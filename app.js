/**
 * 메인 애플리케이션 통합 컨트롤러 (app.js)
 * 각 탭의 사용자 상호작용, 사운드 엔진 초기화, 캔버스 렌더링, 퀴즈 흐름 제어,
 * 그리고 모바일 터치 대응 스티커 드래그 앤 드롭 및 LocalStorage 동기화를 제어합니다.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. 상태 및 글로벌 캐시 변수
    let soundEnabled = localStorage.getItem('fm_sound') !== 'false';
    let currentVisualMode = 'circle'; // 'circle' 또는 'bar'
    let dragItem = null;
    let activeOffset = { x: 0, y: 0 };
    let selectedPlacedStickerUniqueId = null;

    // 2. UI 요소 셀렉터
    const appContainer = document.getElementById('app-container');
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const themeSelector = document.getElementById('theme-selector');
    const userGoldText = document.getElementById('user-gold');
    const userHighScoreText = document.getElementById('user-high-score');

    // 탭 버튼 및 본문 판넬
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    // 계산기 입력 필드
    const inputAWhole = document.getElementById('input-a-whole');
    const inputANum = document.getElementById('input-a-num');
    const inputADenom = document.getElementById('input-a-denom');
    const selectOperator = document.getElementById('select-operator');
    const inputBWhole = document.getElementById('input-b-whole');
    const inputBNum = document.getElementById('input-b-num');
    const inputBDenom = document.getElementById('input-b-denom');
    const btnClearCalc = document.getElementById('btn-clear-calc');
    const btnRunCalc = document.getElementById('btn-run-calc');

    // 계산기 결과 디스플레이
    const resultDisplaySection = document.getElementById('result-display-section');
    const resultFractionOutput = document.getElementById('result-fraction-output');
    const canvasOpSign = document.getElementById('canvas-op-sign');
    const stepsContainer = document.getElementById('steps-container');
    const btnModeCircle = document.getElementById('btn-mode-circle');
    const btnModeBar = document.getElementById('btn-mode-bar');

    // 계산기 캔버스들
    const canvasFracA = document.getElementById('canvas-frac-a');
    const canvasFracB = document.getElementById('canvas-frac-b');
    const canvasFracResult = document.getElementById('canvas-frac-result');

    // 퀴즈 요소
    const quizCurrentScore = document.getElementById('quiz-current-score');
    const quizComboBadge = document.getElementById('quiz-combo-badge');
    const btnSkipQuiz = document.getElementById('btn-skip-quiz');
    const quizQTitle = document.getElementById('quiz-q-title');
    const quizQDesc = document.getElementById('quiz-q-desc');
    const quizCanvasWrapper = document.getElementById('quiz-canvas-wrapper');
    const canvasQuizVisual = document.getElementById('canvas-quiz-visual');
    const quizCompareWrapper = document.getElementById('quiz-compare-wrapper');
    const canvasCompare1 = document.getElementById('canvas-compare-1');
    const canvasCompare2 = document.getElementById('canvas-compare-2');
    const quizOptionsContainer = document.getElementById('quiz-options-container');
    const quizFeedbackBox = document.getElementById('quiz-feedback-box');
    const feedbackIcon = document.getElementById('feedback-icon');
    const feedbackTitle = document.getElementById('feedback-title');
    const feedbackDesc = document.getElementById('feedback-desc');

    // 스티커북 요소
    const btnClearBoard = document.getElementById('btn-clear-board');
    const stickerBoardZone = document.getElementById('sticker-board-zone');
    const btnMyStickersTab = document.getElementById('btn-my-stickers');
    const btnOpenShopTab = document.getElementById('btn-open-shop');
    const inventoryGridBox = document.getElementById('inventory-grid-box');
    const shopGridBox = document.getElementById('shop-grid-box');

    // 3. 앱 초기 세팅 실행
    initApp();

    function initApp() {
        // 사운드 아이콘 초기 상태 설정
        updateSoundButtonUI();

        // 테마 복구
        const savedTheme = localStorage.getItem('fm_theme') || 'theme-candy';
        document.body.className = savedTheme;
        themeSelector.value = savedTheme;

        // 골드 및 통계 연동
        updateUserStatsUI();
        window.quizEngine.onGoldUpdate = (gold) => {
            userGoldText.innerText = gold;
            // 텍스트 살짝 통통 튀는 애니메이션 추가
            userGoldText.parentElement.classList.add('pop-animation');
            setTimeout(() => userGoldText.parentElement.classList.remove('pop-animation'), 300);
        };

        // 스티커 보관함 및 샵 렌더링
        renderStickerInventory();
        renderStickerShop();
        renderPlacedStickers();

        // 이벤트 리스너 등록
        bindGlobalEvents();
        bindCalcTabEvents();
        bindQuizTabEvents();
        bindStickerTabEvents();
        initSpinButtons(); // 아동용 스핀 버튼 초기화

        // 모바일 사운드 시작 잠금 해제를 위한 도우미 리스너
        document.body.addEventListener('click', () => {
            if (window.soundEngine) window.soundEngine.init();
        }, { once: true });
    }

    // 4. 공통 글로벌 제어 & 이벤트
    function bindGlobalEvents() {
        // 사운드 온오프
        soundToggleBtn.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem('fm_sound', soundEnabled);
            updateSoundButtonUI();
            if (soundEnabled) {
                window.soundEngine.playTap();
            }
        });

        // 테마 체인저
        themeSelector.addEventListener('change', (e) => {
            const chosenTheme = e.target.value;
            document.body.className = chosenTheme;
            localStorage.setItem('fm_theme', chosenTheme);
            if (soundEnabled) window.soundEngine.playTap();
            // 테마 변경 시 시각 교구 실시간 재렌더링
            refreshCalculationsVisuals();
        });

        // 탭 전환 시스템
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');

                // 탭 버튼 활성화 상태 스위칭
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 탭 본문 스위칭
                tabPanes.forEach(pane => {
                    pane.classList.remove('active');
                    if (pane.id === targetTab) {
                        pane.classList.add('active');
                    }
                });

                if (soundEnabled) window.soundEngine.playTap();

                // 특정 탭 진입 시 동작
                if (targetTab === 'tab-quiz') {
                    // 퀴즈 랜드 첫 문제 출제 (아직 활성화 안 된 경우)
                    if (!window.quizEngine.currentQuestion) {
                        loadNextQuizQuestion();
                    } else {
                        // 퀴즈 화면 캔버스 크기 재조정 렌더링
                        renderQuizVisuals();
                    }
                } else if (targetTab === 'tab-shop') {
                    // 스티커북 탭 로드 시 드래그 요소 정리
                    clearStickerSelections();
                } else if (targetTab === 'tab-calc') {
                    // 계산기 탭 캔버스 강제 동기화
                    setTimeout(refreshCalculationsVisuals, 50);
                }
            });
        });
    }

    function updateSoundButtonUI() {
        soundToggleBtn.innerText = soundEnabled ? '🔊' : '🔇';
    }

    function updateUserStatsUI() {
        userGoldText.innerText = window.quizEngine.gold;
        userHighScoreText.innerText = window.quizEngine.highScore;
    }

    // 5. 🧮 분수 계산기 탭 내부 기능 구현
    function bindCalcTabEvents() {
        // 요술 계산 실행
        btnRunCalc.addEventListener('click', () => {
            if (soundEnabled) window.soundEngine.playTap();
            executeFractionCalculation();
        });

        // 다시 쓰기 지우기
        btnClearCalc.addEventListener('click', () => {
            if (soundEnabled) window.soundEngine.playTap();
            inputAWhole.value = '';
            inputANum.value = '';
            inputADenom.value = '';
            inputBWhole.value = '';
            inputBNum.value = '';
            inputBDenom.value = '';
            resultDisplaySection.style.display = 'none';
        });

        // 피자 vs 초콜릿 시각화 탭 토글
        btnModeCircle.addEventListener('click', () => {
            currentVisualMode = 'circle';
            btnModeCircle.classList.add('active');
            btnModeBar.classList.remove('active');
            if (soundEnabled) window.soundEngine.playTap();
            refreshCalculationsVisuals();
        });

        btnModeBar.addEventListener('click', () => {
            currentVisualMode = 'bar';
            btnModeBar.classList.add('active');
            btnModeCircle.classList.remove('active');
            if (soundEnabled) window.soundEngine.playTap();
            refreshCalculationsVisuals();
        });
    }

    // 아동 친화형 스핀 버튼 작동
    function initSpinButtons() {
        const spinBtns = document.querySelectorAll('.spin-btn');
        spinBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = btn.getAttribute('data-target');
                const inputEl = document.getElementById(targetId);
                if (!inputEl) return;

                let val = parseInt(inputEl.value) || 0;
                const isUp = btn.classList.contains('spin-up');

                if (isUp) {
                    val++;
                } else {
                    val--;
                }

                // 경계선 필터링 가드
                if (targetId.endsWith('denom')) {
                    if (val < 1) val = 1; // 분모 최솟값 1 고정
                } else {
                    if (val < 0) val = 0; // 자연수, 분자 최솟값 0 고정
                }

                inputEl.value = val;

                if (soundEnabled) window.soundEngine.playTap();

                // ➕/➖ 조작 시 사용자가 '계산하기'를 일일이 안 눌러도 
                // 실시간으로 원형 피자와 수식이 쑥쑥 자라나고 변경되는 매끄러운 반응형 피드백 제공!
                executeFractionCalculationSilently();
            });
        });
    }

    // 터치 증감 시 팝업 경고 없이 실시간으로 계산 결과를 교구 캔버스에 주입하는 함수
    function executeFractionCalculationSilently() {
        const w1 = parseInt(inputAWhole.value) || 0;
        const n1 = parseInt(inputANum.value) || 0;
        const d1 = parseInt(inputADenom.value) || 1;

        const w2 = parseInt(inputBWhole.value) || 0;
        const n2 = parseInt(inputBNum.value) || 0;
        const d2 = parseInt(inputBDenom.value) || 1;

        // 조용히 작동하므로 포커스 상태에서는 에러 경고 생략하고 타당성만 조율
        if (d1 === 0 || d2 === 0) return;
        if (n1 === 0 && w1 === 0) return;
        if (n2 === 0 && w2 === 0) return;

        const f1 = new Fraction(w1, n1, d1);
        const f2 = new Fraction(w2, n2, d2);
        const op = selectOperator.value;

        let calcResultObj = null;
        try {
            if (op === '+') calcResultObj = Fraction.add(f1, f2);
            else if (op === '-') calcResultObj = Fraction.subtract(f1, f2);
            else if (op === '*') calcResultObj = Fraction.multiply(f1, f2);
            else if (op === '/') calcResultObj = Fraction.divide(f1, f2);
        } catch (e) {
            return;
        }

        if (calcResultObj.explanation && calcResultObj.explanation.isNegativeError) return;

        lastCalcData = {
            f1, f2, op,
            result: calcResultObj.result,
            explanation: calcResultObj.explanation
        };

        resultDisplaySection.style.display = 'block';

        renderResultFraction(calcResultObj.result);
        renderExplanationSteps(calcResultObj.explanation);
        refreshCalculationsVisuals();

        // 실시간 쪼꼬 말풍선 업데이트
        updateChocoSpeech(calcResultObj.result);
    }

    // 🐼 결과 형태에 따른 쪼꼬 가이드 대화창 멘트 갱신
    function updateChocoSpeech(resultFraction) {
        const calcSpeechText = document.getElementById('calc-speech-text');
        const calcCharacterGuide = document.getElementById('calc-character-guide');
        if (!calcSpeechText || !calcCharacterGuide) return;

        calcCharacterGuide.style.display = 'flex';

        if (resultFraction.whole === 0 && resultFraction.numerator === 0) {
            calcSpeechText.innerHTML = "우와! 계산해 보니 <b>0조각</b>이 되었어! 남은 피자 조각이 하나도 없는 보들보들한 상태란다 🐼💨";
        } else if (resultFraction.whole > 0 && resultFraction.numerator > 0) {
            calcSpeechText.innerHTML = `자연수 <b>${resultFraction.whole}</b>와(과) 분수 조각이 합쳐진 멋진 <b>대분수</b> 정답 등장! 초콜릿 막대가 꽉 차고도 넘쳤어 🐼🍫`;
        } else if (resultFraction.whole > 0 && resultFraction.numerator === 0) {
            calcSpeechText.innerHTML = `소수점 없이 딱 떨어지는 완전한 자연수 <b>${resultFraction.whole}</b> 정답이야! 통째로 가득 채워졌네 🐼👑`;
        } else {
            calcSpeechText.innerHTML = `분모보다 분자가 더 작은 이쁜 <b>진분수</b> 정답 완성! 피자 한 판보다 적은 크기야 🐼🍕`;
        }
    }

    // 분수 연산 실질 가동 및 데이터 구성
    let lastCalcData = null; // 재렌더링 시 사용될 최종 결과 캐싱

    function executeFractionCalculation() {
        // 입력값 파싱 (비었으면 0으로 예외 필터링)
        const w1 = parseInt(inputAWhole.value) || 0;
        const n1 = parseInt(inputANum.value) || 0;
        const d1 = parseInt(inputADenom.value) || 1;

        const w2 = parseInt(inputBWhole.value) || 0;
        const n2 = parseInt(inputBNum.value) || 0;
        const d2 = parseInt(inputBDenom.value) || 1;

        if (d1 === 0 || d2 === 0) {
            alert("⚠️ 분모는 0이 될 수 없습니다! 1 이상의 숫자를 입력해 주세요.");
            return;
        }

        if (n1 < 0 || n2 < 0 || d1 < 0 || d2 < 0 || w1 < 0 || w2 < 0) {
            alert("⚠️ 음수나 마이너스는 입력할 수 없어요! 예쁜 양수만 입력해 주세요.");
            return;
        }

        // 분자 분모 모두 비어있는 경우
        if (n1 === 0 && w1 === 0) {
            alert("⚠️ 첫 번째 분수에 값을 입력해 주세요!");
            return;
        }
        if (n2 === 0 && w2 === 0) {
            alert("⚠️ 두 번째 분수에 값을 입력해 주세요!");
            return;
        }

        const f1 = new Fraction(w1, n1, d1);
        const f2 = new Fraction(w2, n2, d2);
        const op = selectOperator.value;

        let calcResultObj = null;

        try {
            if (op === '+') {
                calcResultObj = Fraction.add(f1, f2);
            } else if (op === '-') {
                calcResultObj = Fraction.subtract(f1, f2);
            } else if (op === '*') {
                calcResultObj = Fraction.multiply(f1, f2);
            } else if (op === '/') {
                calcResultObj = Fraction.divide(f1, f2);
            }
        } catch (e) {
            alert("⚠️ 계산 중 오류가 발생했습니다: " + e.message);
            return;
        }

        if (calcResultObj.explanation && calcResultObj.explanation.isNegativeError) {
            alert("⚠️ 첫 번째 분수보다 두 번째 분수가 더 커서 뺄 수 없어요! 초등학교에서는 아직 음수를 배우지 않아요 😉");
            return;
        }

        // 결과 캐시 업데이트 및 섹션 노출
        lastCalcData = {
            f1, f2, op,
            result: calcResultObj.result,
            explanation: calcResultObj.explanation
        };

        resultDisplaySection.style.display = 'block';

        // 1. 계산 결과 박스 렌더링
        renderResultFraction(calcResultObj.result);

        // 2. 단계별 풀이 텍스트 생성
        renderExplanationSteps(calcResultObj.explanation);

        // 3. 교구 캔버스 렌더링
        refreshCalculationsVisuals();

        // 🐼 쪼꼬 캐릭터 말풍선 업데이트
        updateChocoSpeech(calcResultObj.result);

        // 계산 성공 효과음 (팡파르)
        if (soundEnabled) window.soundEngine.playFanfare();

        // 스무스 스크롤 이동
        resultDisplaySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 결과 창에 분수 그리기
    function renderResultFraction(resFraction) {
        resultFractionOutput.innerHTML = '';
        
        // 0인 경우 처리
        if (resFraction.whole === 0 && resFraction.numerator === 0) {
            resultFractionOutput.innerHTML = '<span class="render-whole">0</span>';
            return;
        }

        let html = '';
        
        // 대분수 표기
        if (resFraction.whole > 0) {
            html += `<span class="render-whole">${resFraction.whole}</span>`;
        }

        // 분수부 표기
        if (resFraction.numerator > 0) {
            html += `
                <div class="render-vulgar">
                    <span class="render-num">${resFraction.numerator}</span>
                    <span class="render-denom">${resFraction.denominator}</span>
                </div>
            `;
        }
        
        // 기약분수 설명 라벨 추가
        html += `<span class="result-text-label">(기약분수)</span>`;

        resultFractionOutput.innerHTML = html;
    }

    // 단계별 풀이 HTML 구성
    function renderExplanationSteps(explanation) {
        stepsContainer.innerHTML = '';
        
        explanation.steps.forEach((step, idx) => {
            const card = document.createElement('article');
            card.className = 'step-card';
            card.style.borderLeftColor = getThemePrimaryColor();

            const title = document.createElement('h4');
            title.className = 'step-card-title';
            title.style.color = getThemePrimaryColor();
            title.innerText = step.title;

            const desc = document.createElement('p');
            desc.className = 'step-card-desc';
            desc.innerHTML = step.desc;

            card.appendChild(title);
            card.appendChild(desc);

            if (step.expr) {
                const expr = document.createElement('div');
                expr.className = 'step-card-expr';
                // 수식을 초등학생 친화적으로 가독성 있게 간단한 텍스트로 보정
                expr.innerText = cleanMathExpression(step.expr);
                card.appendChild(expr);
            }

            stepsContainer.appendChild(card);
        });
    }

    // 수식의 LaTeX 형식을 일반 텍스트 형태로 알아보기 쉽게 보정해주는 유틸
    function cleanMathExpression(expr) {
        return expr
            .replace(/\\frac{([^}]+)}{([^}]+)}/g, '$1/$2')
            .replace(/\\times/g, '×')
            .replace(/\\div/g, '÷')
            .replace(/\\quad/g, '  ')
            .replace(/\\text{([^}]+)}/g, '$1')
            .replace(/f1_imp = /g, '가분수 A = ')
            .replace(/f2_imp = /g, '가분수 B = ')
            .replace(/,/g, '  ,  ')
            .replace(/\\/g, '');
    }

    // 현재 선택된 테마에 부합하는 프라이머리 컬러 반환
    function getThemePrimaryColor() {
        const theme = document.body.className;
        if (theme === 'theme-space') return '#00CEC9';
        if (theme === 'theme-forest') return '#78B159';
        return '#FF7597'; // candy 기본
    }

    // 현재 선택된 테마의 보조(포인트) 컬러
    function getThemeAccentColor() {
        const theme = document.body.className;
        if (theme === 'theme-space') return '#6C5CE7';
        if (theme === 'theme-forest') return '#FDCC58';
        return '#A29BFE'; // candy
    }

    // 교구 시각화 렌더링 갱신
    function refreshCalculationsVisuals() {
        if (!lastCalcData) return;

        const colorA = getThemePrimaryColor();
        const colorB = getThemeAccentColor();
        const colorRes = '#FFD200'; // 황금 피자/초콜릿 색상

        // 연산자 기호 매치
        canvasOpSign.innerText = lastCalcData.op;

        // 캔버스 드로잉
        FractionVisualizer.draw(canvasFracA, lastCalcData.f1, currentVisualMode, colorA);
        FractionVisualizer.draw(canvasFracB, lastCalcData.f2, currentVisualMode, colorB);
        FractionVisualizer.draw(canvasFracResult, lastCalcData.result, currentVisualMode, colorRes);
    }


    // 6. 🎮 퀴즈 랜드 탭 내부 기능 구현
    function bindQuizTabEvents() {
        btnSkipQuiz.addEventListener('click', () => {
            if (soundEnabled) window.soundEngine.playTap();
            loadNextQuizQuestion();
        });
    }

    // 새 문제 부하
    function loadNextQuizQuestion() {
        const q = window.quizEngine.generateQuestion();
        
        quizQTitle.innerText = q.title;
        quizQDesc.innerHTML = q.desc;

        // 🐼 퀴즈 출제 시 쪼꼬 캐릭터 가이드 말풍선 갱신
        const quizSpeechText = document.getElementById('quiz-speech-text');
        if (quizSpeechText) {
            if (q.type === 'visual') {
                quizSpeechText.innerHTML = "피자나 초콜릿 그림을 잘 세어보고 알맞은 분수를 골라줘! 🍕🐼";
            } else if (q.type === 'compare') {
                quizSpeechText.innerHTML = "두 개의 분수 캔버스를 보면서 어떤 쪽 분수가 더 크고 뚱뚱한지 잘 비교해봐! ⚖️🐼";
            } else {
                quizSpeechText.innerHTML = "분수를 더하고 빼 보자! 공통분모 통분 과정을 기억하면 엄청 쉬워! 🧮🐼";
            }
        }
        
        // 콤보 뱃지 동기화
        if (window.quizEngine.combo > 0) {
            quizComboBadge.innerText = `🔥 ${window.quizEngine.combo} 콤보!`;
            quizComboBadge.style.display = 'inline-block';
        } else {
            quizComboBadge.style.display = 'none';
        }

        quizCurrentScore.innerText = window.quizEngine.score;
        updateUserStatsUI();

        // 문제 타입별 영역 분할 제어
        if (q.type === 'visual') {
            quizCanvasWrapper.style.display = 'flex';
            quizCompareWrapper.style.display = 'none';
        } else if (q.type === 'compare') {
            quizCanvasWrapper.style.display = 'none';
            quizCompareWrapper.style.display = 'flex';
        } else {
            quizCanvasWrapper.style.display = 'none';
            quizCompareWrapper.style.display = 'none';
        }

        // 보기 옵션 리스트 렌더링
        renderQuizOptions(q.options);
        
        // 시각화 즉시 실행
        setTimeout(renderQuizVisuals, 50);
    }

    // 퀴즈용 시각 자료 그리기
    function renderQuizVisuals() {
        const q = window.quizEngine.currentQuestion;
        if (!q) return;

        const themeCol = getThemePrimaryColor();
        const accentCol = getThemeAccentColor();

        if (q.type === 'visual') {
            FractionVisualizer.draw(canvasQuizVisual, q.targetFraction, q.visualMode, themeCol);
        } else if (q.type === 'compare') {
            FractionVisualizer.draw(canvasCompare1, q.fraction1, 'circle', themeCol);
            FractionVisualizer.draw(canvasCompare2, q.fraction2, 'circle', accentCol);
        }
    }

    // 보기 버튼들 동적 배치
    function renderQuizOptions(options) {
        quizOptionsContainer.innerHTML = '';
        
        options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = opt.text;
            btn.addEventListener('click', () => handleQuizOptionClick(idx));
            quizOptionsContainer.appendChild(btn);
        });
    }

    // 보기를 선택했을 때 로직
    let quizLock = false; // 정답 처리 딜레이 가드

    function handleQuizOptionClick(selectedIndex) {
        if (quizLock) return;
        quizLock = true;

        const evalResult = window.quizEngine.checkAnswer(selectedIndex);
        
        if (evalResult.correct) {
            // 정답 사운드 및 피드백 모달 출력
            if (soundEnabled) window.soundEngine.playCorrect();
            
            feedbackIcon.innerText = '🎉';
            feedbackTitle.innerText = '정답입니다! 참 잘했어요!';
            feedbackTitle.style.color = '#4BD37B';
            feedbackDesc.innerHTML = `🌟 <b>${evalResult.combo} 콤보 달성!</b> +${evalResult.reward} 골드를 획득하였습니다.`;
            quizFeedbackBox.style.borderColor = '#4BD37B';
        } else {
            // 오답 사운드 및 해설 모달 출력
            if (soundEnabled) window.soundEngine.playWrong();
            
            feedbackIcon.innerText = '💡';
            feedbackTitle.innerText = '아쉬워요! 다시 해볼까요?';
            feedbackTitle.style.color = '#FF6B6B';
            feedbackDesc.innerHTML = `정답은 <b>${evalResult.correctAnswerText}</b> 였답니다. 차근차근 다시 풀어봐요!`;
            quizFeedbackBox.style.borderColor = '#FF6B6B';
        }

        // 피드백 박스 보이기
        quizFeedbackBox.style.display = 'block';

        // 1.8초 후 자동으로 창 닫히며 다음 문제 로드
        setTimeout(() => {
            quizFeedbackBox.style.display = 'none';
            quizLock = false;
            loadNextQuizQuestion();
        }, 1800);
    }


    // 7. 🧸 스티커 북 & 스티커 숍 기능 구현
    function bindStickerTabEvents() {
        // 인벤토리(보관함) 탭 클릭
        btnMyStickersTab.addEventListener('click', () => {
            btnMyStickersTab.classList.add('active');
            btnOpenShopTab.classList.remove('active');
            inventoryGridBox.style.display = 'grid';
            shopGridBox.style.display = 'none';
            if (soundEnabled) window.soundEngine.playTap();
        });

        // 상점 탭 클릭
        btnOpenShopTab.addEventListener('click', () => {
            btnOpenShopTab.classList.add('active');
            btnMyStickersTab.classList.remove('active');
            shopGridBox.style.display = 'flex';
            inventoryGridBox.style.display = 'none';
            if (soundEnabled) window.soundEngine.playTap();
        });

        // 스티커북 청소하기
        btnClearBoard.addEventListener('click', () => {
            if (confirm("🎨 스티커 판의 그림을 모두 치울까요?")) {
                if (soundEnabled) window.soundEngine.playTap();
                window.shopEngine.clearStickerBook();
                renderPlacedStickers();
            }
        });

        // 보드 내 빈 곳 클릭 시 선택 해제 처리
        stickerBoardZone.addEventListener('mousedown', (e) => {
            if (e.target === stickerBoardZone) {
                clearStickerSelections();
            }
        });
        stickerBoardZone.addEventListener('touchstart', (e) => {
            if (e.target === stickerBoardZone) {
                clearStickerSelections();
            }
        });
    }

    // 보유 보관함 목록 그리기
    function renderStickerInventory() {
        inventoryGridBox.innerHTML = '';
        const owned = window.shopEngine.ownedStickers;
        
        owned.forEach(stickerId => {
            const stickerMeta = window.shopEngine.stickers.find(s => s.id === stickerId);
            if (!stickerMeta) return;

            const item = document.createElement('div');
            item.className = 'inventory-item';
            item.innerText = stickerMeta.emoji;
            item.title = `${stickerMeta.name} (클릭하면 꾸미기 판에 생성!)`;
            
            item.addEventListener('click', () => {
                // 스티커판 중앙 좌표에 배치
                const rect = stickerBoardZone.getBoundingClientRect();
                const x = (rect.width / 2) - 25;
                const y = (rect.height / 2) - 25;
                
                const placedItem = window.shopEngine.placeSticker(stickerId, x, y);
                if (placedItem) {
                    if (soundEnabled) window.soundEngine.playTap();
                    renderPlacedStickers();
                }
            });

            inventoryGridBox.appendChild(item);
        });
    }

    // 상점 스티커 판매 목록 그리기
    function renderStickerShop() {
        shopGridBox.innerHTML = '';
        const owned = window.shopEngine.ownedStickers;

        window.shopEngine.stickers.forEach(sticker => {
            const isOwned = owned.includes(sticker.id);

            const card = document.createElement('div');
            card.className = `shop-item-card ${isOwned ? 'owned' : ''}`;

            card.innerHTML = `
                <div class="shop-item-left">
                    <span class="shop-item-emoji">${sticker.emoji}</span>
                    <div class="shop-item-meta">
                        <span class="shop-item-name">${sticker.name}</span>
                        <span class="shop-item-desc">${sticker.desc}</span>
                        <span class="shop-item-price-badge">💰 ${sticker.price}골드</span>
                    </div>
                </div>
            `;

            const btnBuy = document.createElement('button');
            btnBuy.className = 'btn btn-primary btn-sm btn-buy-sticker';
            btnBuy.innerText = isOwned ? '구매완료' : '사기';

            if (!isOwned) {
                btnBuy.addEventListener('click', () => {
                    const purchase = window.shopEngine.buySticker(sticker.id, window.quizEngine);
                    if (purchase.success) {
                        alert(`🎉 [${purchase.sticker.name}] 스티커를 샀습니다! '내 보관함' 탭에서 스티커를 꺼내 꾸며보세요.`);
                        updateUserStatsUI();
                        renderStickerInventory();
                        renderStickerShop();
                    } else {
                        alert("⚠️ " + purchase.reason);
                    }
                });
            }

            card.appendChild(btnBuy);
            shopGridBox.appendChild(card);
        });
    }

    // 스티커 보드판 위에 놓인 스티커들 그리기
    function renderPlacedStickers() {
        stickerBoardZone.innerHTML = '';
        const placed = window.shopEngine.placedStickers;

        placed.forEach(item => {
            const div = document.createElement('div');
            div.className = 'placed-sticker';
            div.id = item.uniqueId;
            div.innerText = item.emoji;
            div.style.left = item.x + 'px';
            div.style.top = item.y + 'px';

            // 삭제 버튼 달아주기
            const delBtn = document.createElement('span');
            delBtn.className = 'sticker-delete-btn';
            delBtn.innerText = 'X';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.shopEngine.removePlacedSticker(item.uniqueId);
                if (soundEnabled) window.soundEngine.playTap();
                renderPlacedStickers();
            });
            div.appendChild(delBtn);

            // 드래그 앤 드롭 마우스 & 터치 연동 바인딩
            bindDragEvents(div, item);

            // 선택 여부 갱신
            if (item.uniqueId === selectedPlacedStickerUniqueId) {
                div.classList.add('selected');
            }

            stickerBoardZone.appendChild(div);
        });
    }

    // 드래그앤드롭 완벽 처리 유틸리티 (마우스 & 터치)
    function bindDragEvents(element, placedStickerMeta) {
        
        const startDrag = (clientX, clientY) => {
            dragItem = element;
            selectedPlacedStickerUniqueId = placedStickerMeta.uniqueId;
            
            // 모든 스티커의 선택 해제 후 현재 클릭 스티커 활성화
            const allPlaced = document.querySelectorAll('.placed-sticker');
            allPlaced.forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');

            // 클릭한 오프셋 계산 (요소 좌상단 기준 좌표)
            const styleLeft = parseInt(element.style.left) || 0;
            const styleTop = parseInt(element.style.top) || 0;
            const rect = stickerBoardZone.getBoundingClientRect();
            
            // 캔버스 내에서의 마우스 오프셋 저장
            const localX = clientX - rect.left;
            const localY = clientY - rect.top;

            activeOffset.x = localX - styleLeft;
            activeOffset.y = localY - styleTop;
        };

        const doDrag = (clientX, clientY) => {
            if (!dragItem || dragItem !== element) return;

            const rect = stickerBoardZone.getBoundingClientRect();
            const localX = clientX - rect.left;
            const localY = clientY - rect.top;

            // 새로운 드래그 계산 위치
            let newX = localX - activeOffset.x;
            let newY = localY - activeOffset.y;

            // 스티커 보드 경계 가두기 필터링 (화면 밖 탈출 방지)
            const stickerSize = 50;
            if (newX < 0) newX = 0;
            if (newY < 0) newY = 0;
            if (newX > rect.width - stickerSize) newX = rect.width - stickerSize;
            if (newY > rect.height - stickerSize) newY = rect.height - stickerSize;

            dragItem.style.left = newX + 'px';
            dragItem.style.top = newY + 'px';

            // 실시간 데이터 저장소에 동기화
            window.shopEngine.updatePlacedSticker(placedStickerMeta.uniqueId, { x: newX, y: newY });
        };

        const stopDrag = () => {
            if (dragItem) {
                dragItem = null;
            }
        };

        // 1. 마우스 이벤트 바인딩
        element.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startDrag(e.clientX, e.clientY);
            
            const handleMouseMove = (moveEvt) => {
                doDrag(moveEvt.clientX, moveEvt.clientY);
            };
            
            const handleMouseUp = () => {
                stopDrag();
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        // 2. 모바일 터치 이벤트 바인딩
        element.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            const touch = e.touches[0];
            startDrag(touch.clientX, touch.clientY);
            
            const handleTouchMove = (moveEvt) => {
                const touchMove = moveEvt.touches[0];
                doDrag(touchMove.clientX, touchMove.clientY);
            };
            
            const handleTouchEnd = () => {
                stopDrag();
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
            };
            
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        });
    }

    function clearStickerSelections() {
        selectedPlacedStickerUniqueId = null;
        const allPlaced = document.querySelectorAll('.placed-sticker');
        allPlaced.forEach(el => el.classList.remove('selected'));
    }
});
