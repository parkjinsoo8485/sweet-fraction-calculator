/**
 * 실시간 오디오 신디사이저 엔진 (sound.js)
 * Web Audio API를 사용해 별도의 오디오 파일 다운로드 없이 브라우저에서
 * 다양한 고품질 효과음(클릭음, 정답, 오답, 동전 구매, 팡파르)을 직접 합성합니다.
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
    }

    /**
     * 오디오 컨텍스트 초기화 (사용자 상호작용 후 호출되어야 브라우저 보안 규정 우회 가능)
     */
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * 버튼 클릭 시 가벼운 통통 효과음
     */
    playTap() {
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    /**
     * 퀴즈 정답 시 기분 좋은 띵동 효과음
     */
    playCorrect() {
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const playTone = (freq, start, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.0, start);
            gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + duration);
        };

        // 도 - 미 (C5 -> E5) 2단 화음 음계
        playTone(523.25, now, 0.15); // 도
        playTone(659.25, now + 0.08, 0.35); // 미
    }

    /**
     * 퀴즈 오답 시 삐익 저음 효과음
     */
    playWrong() {
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now); // A3
        osc.frequency.linearRampToValueAtTime(150, now + 0.3);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    /**
     * 상점에서 물건 살 때 찰랑이는 동전 효과음
     */
    playCoins() {
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const playClink = (delay, freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);

            gain.gain.setValueAtTime(0.15, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + delay);
            osc.stop(now + delay + 0.08);
        };

        // 세 번 찰랑이는 소리
        playClink(0.0, 987.77);  // B5
        playClink(0.04, 1174.66); // D6
        playClink(0.08, 1318.51); // E6
    }

    /**
     * 스펙타클한 성공 팡파르 효과음
     */
    playFanfare() {
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const notes = [
            { freq: 523.25, time: 0.0, duration: 0.1 },  // C5
            { freq: 523.25, time: 0.1, duration: 0.1 },  // C5
            { freq: 523.25, time: 0.2, duration: 0.1 },  // C5
            { freq: 659.25, time: 0.3, duration: 0.2 },  // E5
            { freq: 587.33, time: 0.5, duration: 0.2 },  // D5
            { freq: 783.99, time: 0.7, duration: 0.6 }   // G5
        ];

        notes.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, now + note.time);

            gain.gain.setValueAtTime(0.15, now + note.time);
            gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + note.time);
            osc.stop(now + note.time + note.duration);
        });
    }
}

// 싱글톤 패턴으로 글로벌 선언
window.soundEngine = new SoundEngine();
