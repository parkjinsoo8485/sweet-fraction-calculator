/**
 * 분수 계산기 Core Math Engine (fraction.js)
 * 초등학교 교육용에 맞추어 대분수(Mixed Fraction), 진분수(Proper), 가분수(Improper)를 모두 지원하며,
 * 소수점 오차가 없도록 분자/분모 정수 쌍으로 연산합니다.
 * 또한 각 연산 과정의 통분, 계산, 약분 등의 상세 과정을 시각적으로 풀이해 줍니다.
 */

class Fraction {
    /**
     * @param {number} whole - 자연수 부분 (대분수인 경우)
     * @param {number} numerator - 분자
     * @param {number} denominator - 분모
     */
    constructor(whole, numerator, denominator) {
        this.whole = parseInt(whole) || 0;
        this.numerator = parseInt(numerator) || 0;
        this.denominator = parseInt(denominator) || 1;

        if (this.denominator === 0) {
            throw new Error("분모는 0이 될 수 없습니다.");
        }

        // 초등 교육용이므로 분모는 항상 양수로 정규화
        if (this.denominator < 0) {
            this.numerator = -this.numerator;
            this.denominator = -this.denominator;
        }

        this.normalize();
    }

    /**
     * 최대공약수 (Greatest Common Divisor) - 유클리드 호제법
     */
    static gcd(a, b) {
        a = Math.abs(a);
        b = Math.abs(b);
        while (b) {
            let t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    /**
     * 최소공배수 (Least Common Multiple)
     */
    static lcm(a, b) {
        if (a === 0 || b === 0) return 0;
        return Math.abs(a * b) / Fraction.gcd(a, b);
    }

    /**
     * 현재 분수를 가분수(Improper Fraction) 형태로 변환하여 [분자, 분모]로 반환
     */
    toImproper() {
        // 대분수의 가분수화: (자연수 * 분모) + 분자
        const impNumerator = (this.whole * this.denominator) + this.numerator;
        return {
            numerator: impNumerator,
            denominator: this.denominator
        };
    }

    /**
     * 가분수 형태를 대분수 형태로 내부 속성 정규화
     */
    normalize() {
        if (this.numerator === 0) {
            this.whole = 0;
            this.denominator = 1;
            return this;
        }

        // 1. 약분 (Simplify)
        const commonGcd = Fraction.gcd(this.numerator, this.denominator);
        this.numerator /= commonGcd;
        this.denominator /= commonGcd;

        // 2. 가분수를 대분수로 변환
        if (Math.abs(this.numerator) >= this.denominator) {
            const extraWhole = Math.floor(this.numerator / this.denominator);
            this.whole += extraWhole;
            this.numerator = this.numerator % this.denominator;
        }

        // 분자가 0이면 분모는 1로 통일
        if (this.numerator === 0) {
            this.denominator = 1;
        }

        return this;
    }

    /**
     * 기약분수 텍스트 표현 반환
     */
    toString() {
        if (this.whole > 0) {
            if (this.numerator === 0) return `${this.whole}`;
            return `${this.whole}와 ${this.numerator}/${this.denominator}`;
        }
        return `${this.numerator}/${this.denominator}`;
    }

    /**
     * 복제본 생성
     */
    clone() {
        return new Fraction(this.whole, this.numerator, this.denominator);
    }

    /**
     * 소수 값으로 변환 (시각화 또는 검증용)
     */
    valueOf() {
        return this.whole + (this.numerator / this.denominator);
    }

    /**
     * 가분수 상태의 정밀 덧셈 연산
     */
    static add(f1, f2) {
        const imp1 = f1.toImproper();
        const imp2 = f2.toImproper();

        const commonDenom = Fraction.lcm(imp1.denominator, imp2.denominator);
        
        const num1Multiplier = commonDenom / imp1.denominator;
        const num2Multiplier = commonDenom / imp2.denominator;

        const newNum1 = imp1.numerator * num1Multiplier;
        const newNum2 = imp2.numerator * num2Multiplier;
        const resultNum = newNum1 + newNum2;

        const explanation = {
            op: '+',
            f1: f1.clone(),
            f2: f2.clone(),
            imp1,
            imp2,
            commonDenom,
            num1Multiplier,
            num2Multiplier,
            newNum1,
            newNum2,
            resultNum,
            steps: []
        };

        // 해설 생성 단계 구축
        explanation.steps.push({
            title: "1. 가분수로 바꾸기",
            desc: "대분수가 있다면 먼저 계산하기 편하도록 가분수로 바꿉니다.",
            expr: `f1_imp = ${imp1.numerator}/${imp1.denominator}, f2_imp = ${imp2.numerator}/${imp2.denominator}`
        });

        if (imp1.denominator !== imp2.denominator) {
            explanation.steps.push({
                title: "2. 통분하기 (분모 같게 만들기)",
                desc: `두 분모 ${imp1.denominator}와 ${imp2.denominator}의 최소공배수인 <b>${commonDenom}</b>으로 분모를 같게 만듭니다.`,
                expr: `\\frac{${imp1.numerator} \\times ${num1Multiplier}}{${imp1.denominator} \\times ${num1Multiplier}} = \\frac{${newNum1}}{${commonDenom}} \\quad , \\quad \\frac{${imp2.numerator} \\times ${num2Multiplier}}{${imp2.denominator} \\times ${num2Multiplier}} = \\frac{${newNum2}}{${commonDenom}}`
            });
        } else {
            explanation.steps.push({
                title: "2. 분모 확인하기",
                desc: "두 분수의 분모가 이미 같으므로 통분할 필요가 없습니다.",
                expr: `\\text{공통 분모}: ${commonDenom}`
            });
        }

        explanation.steps.push({
            title: "3. 분자끼리 더하기",
            desc: "공통 분모 위에 두 분자를 더합니다.",
            expr: `\\frac{${newNum1} + ${newNum2}}{${commonDenom}} = \\frac{${resultNum}}{${commonDenom}}`
        });

        const finalFraction = new Fraction(0, resultNum, commonDenom);
        explanation.result = finalFraction.clone();

        const beforeSimplifyGcd = Fraction.gcd(resultNum, commonDenom);
        if (beforeSimplifyGcd > 1) {
            explanation.steps.push({
                title: "4. 약분하기 (기약분수로 만들기)",
                desc: `분자와 분모를 최대공약수인 <b>${beforeSimplifyGcd}</b>로 나누어 가장 간단한 분수로 만듭니다.`,
                expr: `\\frac{${resultNum} \\div ${beforeSimplifyGcd}}{${commonDenom} \\div ${beforeSimplifyGcd}} = \\frac{${resultNum / beforeSimplifyGcd}}{${commonDenom / beforeSimplifyGcd}}`
            });
        }

        if (finalFraction.whole > 0 && finalFraction.numerator > 0) {
            explanation.steps.push({
                title: "5. 대분수로 바꾸기",
                desc: `가분수 \\frac{${finalFraction.whole * finalFraction.denominator + finalFraction.numerator}}{${finalFraction.denominator}}를 자연수와 진분수가 합쳐진 대분수로 나타냅니다.`,
                expr: `${finalFraction.whole} \\frac{${finalFraction.numerator}}{${finalFraction.denominator}}`
            });
        }

        return { result: finalFraction, explanation };
    }

    /**
     * 가분수 상태의 정밀 뺄셈 연산
     */
    static subtract(f1, f2) {
        const imp1 = f1.toImproper();
        const imp2 = f2.toImproper();

        const commonDenom = Fraction.lcm(imp1.denominator, imp2.denominator);
        
        const num1Multiplier = commonDenom / imp1.denominator;
        const num2Multiplier = commonDenom / imp2.denominator;

        const newNum1 = imp1.numerator * num1Multiplier;
        const newNum2 = imp2.numerator * num2Multiplier;
        const resultNum = newNum1 - newNum2;

        const explanation = {
            op: '-',
            f1: f1.clone(),
            f2: f2.clone(),
            imp1,
            imp2,
            commonDenom,
            num1Multiplier,
            num2Multiplier,
            newNum1,
            newNum2,
            resultNum,
            steps: []
        };

        explanation.steps.push({
            title: "1. 가분수로 바꾸기",
            desc: "대분수가 있다면 먼저 계산하기 편하도록 가분수로 바꿉니다.",
            expr: `f1_imp = ${imp1.numerator}/${imp1.denominator}, f2_imp = ${imp2.numerator}/${imp2.denominator}`
        });

        if (imp1.denominator !== imp2.denominator) {
            explanation.steps.push({
                title: "2. 통분하기 (분모 같게 만들기)",
                desc: `두 분모 ${imp1.denominator}와 ${imp2.denominator}의 최소공배수인 <b>${commonDenom}</b>으로 분모를 같게 만듭니다.`,
                expr: `\\frac{${imp1.numerator} \\times ${num1Multiplier}}{${imp1.denominator} \\times ${num1Multiplier}} = \\frac{${newNum1}}{${commonDenom}} \\quad , \\quad \\frac{${imp2.numerator} \\times ${num2Multiplier}}{${imp2.denominator} \\times ${num2Multiplier}} = \\frac{${newNum2}}{${commonDenom}}`
            });
        } else {
            explanation.steps.push({
                title: "2. 분모 확인하기",
                desc: "두 분수의 분모가 이미 같으므로 통분할 필요가 없습니다.",
                expr: `\\text{공통 분모}: ${commonDenom}`
            });
        }

        explanation.steps.push({
            title: "3. 분자끼리 빼기",
            desc: "공통 분모 위에 첫 번째 분자에서 두 번째 분자를 뺍니다.",
            expr: `\\frac{${newNum1} - ${newNum2}}{${commonDenom}} = \\frac{${resultNum}}{${commonDenom}}`
        });

        if (resultNum < 0) {
            // 초등 수학에서는 음수를 배우지 않으므로, 이 상황에 대해 친근한 에러 처리를 돕기 위한 필드 설정
            explanation.isNegativeError = true;
        }

        const finalFraction = new Fraction(0, resultNum, commonDenom);
        explanation.result = finalFraction.clone();

        const beforeSimplifyGcd = Fraction.gcd(Math.abs(resultNum), commonDenom);
        if (beforeSimplifyGcd > 1 && resultNum !== 0) {
            explanation.steps.push({
                title: "4. 약분하기 (기약분수로 만들기)",
                desc: `분자와 분모를 최대공약수인 <b>${beforeSimplifyGcd}</b>로 나누어 가장 간단한 분수로 만듭니다.`,
                expr: `\\frac{${resultNum} \\div ${beforeSimplifyGcd}}{${commonDenom} \\div ${beforeSimplifyGcd}} = \\frac{${resultNum / beforeSimplifyGcd}}{${commonDenom / beforeSimplifyGcd}}`
            });
        }

        if (finalFraction.whole > 0 && finalFraction.numerator > 0) {
            explanation.steps.push({
                title: "5. 대분수로 바꾸기",
                desc: `가분수를 자연수와 진분수가 합쳐진 대분수로 나타냅니다.`,
                expr: `${finalFraction.whole} \\frac{${finalFraction.numerator}}{${finalFraction.denominator}}`
            });
        }

        return { result: finalFraction, explanation };
    }

    /**
     * 가분수 상태의 정밀 곱셈 연산
     */
    static multiply(f1, f2) {
        const imp1 = f1.toImproper();
        const imp2 = f2.toImproper();

        const resultNum = imp1.numerator * imp2.numerator;
        const resultDenom = imp1.denominator * imp2.denominator;

        const explanation = {
            op: '×',
            f1: f1.clone(),
            f2: f2.clone(),
            imp1,
            imp2,
            resultNum,
            resultDenom,
            steps: []
        };

        explanation.steps.push({
            title: "1. 가분수로 바꾸기",
            desc: "대분수가 있다면 분자/분모만 있는 가분수 형태로 곱할 준비를 합니다.",
            expr: `f1_imp = ${imp1.numerator}/${imp1.denominator}, f2_imp = ${imp2.numerator}/${imp2.denominator}`
        });

        explanation.steps.push({
            title: "2. 분모는 분모끼리, 분자는 분자끼리 곱하기",
            desc: "분모 두 개를 곱해 분모 자리에 쓰고, 분자 두 개를 곱해 분자 자리에 씁니다.",
            expr: `\\frac{${imp1.numerator} \\times ${imp2.numerator}}{${imp1.denominator} \\times ${imp2.denominator}} = \\frac{${resultNum}}{${resultDenom}}`
        });

        const finalFraction = new Fraction(0, resultNum, resultDenom);
        explanation.result = finalFraction.clone();

        const beforeSimplifyGcd = Fraction.gcd(resultNum, resultDenom);
        if (beforeSimplifyGcd > 1) {
            explanation.steps.push({
                title: "3. 약분하기 (기약분수로 만들기)",
                desc: `분자와 분모를 최대공약수인 <b>${beforeSimplifyGcd}</b>로 나누어 가장 간단한 분수로 약분합니다.`,
                expr: `\\frac{${resultNum} \\div ${beforeSimplifyGcd}}{${resultDenom} \\div ${beforeSimplifyGcd}} = \\frac{${resultNum / beforeSimplifyGcd}}{${resultDenom / beforeSimplifyGcd}}`
            });
        }

        if (finalFraction.whole > 0 && finalFraction.numerator > 0) {
            explanation.steps.push({
                title: "4. 대분수로 바꾸기",
                desc: `가분수를 대분수로 나타내어 마무리합니다.`,
                expr: `${finalFraction.whole} \\frac{${finalFraction.numerator}}{${finalFraction.denominator}}`
            });
        }

        return { result: finalFraction, explanation };
    }

    /**
     * 가분수 상태의 정밀 나눗셈 연산
     */
    static divide(f1, f2) {
        const imp1 = f1.toImproper();
        const imp2 = f2.toImproper();

        if (imp2.numerator === 0) {
            throw new Error("0으로 나눌 수 없습니다.");
        }

        // 나눗셈: 첫번째 가분수 * 두번째 가분수의 역수
        const flippedNumerator = imp2.denominator;
        const flippedDenominator = imp2.numerator;

        const resultNum = imp1.numerator * flippedNumerator;
        const resultDenom = imp1.denominator * flippedDenominator;

        const explanation = {
            op: '÷',
            f1: f1.clone(),
            f2: f2.clone(),
            imp1,
            imp2,
            resultNum,
            resultDenom,
            steps: []
        };

        explanation.steps.push({
            title: "1. 가분수로 바꾸기",
            desc: "계산하기 편리하도록 대분수를 모두 가분수 형태로 바꿉니다.",
            expr: `f1_imp = ${imp1.numerator}/${imp1.denominator}, f2_imp = ${imp2.numerator}/${imp2.denominator}`
        });

        explanation.steps.push({
            title: "2. 나누기를 곱하기로 바꾸고 분수 뒤집기 (역수 곱하기)",
            desc: "나누기 기호(÷)를 곱하기(×)로 바꾸는 대신, 나누는 분수의 분자와 분모를 서로 위아래로 뒤집습니다.",
            expr: `\\frac{${imp1.numerator}}{${imp1.denominator}} \\div \\frac{${imp2.numerator}}{${imp2.denominator}} = \\frac{${imp1.numerator}}{${imp1.denominator}} \\times \\frac{${flippedNumerator}}{${flippedDenominator}}`
        });

        explanation.steps.push({
            title: "3. 곱하기 계산하기",
            desc: "분자는 분자끼리, 분모는 분모끼리 곱하여 계산합니다.",
            expr: `\\frac{${imp1.numerator} \\times ${flippedNumerator}}{${imp1.denominator} \\times ${flippedDenominator}} = \\frac{${resultNum}}{${resultDenom}}`
        });

        const finalFraction = new Fraction(0, resultNum, resultDenom);
        explanation.result = finalFraction.clone();

        const beforeSimplifyGcd = Fraction.gcd(resultNum, resultDenom);
        if (beforeSimplifyGcd > 1) {
            explanation.steps.push({
                title: "4. 약분하기 (기약분수로 만들기)",
                desc: `분자와 분모를 최대공약수인 <b>${beforeSimplifyGcd}</b>로 나누어 가장 간단히 만듭니다.`,
                expr: `\\frac{${resultNum} \\div ${beforeSimplifyGcd}}{${resultDenom} \\div ${beforeSimplifyGcd}} = \\frac{${resultNum / beforeSimplifyGcd}}{${resultDenom / beforeSimplifyGcd}}`
            });
        }

        if (finalFraction.whole > 0 && finalFraction.numerator > 0) {
            explanation.steps.push({
                title: "5. 대분수로 바꾸기",
                desc: `가분수를 대분수로 아름답게 정리합니다.`,
                expr: `${finalFraction.whole} \\frac{${finalFraction.numerator}}{${finalFraction.denominator}}`
            });
        }

        return { result: finalFraction, explanation };
    }
}

// 브라우저 및 Node.js(테스트용) 공용 모듈 수출 설정
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Fraction;
} else {
    window.Fraction = Fraction;
}
