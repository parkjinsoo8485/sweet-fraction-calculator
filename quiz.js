/**
 * 퀴즈 모듈 (quiz.js)
 * 초등학생을 위한 3가지 재미있는 분수 퀴즈를 무작위 생성합니다:
 * 1. 그림 보고 분수 맞추기 (Visual Match)
 * 2. 분수 크기 비교하기 (Fraction Compare)
 * 3. 재미있는 분수 연산 풀기 (Fraction Math)
 * 또한 LocalStorage와 연동되어 사용자의 총 골드와 콤보, 스티커 도감 진행 상태를 완벽 저장합니다.
 */

class QuizEngine {
    constructor() {
        this.gold = parseInt(localStorage.getItem('fm_gold')) || 0;
        this.highScore = parseInt(localStorage.getItem('fm_highscore')) || 0;
        this.score = 0;
        this.combo = 0;
        
        this.currentQuestion = null;
        this.onGoldUpdate = null; // 골드 업데이트 시 UI 콜백
    }

    /**
     * 골드 획득 및 저장
     */
    addGold(amount) {
        this.gold += amount;
        localStorage.setItem('fm_gold', this.gold);
        if (this.onGoldUpdate) this.onGoldUpdate(this.gold);
    }

    /**
     * 골드 사용
     */
    spendGold(amount) {
        if (this.gold >= amount) {
            this.gold -= amount;
            localStorage.setItem('fm_gold', this.gold);
            if (this.onGoldUpdate) this.onGoldUpdate(this.gold);
            return true;
        }
        return false;
    }

    /**
     * 퀴즈 정답 검증
     */
    checkAnswer(userAnswerIndex) {
        const isCorrect = userAnswerIndex === this.currentQuestion.correctIndex;
        
        if (isCorrect) {
            this.combo++;
            this.score += 10;
            // 콤보 보너스 골드: 기본 10G + (콤보 * 2G) (최대 30G)
            const bonus = Math.min(this.combo * 2, 20);
            const reward = 10 + bonus;
            this.addGold(reward);

            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('fm_highscore', this.highScore);
            }
            
            return {
                correct: true,
                reward,
                combo: this.combo
            };
        } else {
            this.combo = 0;
            return {
                correct: false,
                correctAnswerText: this.currentQuestion.options[this.currentQuestion.correctIndex].text
            };
        }
    }

    /**
     * 새로운 문제 무작위 생성
     */
    generateQuestion() {
        // 3가지 문제 유형 무작위 선정
        const types = ['visual', 'compare', 'math'];
        const chosenType = types[Math.floor(Math.random() * types.length)];
        
        let questionData = null;
        if (chosenType === 'visual') {
            questionData = this.createVisualQuestion();
        } else if (chosenType === 'compare') {
            questionData = this.createCompareQuestion();
        } else {
            questionData = this.createMathQuestion();
        }

        this.currentQuestion = questionData;
        return questionData;
    }

    /**
     * 1. 그림 보고 분수 맞추기 퀴즈 생성
     */
    createVisualQuestion() {
        const denoms = [2, 3, 4, 5, 6, 8, 10];
        const denom = denoms[Math.floor(Math.random() * denoms.length)];
        // 진분수만 출제
        const num = Math.floor(Math.random() * (denom - 1)) + 1;
        
        const qFraction = new Fraction(0, num, denom);
        const visualMode = Math.random() > 0.5 ? 'circle' : 'bar';

        // 오답 리스트 생성 (중복 없이)
        const wrongOptions = new Set();
        while (wrongOptions.size < 3) {
            const wDenom = denoms[Math.floor(Math.random() * denoms.length)];
            const wNum = Math.floor(Math.random() * (wDenom - 1)) + 1;
            // 기약분수화했을 때 정답과 같지 않아야 함
            const wFraction = new Fraction(0, wNum, wDenom);
            if (wFraction.valueOf() !== qFraction.valueOf() && wFraction.toString() !== qFraction.toString()) {
                wrongOptions.add(`${wFraction.numerator}/${wFraction.denominator}`);
            }
        }

        const options = Array.from(wrongOptions).map(opt => {
            const [n, d] = opt.split('/');
            return {
                text: `${n}/${d}`,
                fraction: new Fraction(0, n, d)
            };
        });

        // 정답 삽입
        const correctOpt = {
            text: `${num}/${denom}`,
            fraction: qFraction
        };
        const correctIndex = Math.floor(Math.random() * 4);
        options.splice(correctIndex, 0, correctOpt);

        return {
            type: 'visual',
            title: "🍕 이 그림은 몇 분의 몇일까요?",
            desc: "그림에 색칠된 조각의 크기를 가장 잘 나타내는 분수를 골라보세요!",
            targetFraction: qFraction,
            visualMode: visualMode,
            options: options,
            correctIndex: correctIndex
        };
    }

    /**
     * 2. 분수 크기 비교하기 퀴즈 생성
     */
    createCompareQuestion() {
        // 비교하기 쉬운 분수 쌍 생성
        const denoms = [2, 3, 4, 5, 6, 8];
        let f1, f2;
        
        do {
            const d1 = denoms[Math.floor(Math.random() * denoms.length)];
            const n1 = Math.floor(Math.random() * (d1 - 1)) + 1;
            const d2 = denoms[Math.floor(Math.random() * denoms.length)];
            const n2 = Math.floor(Math.random() * (d2 - 1)) + 1;
            
            f1 = new Fraction(0, n1, d1);
            f2 = new Fraction(0, n2, d2);
        } while (f1.valueOf() === f2.valueOf()); // 같은 크기는 재미 없으므로 크기가 다른 것만 선정

        const val1 = f1.valueOf();
        const val2 = f2.valueOf();
        
        let correctSign = '';
        if (val1 > val2) correctSign = '>';
        else if (val1 < val2) correctSign = '<';

        const options = [
            { text: '크다 ( > )', sign: '>' },
            { text: '작다 ( < )', sign: '<' }
        ];

        const correctIndex = options.findIndex(opt => opt.sign === correctSign);

        return {
            type: 'compare',
            title: "⚖️ 어떤 분수가 더 클까요?",
            desc: `왼쪽 분수와 오른쪽 분수의 크기를 비교해 보세요. <br><b>${f1.toString()}</b> [ ? ] <b>${f2.toString()}</b>`,
            fraction1: f1,
            fraction2: f2,
            options: options,
            correctIndex: correctIndex
        };
    }

    /**
     * 3. 사칙연산 퀴즈 생성
     */
    createMathQuestion() {
        // 쉬운 수준의 덧셈 또는 뺄셈 출제
        const denoms = [2, 3, 4, 5, 6, 8];
        const sameDenom = Math.random() > 0.4; // 60% 확률로 분모가 다른 덧셈/뺄셈 출제하여 변별력 제공
        
        let f1, f2, op, resultFraction;
        
        if (sameDenom) {
            // 분모가 같은 덧셈/뺄셈
            const d = denoms[Math.floor(Math.random() * denoms.length)];
            op = Math.random() > 0.5 ? '+' : '-';
            
            if (op === '+') {
                const n1 = Math.floor(Math.random() * (d - 2)) + 1;
                const n2 = Math.floor(Math.random() * (d - n1 - 1)) + 1;
                f1 = new Fraction(0, n1, d);
                f2 = new Fraction(0, n2, d);
                resultFraction = Fraction.add(f1, f2).result;
            } else {
                const n1 = Math.floor(Math.random() * (d - 1)) + 2;
                const n2 = Math.floor(Math.random() * (n1 - 1)) + 1;
                f1 = new Fraction(0, n1, d);
                f2 = new Fraction(0, n2, d);
                resultFraction = Fraction.subtract(f1, f2).result;
            }
        } else {
            // 분모가 다른 덧셈/뺄셈
            op = Math.random() > 0.5 ? '+' : '-';
            const d1 = denoms[Math.floor(Math.random() * denoms.length)];
            const d2 = denoms[Math.floor(Math.random() * denoms.length)];
            
            if (op === '+') {
                // 더해서 1.5가 넘지 않는 수준 조율
                f1 = new Fraction(0, 1, d1);
                f2 = new Fraction(0, 1, d2);
                resultFraction = Fraction.add(f1, f2).result;
            } else {
                // 항상 양수가 나오도록 조율
                let n1 = Math.floor(Math.random() * (d1 - 1)) + 1;
                f1 = new Fraction(0, n1, d1);
                f2 = new Fraction(0, 1, d2);
                
                // 음수가 안될 때까지 보정
                while (f1.valueOf() <= f2.valueOf()) {
                    n1++;
                    f1 = new Fraction(0, n1, d1);
                }
                resultFraction = Fraction.subtract(f1, f2).result;
            }
        }

        // 결과값 텍스트
        const correctText = resultFraction.toString();

        // 오답 옵션 생성
        const wrongOptions = new Set();
        while (wrongOptions.size < 3) {
            const wD = denoms[Math.floor(Math.random() * denoms.length)];
            const wN = Math.floor(Math.random() * (wD - 1)) + 1;
            const wFraction = new Fraction(0, wN, wD);
            if (wFraction.valueOf() !== resultFraction.valueOf() && wFraction.toString() !== correctText) {
                wrongOptions.add(wFraction.toString());
            }
        }

        const options = Array.from(wrongOptions).map(opt => ({ text: opt }));
        const correctOpt = { text: correctText };
        const correctIndex = Math.floor(Math.random() * 4);
        options.splice(correctIndex, 0, correctOpt);

        return {
            type: 'math',
            title: `🧮 분수를 더하고 빼 볼까요?`,
            desc: `다음 식의 알맞은 계산 결과를 구해보세요.<br><div class="math-expr"><b>${f1.toString()} ${op} ${f2.toString()} = ?</b></div>`,
            f1, f2, op,
            options: options,
            correctIndex: correctIndex
        };
    }
}

// 글로벌 등록
window.quizEngine = new QuizEngine();
