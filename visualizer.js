/**
 * 분수 시각화 엔진 (visualizer.js)
 * HTML5 Canvas를 사용해 분수를 귀엽고 명확한 피자(원형) 또는 초콜릿 바(막대형) 모델로 실시간 렌더링합니다.
 * 대분수(예: 2와 1/3 -> 꽉 찬 2개 + 1/3개 조각)까지 완벽하게 지원합니다.
 */

class FractionVisualizer {
    /**
     * 분수를 Canvas에 그리기
     * @param {HTMLCanvasElement} canvas - 그릴 대상 캔버스 요소
     * @param {Fraction} fraction - 그릴 Fraction 인스턴스
     * @param {string} mode - 'circle' (피자) 또는 'bar' (초콜릿)
     * @param {string} themeColor - 메인 렌더링 색상 (hex)
     */
    static draw(canvas, fraction, mode = 'circle', themeColor = '#FF6B6B') {
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        // 캔버스 크기 고해상도 대응
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || 300;
        const height = rect.height || 180;
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        // 분수 값 추출
        const whole = fraction.whole;
        const num = fraction.numerator;
        const denom = fraction.denominator;

        // 총 필요한 모델 수 계산 (대분수인 경우 whole + (num > 0 ? 1 : 0))
        // 단, 분자가 0인 경우에는 whole만큼만 그림
        const totalModels = whole + (num > 0 ? 1 : 0);

        if (totalModels === 0) {
            // 0인 경우 빈 원이나 빈 막대 하나를 그려줌
            if (mode === 'circle') {
                this.drawEmptyCircle(ctx, width / 2, height / 2, Math.min(width, height) * 0.35);
            } else {
                this.drawEmptyBar(ctx, 20, height / 2 - 20, width - 40, 40);
            }
            return;
        }

        if (mode === 'circle') {
            this.drawCircleModels(ctx, width, height, whole, num, denom, themeColor);
        } else {
            this.drawBarModels(ctx, width, height, whole, num, denom, themeColor);
        }
    }

    /**
     * 원형(피자) 모델 렌더링
     */
    static drawCircleModels(ctx, width, height, whole, num, denom, themeColor) {
        const totalModels = whole + (num > 0 ? 1 : 0);
        
        // 배치 설계: 최대 3개까지 가로로 배치, 그 이상은 적절히 분할
        const radius = Math.min((width - (totalModels + 1) * 15) / (totalModels * 2), height * 0.35);
        const centerY = height / 2;
        const spacing = (width - (totalModels * radius * 2)) / (totalModels + 1);

        for (let i = 0; i < totalModels; i++) {
            const centerX = spacing + radius + i * (radius * 2 + spacing);
            
            // i < whole 인 경우 완전 채움 모델
            const isFull = i < whole;
            const fillCount = isFull ? denom : num;

            // 1. 피자 채우기 영역 그리기
            if (fillCount > 0) {
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                if (isFull) {
                    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                } else {
                    // 초등학교 교육용 시각적 일치를 위해 12시( -Math.PI / 2 ) 방향부터 채움
                    const startAngle = -Math.PI / 2;
                    const endAngle = startAngle + (Math.PI * 2 * (fillCount / denom));
                    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
                }
                ctx.closePath();
                ctx.fillStyle = themeColor;
                ctx.globalAlpha = 0.85;
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }

            // 2. 피자 도우/외곽선 및 분할선 그리기
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#4A4A4A';
            ctx.stroke();

            // 분할선 그리기 (분모 > 1 인 경우에만)
            if (denom > 1 && (!isFull || fillCount > 0)) {
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(74, 74, 74, 0.4)';
                
                for (let j = 0; j < denom; j++) {
                    const angle = -Math.PI / 2 + (Math.PI * 2 * j / denom);
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    ctx.lineTo(
                        centerX + radius * Math.cos(angle),
                        centerY + radius * Math.sin(angle)
                    );
                    ctx.stroke();
                }
            }

            // 아래에 숫자 라벨 또는 텍스트 표시
            ctx.fillStyle = '#2D3748';
            ctx.font = 'bold 12px "Outfit", "Nanum Square Round", sans-serif';
            ctx.textAlign = 'center';
            if (isFull) {
                ctx.fillText("1 (전체)", centerX, centerY + radius + 22);
            } else {
                ctx.fillText(`${num}/${denom}`, centerX, centerY + radius + 22);
            }
        }
    }

    /**
     * 막대형(초콜릿) 모델 렌더링
     */
    static drawBarModels(ctx, width, height, whole, num, denom, themeColor) {
        const totalModels = whole + (num > 0 ? 1 : 0);
        
        // 막대 높이 및 크기 지정
        const barHeight = Math.min(height * 0.22, 35);
        const barWidth = width - 60;
        
        // 여러 개의 막대가 있는 경우 세로로 배치
        const startY = (height - (totalModels * barHeight + (totalModels - 1) * 18)) / 2;

        for (let i = 0; i < totalModels; i++) {
            const currentY = startY + i * (barHeight + 18);
            const isFull = i < whole;
            const fillCount = isFull ? denom : num;

            // 1. 채워진 영역 그리기 (부드러운 모서리 효과)
            if (fillCount > 0) {
                const filledWidth = barWidth * (fillCount / denom);
                ctx.fillStyle = themeColor;
                ctx.globalAlpha = 0.85;
                this.roundRect(ctx, 30, currentY, filledWidth, barHeight, 6);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }

            // 2. 전체 막대 외곽선 그리기
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#4A4A4A';
            this.roundRect(ctx, 30, currentY, barWidth, barHeight, 6);
            ctx.stroke();

            // 3. 막대 분할 칸선 그리기
            if (denom > 1) {
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(74, 74, 74, 0.4)';
                const pieceWidth = barWidth / denom;
                for (let j = 1; j < denom; j++) {
                    ctx.beginPath();
                    ctx.moveTo(30 + j * pieceWidth, currentY);
                    ctx.lineTo(30 + j * pieceWidth, currentY + barHeight);
                    ctx.stroke();
                }
            }

            // 오른쪽에 값 텍스트 표시
            ctx.fillStyle = '#2D3748';
            ctx.font = 'bold 12px "Outfit", "Nanum Square Round", sans-serif';
            ctx.textAlign = 'left';
            if (isFull) {
                ctx.fillText("1", width - 22, currentY + barHeight / 2 + 4);
            } else {
                ctx.fillText(`${num}/${denom}`, width - 25, currentY + barHeight / 2 + 4);
            }
        }
    }

    /**
     * 빈 원형 모델 (0인 경우)
     */
    static drawEmptyCircle(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#CBD5E0';
        ctx.stroke();

        ctx.fillStyle = '#718096';
        ctx.font = 'bold 14px "Nanum Square Round"';
        ctx.textAlign = 'center';
        ctx.fillText("0", x, y + 5);
    }

    /**
     * 빈 막대형 모델 (0인 경우)
     */
    static drawEmptyBar(ctx, x, y, w, h) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#CBD5E0';
        this.roundRect(ctx, x, y, w, h, 6);
        ctx.stroke();

        ctx.fillStyle = '#718096';
        ctx.font = 'bold 14px "Nanum Square Round"';
        ctx.textAlign = 'center';
        ctx.fillText("0", x + w / 2, y + h / 2 + 5);
    }

    /**
     * 둥근 사각형 그리기 헬퍼 함수
     */
    static roundRect(ctx, x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
        return ctx;
    }
}

// 브라우저 및 Node.js용 모듈 호환성 처리
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FractionVisualizer;
} else {
    window.FractionVisualizer = FractionVisualizer;
}
