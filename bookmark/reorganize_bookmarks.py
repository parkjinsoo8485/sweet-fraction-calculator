#!/usr/bin/env python3
"""
Reorganize Chrome bookmarks HTML file into categorized folders.
Features filtering of unnecessary bookmarks, importance-based sorting,
and parallel checking of dead links (HTTP 404, DNS errors).
"""

import re
import os
import sys
import io
import urllib.request
import urllib.error
import socket
import ssl
from html.parser import HTMLParser
from collections import defaultdict
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configure UTF-8 encoding for standard output streams on Windows
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Fallback for Python versions < 3.7
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

INPUT_FILE = r"c:\Users\jinso\Desktop\새 폴더 (3)\bookmarks_26. 6. 5..html"
OUTPUT_FILE = r"c:\Users\jinso\Desktop\새 폴더 (3)\bookmarks_reorganized.html"

class Bookmark:
    def __init__(self, url, title, add_date="", icon=""):
        self.url = url
        self.title = title
        self.add_date = add_date
        self.icon = icon

class BookmarkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.bookmarks = []
        self.current_url = None
        self.current_attrs = {}
        self.in_a = False
        self.current_title = ""
    
    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'a':
            self.in_a = True
            self.current_title = ""
            attrs_dict = dict(attrs)
            self.current_url = attrs_dict.get('href', '')
            self.current_attrs = attrs_dict
    
    def handle_data(self, data):
        if self.in_a:
            self.current_title += data
    
    def handle_endtag(self, tag):
        if tag.lower() == 'a' and self.in_a:
            self.in_a = False
            if self.current_url:
                bm = Bookmark(
                    url=self.current_url,
                    title=self.current_title.strip(),
                    add_date=self.current_attrs.get('add_date', ''),
                    icon=self.current_attrs.get('icon', '')
                )
                self.bookmarks.append(bm)
            self.current_url = None
            self.current_attrs = {}
            self.current_title = ""


def is_unnecessary(bm):
    """
    Determine if a bookmark is unnecessary based on simple textual patterns.
    """
    url = bm.url.lower().strip()
    title = bm.title.lower().strip()
    
    if not url or not title:
        return True
        
    if url.startswith('file:///'):
        return True
        
    if url.startswith('chrome://') or url.startswith('chrome-extension://'):
        return True
        
    search_indicators = [
        'google.com/search?', 'search.naver?', 'search.daum.net?',
        'search.danawa.com', 'coupang.com/np/search', 'aliexpress.com/wholesale',
        'search.php?', 'totalsearch/hometotalsearch.do', 'xmanual/search/'
    ]
    if any(ind in url for ind in search_indicators):
        return True
        
    ad_indicators = [
        'click.linkprice.com', 'ad.naver.com', 'link.coupang.com', 'adclick', 'ad_group='
    ]
    if any(ind in url for ind in ad_indicators):
        return True
        
    return False


def check_url_status(bm):
    """
    Pings a URL to check if it's dead (e.g. 404, DNS error).
    Returns (Bookmark, is_alive, reason)
    """
    url = bm.url
    url_lower = url.lower()
    
    # 1. Educatonal, Gov, Local and Key service bypass (Always Keep)
    bypass_domains = [
        '.go.kr', '.es.kr', '.ms.kr', '.hs.kr', '.ac.kr', 'neis', '나이스',
        'localhost', '127.0.0.1', 'sharepoint.com', 'office.com', 'microsoft.com',
        'google.com/spreadsheets', 'docs.google.com'
    ]
    if any(dom in url_lower for dom in bypass_domains):
        return bm, True, 'Bypassed (Edu/Gov/Intranet/Local)'
        
    # 2. HEAD Request
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    req = urllib.request.Request(url, headers=headers, method='HEAD')
    
    try:
        with urllib.request.urlopen(req, timeout=3.0, context=ctx) as response:
            return bm, True, f'HTTP {response.status} (HEAD)'
    except urllib.error.HTTPError as e:
        # 404 and 410 are definitely dead.
        if e.code in (404, 410):
            return bm, False, f'HTTP {e.code} (Dead)'
        # 403 Forbidden / 401 Unauthorized are alive but restricted
        elif e.code in (401, 403):
            return bm, True, f'HTTP {e.code} Keep (Auth Required)'
        # Other errors: retry with GET method (some servers block HEAD)
        else:
            try:
                req_get = urllib.request.Request(url, headers=headers, method='GET')
                # Only read 1 byte to save bandwidth
                with urllib.request.urlopen(req_get, timeout=3.0, context=ctx) as response_get:
                    return bm, True, f'HTTP {response_get.status} (GET)'
            except urllib.error.HTTPError as e2:
                if e2.code in (404, 410):
                    return bm, False, f'HTTP {e2.code} (GET Dead)'
                else:
                    return bm, True, f'HTTP {e2.code} Keep'
            except Exception as ex:
                return bm, True, f'Keep (GET Exception: {str(ex)})'
    except urllib.error.URLError as e:
        # DNS failure or connection refused is likely dead
        reason_str = str(e.reason).lower()
        if 'getaddrinfo failed' in reason_str:
            return bm, False, 'DNS Lookup Failed (Dead)'
        elif 'connection refused' in reason_str:
            return bm, False, 'Connection Refused (Dead)'
        elif 'timed out' in reason_str:
            return bm, False, 'Connection Timed Out (Dead)'
        else:
            return bm, True, f'Keep (URLError: {str(e.reason)})'
    except socket.timeout:
        return bm, False, 'Socket Timeout (Dead)'
    except Exception as e:
        return bm, True, f'Keep (Exception: {str(e)})'


def get_importance_score(bm):
    """
    Returns an importance score (1 = High, 2 = Medium, 3 = Low).
    Important items will be sorted to the top.
    """
    url = bm.url.lower().strip()
    title = bm.title.lower().strip()
    
    clean_url = url.split('://')[-1].split('www.')[-1]
    path_parts = [p for p in clean_url.split('/') if p]
    
    is_main_homepage = len(path_parts) <= 1 or (len(path_parts) == 2 and path_parts[1] in ('', 'index.html', 'index.php', 'main.do', 'index.do'))
    
    importance_keywords = [
        '로그인', 'lms', '포털', '메인', '공식', '홈페이지', '도서관',
        'portal', 'login', 'home', 'dashboard', '대시보드', '관리자'
    ]
    has_importance_keyword = any(kw in title for kw in importance_keywords)
    
    if is_main_homepage or has_importance_keyword:
        return 1
        
    is_deep_link = (len(url) > 150) or ('itemid=' in url) or ('spm=' in url) or ('productlist.main' in url)
    if is_deep_link:
        return 3
        
    return 2


def categorize_bookmark(bm):
    """Categorize a bookmark based on URL and title."""
    url = bm.url.lower()
    title = bm.title.lower()
    combined = url + " " + title
    
    # ===== 교육/학교 관련 =====
    edu_keywords = [
        'sunmoon', '선문대', 'graduate', '대학교', '대학원', '학사종합',
        'education.minecraft', 'education.microsoft', '교육자 센터',
        'microsoft.com/ko-kr/courses', '디비디비스쿨', 'dbdbschool',
        '늘봄', '방과후', '각화초', 'gakhwa', '학교안내',
        '세종학당', '입문', '공지사항', 'graduate.sunmoon',
        'unc.doculink', '증명발급', '대한민국 no.1 전국대학',
        '연제초', '서부초', '초등학교', '고등학교', '중학교'
    ]
    if any(k in combined for k in edu_keywords):
        return "🎓 학교/대학교 (School & University)"
    
    # ===== 교육청/공교육 시스템 =====
    edusys_keywords = [
        'gen.go.kr', '광주광역시교육', '교육정보원', '교육연수원',
        'neis', '나이스', '업무포털', '학교알리미', 'schoolinfo',
        '학교정보공시', '학생정서', 'mom.eduro', '교육자치',
        'eduup', '교육과학연구원', 'gise.gen', '사이버학습',
        'cyber.gedu', 'i-scream', '아이스크림', '원어민 화상', 'native.gen',
        'iedu.knise', '특수교육원', '교원능력', 'keris', '캐리스',
        '개인정보보호', 'privacy.go', 'sec.keris',
        '공직자 통합메일', 'kmmbox', 'mail.korea',
        '의무연수', '교직원 법정', '광주사이버학습',
        '교육정보마당', 'seobu.gen', '유지보수 전담반',
        'help.gen.go.kr', 'intra.privacy', '청소년 인터넷',
        'school14', '전라남도교육청', 'gov.wrks',
        '세인에듀', 'seinedu', 'homelearn', '평생학습',
        '부스트코스', 'boostcourse', 'ssem.re.kr',
        'e학습터', '블렌디드 수업', '과제확인', '클래스룸', 'classroom',
        'teacheron', '티처온', '경기 교사온',
        '임용', '연구대회', '자료전', '교원단체', '교총', 'kfta.or.kr',
        '잇다', 'edunet.net', 'schoolsafe', '학교안전',
        'g-school', 'g스쿨', '교육전문직', '교육청', '교사',
        '티처', 'teacher', '지스쿨', '하이패스', '전문직 시험',
        'e알리미', 'ealimi', 'kice.re.kr', '교육과정평가원',
        'kci.go.kr', '학술지', '한국교원연수원', 'hstudy.co.kr',
        'kofac.re.kr', '창의재단', 'k-mooc', 'kmooc', '농업교육'
    ]
    if any(k in combined for k in edusys_keywords):
        return "🏫 교육청/공교육 시스템 (Education System)"
    
    # ===== 한국어교육/교원 =====
    korean_edu_keywords = [
        'korean.go.kr', 'kteacher', '한국어교원', '한국어 교원',
        '한국교육원', 'kecsf', 'kecdc', 'kecny', 'cakec',
        'auskec', 'atlantakec', '샌프란시스코 한국 교육원',
        '워싱턴 한국교육원', '뉴욕한국교육원',
        'korean.net', '스터디코리안', 'ebook.korean',
        '한국어교수학습', 'kcenter.korean', '어휘 내용 검색',
        '자격 심사', '학위과정', '교육기관',
        '한국교사 자격증', 'klacusa', '캘리포니아',
        '해외학교', 'koreanschool7',
        'fppedu', 'hub.fppedu',
    ]
    if any(k in combined for k in korean_edu_keywords):
        return "🇰🇷 한국어교육/교원 (Korean Language Education)"
    
    # ===== 도서관/독서/전자책 =====
    library_keywords = [
        'library', '도서관', '전자책', 'ebook', 'epub',
        '전자서비스', 'gangnam.go.kr', '강남구통합도서관',
        '영어원서', 'lib.gen.go.kr', 'ebook.sje',
        'issuu', 'zamzar', 'epub to pdf',
        'gen.lib.rus', 'library genesis',
        'smallpdf', 'pdf 변환',
        '북셰어 온라인도서관',
        'bitly', 'app.bitly',
        '크레마클럽', 'cremaclub', 'yes24.com/bookclub'
    ]
    if any(k in combined for k in library_keywords):
        return "📖 도서관/전자책 (Library & E-books)"
    
    # ===== 부동산/주택 =====
    real_estate_keywords = [
        '개포주공', '재건축', '주택', '리모델링', '건축비', '건축',
        '신축', '공매', '온비드', 'onbid', '토지이음', '호갱노노', 'hogangnono',
        '주택담보', '적격대출', 'hf.go.kr', '부동산', '청약', '분양', '아파트',
        '실거래가', '조립식주택', '집수리', '임대주택', '주거급여', '집수리닷컴',
        '주거환경개선', '단독주택', '주택조합', '쉐어하우스', '시니어 쉐어하우스',
        '상수도사업본부', 'water.gwangju.go.kr'
    ]
    if any(k in combined for k in real_estate_keywords):
        return "🏢 부동산/주택 (Real Estate)"
    
    # ===== AI/인공지능 =====
    ai_keywords = [
        'ai.jne', 'aistudio.google', 'aihub', 'ai 허브',
        'ai 맞춤형', '인공지능', 'ai city', 'aicitybuilders',
        'connect ai lab', 'google ai studio', 'api-keys',
        'academy.kisa', 'kisa 아카데미', 'google skills',
        'bigquery', 'ai·디지털', 'aid 30',
        '재직자 ai', 'lifelong.chosun',
        'comfyui', 'stable diffusion', 'huggingface', 'openai',
        'chatgpt', 'anthropic', 'claude', 'ollama',
        'vast.ai', 'runyour.ai', 'gpu',
        'machine-learning', 'ml-intro', 'kaggle', '캐글'
    ]
    if any(k in combined for k in ai_keywords):
        return "🤖 AI/인공지능 (AI & Artificial Intelligence)"
    
    # ===== 프로그래밍/개발 =====
    dev_keywords = [
        'github.com', 'developer.mozilla', 'opentutorials',
        'code.org', 'studio.code', 'codesters', '코딩',
        '생활코딩', 'seomal', '서말', 'wikidocs', 'it 기술노트',
        'ebssw', '이솦', 'sw교육', '소프트웨어 아카데미',
        '안드로이드 프로그래밍', 'android', 'python', '파이썬',
        'web2', 'aws', '무료서버', '개인서버',
        '마인크래프트', 'minecraft', '에듀 스쿨', 'mineedu',
        'second life', 'secondlife', 'agent skill', 'antigravity',
        'gemini', 'github education', 'autocapitalize',
        'html', 'coding', 'entrepreneur.com/article/250323',
        '12 sites that will teach you coding',
        'poloniexlendingbot', 'readthedocs',
        'hicomputing', '초등컴퓨팅교사', 'zep',
        'wonseokjung', 'repository', 'repositories',
        'google for developers', 'googledevelopers',
        'cdn', 'webdeveloper', 'youtube favorites back up',
        '웹 프로그래밍', 'fullstack', '풀스택',
        'bubble.io', 'bubble', 'udemy', '인프런', 'inflearn',
        'no-code', 'nocode', '노코드', 'w3schools',
        'stackoverflow', 'stack overflow', 'jsfiddle', 'codepen', 'replit',
        'appsheet', '앱시트', 'roblox', '로블록스', '패스트캠퍼스', 'fastcampus', 'matplotlib'
    ]
    if any(k in combined for k in dev_keywords):
        return "💻 프로그래밍/개발 (Programming & Development)"
    
    # ===== 언어학습 (영어/포어/중국어 등) =====
    lang_keywords = [
        'eslfast', 'english level', 'bbc.co.uk/learningenglish',
        'britishcouncil', 'memrise', 'hellotalk',
        'learn english', 'english grammar', 'collocation',
        'efset', 'storylineonline', 'toeic', 'ybmbooks',
        'merriam-webster', '영어문법', '가정법',
        '영어회화', 'tv series', 'english conversation',
        'pdfdrive.com', 'conversational',
        'michaelis', 'conjugator.reverso', 'conjugation',
        'porta dos fundos', '포어학습',
        'lelivros', 'lunetas', 'dominiopublico', 'linguadagente',
        'baixelivros', 'tudo bem', 'livrariasbs',
        'portuguesparaestrangeiro', '365 common portuguese',
        '중국어말하기대회', '니하오',
        'easypacelearning', 'pdfdrive',
        'sachtoeic', 'invest-digest',
        'lkoass', '일본어', 'jlpt', 'japanesejlpt', 'kanji',
        '입트영', '困知',
        'hada.io', 'geek', '개발/기술/스타트업',
        '고사성어', '사자성어',
        'flex', 'hufs.ac.kr', '특수외국어', '능력평가',
        'youglish'
    ]
    if any(k in combined for k in lang_keywords):
        return "📚 어학/언어학습 (Language Learning)"
    
    # ===== 암호화폐/블록체인 =====
    crypto_keywords = [
        'bitcoin', 'miningpoolhub', 'rocketpool', 'ethereum',
        'poloniex', 'binance', '빗썸', 'bithumb', '2p1d',
        'steemit', 'crypto', 'flipsidecrypto', '코인',
        'korcoin', '랜딩봇', 'lending', 'passive profits',
        '채굴', 'mining', 'h81a', 'btc', 'ddengle', '땡글',
        'hashrate', '해시', 'pancakeswap', 'chainlist', 'dapp'
    ]
    if any(k in combined for k in crypto_keywords):
        return "₿ 암호화폐/블록체인 (Cryptocurrency)"
    
    # ===== 쇼핑 =====
    shopping_keywords = [
        'coupang.com', '쿠팡', 'aliexpress', '알리익스프레스',
        '11st.co.kr', '11번가', 'auction.co.kr', '옥션',
        'submarino', 'wemakeprice', '위메프',
        'halfclub', '하프클럽', 'wedisk',
        'be-happy', '행복한나눔', 'ubiqnet',
        '아덴', 'i-arden', 'joonggonara', '중고나라',
        '태극명찰', '마사지기', '스파알', '쇼핑몰',
        'gmarket', '지마켓', '스마트스토어', 'smartstore'
    ]
    if any(k in combined for k in shopping_keywords):
        return "🛒 쇼핑 (Shopping)"
    
    # ===== IT 하드웨어/기기 =====
    hw_keywords = [
        'ssd', 'm.2', 'ngff', 'sata', '외장케이스', '컨버터',
        '어댑터', 'adapter', '갤럭시', 'galaxy',
        '루팅', '벽돌', '커스텀롬', '리커버리', 'cwm',
        'omnirom', 'cyanogenmod', '노트북 윈도우', '드라이버',
        'samsung.com/sec/support', 'driverscape',
        '잉크패드', 'lcd', 'led', 'ad보드', '모니터diy',
        '충전기', 'usb충전기', '건조기',
        '팬 소음', '방열', '급지롤러', '8100',
        '와이퍼', '카매트', '시트', '캐노픽스',
        '액정수리', 'smart119', '갤럭시탭', '홈버튼',
        'lcd 디스플레이', '터치 스크린', 'amoled',
        'rasp', '라즈베리 파이', '레트로 게임기',
        'canon g3111', 'driver', '프린터',
        'dm-v600', 'r59', 'r60', 'cpu master',
        'sens r60',
        'ip-255', '인터넷키폰', '텔링크',
        'oreilly', 'library access', 'o\'reilly',
        'www-oreilly-com',
        '디바이스마트', 'devicemart', '라즈베리', 'raspberry',
        '모니터암', '복합기', '렌탈', 'usb3', 'usb 3',
        '다나와', 'danawa', '마우스', '키보드', '공구',
        '에이수스', 'asus', '기가바이트', 'gigabyte',
        '인텔', 'intel', 'amd', '엔비디아', 'nvidia',
        '메인보드', '그래픽카드'
    ]
    if any(k in combined for k in hw_keywords):
        return "🔧 IT 하드웨어/기기 (IT Hardware & Devices)"
    
    # ===== 동영상/미디어/유튜브 =====
    media_keywords = [
        'youtube.com', 'youtu.be', 'youku.com',
        'netflix', 'ttsmaker', '텍스트 음성',
        'ustvgo', '동화', '구연동화',
        'spotify', '스포티파이', '녹화', 'bandicam',
        '가유아녀', '家有儿女', '유플레이어', 'youplayer'
    ]
    if any(k in combined for k in media_keywords):
        return "🎬 미디어/영상 (Media & Video)"
    
    # ===== 정부/공공/민원 =====
    gov_keywords = [
        'korail', '코레일', '110.go.kr', '정부민원',
        'nhuf.molit', '주택도시기금', 'seogu.gwangju', '서구청', '상담신청',
        'moe.go.kr', '교육부', '말레이시아한국국제학교',
        'unrecruit.mofa', '국제기구', '외교부',
        'koica', 'oda', '국제협력',
        'bizno.net', '사업자번호',
        '광주국제교류', 'gic.or.kr',
        '광주시', '광주도시공사', 'gmcc',
        '대피소', '국립공원',
        '갑질피해', '공연장안전', 'stagesafety',
        'nongsaro', '농사로', '공무원',
        '공무원 유학', '동반휴직',
        '재외동포재단', 'cecsp',
        'gen365', 'sharepoint', '비상연락망',
        '수련휴양시설', '전자 필기장',
        '고시넷', 'gosinet',
        '서울시', '도봉구', 'kdp.aks.ac.kr', '구비문학',
        '해양에너지', 'kepco', '한국전력', '전기요금',
        '나라장터', 'g2b', '도시재생', '도시공사',
        'scourt.go.kr', '가족관계', '정부24',
        'gov.kr', 'fss.or.kr', '금융감독원', 'niceipin', '아이핀',
        '장애인 등록'
    ]
    if any(k in combined for k in gov_keywords):
        return "🏛️ 정부/공공/민원 (Government & Public Services)"
    
    # ===== 금융/결제 =====
    finance_keywords = [
        'wooribank', '우리은행', 'receita.fazenda',
        'cpf', 'comgas', 'vivo.com.br', 'claro.com.br',
        'minhaclaroresidencial', 'meuvivo', 'comgás',
        '각종공과금', '2° via fatura', 'fatura',
        '은행', 'kbstar', '국민은행', '신한은행', '하나은행',
        '카카오뱅크', '토스'
    ]
    if any(k in combined for k in finance_keywords):
        return "💰 금융/결제 (Finance & Payment)"
    
    # ===== 추천서/학생부/입시 =====
    admission_keywords = [
        '추천서', '자기소개서', '자소서', '교사추천서',
        '학생부', '세특', '학교장 추천서',
        '재외국민', '특례', '특별전형',
        '수시장인', '에듀진',
        '면접', '고시넷',
    ]
    if any(k in combined for k in admission_keywords):
        return "📝 입시/추천서/학생부 (Admissions)"
    
    # ===== 종교/철학 =====
    religion_keywords = [
        '반야심경', '육조단경', '도덕경', '노자',
        '불교', '천수경', '重玄学', '众妙',
        '성철', '근기', '사또', '동화여행',
        'fellowship', 'church', 'christian',
        '남미복음', '복음선교',
    ]
    if any(k in combined for k in religion_keywords):
        return "🙏 종교/철학 (Religion & Philosophy)"
    
    # ===== 의료/건강 =====
    health_keywords = [
        '병원', 'hospital', 'cnubh', '한의원', 'himiz',
        '관절', '약초', '두충나무', 'suwanhospital',
        '한국병원', '건강', '질병', '약국'
    ]
    if any(k in combined for k in health_keywords):
        return "🏥 의료/건강 (Health & Medical)"
    
    # ===== 부동산/생활 =====
    life_keywords = [
        '에어비앤비', 'airbnb', '에어바운스', '행사 사례', '판촉물', 'skygift',
        '캐나다 간호사', '간호조무사', '이민',
        '약초천국', '장흥',
        '하늘판촉물',
        '자서전', '어르신',
        '곡성', '섬진강', '천문대',
        'canon creative park', '종이 공예',
        '자기주도학습',
        '국제학교', '채용',
        'indeed', 'kr.indeed', '한국어 강사',
        '시니어', '쉐어하우스', '고령친화', '주택조합',
        '법무법인', '이사', '가족요양', '숨고', 'soomgo', '개조'
    ]
    if any(k in combined for k in life_keywords):
        return "🏠 생활/기타 (Life & Misc)"
    
    # ===== 중국 관련 =====
    china_keywords = [
        'chinatalk', '차이나톡', 'naifei', '百度',
        '中国签证', 'visaforchina', '중국비자',
        'kuwomusic', '酷我', '중국 생활',
        '가유아녀', '家有儿女',
    ]
    if any(k in combined for k in china_keywords):
        return "🇨🇳 중국 관련 (China Related)"
 
    # ===== 한글/문서 작성 =====
    doc_keywords = [
        'hantip', '한글문서', '개요와 스타일', '보고서',
        'google.com/spreadsheets', 'google sheets',
        'docs.google',
        '한컴', '한글 도움말', '한글 단축키', 'hwp', 'pdf',
        'powerpoint', 'excel', '엑셀'
    ]
    if any(k in combined for k in doc_keywords):
        return "📄 문서 작성/도구 (Documents & Tools)"
    
    # ===== 기타 레거시/오래된 북마크 =====
    legacy_keywords = [
        'nolzzang', '무한전투', 'dbdbdeep', '미스터하이',
        'iamschool', 'iamhere', '어린이안심',
        'graphai', '헬라인',
        '프로젝터', 'epson',
        'uexpress', 'dear abby',
    ]
    if any(k in combined for k in legacy_keywords):
        return "🗄️ 기타/미분류 (Others)"
    
    return "🗄️ 기타/미분류 (Others)"


def subcategorize_bookmark(bm, parent_cat):
    """
    Subcategorize a bookmark under a parent category.
    Returns the subfolder name, or None if it belongs to the parent directly.
    """
    url = bm.url.lower()
    title = bm.title.lower()
    combined = url + " " + title

    if parent_cat == "🏫 교육청/공교육 시스템 (Education System)":
        # 📁 교육청 행정/연수원 (Administration & Training)
        admin_keywords = [
            'gen.go.kr', '광주광역시교육', '교육정보원', '교육연수원',
            'neis', '나이스', '업무포털', '학교알리미', 'schoolinfo',
            '학교정보공시', '학생정서', 'mom.eduro', '교육자치',
            'gise.gen', 'keris', '캐리스', '개인정보보호', 'privacy.go',
            'sec.keris', '공직자 통합메일', 'kmmbox', 'mail.korea',
            'seobu.gen', '유지보수 전담반', 'help.gen.go.kr', 'intra.privacy',
            'gov.wrks', 'schoolsafe', '학교안전', 'e알리미', 'ealimi',
            'kice.re.kr', '교육과정평가원', '교육전문직', '교육청'
        ]
        # 📁 교사 임용/전문직 시험 (Teacher Exams)
        exam_keywords = [
            '임용', '연구대회', '자료전', '교원단체', '교총', 'kfta.or.kr',
            'g-school', 'g스쿨', '교사 시험', '티처', 'teacher', '지스쿨',
            '하이패스', '전문직 시험', '의무연수', '교직원 법정'
        ]
        # 📁 온라인 학습/수업 (Online Learning)
        learning_keywords = [
            'eduup', '교육과학연구원', '사이버학습', 'cyber.gedu',
            'i-scream', '아이스크림', '원어민 화상', 'native.gen',
            'iedu.knise', '특수교육원', '교원능력', '광주사이버학습',
            '교육정보마당', '청소년 인터넷', 'school14', '전라남도교육청',
            '세인에듀', 'seinedu', 'homelearn', '평생학습', '부스트코스',
            'boostcourse', 'ssem.re.kr', 'e학습터', '블렌디드 수업',
            '과제확인', '클래스룸', 'classroom', 'teacheron', '티처온',
            '경기 교사온', '잇다', 'edunet.net', 'kci.go.kr', '학술지',
            '한국교원연수원', 'hstudy.co.kr', 'kofac.re.kr', '창의재단',
            'k-mooc', 'kmooc', '농업교육'
        ]
        
        if any(k in combined for k in exam_keywords):
            return "📁 교사 임용/전문직 시험 (Teacher Exams)"
        if any(k in combined for k in admin_keywords):
            return "📁 교육청 행정/연수원 (Administration & Training)"
        if any(k in combined for k in learning_keywords):
            return "📁 온라인 학습/수업 (Online Learning)"
        return "📁 일반 공교육 자료 (General Edu System)"

    elif parent_cat == "🎓 학교/대학교 (School & University)":
        # 📁 대학교/대학원 (University & Graduate)
        univ_keywords = [
            'sunmoon', '선문대', 'graduate', '대학교', '대학원',
            '학사종합', 'graduate.sunmoon', '대한민국 no.1 전국대학'
        ]
        # 📁 초/중/고등학교 (K-12 School)
        k12_keywords = [
            '각화초', 'gakhwa', '학교안내', '연제초', '서부초',
            '초등학교', '고등학교', '중학교'
        ]
        # 📁 한국어 학당/기타 (Korean Language & Misc)
        korean_school_keywords = [
            '세종학당', '입문', 'unc.doculink', '증명발급',
            'education.minecraft', 'education.microsoft', '교육자 센터',
            'microsoft.com/ko-kr/courses', '디비디비스쿨', 'dbdbschool',
            '늘봄', '방과후'
        ]
        
        if any(k in combined for k in univ_keywords):
            return "📁 대학교/대학원 (University & Graduate)"
        if any(k in combined for k in k12_keywords):
            return "📁 초/중/고등학교 (K-12 School)"
        if any(k in combined for k in korean_school_keywords):
            return "📁 한국어 학당/기타 (Korean Language & Misc)"
        return "📁 일반 학교 정보 (General School)"

    elif parent_cat == "🏢 부동산/주택 (Real Estate)":
        # 📁 공매/경매/실거래가 (Auctions & Prices)
        auction_keywords = [
            '공매', '경매', '온비드', 'onbid', '실거래가', '호갱노노', 'hogangnono'
        ]
        # 📁 청약/임대/주택금융 (Loans & Subscription)
        loan_keywords = [
            '주택담보', '적격대출', 'hf.go.kr', '청약', '분양', '임대주택',
            '주거급여', '주택도시기금', 'nhuf.molit'
        ]
        # 📁 건축/리모델링/집수리 (Renovation & Building)
        renovation_keywords = [
            '개포주공', '재건축', '리모델링', '건축비', '건축', '신축',
            '조립식주택', '집수리', '집수리닷컴', '주거환경개선',
            '단독주택', '주택조합', '개조'
        ]
        # 📁 부동산 생활/기타 (General Real Estate)
        life_keywords = [
            '쉐어하우스', '시니어 쉐어하우스', '상수도사업본부',
            'water.gwangju.go.kr', '토지이음'
        ]
        
        if any(k in combined for k in auction_keywords):
            return "📁 공매/경매/실거래가 (Auctions & Prices)"
        if any(k in combined for k in loan_keywords):
            return "📁 청약/임대/주택금융 (Loans & Subscription)"
        if any(k in combined for k in renovation_keywords):
            return "📁 건축/리모델링/집수리 (Renovation & Building)"
        if any(k in combined for k in life_keywords):
            return "📁 부동산 생활/기타 (General Real Estate)"
        return "📁 일반 부동산 (General Real Estate)"

    elif parent_cat == "💻 프로그래밍/개발 (Programming & Development)":
        # 📁 SW 코딩 교육/하드웨어 (Coding Education)
        edu_keywords = [
            'code.org', 'studio.code', 'codesters', '코딩교육',
            'sw교육', '소프트웨어 아카데미', '마인크래프트', 'minecraft',
            '에듀 스쿨', 'mineedu', '초등컴퓨팅교사', 'hicomputing',
            'sw 교육', 'ebssw', '이솦'
        ]
        # 📁 노코드/앱 빌더 (No-code & App Builders)
        nocode_keywords = [
            'bubble.io', 'bubble', 'no-code', 'nocode', '노코드',
            'appsheet', '앱시트', 'zep'
        ]
        # 📁 개발 도구/플랫폼 (Developer Tools)
        tool_keywords = [
            'github.com', 'repository', 'repositories', 'github education',
            'wonseokjung', 'jsfiddle', 'codepen', 'replit', 'github'
        ]
        # 📁 프로그래밍 언어/학습 (Languages & Tutorials)
        lang_keywords = [
            'python', '파이썬', 'html', 'javascript', 'js', 'css',
            'w3schools', 'stackoverflow', 'stack overflow', 'opentutorials',
            '생활코딩', 'seomal', '서말', 'wikidocs', 'it 기술노트',
            'developer.mozilla', 'udemy', '인프런', 'inflearn', '패스트캠퍼스',
            'fastcampus', 'matplotlib', 'roblox', '로블록스'
        ]
        
        if any(k in combined for k in edu_keywords):
            return "📁 SW 코딩 교육/하드웨어 (Coding Education)"
        if any(k in combined for k in nocode_keywords):
            return "📁 노코드/앱 빌더 (No-code & App Builders)"
        if any(k in combined for k in tool_keywords):
            return "📁 개발 도구/플랫폼 (Developer Tools)"
        if any(k in combined for k in lang_keywords):
            return "📁 프로그래밍 언어/학습 (Languages & Tutorials)"
        return "📁 일반 개발 자료 (General Dev)"

    elif parent_cat == "📚 어학/언어학습 (Language Learning)":
        # 📁 영어 학습 (English)
        eng_keywords = [
            'eslfast', 'english level', 'bbc.co.uk/learningenglish',
            'britishcouncil', 'learn english', 'english grammar',
            'collocation', 'efset', 'storylineonline', 'toeic',
            'ybmbooks', 'merriam-webster', '영어문법', '가정법',
            '영어회화', 'english conversation', 'youglish', '입트영'
        ]
        # 📁 포르투갈어 학습 (Portuguese)
        port_keywords = [
            'michaelis', 'conjugator.reverso', 'conjugation',
            'porta dos fundos', '포어학습', 'lelivros', 'lunetas',
            'dominiopublico', 'linguadagente', 'baixelivros', 'tudo bem',
            'livrariasbs', 'portuguesparaestrangeiro', '365 common portuguese'
        ]
        # 📁 기타 외국어/사전 (Other Languages)
        other_keywords = [
            '중국어말하기대회', '니하오', '일본어', 'jlpt', 'japanesejlpt',
            'kanji', 'flex', 'hufs.ac.kr', '특수외국어', '능력평가',
            '고사성어', '사자성어'
        ]
        
        if any(k in combined for k in eng_keywords):
            return "📁 영어 학습 (English)"
        if any(k in combined for k in port_keywords):
            return "📁 포르투갈어 학습 (Portuguese)"
        if any(k in combined for k in other_keywords):
            return "📁 기타 외국어/사전 (Other Languages)"
        return "📁 일반 어학 (General Language)"

    elif parent_cat == "📖 도서관/전자책 (Library & E-books)":
        # 📁 전자책/북클럽 (E-books)
        ebook_keywords = [
            '전자책', 'ebook', 'epub', '크레마클럽', 'cremaclub',
            'yes24.com/bookclub', 'lelivros', 'baixelivros'
        ]
        # 📁 공공/대학 도서관 (Libraries)
        lib_keywords = [
            'library', '도서관', 'gangnam.go.kr', '강남구통합도서관',
            'lib.gen.go.kr', 'ebook.sje', '북셰어 온라인도서관'
        ]
        # 📁 문서 변환/자료 검색 (Converter & Resources)
        conv_keywords = [
            'issuu', 'zamzar', 'epub to pdf', 'gen.lib.rus',
            'library genesis', 'smallpdf', 'pdf 변환'
        ]
        
        if any(k in combined for k in ebook_keywords):
            return "📁 전자책/북클럽 (E-books)"
        if any(k in combined for k in lib_keywords):
            return "📁 공공/대학 도서관 (Libraries)"
        if any(k in combined for k in conv_keywords):
            return "📁 문서 변환/자료 검색 (Converter & Resources)"
        return "📁 일반 도서 정보 (General Library)"
        
    return None


def remove_duplicates(bookmarks):
    """
    Remove duplicate bookmarks based on normalized URL.
    This normalizing trims trailing slashes and query parameter orders where possible.
    """
    seen_urls = set()
    unique = []
    for bm in bookmarks:
        # Normalize URL to catch duplicates like http://site.com and https://site.com/
        normalized = bm.url.strip().lower()
        normalized = normalized.replace('https://', 'http://')
        normalized = normalized.rstrip('/')
        
        if normalized not in seen_urls:
            seen_urls.add(normalized)
            unique.append(bm)
    return unique


def _escape_title(title):
    """Escape HTML entities in a bookmark title without double-escaping."""
    safe = title.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    safe = safe.replace('&amp;amp;', '&amp;')
    safe = safe.replace('&amp;lt;', '&lt;')
    safe = safe.replace('&amp;gt;', '&gt;')
    safe = safe.replace('&amp;#39;', '&#39;')
    safe = safe.replace('&amp;quot;', '&quot;')
    return safe


def _write_bookmark_line(lines, bm, indent):
    """Append a single bookmark <A> line at the given indent level."""
    icon_attr = f' ICON="{bm.icon}"' if bm.icon else ''
    add_date_attr = f' ADD_DATE="{bm.add_date}"' if bm.add_date else ''
    safe_title = _escape_title(bm.title)
    pad = '    ' * indent
    lines.append(f'{pad}<DT><A HREF="{bm.url}"{add_date_attr}{icon_attr}>{safe_title}</A>')


def generate_bookmarks_html(categorized_nested, output_path):
    """
    Generate a Chrome-compatible bookmarks HTML file with nested subcategory folders.
    categorized_nested: dict of { category_name: { subcategory_name_or_None: [Bookmark, ...] } }
    """
    now_ts = str(int(datetime.now().timestamp()))
    
    lines = []
    lines.append('<!DOCTYPE NETSCAPE-Bookmark-file-1>')
    lines.append('<!-- This is an automatically generated file.')
    lines.append('     It will be read and overwritten.')
    lines.append('     DO NOT EDIT! -->')
    lines.append('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">')
    lines.append('<TITLE>Bookmarks</TITLE>')
    lines.append('<H1>Bookmarks</H1>')
    lines.append('<DL><p>')
    lines.append(f'    <DT><H3 ADD_DATE="{now_ts}" LAST_MODIFIED="{now_ts}" PERSONAL_TOOLBAR_FOLDER="true">북마크바</H3>')
    lines.append('    <DL><p>')
    
    # Category Order prioritizing User's core interests (Education, E-books, Real Estate)
    category_order = [
        "🏫 교육청/공교육 시스템 (Education System)",
        "🎓 학교/대학교 (School & University)",
        "🇰🇷 한국어교육/교원 (Korean Language Education)",
        "📖 도서관/전자책 (Library & E-books)",
        "🏢 부동산/주택 (Real Estate)",
        "🤖 AI/인공지능 (AI & Artificial Intelligence)",
        "💻 프로그래밍/개발 (Programming & Development)",
        "📚 어학/언어학습 (Language Learning)",
        "📄 문서 작성/도구 (Documents & Tools)",
        "📝 입시/추천서/학생부 (Admissions)",
        "🏛️ 정부/공공/민원 (Government & Public Services)",
        "💰 금융/결제 (Finance & Payment)",
        "🏥 의료/건강 (Health & Medical)",
        "🎬 미디어/영상 (Media & Video)",
        "🙏 종교/철학 (Religion & Philosophy)",
        "🇨🇳 중국 관련 (China Related)",
        "🏠 생활/기타 (Life & Misc)",
        "₿ 암호화폐/블록체인 (Cryptocurrency)",
        "🛒 쇼핑 (Shopping)",
        "🔧 IT 하드웨어/기기 (IT Hardware & Devices)",
        "🗄️ 기타/미분류 (Others)",
    ]
    
    sorted_categories = []
    for cat in category_order:
        if cat in categorized_nested:
            sorted_categories.append(cat)
    # Add any remaining categories
    for cat in sorted(categorized_nested.keys()):
        if cat not in sorted_categories:
            sorted_categories.append(cat)
    
    total_bookmarks = 0
    total_subcategories = 0
    
    for category in sorted_categories:
        subcats = categorized_nested[category]
        
        # Calculate total bookmarks in this parent category
        cat_total = sum(len(bms) for bms in subcats.values())
        if cat_total == 0:
            continue
            
        total_bookmarks += cat_total
        
        # Open category folder
        lines.append(f'        <DT><H3 ADD_DATE="{now_ts}" LAST_MODIFIED="{now_ts}">{category} [{cat_total}개]</H3>')
        lines.append('        <DL><p>')
        
        # Sort subcategories, putting None (directly under parent) at the end
        subcat_keys = sorted([k for k in subcats.keys() if k is not None])
        if None in subcats:
            subcat_keys.append(None)
            
        for subcat_key in subcat_keys:
            bms = subcats[subcat_key]
            if not bms:
                continue
            
            # Sort bookmarks within subfolder by importance rank, then by title
            bms.sort(key=lambda b: (get_importance_score(b), b.title.lower()))
            
            if subcat_key is not None:
                total_subcategories += 1
                lines.append(f'            <DT><H3 ADD_DATE="{now_ts}" LAST_MODIFIED="{now_ts}">{subcat_key} [{len(bms)}개]</H3>')
                lines.append('            <DL><p>')
                for bm in bms:
                    _write_bookmark_line(lines, bm, indent=4)
                lines.append('            </DL><p>')
            else:
                # Direct bookmarks in category folder
                for bm in bms:
                    _write_bookmark_line(lines, bm, indent=3)
                    
        # Close category folder
        lines.append('        </DL><p>')
    
    lines.append('    </DL><p>')
    lines.append('</DL><p>')
    
    content = '\n'.join(lines)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return total_bookmarks, len(sorted_categories), total_subcategories


def main():
    print("=" * 60)
    print("📂 북마크 재분류 및 필터링 도구 (Bookmark Reorganizer)")
    print("=" * 60)
    
    # Read input file
    print(f"\n📖 입력 파일 읽는 중: {INPUT_FILE}")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse bookmarks
    print("🔍 북마크 파싱 중...")
    parser = BookmarkParser()
    parser.feed(content)
    
    total_raw = len(parser.bookmarks)
    print(f"   → 발견된 북마크: {total_raw}개")
    
    # Remove duplicates
    print("🧹 중복 제거 중...")
    unique_bookmarks = remove_duplicates(parser.bookmarks)
    removed_dupes = total_raw - len(unique_bookmarks)
    print(f"   → 중복 제거: {removed_dupes}개")
    
    # Filter unnecessary bookmarks (text patterns)
    print("🗑️ 1차 텍스트 필터링 (불필요 패턴 제외)...")
    filtered_bookmarks = []
    ignored_count = 0
    for bm in unique_bookmarks:
        if is_unnecessary(bm):
            ignored_count += 1
        else:
            filtered_bookmarks.append(bm)
            
    print(f"   → 필터링된 불필요 항목: {ignored_count}개")
    print(f"   → 1차 생존 북마크: {len(filtered_bookmarks)}개")
    
    # Check link health (dead links checker using multi-threading)
    print("\n🌐 2차 링크 유효성 검증 시작 (접속 확인)...")
    print("   ※ 멀티스레드 방식으로 약 2,000개 링크의 접속 상태를 병렬로 확인합니다.")
    print("   ※ 교육청, 정부, 주요 서비스(Microsoft/Google 등)는 접속 지연 시에도 자동 보존됩니다.")
    
    alive_bookmarks = []
    dead_bookmarks_count = 0
    
    # We use ThreadPoolExecutor to verify connections in parallel.
    total_to_check = len(filtered_bookmarks)
    progress_step = max(1, total_to_check // 20)  # Log every 5%
    
    with ThreadPoolExecutor(max_workers=80) as executor:
        # Submit check jobs
        futures = {executor.submit(check_url_status, bm): bm for bm in filtered_bookmarks}
        
        checked_count = 0
        for future in as_completed(futures):
            bm, is_alive, reason = future.result()
            checked_count += 1
            
            if is_alive:
                alive_bookmarks.append(bm)
            else:
                dead_bookmarks_count += 1
            
            if checked_count % progress_step == 0 or checked_count == total_to_check:
                percent = (checked_count / total_to_check) * 100
                print(f"   → 진행률: {checked_count}/{total_to_check} ({percent:.1f}%) | 누적 삭제됨: {dead_bookmarks_count}개")
                
    print(f"\n✅ 링크 유효성 검증 완료!")
    print(f"   → 접속 불가/삭제된 링크: {dead_bookmarks_count}개 삭제 완료")
    print(f"   → 최종 유효 북마크: {len(alive_bookmarks)}개")
    
    # Categorize
    print("\n📁 카테고리별 분류 및 중요도 매기는 중...")
    categorized = defaultdict(list)
    for bm in alive_bookmarks:
        category = categorize_bookmark(bm)
        categorized[category].append(bm)
        
    # Subcategorize within each category
    print("📂 하위 카테고리 세부 분류 중...")
    categorized_nested = {}
    
    # 6대 핵심 카테고리 정의
    subcat_parents = {
        "🏫 교육청/공교육 시스템 (Education System)",
        "🎓 학교/대학교 (School & University)",
        "🏢 부동산/주택 (Real Estate)",
        "💻 프로그래밍/개발 (Programming & Development)",
        "📚 어학/언어학습 (Language Learning)",
        "📖 도서관/전자책 (Library & E-books)"
    }
    
    for cat, bookmarks in categorized.items():
        categorized_nested[cat] = defaultdict(list)
        for bm in bookmarks:
            if cat in subcat_parents:
                subcat = subcategorize_bookmark(bm, cat)
                categorized_nested[cat][subcat].append(bm)
            else:
                categorized_nested[cat][None].append(bm)
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 분류 및 필터링 결과 요약")
    print("=" * 60)
    
    # Sort categories by total count
    sorted_cats_by_size = sorted(
        categorized_nested.keys(),
        key=lambda c: -sum(len(bms) for bms in categorized_nested[c].values())
    )
    
    for cat in sorted_cats_by_size:
        subcats = categorized_nested[cat]
        cat_total = sum(len(bms) for bms in subcats.values())
        bar = "█" * min(cat_total, 50)
        print(f"  {cat}: {cat_total}개 {bar}")
        
        # Print subcategory details
        subcat_keys = sorted([k for k in subcats.keys() if k is not None])
        for sc_key in subcat_keys:
            sc_count = len(subcats[sc_key])
            print(f"    └─ {sc_key}: {sc_count}개")
        if None in subcats and len(subcats[None]) > 0:
            # If the category is one of the nested ones, show direct placements as "Others/Misc"
            if cat in subcat_parents:
                print(f"    └─ 📁 기타/미분류 세부 항목: {len(subcats[None])}개")
    
    # Generate output
    print(f"\n💾 재분류된 북마크 저장 중: {OUTPUT_FILE}")
    total, num_cats, num_subcats = generate_bookmarks_html(categorized_nested, OUTPUT_FILE)
    
    print(f"\n✅ 완료!")
    print(f"   → 총 {total}개 북마크를 {num_cats}개 카테고리, {num_subcats}개 하위 폴더로 정리했습니다. (하위 폴더 중첩 완료)")
    print(f"   → 출력 파일: {OUTPUT_FILE}")
    print(f"\n💡 Chrome에서 가져오기:")
    print(f"   1. Chrome 열기 → 북마크 관리자 (Ctrl+Shift+O)")
    print(f"   2. 우측 상단 ⋮ → '북마크 가져오기'")
    print(f"   3. 생성된 파일 선택")


if __name__ == '__main__':
    main()
