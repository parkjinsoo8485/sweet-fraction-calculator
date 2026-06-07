// Category order mapping
const CATEGORY_ORDER = [
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
  "🗄️ 기타/미분류 (Others)"
];

const SUBCAT_PARENTS = new Set([
  "🏫 교육청/공교육 시스템 (Education System)",
  "🎓 학교/대학교 (School & University)",
  "🏢 부동산/주택 (Real Estate)",
  "💻 프로그래밍/개발 (Programming & Development)",
  "📚 어학/언어학습 (Language Learning)",
  "📖 도서관/전자책 (Library & E-books)"
]);

// UI Elements
const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');
const optionsPanel = document.getElementById('optionsPanel');
const progressPanel = document.getElementById('progressPanel');
const resultPanel = document.getElementById('resultPanel');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const progressStatus = document.getElementById('progressStatus');
const progressSubtext = document.getElementById('progressSubtext');
const resultSummary = document.getElementById('resultSummary');
const statList = document.getElementById('statList');

const optNewFolder = document.getElementById('optNewFolder');
const optCheckDead = document.getElementById('optCheckDead');

// Start process
btnStart.addEventListener('click', startReorganization);
btnReset.addEventListener('click', resetUI);

function resetUI() {
  optionsPanel.classList.remove('hidden');
  progressPanel.classList.add('hidden');
  resultPanel.classList.add('hidden');
  progressBar.style.width = '0%';
  progressPercent.textContent = '0%';
  statList.innerHTML = '';
}

async function startReorganization() {
  optionsPanel.classList.add('hidden');
  progressPanel.classList.remove('hidden');
  
  updateProgress('북마크 검색 중...', 5, '현재 저장된 모든 북마크를 스캔하고 있습니다.');

  try {
    // 1. Get entire bookmark tree
    const rootNodes = await chrome.bookmarks.getTree();
    const flatBookmarks = [];
    extractBookmarks(rootNodes[0], flatBookmarks);

    updateProgress('분석 중...', 15, `총 ${flatBookmarks.length}개의 북마크 발견. 중복 및 정크 검출 중...`);

    // 2. Remove duplicates (Normalize URL)
    const uniqueMap = new Map();
    let duplicateCount = 0;
    for (const bm of flatBookmarks) {
      const normUrl = normalizeUrl(bm.url);
      if (uniqueMap.has(normUrl)) {
        duplicateCount++;
      } else {
        uniqueMap.set(normUrl, bm);
      }
    }
    const uniqueBookmarks = Array.from(uniqueMap.values());

    // 3. Filter unnecessary (junk)
    let junkCount = 0;
    const filteredBookmarks = [];
    for (const bm of uniqueBookmarks) {
      if (isUnnecessary(bm.url, bm.title)) {
        junkCount++;
      } else {
        filteredBookmarks.append(bm);
      }
    }

    updateProgress('링크 유효성 검사 준비...', 25, `중복 ${duplicateCount}개, 불필요 항목 ${junkCount}개 필터링 완료.`);

    // 4. Optionally check dead links
    let finalBookmarks = filteredBookmarks;
    let deadCount = 0;
    if (optCheckDead.checked) {
      finalBookmarks = [];
      const totalToCheck = filteredBookmarks.length;
      
      for (let i = 0; i < totalToCheck; i++) {
        const bm = filteredBookmarks[i];
        const pct = Math.floor(25 + (i / totalToCheck) * 55); // 25% ~ 80% range for dead link check
        updateProgress(
          '링크 연결 확인 중...',
          pct,
          `검사 진행률: ${i + 1}/${totalToCheck} | 접속 불가능한 링크: ${deadCount}개 삭제됨`
        );
        
        const isAlive = await checkUrlStatus(bm.url);
        if (isAlive) {
          finalBookmarks.push(bm);
        } else {
          deadCount++;
        }
      }
    }

    updateProgress('카테고리 및 세부 폴더 분류 중...', 85, `총 ${finalBookmarks.length}개의 유효 북마크 분류 중...`);

    // 5. Categorize and Subcategorize
    const categorized = {};
    for (const cat of CATEGORY_ORDER) {
      categorized[cat] = {
        direct: [],
        subfolders: {}
      };
    }

    for (const bm of finalBookmarks) {
      let parentCat = categorizeBookmark(bm.url, bm.title);
      if (!categorized[parentCat]) {
        categorized[parentCat] = { direct: [], subfolders: {} };
      }

      if (SUBCAT_PARENTS.has(parentCat)) {
        const subcat = subcategorizeBookmark(bm.url, bm.title, parentCat);
        if (subcat) {
          if (!categorized[parentCat].subfolders[subcat]) {
            categorized[parentCat].subfolders[subcat] = [];
          }
          categorized[parentCat].subfolders[subcat].push(bm);
        } else {
          categorized[parentCat].direct.push(bm);
        }
      } else {
        categorized[parentCat].direct.push(bm);
      }
    }

    updateProgress('브라우저 북마크 폴더 생성 및 동기화 중...', 90, '계층형 중첩 폴더를 생성하고 있습니다. 잠시만 기다려주세요.');

    // 6. Write bookmarks to Chrome
    let targetRootId = '1'; // Default: Bookmarks bar
    if (optNewFolder.checked) {
      // Create new folder '[Reorganized Bookmarks]' on Bookmarks Bar
      const dateStr = new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      const mainFolder = await chrome.bookmarks.create({
        parentId: '1', // Bookmarks Bar
        title: `[Reorganized Bookmarks] (${dateStr})`
      });
      targetRootId = mainFolder.id;
    } else {
      // Direct replace mode: Backup first, then clean bookmarks bar
      updateProgress('기존 북마크 백업 생성 중...', 92, '안전을 위해 기존 북마크를 백업 폴더로 복사하고 있습니다.');
      const backupFolder = await chrome.bookmarks.create({
        parentId: '1',
        title: `[Backup Bookmarks - ${new Date().toLocaleDateString()}]`
      });
      
      // Move all direct children of Bookmarks Bar (except the new backup folder itself) to Backup
      const barNode = (await chrome.bookmarks.getSubTree('1'))[0];
      for (const child of barNode.children) {
        if (child.id !== backupFolder.id) {
          await chrome.bookmarks.move(child.id, { parentId: backupFolder.id });
        }
      }
      targetRootId = '1';
    }

    // Write categorized bookmark structure
    const totalProcessed = await writeCategorizedToChrome(categorized, targetRootId);

    updateProgress('분류 완료!', 100, '성공적으로 모든 북마크 정돈이 마무리되었습니다.');
    setTimeout(() => showResults(categorized, totalProcessed, duplicateCount, junkCount, deadCount), 600);

  } catch (err) {
    console.error(err);
    updateProgress('오류 발생', 100, `오류 메시지: ${err.message}`);
    setTimeout(resetUI, 3000);
  }
}

// Recursively extract all bookmarks (leaves with url)
function extractBookmarks(node, list) {
  if (node.url) {
    list.push({
      title: node.title || '이름 없음',
      url: node.url,
      dateAdded: node.dateAdded
    });
  }
  if (node.children) {
    for (const child of node.children) {
      extractBookmarks(child, list);
    }
  }
}

function normalizeUrl(url) {
  if (!url) return '';
  let norm = url.trim().toLowerCase();
  norm = norm.replace('https://', 'http://');
  if (norm.endsWith('/')) {
    norm = norm.slice(0, -1);
  }
  return norm;
}

function updateProgress(status, pct, subtext) {
  progressStatus.textContent = status;
  progressPercent.textContent = `${pct}%`;
  progressBar.style.width = `${pct}%`;
  progressSubtext.textContent = subtext;
}

// Communicate with background script to fetch connection check
function checkUrlStatus(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'check_url', url: url }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(true); // 에러 발생 시 안전하게 살려둠
      } else {
        resolve(response.isAlive);
      }
    });
  });
}

// Generate the hierarchical directories and populate bookmarks inside Chrome
async function writeCategorizedToChrome(categorized, rootId) {
  let count = 0;
  for (const catName of CATEGORY_ORDER) {
    const data = categorized[catName];
    const subkeys = Object.keys(data.subfolders);
    const totalBms = data.direct.length + subkeys.reduce((sum, k) => sum + data.subfolders[k].length, 0);

    if (totalBms === 0) continue;

    // Create Category Folder
    const catFolder = await chrome.bookmarks.create({
      parentId: rootId,
      title: `${catName} [${totalBms}개]`
    });

    // 1. Create subfolders
    for (const subName of sorted(subkeys)) {
      const subBms = data.subfolders[subName];
      if (!subBms || subBms.length === 0) continue;

      const subFolder = await chrome.bookmarks.create({
        parentId: catFolder.id,
        title: `${subName} [${subBms.length}개]`
      });

      // Sort and insert bookmarks in subfolder
      subBms.sort((a, b) => {
        const scoreA = getImportanceScore(a.url, a.title);
        const scoreB = getImportanceScore(b.url, b.title);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.title.localeCompare(b.title, 'ko');
      });

      for (const bm of subBms) {
        await chrome.bookmarks.create({
          parentId: subFolder.id,
          title: bm.title,
          url: bm.url
        });
        count++;
      }
    }

    // 2. Direct bookmarks
    if (data.direct.length > 0) {
      data.direct.sort((a, b) => {
        const scoreA = getImportanceScore(a.url, a.title);
        const scoreB = getImportanceScore(b.url, b.title);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.title.localeCompare(b.title, 'ko');
      });

      for (const bm of data.direct) {
        await chrome.bookmarks.create({
          parentId: catFolder.id,
          title: bm.title,
          url: bm.url
        });
        count++;
      }
    }
  }
  return count;
}

function sorted(arr) {
  return [...arr].sort((a, b) => a.localeCompare(b, 'ko'));
}

function showResults(categorized, totalProcessed, dupes, junk, dead) {
  progressPanel.classList.add('hidden');
  resultPanel.classList.remove('hidden');

  resultSummary.innerHTML = `성공적으로 정리를 마쳤습니다.<br>
    유효 북마크: <strong>${totalProcessed}개</strong> | 중복 제거: ${dupes}개<br>
    불필요 필터: ${junk}개 ${dead > 0 ? `| 접속 끊김 삭제: ${dead}개` : ''}`;

  // Build statistics list
  for (const catName of CATEGORY_ORDER) {
    const data = categorized[catName];
    const subkeys = Object.keys(data.subfolders);
    const catTotal = data.direct.length + subkeys.reduce((sum, k) => sum + data.subfolders[k].length, 0);

    if (catTotal === 0) continue;

    const statItem = document.createElement('div');
    statItem.className = 'stat-item';

    // Header
    const header = document.createElement('div');
    header.className = 'stat-item-header';
    header.innerHTML = `
      <div class="stat-item-title">${catName}</div>
      <div class="stat-item-count">${catTotal}개</div>
    `;

    // Content (Dropdown Accordion)
    const content = document.createElement('div');
    content.className = 'stat-item-content';
    
    // Fill content
    let hasContent = false;
    for (const subName of sorted(subkeys)) {
      const len = data.subfolders[subName].length;
      if (len > 0) {
        hasContent = true;
        content.innerHTML += `
          <div class="substat-row">
            <span>${subName}</span>
            <span>${len}개</span>
          </div>
        `;
      }
    }
    if (data.direct.length > 0 && subkeys.length > 0) {
      hasContent = true;
      content.innerHTML += `
        <div class="substat-row">
          <span>📁 기타/미분류 세부 항목</span>
          <span>${data.direct.length}개</span>
        </div>
      `;
    }

    if (hasContent) {
      header.addEventListener('click', () => {
        content.classList.toggle('open');
      });
      statItem.appendChild(header);
      statItem.appendChild(content);
    } else {
      statItem.appendChild(header);
    }

    statList.appendChild(statItem);
  }
}


// ==========================================
// UTILITY ENGINE PORTED FROM PYTHON SCRIPT
// ==========================================

function isUnnecessary(url, title) {
  if (!url || !title) return true;
  const urlLower = url.toLowerCase().trim();
  const titleLower = title.toLowerCase().trim();

  if (urlLower.startsWith('file:///')) return true;
  if (urlLower.startsWith('chrome://') || urlLower.startsWith('chrome-extension://')) return true;

  const searchIndicators = [
    'google.com/search?', 'search.naver?', 'search.daum.net?',
    'search.danawa.com', 'coupang.com/np/search', 'aliexpress.com/wholesale',
    'search.php?', 'totalsearch/hometotalsearch.do', 'xmanual/search/'
  ];
  if (searchIndicators.some(ind => urlLower.includes(ind))) return true;

  const adIndicators = [
    'click.linkprice.com', 'ad.naver.com', 'link.coupang.com', 'adclick', 'ad_group='
  ];
  if (adIndicators.some(ind => urlLower.includes(ind))) return true;

  return false;
}

function getImportanceScore(url, title) {
  const urlLower = url.toLowerCase().trim();
  const titleLower = title.toLowerCase().trim();

  let cleanUrl = urlLower;
  if (cleanUrl.includes('://')) cleanUrl = cleanUrl.split('://')[1];
  if (cleanUrl.includes('www.')) cleanUrl = cleanUrl.split('www.')[1];
  
  const pathParts = cleanUrl.split('/').filter(p => p);
  const isMainHomepage = pathParts.length <= 1 || (pathParts.length === 2 && ['', 'index.html', 'index.php', 'main.do', 'index.do'].includes(pathParts[1]));

  const importanceKeywords = [
    '로그인', 'lms', '포털', '메인', '공식', '홈페이지', '도서관',
    'portal', 'login', 'home', 'dashboard', '대시보드', '관리자'
  ];
  const hasImportanceKeyword = importanceKeywords.some(kw => titleLower.includes(kw));

  if (isMainHomepage || hasImportanceKeyword) return 1;

  const isDeepLink = (urlLower.length > 150) || urlLower.includes('itemid=') || urlLower.includes('spm=') || urlLower.includes('productlist.main');
  if (isDeepLink) return 3;

  return 2;
}

function categorizeBookmark(url, title) {
  const combined = (url + " " + title).toLowerCase();

  // ===== 교육/학교 관련 =====
  if (['sunmoon', '선문대', 'graduate', '대학교', '대학원', '학사종합', 'education.minecraft', 'education.microsoft', '교육자 센터', 'microsoft.com/ko-kr/courses', '디비디비스쿨', 'dbdbschool', '늘봄', '방과후', '각화초', 'gakhwa', '학교안내', '세종학당', '입문', '공지사항', 'graduate.sunmoon', 'unc.doculink', '증명발급', '대한민국 no.1 전국대학', '연제초', '서부초', '초등학교', '고등학교', '중학교'].some(k => combined.includes(k))) {
    return "🎓 학교/대학교 (School & University)";
  }

  // ===== 교육청/공교육 시스템 =====
  if (['gen.go.kr', '광주광역시교육', '교육정보원', '교육연수원', 'neis', '나이스', '업무포털', '학교알리미', 'schoolinfo', '학교정보공시', '학생정서', 'mom.eduro', '교육자치', 'eduup', '교육과학연구원', 'gise.gen', '사이버학습', 'cyber.gedu', 'i-scream', '아이스크림', '원어민 화상', 'native.gen', 'iedu.knise', '특수교육원', '교원능력', 'keris', '캐리스', '개인정보보호', 'privacy.go', 'sec.keris', '공직자 통합메일', 'kmmbox', 'mail.korea', '의무연수', '교직원 법정', '광주사이버학습', '교육정보마당', 'seobu.gen', '유지보수 전담반', 'help.gen.go.kr', 'intra.privacy', '청소년 인터넷', 'school14', '전라남도교육청', 'gov.wrks', '세인에듀', 'seinedu', 'homelearn', '평생학습', '부스트코스', 'boostcourse', 'ssem.re.kr', 'e학습터', '블렌디드 수업', '과제확인', '클래스룸', 'classroom', 'teacheron', '티처온', '경기 교사온', '임용', '연구대회', '자료전', '교원단체', '교총', 'kfta.or.kr', '잇다', 'edunet.net', 'schoolsafe', '학교안전', 'g-school', 'g스쿨', '교육전문직', '교육청', '교사', '티처', 'teacher', '지스쿨', '하이패스', '전문직 시험', 'e알리미', 'ealimi', 'kice.re.kr', '교육과정평가원', 'kci.go.kr', '학술지', '한국교원연수원', 'hstudy.co.kr', 'kofac.re.kr', '창의재단', 'k-mooc', 'kmooc', '농업교육'].some(k => combined.includes(k))) {
    return "🏫 교육청/공교육 시스템 (Education System)";
  }

  // ===== 한국어교육/교원 =====
  if (['korean.go.kr', 'kteacher', '한국어교원', '한국어 교원', '한국교육원', 'kecsf', 'kecdc', 'kecny', 'cakec', 'auskec', 'atlantakec', '샌프란시스코 한국 교육원', '워싱턴 한국교육원', '뉴욕한국교육원', 'korean.net', '스터디코리안', 'ebook.korean', '한국어교수학습', 'kcenter.korean', '어휘 내용 검색', '자격 심사', '학위과정', '교육기관', '한국교사 자격증', 'klacusa', '캘리포니아', '해외학교', 'koreanschool7', 'fppedu', 'hub.fppedu'].some(k => combined.includes(k))) {
    return "🇰🇷 한국어교육/교원 (Korean Language Education)";
  }

  // ===== 도서관/독서/전자책 =====
  if (['library', '도서관', '전자책', 'ebook', 'epub', '전자서비스', 'gangnam.go.kr', '강남구통합도서관', '영어원서', 'lib.gen.go.kr', 'ebook.sje', 'issuu', 'zamzar', 'epub to pdf', 'gen.lib.rus', 'library genesis', 'smallpdf', 'pdf 변환', '북셰어 온라인도서관', 'bitly', 'app.bitly', '크레마클럽', 'cremaclub', 'yes24.com/bookclub'].some(k => combined.includes(k))) {
    return "📖 도서관/전자책 (Library & E-books)";
  }

  // ===== 부동산/주택 =====
  if (['개포주공', '재건축', '주택', '리모델링', '건축비', '건축', '신축', '공매', '온비드', 'onbid', '토지이음', '호갱노노', 'hogangnono', '주택담보', '적격대출', 'hf.go.kr', '부동산', '청약', '분양', '아파트', '실거래가', '조립식주택', '집수리', '임대주택', '주거급여', '집수리닷컴', '주거환경개선', '단독주택', '주택조합', '쉐어하우스', '시니어 쉐어하우스', '상수도사업본부', 'water.gwangju.go.kr'].some(k => combined.includes(k))) {
    return "🏢 부동산/주택 (Real Estate)";
  }

  // ===== AI/인공지능 =====
  if (['ai.jne', 'aistudio.google', 'aihub', 'ai 허브', 'ai 맞춤형', '인공지능', 'ai city', 'aicitybuilders', 'connect ai lab', 'google ai studio', 'api-keys', 'academy.kisa', 'kisa 아카데미', 'google skills', 'bigquery', 'ai·디지털', 'aid 30', '재직자 ai', 'lifelong.chosun', 'comfyui', 'stable diffusion', 'huggingface', 'openai', 'chatgpt', 'anthropic', 'claude', 'ollama', 'vast.ai', 'runyour.ai', 'gpu', 'machine-learning', 'ml-intro', 'kaggle', '캐글'].some(k => combined.includes(k))) {
    return "🤖 AI/인공지능 (AI & Artificial Intelligence)";
  }

  // ===== 프로그래밍/개발 =====
  if (['github.com', 'developer.mozilla', 'opentutorials', 'code.org', 'studio.code', 'codesters', '코딩', '생활코딩', 'seomal', '서말', 'wikidocs', 'it 기술노트', 'ebssw', '이솦', 'sw교육', '소프트웨어 아카데미', '안드로이드 프로그래밍', 'android', 'python', '파이썬', 'web2', 'aws', '무료서버', '개인서버', '마인크래프트', 'minecraft', '에듀 스쿨', 'mineedu', 'second life', 'secondlife', 'agent skill', 'antigravity', 'gemini', 'github education', 'autocapitalize', 'html', 'coding', 'entrepreneur.com/article/250323', '12 sites that will teach you coding', 'poloniexlendingbot', 'readthedocs', 'hicomputing', '초등컴퓨팅교사', 'zep', 'wonseokjung', 'repository', 'repositories', 'google for developers', 'googledevelopers', 'cdn', 'webdeveloper', 'youtube favorites back up', '웹 프로그래밍', 'fullstack', '풀스택', 'bubble.io', 'bubble', 'udemy', '인프런', 'inflearn', 'no-code', 'nocode', '노코드', 'w3schools', 'stackoverflow', 'stack overflow', 'jsfiddle', 'codepen', 'replit', 'appsheet', '앱시트', 'roblox', '로블록스', '패스트캠퍼스', 'fastcampus', 'matplotlib'].some(k => combined.includes(k))) {
    return "💻 프로그래밍/개발 (Programming & Development)";
  }

  // ===== 어학/언어학습 =====
  if (['eslfast', 'english level', 'bbc.co.uk/learningenglish', 'britishcouncil', 'memrise', 'hellotalk', 'learn english', 'english grammar', 'collocation', 'efset', 'storylineonline', 'toeic', 'ybmbooks', 'merriam-webster', '영어문법', '가정법', '영어회화', 'tv series', 'english conversation', 'pdfdrive.com', 'conversational', 'michaelis', 'conjugator.reverso', 'conjugation', 'porta dos fundos', '포어학습', 'lelivros', 'lunetas', 'dominiopublico', 'linguadagente', 'baixelivros', 'tudo bem', 'livrariasbs', 'portuguesparaestrangeiro', '365 common portuguese', '중국어말하기대회', '니하오', 'easypacelearning', 'pdfdrive', 'sachtoeic', 'invest-digest', 'lkoass', '일본어', 'jlpt', 'japanesejlpt', 'kanji', '입트영', '困知', 'hada.io', 'geek', '개발/기술/스타트업', '고사성어', '사자성어', 'flex', 'hufs.ac.kr', '특수외국어', '능력평가', 'youglish'].some(k => combined.includes(k))) {
    return "📚 어학/언어학습 (Language Learning)";
  }

  // ===== 암호화폐 =====
  if (['bitcoin', 'miningpoolhub', 'rocketpool', 'ethereum', 'poloniex', 'binance', '빗썸', 'bithumb', '2p1d', 'steemit', 'crypto', 'flipsidecrypto', '코인', 'korcoin', '랜딩봇', 'lending', 'passive profits', '채굴', 'mining', 'h81a', 'btc', 'ddengle', '땡글', 'hashrate', '해시', 'pancakeswap', 'chainlist', 'dapp'].some(k => combined.includes(k))) {
    return "₿ 암호화폐/블록체인 (Cryptocurrency)";
  }

  // ===== 쇼핑 =====
  if (['coupang.com', '쿠팡', 'aliexpress', '알리익스프레스', '11st.co.kr', '11번가', 'auction.co.kr', '옥션', 'submarino', 'wemakeprice', '위메프', 'halfclub', '하프클럽', 'wedisk', 'be-happy', '행복한나눔', 'ubiqnet', '아덴', 'i-arden', 'joonggonara', '중고나라', '태극명찰', '마사지기', '스파알', '쇼핑몰', 'gmarket', '지마켓', '스마트스토어', 'smartstore'].some(k => combined.includes(k))) {
    return "🛒 쇼핑 (Shopping)";
  }

  // ===== IT 기기 =====
  if (['ssd', 'm.2', 'ngff', 'sata', '외장케이스', '컨버터', '어댑터', 'adapter', '갤럭시', 'galaxy', '루팅', '벽돌', '커스텀롬', '리커버리', 'cwm', 'omnirom', 'cyanogenmod', '노트북 윈도우', '드라이버', 'samsung.com/sec/support', 'driverscape', '잉크패드', 'lcd', 'led', 'ad보드', '모니터diy', '충전기', 'usb충전기', '건조기', '팬 소음', '방열', '급지롤러', '8100', '와이퍼', '카매트', '시트', '캐노픽스', '액정수리', 'smart119', '갤럭시탭', '홈버튼', 'lcd 디스플레이', '터치 스크린', 'amoled', 'rasp', '라즈베리 파이', '레트로 게임기', 'canon g3111', 'driver', '프린터', 'dm-v600', 'r59', 'r60', 'cpu master', 'sens r60', 'ip-255', '인터넷키폰', '텔링크', 'oreilly', 'library access', 'o\'reilly', 'www-oreilly-com', '디바이스마트', 'devicemart', '라즈베리', 'raspberry', '모니터암', '복합기', '렌탈', 'usb3', 'usb 3', '다나와', 'danawa', '마우스', '키보드', '공구', '에이수스', 'asus', '기가바이트', 'gigabyte', '인텔', 'intel', 'amd', '엔비디아', 'nvidia', '메인보드', '그래픽카드'].some(k => combined.includes(k))) {
    return "🔧 IT 하드웨어/기기 (IT Hardware & Devices)";
  }

  // ===== 동영상/미디어 =====
  if (['youtube.com', 'youtu.be', 'youku.com', 'netflix', 'ttsmaker', '텍스트 음성', 'ustvgo', '동화', '구연동화', 'spotify', '스포티파이', '녹화', 'bandicam', '가유아녀', '가유兒女', '유플레이어', 'youplayer'].some(k => combined.includes(k))) {
    return "🎬 미디어/영상 (Media & Video)";
  }

  // ===== 정부/공공/민원 =====
  if (['korail', '코레일', '110.go.kr', '정부민원', 'nhuf.molit', '주택도시기금', 'seogu.gwangju', '서구청', '상담신청', 'moe.go.kr', '교육부', '말레이시아한국국제학교', 'unrecruit.mofa', '국제기구', '외교부', 'koica', 'oda', '국제협력', 'bizno.net', '사업자번호', '광주국제교류', 'gic.or.kr', '광주시', '광주도시공사', 'gmcc', '대피소', '국립공원', '갑질피해', '공연장안전', 'stagesafety', 'nongsaro', '농사로', '공무원', '공무원 유학', '동반휴직', '재외동포재단', 'cecsp', 'gen365', 'sharepoint', '비상연락망', '수련휴양시설', '전자 필기장', '고시넷', 'gosinet', '서울시', '도봉구', 'kdp.aks.ac.kr', '구비문학', '해양에너지', 'kepco', '한국전력', '전기요금', '나라장터', 'g2b', '도시재생', '도시공사', 'scourt.go.kr', '가족관계', '정부24', 'gov.kr', 'fss.or.kr', '금융감독원', 'niceipin', '아이핀', '장애인 등록'].some(k => combined.includes(k))) {
    return "🏛️ 정부/공공/민원 (Government & Public Services)";
  }

  // ===== 금융/결제 =====
  if (['wooribank', '우리은행', 'receita.fazenda', 'cpf', 'comgas', 'vivo.com.br', 'claro.com.br', 'minhaclaroresidencial', 'meuvivo', 'comgás', '각종공과금', '2° via fatura', 'fatura', '은행', 'kbstar', '국민은행', '신한은행', '하나은행', '카카오뱅크', '토스'].some(k => combined.includes(k))) {
    return "💰 금융/결제 (Finance & Payment)";
  }

  // ===== 입시/추천서 =====
  if (['추천서', '자기소개서', '자소서', '교사추천서', '학생부', '세특', '학교장 추천서', '재외국민', '특례', '특별전형', '수시장인', '에듀진', '면접', '고시넷'].some(k => combined.includes(k))) {
    return "📝 입시/추천서/학생부 (Admissions)";
  }

  // ===== 종교/철학 =====
  if (['반야심경', '육조단경', '도덕경', '노자', '불교', '천수경', '重玄学', '众妙', '성철', '근기', '사또', '동화여행', 'fellowship', 'church', 'christian', '남미복음', '복음선교'].some(k => combined.includes(k))) {
    return "🙏 종교/철학 (Religion & Philosophy)";
  }

  // ===== 의료/건강 =====
  if (['병원', 'hospital', 'cnubh', '한의원', 'himiz', '관절', '약초', '두충나무', 'suwanhospital', '한국병원', '건강', '질병', '약국'].some(k => combined.includes(k))) {
    return "🏥 의료/건강 (Health & Medical)";
  }

  // ===== 생활/기타 =====
  if (['에어비앤비', 'airbnb', '에어바운스', '행사 사례', '판촉물', 'skygift', '캐나다 간호사', '간호조무사', '이민', '약초천국', '장흥', '하늘판촉물', '자서전', '어르신', '곡성', '섬진강', '천문대', 'canon creative park', '종이 공예', '자기주도학습', '국제학교', '채용', 'indeed', 'kr.indeed', '한국어 강사', '시니어', '쉐어하우스', '고령친화', '주택조합', '법무법인', '이사', '가족요양', '숨고', 'soomgo', '개조'].some(k => combined.includes(k))) {
    return "🏠 생활/기타 (Life & Misc)";
  }

  // ===== 중국 관련 =====
  if (['chinatalk', '차이나톡', 'naifei', '百度', '中国签证', 'visaforchina', '중국비자', 'kuwomusic', '酷我', '중국 생활', '가유아녀', '가유兒女'].some(k => combined.includes(k))) {
    return "🇨🇳 중국 관련 (China Related)";
  }

  // ===== 한글/문서 작성 =====
  if (['hantip', '한글문서', '개요와 스타일', '보고서', 'google.com/spreadsheets', 'google sheets', 'docs.google', '한컴', '한글 도움말', '한글 단축키', 'hwp', 'pdf', 'powerpoint', 'excel', '엑셀'].some(k => combined.includes(k))) {
    return "📄 문서 작성/도구 (Documents & Tools)";
  }

  // ===== 레거시 =====
  if (['nolzzang', '무한전투', 'dbdbdeep', '미스터하이', 'iamschool', 'iamhere', '어린이안심', 'graphai', '헬라인', '프로젝터', 'epson', 'uexpress', 'dear abby'].some(k => combined.includes(k))) {
    return "🗄️ 기타/미분류 (Others)";
  }

  return "🗄️ 기타/미분류 (Others)";
}

function subcategorizeBookmark(url, title, parentCat) {
  const combined = (url + " " + title).toLowerCase();

  if (parentCat === "🏫 교육청/공교육 시스템 (Education System)") {
    const adminKeywords = [
      'gen.go.kr', '광주광역시교육', '교육정보원', '교육연수원',
      'neis', '나이스', '업무포털', '학교알리미', 'schoolinfo',
      '학교정보공시', '학생정서', 'mom.eduro', '교육자치',
      'gise.gen', 'keris', '캐리스', '개인정보보호', 'privacy.go',
      'sec.keris', '공직자 통합메일', 'kmmbox', 'mail.korea',
      'seobu.gen', '유지보수 전담반', 'help.gen.go.kr', 'intra.privacy',
      'gov.wrks', 'schoolsafe', '학교안전', 'e알리미', 'ealimi',
      'kice.re.kr', '교육과정평가원', '교육전문직', '교육청'
    ];
    const examKeywords = [
      '임용', '연구대회', '자료전', '교원단체', '교총', 'kfta.or.kr',
      'g-school', 'g스쿨', '교사 시험', '티처', 'teacher', '지스쿨',
      '하이패스', '전문직 시험', '의무연수', '교직원 법정'
    ];
    const learningKeywords = [
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
    ];

    if (examKeywords.some(k => combined.includes(k))) return "📁 교사 임용/전문직 시험 (Teacher Exams)";
    if (adminKeywords.some(k => combined.includes(k))) return "📁 교육청 행정/연수원 (Administration & Training)";
    if (learningKeywords.some(k => combined.includes(k))) return "📁 온라인 학습/수업 (Online Learning)";
    return "📁 일반 공교육 자료 (General Edu System)";
  }

  if (parentCat === "🎓 학교/대학교 (School & University)") {
    const univKeywords = [
      'sunmoon', '선문대', 'graduate', '대학교', '대학원',
      '학사종합', 'graduate.sunmoon', '대한민국 no.1 전국대학'
    ];
    const k12Keywords = [
      '각화초', 'gakhwa', '학교안내', '연제초', '서부초',
      '초등학교', '고등학교', '중학교'
    ];
    const koreanSchoolKeywords = [
      '세종학당', '입문', 'unc.doculink', '증명발급',
      'education.minecraft', 'education.microsoft', '교육자 센터',
      'microsoft.com/ko-kr/courses', '디비디비스쿨', 'dbdbschool',
      '늘봄', '방과후'
    ];

    if (univKeywords.some(k => combined.includes(k))) return "📁 대학교/대학원 (University & Graduate)";
    if (k12Keywords.some(k => combined.includes(k))) return "📁 초/중/고등학교 (K-12 School)";
    if (koreanSchoolKeywords.some(k => combined.includes(k))) return "📁 한국어 학당/기타 (Korean Language & Misc)";
    return "📁 일반 학교 정보 (General School)";
  }

  if (parentCat === "🏢 부동산/주택 (Real Estate)") {
    const auctionKeywords = [
      '공매', '경매', '온비드', 'onbid', '실거래가', '호갱노노', 'hogangnono'
    ];
    const loanKeywords = [
      '주택담보', '적격대출', 'hf.go.kr', '청약', '분양', '임대주택',
      '주거급여', '주택도시기금', 'nhuf.molit'
    ];
    const renovationKeywords = [
      '개포주공', '재건축', '리모델링', '건축비', '건축', '신축',
      '조립식주택', '집수리', '집수리닷컴', '주거환경개선',
      '단독주택', '주택조합', '개조'
    ];
    const lifeKeywords = [
      '쉐어하우스', '시니어 쉐어하우스', '상수도사업본부',
      'water.gwangju.go.kr', '토지이음'
    ];

    if (auctionKeywords.some(k => combined.includes(k))) return "📁 공매/경매/실거래가 (Auctions & Prices)";
    if (loanKeywords.some(k => combined.includes(k))) return "📁 청약/임대/주택금융 (Loans & Subscription)";
    if (renovationKeywords.some(k => combined.includes(k))) return "📁 건축/리모델링/집수리 (Renovation & Building)";
    if (lifeKeywords.some(k => combined.includes(k))) return "📁 부동산 생활/기타 (General Real Estate)";
    return "📁 일반 부동산 (General Real Estate)";
  }

  if (parentCat === "💻 프로그래밍/개발 (Programming & Development)") {
    const eduKeywords = [
      'code.org', 'studio.code', 'codesters', '코딩교육',
      'sw교육', '소프트웨어 아카데미', '마인크래프트', 'minecraft',
      '에듀 스쿨', 'mineedu', '초등컴퓨팅교사', 'hicomputing',
      'sw 교육', 'ebssw', '이솦'
    ];
    const nocodeKeywords = [
      'bubble.io', 'bubble', 'no-code', 'nocode', '노코드',
      'appsheet', '앱시트', 'zep'
    ];
    const toolKeywords = [
      'github.com', 'repository', 'repositories', 'github education',
      'wonseokjung', 'jsfiddle', 'codepen', 'replit', 'github'
    ];
    const langKeywords = [
      'python', '파이썬', 'html', 'javascript', 'js', 'css',
      'w3schools', 'stackoverflow', 'stack overflow', 'opentutorials',
      '생활코딩', 'seomal', '서말', 'wikidocs', 'it 기술노트',
      'developer.mozilla', 'udemy', '인프런', 'inflearn', '패스트캠퍼스',
      'fastcampus', 'matplotlib', 'roblox', '로블록스'
    ];

    if (eduKeywords.some(k => combined.includes(k))) return "📁 SW 코딩 교육/하드웨어 (Coding Education)";
    if (nocodeKeywords.some(k => combined.includes(k))) return "📁 노코드/앱 빌더 (No-code & App Builders)";
    if (toolKeywords.some(k => combined.includes(k))) return "📁 개발 도구/플랫폼 (Developer Tools)";
    if (langKeywords.some(k => combined.includes(k))) return "📁 프로그래밍 언어/학습 (Languages & Tutorials)";
    return "📁 일반 개발 자료 (General Dev)";
  }

  if (parentCat === "📚 어학/언어학습 (Language Learning)") {
    const engKeywords = [
      'eslfast', 'english level', 'bbc.co.uk/learningenglish',
      'britishcouncil', 'learn english', 'english grammar',
      'collocation', 'efset', 'storylineonline', 'toeic',
      'ybmbooks', 'merriam-webster', '영어문법', '가정법',
      '영어회화', 'english conversation', 'youglish', '입트영'
    ];
    const portKeywords = [
      'michaelis', 'conjugator.reverso', 'conjugation',
      'porta dos fundos', '포어학습', 'lelivros', 'lunetas',
      'dominiopublico', 'linguadagente', 'baixelivros', 'tudo bem',
      'livrariasbs', 'portuguesparaestrangeiro', '365 common portuguese'
    ];
    const otherKeywords = [
      '중국어말하기대회', '니하오', '일본어', 'jlpt', 'japanesejlpt',
      'kanji', 'flex', 'hufs.ac.kr', '특수외국어', '능력평가',
      '고사성어', '사자성어'
    ];

    if (engKeywords.some(k => combined.includes(k))) return "📁 영어 학습 (English)";
    if (portKeywords.some(k => combined.includes(k))) return "📁 포르투갈어 학습 (Portuguese)";
    if (otherKeywords.some(k => combined.includes(k))) return "📁 기타 외국어/사전 (Other Languages)";
    return "📁 일반 어학 (General Language)";
  }

  if (parentCat === "📖 도서관/전자책 (Library & E-books)") {
    const ebookKeywords = [
      '전자책', 'ebook', 'epub', '크레마클럽', 'cremaclub',
      'yes24.com/bookclub', 'lelivros', 'baixelivros'
    ];
    const libKeywords = [
      'library', '도서관', 'gangnam.go.kr', '강남구통합도서관',
      'lib.gen.go.kr', 'ebook.sje', '북셰어 온라인도서관'
    ];
    const convKeywords = [
      'issuu', 'zamzar', 'epub to pdf', 'gen.lib.rus',
      'library genesis', 'smallpdf', 'pdf 변환'
    ];

    if (ebookKeywords.some(k => combined.includes(k))) return "📁 전자책/북클럽 (E-books)";
    if (libKeywords.some(k => combined.includes(k))) return "📁 공공/대학 도서관 (Libraries)";
    if (convKeywords.some(k => combined.includes(k))) return "📁 문서 변환/자료 검색 (Converter & Resources)";
    return "📁 일반 도서 정보 (General Library)";
  }

  return null;
}
