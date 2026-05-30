/**
 * 스티커 샵 및 스티커북 모듈 (shop.js)
 * 사용자가 퀴즈로 번 골드를 가지고 귀여운 스티커를 상점에서 사고,
 * 스티커북 판에 드래그 앤 드롭하여 자신만의 그림을 꾸밀 수 있게 해 줍니다.
 * 완벽한 LocalStorage 세이브 기능과 부드러운 드래그 핸들링을 내장하고 있습니다.
 */

class ShopEngine {
    constructor() {
        // 귀여운 아동 취향 저격 스티커 컬렉션 정의
        this.stickers = [
            { id: 'lion', emoji: '🦁', name: '멋쟁이 사자', price: 30, desc: '으르렁! 용감한 사자 스티커' },
            { id: 'panda', emoji: '🐼', name: '딩굴 판다', price: 40, desc: '대나무를 좋아하는 귀여운 판다' },
            { id: 'fox', emoji: '🦊', name: '꼬마 여우', price: 50, desc: '똑똑하고 발랄한 꼬마 여우' },
            { id: 'dino', emoji: '🦖', name: '초록 공룡', price: 80, desc: '인기 만점 귀염둥이 티라노' },
            { id: 'unicorn', emoji: '🦄', name: '꿈나라 유니콘', price: 100, desc: '무지개를 타고 다니는 유니콘' },
            { id: 'penguin', emoji: '🐧', name: '신사 펭귄', price: 60, desc: '뒤뚱뒤뚱 귀여운 남극의 신사' },
            { id: 'rocket', emoji: '🚀', name: '우주 탐험선', price: 120, desc: '넓은 우주로 날아가는 로켓!' },
            { id: 'star', emoji: '⭐', name: '반짝 황금별', price: 20, desc: '밤하늘을 빛내는 반짝 황금별' },
            { id: 'pizza', emoji: '🍕', name: '토마토 피자', price: 50, desc: '분수 공부에 필수적인 맛있는 피자' },
            { id: 'donut', emoji: '🍩', name: '초코 도넛', price: 45, desc: '달콤한 초코 크림 도넛' },
            { id: 'rainbow', emoji: '🌈', name: '희망 무지개', price: 150, desc: '하늘에 떠오른 알록달록 무지개' },
            { id: 'crown', emoji: '👑', name: '반짝 왕관', price: 200, desc: '수학의 왕이 될 자를 위한 골드 왕관' }
        ];

        // 보유 중인 스티커 ID 리스트 로드 (기본 스티커 제공: star, pizza)
        const savedOwned = localStorage.getItem('fm_owned_stickers');
        this.ownedStickers = savedOwned ? JSON.parse(savedOwned) : ['star', 'pizza'];

        // 스티커북에 배치된 스티커 목록 { id, emoji, x, y, size } 로드
        const savedPlaced = localStorage.getItem('fm_placed_stickers');
        this.placedStickers = savedPlaced ? JSON.parse(savedPlaced) : [];
    }

    /**
     * 특정 스티커 구매 시도
     */
    buySticker(stickerId, quizEngine) {
        const sticker = this.stickers.find(s => s.id === stickerId);
        if (!sticker) return { success: false, reason: "존재하지 않는 스티커입니다." };
        if (this.ownedStickers.includes(stickerId)) return { success: false, reason: "이미 보유한 스티커입니다." };

        // 골드 소모 검증
        if (quizEngine.spendGold(sticker.price)) {
            this.ownedStickers.push(stickerId);
            localStorage.setItem('fm_owned_stickers', JSON.stringify(this.ownedStickers));
            
            // 효과음 재생
            if (window.soundEngine) window.soundEngine.playCoins();
            
            return { success: true, sticker };
        } else {
            return { success: false, reason: "골드가 부족합니다! 퀴즈를 더 풀어보세요!" };
        }
    }

    /**
     * 스티커북에 스티커 새로 배치하기
     */
    placeSticker(stickerId, x, y, size = 50) {
        const sticker = this.stickers.find(s => s.id === stickerId);
        if (!sticker || !this.ownedStickers.includes(stickerId)) return false;

        const newPlacement = {
            uniqueId: stickerId + '_' + Date.now(), // 고유 ID 생성
            id: stickerId,
            emoji: sticker.emoji,
            x: x,
            y: y,
            size: size
        };

        this.placedStickers.push(newPlacement);
        this.savePlacedStickers();
        return newPlacement;
    }

    /**
     * 배치된 스티커 삭제
     */
    removePlacedSticker(uniqueId) {
        this.placedStickers = this.placedStickers.filter(s => s.uniqueId !== uniqueId);
        this.savePlacedStickers();
    }

    /**
     * 배치된 스티커 이동 및 크기 조절 업데이트
     */
    updatePlacedSticker(uniqueId, updates) {
        const item = this.placedStickers.find(s => s.uniqueId === uniqueId);
        if (item) {
            Object.assign(item, updates);
            this.savePlacedStickers();
        }
    }

    savePlacedStickers() {
        localStorage.setItem('fm_placed_stickers', JSON.stringify(this.placedStickers));
    }

    /**
     * 스티커북 초기화 (초기 상태로 청소)
     */
    clearStickerBook() {
        this.placedStickers = [];
        this.savePlacedStickers();
    }
}

// 글로벌 등록
window.shopEngine = new ShopEngine();
