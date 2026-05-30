import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ==================== 수학 유틸리티 ==================== */
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { let t = b; b = a % b; a = t; } return a || 1; };
const lcm = (a, b) => (a * b) / gcd(a, b);

function calculate(n1, d1, op, n2, d2) {
  if (d1 <= 0 || d2 <= 0 || (op === '÷' && n2 === 0)) return null;
  let rN, rD;
  const steps = [];

  const fmtFrac = (n, d) => d === 1 ? `${n}` : `${n}/${d}`;

  if (op === '+' || op === '-') {
    if (d1 === d2) {
      rD = d1;
      rN = op === '+' ? n1 + n2 : n1 - n2;
      steps.push({
        title: '✅ 분모가 같아요!',
        desc: `분모가 ${d1}로 같으니까\n분자끼리 바로 ${op === '+' ? '더해요' : '빼요'}!\n\n${n1} ${op} ${n2} = ${rN}`,
        highlight: `${n1}/${d1} ${op} ${n2}/${d2} = ${rN}/${rD}`
      });
    } else {
      const L = lcm(d1, d2);
      const m1 = L / d1, m2 = L / d2;
      const tN1 = n1 * m1, tN2 = n2 * m2;
      steps.push({
        title: '🔧 통분해요!',
        desc: `분모가 달라서 공통 분모를 찾아요.\n두 분모 ${d1}과 ${d2}의 최소공배수는 ${L}!\n\n• ${fmtFrac(n1,d1)} → ${fmtFrac(n1,d1)} × ${m1}/${m1} = ${fmtFrac(tN1,L)}\n• ${fmtFrac(n2,d2)} → ${fmtFrac(n2,d2)} × ${m2}/${m2} = ${fmtFrac(tN2,L)}`,
        highlight: `${fmtFrac(tN1,L)} ${op} ${fmtFrac(tN2,L)}`
      });
      rD = L;
      rN = op === '+' ? tN1 + tN2 : tN1 - tN2;
      steps.push({
        title: `✏️ 분자끼리 ${op === '+' ? '더해요' : '빼요'}!`,
        desc: `이제 분모가 같으니 분자끼리 계산해요!\n${tN1} ${op} ${tN2} = ${rN}`,
        highlight: `${fmtFrac(tN1,L)} ${op} ${fmtFrac(tN2,L)} = ${fmtFrac(rN,rD)}`
      });
    }
  } else if (op === '×') {
    rN = n1 * n2; rD = d1 * d2;
    steps.push({
      title: '✖️ 분자는 분자끼리, 분모는 분모끼리!',
      desc: `곱하기는 간단해요!\n분자: ${n1} × ${n2} = ${rN}\n분모: ${d1} × ${d2} = ${rD}`,
      highlight: `${fmtFrac(n1,d1)} × ${fmtFrac(n2,d2)} = ${fmtFrac(rN,rD)}`
    });
  } else if (op === '÷') {
    rN = n1 * d2; rD = d1 * n2;
    steps.push({
      title: '🔄 뒤 분수를 뒤집어요!',
      desc: `나누기 비법: 뒤의 분수를 뒤집어서 곱해요!\n${fmtFrac(n1,d1)} ÷ ${fmtFrac(n2,d2)}\n= ${fmtFrac(n1,d1)} × ${fmtFrac(d2,n2)}\n= ${fmtFrac(rN,rD)}`,
      highlight: `${fmtFrac(n1,d1)} × ${fmtFrac(d2,n2)} = ${fmtFrac(rN,rD)}`
    });
  }

  const neg = rN < 0;
  const absN = Math.abs(rN);
  const g = gcd(absN, rD);
  let fN = absN / g, fD = rD / g;
  if (g > 1) {
    steps.push({
      title: '✂️ 약분할 수 있어요!',
      desc: `${absN}과 ${rD}를 공약수 ${g}로 나눠요!\n${absN} ÷ ${g} = ${fN}\n${rD} ÷ ${g} = ${fD}`,
      highlight: `${fmtFrac(absN,rD)} = ${fmtFrac(fN,fD)}`
    });
  }
  let fW = 0, fRN = fN;
  if (fN >= fD && fD > 0) {
    fW = Math.floor(fN / fD);
    fRN = fN % fD;
    if (fRN === 0) {
      steps.push({ title: '🎁 자연수가 됐어요!', desc: `${fN}/${fD} = ${fW}`, highlight: `= ${fW}` });
    } else {
      steps.push({
        title: '🏠 대분수로 바꿔요!',
        desc: `${fN} ÷ ${fD} = ${fW} 나머지 ${fRN}\n가분수 ${fmtFrac(fN,fD)} = ${fW}과 ${fmtFrac(fRN,fD)}`,
        highlight: `= ${fW}과 ${fmtFrac(fRN,fD)}`
      });
    }
  }

  return { neg, rN, rD, fN, fD, fW, fRN, steps, g };
}

function makeQuiz(level = 1) {
  const maxDen = level === 1 ? 4 : level === 2 ? 6 : 9;
  const ops = level === 1 ? ['+', '-'] : level === 2 ? ['+', '-', '×'] : ['+', '-', '×', '÷'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let d1 = Math.floor(Math.random() * (maxDen - 1)) + 2;
  let d2 = op === '-' ? d1 : Math.floor(Math.random() * (maxDen - 1)) + 2;
  let n1 = Math.floor(Math.random() * (d1 - 1)) + 1;
  let n2 = Math.floor(Math.random() * (d2 - 1)) + 1;
  if (op === '-' && n1 < n2) { const t = n1; n1 = n2; n2 = t; }
  const res = calculate(n1, d1, op, n2, d2);
  if (!res) return makeQuiz(level);
  return { n1, d1, op, n2, d2, ansW: res.fW, ansN: res.fRN, ansD: res.fRN === 0 ? 1 : res.fD, level };
}

/* ==================== 세로 분수 컴포넌트 & 파서 ==================== */
function Frac({ w = 0, n, d, color, fontSize = 'inherit', neg = false }) {
  const isMixed = w > 0;
  const hasFrac = n > 0 && d > 0;

  return (
    <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      verticalAlign: 'middle',
      fontFamily: 'Nunito, "Nanum Gothic", sans-serif',
      color: color || 'inherit',
      fontSize: fontSize,
      margin: '0 4px'
    }}>
      {neg && <span style={{ marginRight: '3px', fontWeight: 900 }}>−</span>}
      {isMixed && (
        <span style={{ 
          fontSize: '1.2em', 
          fontWeight: 900, 
          marginRight: '3px',
          color: '#B45309', // 정수 부분 강조
          transform: 'translateY(-1px)'
        }}>
          {w}
        </span>
      )}
      {hasFrac ? (
        <span style={{ 
          display: 'inline-flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          lineHeight: 1.1,
          verticalAlign: 'middle',
          padding: '0 2px',
          minWidth: '18px'
        }}>
          <span style={{ fontSize: '0.85em', fontWeight: 900, paddingBottom: '1px' }}>{n}</span>
          <span style={{ 
            display: 'block', 
            width: '100%', 
            height: '2.5px', 
            backgroundColor: color || 'currentColor', 
            borderRadius: '1px',
            margin: '1px 0'
          }} />
          <span style={{ fontSize: '0.85em', fontWeight: 900, paddingTop: '1px' }}>{d}</span>
        </span>
      ) : (
        !isMixed && <span style={{ fontWeight: 900 }}>0</span>
      )}
    </span>
  );
}

function parseMath(text, color) {
  if (typeof text !== 'string') return text;
  
  // We want to match:
  // 1. Mixed fractions like: "1과 2/3" or "2와 3/5" or "-1과 2/3" (optional negative sign)
  //    Pattern: (-?\d+)\s*(?:과|와)\s*(\d+)\s*\/\s*(\d+)
  // 2. Simple fractions like: "4/12" or "-4/12" or "1/3"
  //    Pattern: (-?\d+)\s*\/\s*(\d+)
  
  const regex = /(-?\d+)\s*(?:과|와)\s*(\d+)\s*\/\s*(\d+)|(-?\d+)\s*\/\s*(\d+)/g;
  
  const elements = [];
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }
    
    const [fullMatch, mixedW, mixedN, mixedD, simpleN, simpleD] = match;
    
    if (mixedW !== undefined) {
      const wVal = parseInt(mixedW, 10);
      const nVal = parseInt(mixedN, 10);
      const dVal = parseInt(mixedD, 10);
      const isNeg = wVal < 0;
      elements.push(
        <Frac 
          key={match.index} 
          w={Math.abs(wVal)} 
          n={nVal} 
          d={dVal} 
          neg={isNeg} 
          color={color} 
        />
      );
    } else if (simpleN !== undefined) {
      const nVal = parseInt(simpleN, 10);
      const dVal = parseInt(simpleD, 10);
      const isNeg = nVal < 0;
      elements.push(
        <Frac 
          key={match.index} 
          n={Math.abs(nVal)} 
          d={dVal} 
          neg={isNeg} 
          color={color} 
        />
      );
    }
    
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }
  
  return elements.length > 0 ? elements : text;
}

/* ==================== Web Audio 효과음 ==================== */
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    if (type === 'correct') {
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = freq;
        osc.connect(g); g.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.15);
        osc.start(ctx.currentTime + i * 0.1); osc.stop(ctx.currentTime + i * 0.1 + 0.15);
      });
    } else if (type === 'wrong') {
      [300, 250].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'square'; osc.frequency.value = freq;
        osc.connect(g); g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.2);
        osc.start(ctx.currentTime + i * 0.15); osc.stop(ctx.currentTime + i * 0.15 + 0.2);
      });
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = 440;
      osc.connect(g); g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start(); osc.stop(ctx.currentTime + 0.05);
    }
  } catch (e) { /* ignore if audio not available */ }
}

/* ==================== 로컬 스토리지 헬퍼 ==================== */
const LS_KEY = 'sweetFractionApp_v2';
function loadState() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}
function saveState(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

/* ==================== 막대 모델 시각화 ==================== */
function BarModel({ num, den, color = '#A855F7', label }) {
  if (den <= 0 || den > 20) return null;
  const segments = [];
  const safeNum = Math.min(num, den);
  for (let i = 0; i < den; i++) {
    segments.push(
      <div
        key={i}
        style={{
          flex: 1,
          backgroundColor: i < safeNum ? color : '#EDE9FE',
          borderRight: i < den - 1 ? '2.5px solid rgba(255,255,255,0.9)' : 'none',
          transition: 'background-color 0.3s ease',
        }}
      />
    );
  }
  return (
    <div style={{ marginBottom: 10 }}>
      {label && (
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.3px', display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap' }}>
          {parseMath(label, color)}
        </div>
      )}
      <div style={{ display: 'flex', height: 36, borderRadius: 10, overflow: 'hidden', border: `3px solid ${color}`, boxShadow: `0 3px 0 ${color}88` }}>
        {segments}
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.88rem', fontWeight: 800, color, marginTop: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        {parseMath(`${safeNum}/${den}`)} = {Math.round((safeNum / den) * 100)}%
      </div>
    </div>
  );
}

/* ==================== 파이 차트 시각화 ==================== */
function PieModel({ num, den, color = '#A855F7', label }) {
  if (den <= 0 || den > 12) return null;
  const radius = 40;
  const cx = 50, cy = 50;
  const segments = [];
  const angleStep = (2 * Math.PI) / den;

  for (let i = 0; i < den; i++) {
    const startAngle = i * angleStep - Math.PI / 2;
    const endAngle = (i + 1) * angleStep - Math.PI / 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = angleStep > Math.PI ? 1 : 0;
    const filled = i < num;
    segments.push(
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={filled ? color : '#EDE9FE'}
        stroke="white"
        strokeWidth="2"
        style={{ transition: 'fill 0.3s ease' }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
      {label && <div style={{ fontSize: '0.8rem', fontWeight: 800, color, marginBottom: 4, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center' }}>{parseMath(label, color)}</div>}
      <svg width="90" height="90" viewBox="0 0 100 100">
        {segments}
      </svg>
      <div style={{ fontSize: '0.88rem', fontWeight: 800, color, marginTop: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {parseMath(`${num}/${den}`, color)}
      </div>
    </div>
  );
}

/* ==================== 스핀 입력 그룹 ==================== */
function SpinInput({ value, onChange, label, min = 0, max = 99, wide = false, yellowStyle = false }) {
  const handleUp = () => { onChange(Math.min(max, value + 1)); playSound('click'); };
  const handleDown = () => { onChange(Math.max(min, value - 1)); playSound('click'); };
  const handleChange = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
  };

  const inputStyle = yellowStyle ? {
    background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
    borderColor: '#FCD34D',
    boxShadow: '0 3px 0 #D97706',
    color: '#92400E',
  } : {};

  const spinStyle = yellowStyle ? {
    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
    boxShadow: '0 2px 0 #B45309',
  } : {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <button className="spin-btn" style={spinStyle} onClick={handleUp}>▲</button>
      <input
        type="number"
        value={value}
        onChange={handleChange}
        className={`num-input${yellowStyle ? ' whole' : ''}`}
        style={{ width: wide ? 84 : 68, height: wide ? 80 : 68, fontSize: wide ? '2rem' : '1.8rem', ...inputStyle }}
        min={min}
        max={max}
      />
      <button className="spin-btn" style={spinStyle} onClick={handleDown}>▼</button>
      {label && <div className="input-label">{label}</div>}
    </div>
  );
}

/* ==================== 배지 시스템 ==================== */
const BADGES = [
  { id: 'first', icon: '🌟', name: '첫 걸음!', desc: '첫 퀴즈 통과', req: (s) => s.total >= 1 },
  { id: 'streak3', icon: '🔥', name: '연속의 불꽃!', desc: '3연속 정답', req: (s) => s.maxStreak >= 3 },
  { id: 'streak5', icon: '⚡', name: '번개 천재!', desc: '5연속 정답', req: (s) => s.maxStreak >= 5 },
  { id: 'score10', icon: '🏆', name: '10점 달성!', desc: '퀴즈 10점 획득', req: (s) => s.score >= 10 },
  { id: 'score30', icon: '👑', name: '분수 왕!', desc: '퀴즈 30점 획득', req: (s) => s.score >= 30 },
  { id: 'level2', icon: '🚀', name: '레벨 업!', desc: '레벨 2 도달', req: (s) => s.level >= 2 },
  { id: 'level3', icon: '💎', name: '전문가!', desc: '레벨 3 도달', req: (s) => s.level >= 3 },
  { id: 'perfect5', icon: '✨', name: '퍼펙트 5!', desc: '5문제 연속 완벽', req: (s) => s.perfectRun >= 5 },
];

/* ==================== 메인 앱 ==================== */
export default function App() {
  /* 탭 */
  const [tab, setTab] = useState('calc');

  /* 계산기 상태 */
  const [mode, setMode] = useState('simple');
  const [w1, setW1] = useState(0);
  const [n1, setN1] = useState(1);
  const [d1, setD1] = useState(3);
  const [op, setOp] = useState('+');
  const [w2, setW2] = useState(0);
  const [n2, setN2] = useState(1);
  const [d2, setD2] = useState(4);
  const [visualMode, setVisualMode] = useState('bar'); // 'bar' | 'pie'
  const [showSteps, setShowSteps] = useState(true);

  /* 퀴즈 상태 */
  const [quiz, setQuiz] = useState(null);
  const [ansW, setAnsW] = useState('');
  const [ansN, setAnsN] = useState('');
  const [ansD, setAnsD] = useState('');
  const [feedback, setFeedback] = useState(null);

  /* 통계 (영속) */
  const [stats, setStats] = useState(() => {
    const s = loadState();
    return {
      score: s.score || 0,
      total: s.total || 0,
      streak: s.streak || 0,
      maxStreak: s.maxStreak || 0,
      level: s.level || 1,
      perfectRun: s.perfectRun || 0,
      badges: s.badges || [],
    };
  });

  /* 새 배지 알림 */
  const [newBadge, setNewBadge] = useState(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  /* 마스코트 */
  const MASCOT_TIPS = {
    '+': '분모가 다르면 통분부터!\n두 분모의 최소공배수를 찾아요 🔧',
    '-': '빼기도 통분이 먼저예요!\n큰 수에서 작은 수를 빼요 ✂️',
    '×': '곱하기는 쉬워요!\n분자끼리, 분모끼리 곱해요 ✖️',
    '÷': '나누기는 뒤 분수를 뒤집어요!\n역수를 곱하는 거예요 🔄',
  };
  const [mascotMsg, setMascotMsg] = useState('안녕! 나는 분수 도사 뿡이야! 🎉\n같이 분수를 배워볼까요?');

  /* 실제 계산에 사용할 분자 */
  const calcN1 = mode === 'mixed' ? w1 * d1 + n1 : n1;
  const calcN2 = mode === 'mixed' ? w2 * d2 + n2 : n2;
  const result = calculate(calcN1, d1, op, calcN2, d2);

  /* 마스코트 메시지 업데이트 */
  useEffect(() => {
    if (!result) { setMascotMsg('앗! 0으로 나눌 수는 없어요! 숫자를 바꿔봐요 😅'); return; }
    setMascotMsg(MASCOT_TIPS[op]);
  }, [op, d1, d2]);

  /* 통계 저장 */
  useEffect(() => {
    saveState(stats);
  }, [stats]);

  /* 배지 체크 */
  useEffect(() => {
    const earned = BADGES.filter(b => !stats.badges.includes(b.id) && b.req(stats));
    if (earned.length > 0) {
      const badge = earned[0];
      setStats(s => ({ ...s, badges: [...s.badges, badge.id] }));
      setNewBadge(badge);
      setShowBadgeModal(true);
      playSound('correct');
    }
  }, [stats.score, stats.streak, stats.maxStreak, stats.level, stats.perfectRun]);

  /* 레벨 업 로직 */
  const computeLevel = (score) => {
    if (score >= 30) return 3;
    if (score >= 10) return 2;
    return 1;
  };

  /* 퀴즈 시작 */
  useEffect(() => {
    if (tab === 'quiz' && !quiz) setQuiz(makeQuiz(stats.level));
  }, [tab, quiz]);

  const startNewQuiz = () => {
    setQuiz(makeQuiz(stats.level));
    setAnsW(''); setAnsN(''); setAnsD('');
    setFeedback(null);
  };

  const checkAnswer = () => {
    if (!quiz || feedback) return;
    const uw = parseInt(ansW || '0', 10);
    const un = parseInt(ansN || '0', 10);
    const ud = parseInt(ansD || '1', 10);
    const correct =
      uw === quiz.ansW &&
      un === quiz.ansN &&
      (quiz.ansN === 0 || ud === quiz.ansD);

    if (correct) {
      setFeedback('correct');
      playSound('correct');
      setStats(s => {
        const newScore = s.score + 1;
        const newStreak = s.streak + 1;
        const newMaxStreak = Math.max(s.maxStreak, newStreak);
        const newPerfectRun = newStreak >= 5 ? Math.max(s.perfectRun, newStreak) : s.perfectRun;
        return {
          ...s,
          score: newScore,
          total: s.total + 1,
          streak: newStreak,
          maxStreak: newMaxStreak,
          level: computeLevel(newScore),
          perfectRun: newPerfectRun,
        };
      });
    } else {
      setFeedback('wrong');
      playSound('wrong');
      setStats(s => ({ ...s, total: s.total + 1, streak: 0 }));
    }
  };

  /* 탭 핸들러 */
  const handleTabChange = (newTab) => {
    playSound('click');
    setTab(newTab);
  };

  const TABS = [
    { id: 'calc', icon: '🧮', label: '계산기' },
    { id: 'quiz', icon: '🎯', label: '퀴즈' },
    { id: 'concept', icon: '📚', label: '개념' },
    { id: 'trophy', icon: '🏆', label: '내 기록' },
  ];

  const levelInfo = [
    { level: 1, label: '입문', color: '#4ADE80', bgColor: '#DCFCE7', nextReq: 10 },
    { level: 2, label: '중급', color: '#38BDF8', bgColor: '#E0F2FE', nextReq: 30 },
    { level: 3, label: '전문가', color: '#A855F7', bgColor: '#EDE9FE', nextReq: null },
  ][stats.level - 1];

  return (
    <div className="app-wrapper">

      {/* ===== 배지 획득 모달 ===== */}
      {showBadgeModal && newBadge && (
        <div
          onClick={() => setShowBadgeModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 28, padding: '32px 28px', textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '4px solid #A855F7',
              animation: 'bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              maxWidth: 340, width: '100%',
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: 8, animation: 'bounceEmoji 0.8s ease' }}>
              {newBadge.icon}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#7C3AED', marginBottom: 4 }}>
              배지 획득!
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1E1B4B', marginBottom: 8 }}>
              {newBadge.name}
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#6B7280', marginBottom: 20 }}>
              {newBadge.desc}
            </div>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setShowBadgeModal(false)}
            >
              🎉 감사해요!
            </button>
          </div>
        </div>
      )}

      {/* ===== 헤더 ===== */}
      <header className="app-header">
        <h1 className="app-title">🍰 달콤 분수 계산기</h1>
        <p className="app-subtitle">분수를 맛있게 배워요!</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <div className="score-badge">
            <span>🏆</span> {stats.score}점
          </div>
          <div className="score-badge">
            <span>🎯</span> {stats.total}문제
          </div>
          {stats.streak >= 2 && (
            <div className="score-badge" style={{ background: 'rgba(251,191,36,0.3)', borderColor: 'rgba(251,191,36,0.6)' }}>
              🔥 {stats.streak}연속!
            </div>
          )}
          <div
            className="score-badge"
            style={{ background: `${levelInfo.color}44`, borderColor: `${levelInfo.color}99` }}
          >
            ⭐ {levelInfo.label}
          </div>
        </div>
      </header>

      {/* ===== 탭 네비게이션 ===== */}
      <nav className="tab-nav" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-nav-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => handleTabChange(t.id)}
          >
            <span className="tab-icon" style={{ fontSize: '1.3rem' }}>{t.icon}</span>
            <span style={{ fontSize: '0.75rem' }}>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* ========================= 계산기 탭 ========================= */}
      {tab === 'calc' && (
        <div>
          {/* 마스코트 */}
          <div className="mascot-box">
            <span className="mascot-emoji">🐼</span>
            <div className="mascot-bubble">
              <div className="mascot-name">뿡이 선생님</div>
              <div className="mascot-speech">{mascotMsg}</div>
            </div>
          </div>

          {/* 분수 타입 선택 */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">📝 분수 타입</div>
            <div className="type-toggle">
              <button className={`type-btn ${mode === 'simple' ? 'active' : ''}`} onClick={() => { setMode('simple'); playSound('click'); }}>
                진분수 / 가분수
              </button>
              <button className={`type-btn ${mode === 'mixed' ? 'active' : ''}`} onClick={() => { setMode('mixed'); playSound('click'); }}>
                🔢 대분수 모드
              </button>
            </div>
          </div>

          {/* 분수 입력 카드 */}
          <div className="card">
            <div className="card-title">✏️ 숫자를 넣어보세요!</div>

            <div className="fraction-calculator" style={{ gap: 12, padding: '20px 8px' }}>
              {/* 첫 번째 분수 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {mode === 'mixed' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <SpinInput value={w1} onChange={setW1} label="" min={0} yellowStyle />
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#B45309', marginTop: 6 }}>자연수</div>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7C3AED', marginBottom: 2 }}>분자</div>
                  <SpinInput value={n1} onChange={setN1} label="" min={0} />
                  <div className="fraction-line" style={{ margin: '4px 0' }} />
                  <SpinInput value={d1} onChange={v => setD1(Math.max(1, v))} label="" min={1} />
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7C3AED', marginTop: 4 }}>분모</div>
                </div>
              </div>

              {/* 연산자 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#A855F7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>연산</div>
                <select
                  className="operator-select"
                  value={op}
                  onChange={e => { setOp(e.target.value); playSound('click'); }}
                >
                  {['+', '-', '×', '÷'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* 두 번째 분수 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {mode === 'mixed' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <SpinInput value={w2} onChange={setW2} label="" min={0} yellowStyle />
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#B45309', marginTop: 6 }}>자연수</div>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7C3AED', marginBottom: 2 }}>분자</div>
                  <SpinInput value={n2} onChange={setN2} label="" min={0} />
                  <div className="fraction-line" style={{ margin: '4px 0' }} />
                  <SpinInput value={d2} onChange={v => setD2(Math.max(1, v))} label="" min={1} />
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7C3AED', marginTop: 4 }}>분모</div>
                </div>
              </div>
            </div>
          </div>

          {/* 결과 */}
          {result && (
            <div className="result-section">
              {/* 결과 큰 카드 */}
              <div className="result-card">
                <div className="result-label">🎉 계산 결과</div>
                <div className="result-fraction-display">
                  {result.neg && (
                    <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'white', textShadow: '0 2px 0 rgba(0,0,0,0.2)' }}>−</span>
                  )}
                  {result.fW > 0 && (
                    <span className="result-whole-num">{result.fW}</span>
                  )}
                  {result.fRN > 0 && (
                    <div className="result-vulgar">
                      <span className="result-num">{result.fRN}</span>
                      <div className="result-bar" style={{ minWidth: `${Math.max(40, String(Math.max(result.fRN, result.fD)).length * 20)}px` }} />
                      <span className="result-den">{result.fD}</span>
                    </div>
                  )}
                  {result.fW === 0 && result.fRN === 0 && (
                    <span className="result-whole-num">0</span>
                  )}
                </div>
                {/* 약분 전 분수 */}
                {result.g > 1 && (
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    약분 전: <Frac n={result.fN * result.g} d={result.fD * result.g} neg={result.neg} color="white" />
                  </div>
                )}
                {/* 소수 */}
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', fontWeight: 700, marginTop: 4 }}>
                  ≈ {result.fD > 0 ? ((result.neg ? -1 : 1) * (result.fW + (result.fRN / result.fD))).toFixed(3) : '0'}
                </div>
              </div>

              {/* 시각화 전환 버튼 */}
              {(op === '+' || op === '-') && d1 <= 10 && d2 <= 10 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button
                    className={`btn ${visualMode === 'bar' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, padding: '10px 8px', fontSize: '0.85rem' }}
                    onClick={() => setVisualMode('bar')}
                  >
                    📊 막대 모델
                  </button>
                  <button
                    className={`btn ${visualMode === 'pie' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, padding: '10px 8px', fontSize: '0.85rem' }}
                    onClick={() => setVisualMode('pie')}
                  >
                    🥧 파이 차트
                  </button>
                </div>
              )}

              {/* 막대 모델 시각화 */}
              {(op === '+' || op === '-') && d1 <= 10 && d2 <= 10 && visualMode === 'bar' && (
                <div className="card">
                  <div className="card-title">📊 막대 그림으로 보기</div>
                  <BarModel num={calcN1} den={d1} color="#7C3AED" label={`첫 번째: ${calcN1}/${d1}`} />
                  <BarModel num={calcN2} den={d2} color="#EC4899" label={`두 번째: ${calcN2}/${d2}`} />
                  {result.fD <= 20 && result.fRN + result.fW * result.fD <= result.fD * 4 && (
                    <BarModel
                      num={result.fRN + result.fW * result.fD}
                      den={result.fD}
                      color="#10B981"
                      label={`결과: ${result.fW > 0 ? `${result.fW}과 ${result.fRN}/${result.fD}` : `${result.fN}/${result.fD}`}`}
                    />
                  )}
                </div>
              )}

              {/* 파이 차트 시각화 */}
              {(op === '+' || op === '-') && d1 <= 10 && d2 <= 10 && visualMode === 'pie' && (
                <div className="card">
                  <div className="card-title">🥧 파이 차트로 보기</div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 8 }}>
                    <PieModel num={calcN1} den={d1} color="#7C3AED" label={`첫 번째: ${calcN1}/${d1}`} />
                    <PieModel num={calcN2} den={d2} color="#EC4899" label={`두 번째: ${calcN2}/${d2}`} />
                    {result.fD <= 12 && (
                      <PieModel
                        num={result.fRN + result.fW * result.fD}
                        den={result.fD}
                        color="#10B981"
                        label={`결과: ${result.fW > 0 ? `${result.fW}과 ${result.fRN}/${result.fD}` : `${result.fN}/${result.fD}`}`}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* 풀이 단계 */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div className="card-title" style={{ margin: 0 }}>🔍 어떻게 풀었을까요?</div>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                    onClick={() => setShowSteps(!showSteps)}
                  >
                    {showSteps ? '숨기기' : '보기'}
                  </button>
                </div>
                {showSteps && (
                  <div className="steps-container">
                    {result.steps.map((s, i) => (
                      <div key={i} className="step-item" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="step-title">{s.title}</div>
                        <div className="step-desc" style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                          {parseMath(s.desc)}
                        </div>
                        {s.highlight && (
                          <div style={{
                            background: 'linear-gradient(135deg, #EDE9FE, #FDF2F8)',
                            border: '2px solid #C4B5FD',
                            borderRadius: 10,
                            padding: '10px 14px',
                            marginTop: 8,
                            textAlign: 'center',
                            fontSize: '1.25rem',
                            fontWeight: 900,
                            color: '#5B21B6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            flexWrap: 'wrap'
                          }}>
                            {parseMath(s.highlight, '#5B21B6')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================= 퀴즈 탭 ========================= */}
      {tab === 'quiz' && (
        <div className="quiz-section">
          {/* 점수 + 레벨 */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div className="score-pill correct">✅ {stats.score}점</div>
                <div className="score-pill total">📝 {stats.total}문제</div>
                {stats.streak >= 2 && (
                  <div className="score-pill" style={{ background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)', borderColor: '#FCD34D', color: '#92400E', boxShadow: '0 3px 0 #FCD34D' }}>
                    🔥 {stats.streak}연속!
                  </div>
                )}
              </div>
              <div
                style={{
                  background: levelInfo.bgColor,
                  border: `3px solid ${levelInfo.color}`,
                  borderRadius: 20,
                  padding: '6px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  color: levelInfo.color,
                  boxShadow: `0 3px 0 ${levelInfo.color}88`,
                }}
              >
                ⭐ 레벨 {stats.level}: {levelInfo.label}
              </div>
            </div>

            {/* 레벨 진행바 */}
            {levelInfo.nextReq && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280', marginBottom: 6 }}>
                  다음 레벨까지: {stats.score}/{levelInfo.nextReq}점
                </div>
                <div style={{ height: 12, background: '#EDE9FE', borderRadius: 10, overflow: 'hidden', border: `2px solid ${levelInfo.color}44` }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, (stats.score / levelInfo.nextReq) * 100)}%`,
                      background: `linear-gradient(90deg, ${levelInfo.color}, ${levelInfo.color}CC)`,
                      borderRadius: 10,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            )}
            {!levelInfo.nextReq && (
              <div style={{ marginTop: 10, textAlign: 'center', fontSize: '0.9rem', fontWeight: 800, color: '#A855F7' }}>
                🎉 최고 레벨 달성! 진정한 분수 전문가!
              </div>
            )}
          </div>

          {quiz && (
            <>
              {/* 문제 카드 */}
              <div className="card quiz-problem-card" style={{ background: 'linear-gradient(135deg, #F5F3FF, #FDF2F8)', border: '3px solid #DDD6FE', boxShadow: '0 5px 0 #DDD6FE', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#9CA3AF' }}>
                    레벨 {quiz.level} 문제
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#7C3AED' }}>
                    {quiz.op === '+' ? '➕ 덧셈' : quiz.op === '-' ? '➖ 뺄셈' : quiz.op === '×' ? '✖️ 곱셈' : '➗ 나눗셈'}
                  </div>
                </div>

                <div className="quiz-prompt">다음을 계산하세요! 💪</div>
                <div className="quiz-fraction-display">
                  <div className="quiz-frac">
                    <span className="quiz-num">{quiz.n1}</span>
                    <div className="quiz-line" />
                    <span className="quiz-den">{quiz.d1}</span>
                  </div>
                  <span className="quiz-op">{quiz.op}</span>
                  <div className="quiz-frac">
                    <span className="quiz-num">{quiz.n2}</span>
                    <div className="quiz-line" />
                    <span className="quiz-den">{quiz.d2}</span>
                  </div>
                  <span className="quiz-equals">=</span>
                  <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#DDD6FE' }}>？</span>
                </div>

                {/* 막대 힌트 */}
                {quiz.d1 <= 8 && quiz.d2 <= 8 && (
                  <div style={{ marginTop: 12, padding: '12px', background: 'rgba(255,255,255,0.7)', borderRadius: 14 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9CA3AF', marginBottom: 8 }}>힌트 그림</div>
                    <BarModel num={quiz.n1} den={quiz.d1} color="#7C3AED" label="" />
                    <BarModel num={quiz.n2} den={quiz.d2} color="#EC4899" label="" />
                  </div>
                )}
              </div>

              {/* 정답 입력 */}
              {!feedback && (
                <div className="card">
                  <div className="card-title" style={{ justifyContent: 'center' }}>✍️ 정답을 써보세요</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    {/* 자연수 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateY(-21px)' }}>
                      <input
                        type="number"
                        className="ans-input"
                        value={ansW}
                        onChange={e => setAnsW(e.target.value)}
                        placeholder="0"
                        style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', borderColor: '#FCD34D', boxShadow: '0 3px 0 #D97706', color: '#92400E' }}
                      />
                      <div className="ans-label" style={{ marginTop: 8 }}>자연수</div>
                    </div>

                    {/* 분수 부분 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <input
                        type="number"
                        className="ans-input"
                        value={ansN}
                        onChange={e => setAnsN(e.target.value)}
                        placeholder="분자"
                        onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                      />
                      <div className="ans-line" style={{ margin: '6px 0' }} />
                      <input
                        type="number"
                        className="ans-input"
                        value={ansD}
                        onChange={e => setAnsD(e.target.value)}
                        placeholder="분모"
                        onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                      />
                      <div className="ans-label" style={{ marginTop: 8 }}>분수 부분</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" style={{ flex: 0.4, padding: '14px' }} onClick={startNewQuiz}>
                      🔄 건너뛰기
                    </button>
                    <button className="btn btn-yellow btn-lg" style={{ flex: 1 }} onClick={checkAnswer}>
                      🔍 정답 확인!
                    </button>
                  </div>
                </div>
              )}

              {/* 피드백 */}
              {feedback && (
                <div className={`feedback-card ${feedback}`}>
                  <span className="feedback-emoji">
                    {feedback === 'correct'
                      ? stats.streak >= 5 ? '🎆' : stats.streak >= 3 ? '🎉' : '✅'
                      : '😅'}
                  </span>
                  <div className="feedback-text">
                    {feedback === 'correct'
                      ? stats.streak >= 5 ? `${stats.streak}연속! 믿을 수 없어요! 🤩`
                        : stats.streak >= 3 ? `${stats.streak}연속 정답! 멋져요!`
                        : '정답이에요! 최고예요!'
                      : '아쉬워요! 다시 도전해봐요!'}
                  </div>
                  {feedback === 'wrong' && (
                    <div className="feedback-answer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      정답: <Frac w={quiz.ansW} n={quiz.ansN} d={quiz.ansD} />
                    </div>
                  )}
                  <button className="btn btn-primary btn-lg" style={{ marginTop: 14 }} onClick={startNewQuiz}>
                    {feedback === 'correct' ? '🚀 다음 문제!' : '🔄 새 문제 풀기!'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================= 개념 탭 ========================= */}
      {tab === 'concept' && (
        <div className="concept-section">

          {/* 분수 3형제 */}
          <div className="card">
            <div className="card-title">🎪 분수 3형제!</div>

            {[
              {
                icon: '🌸', color: 'pink', name: '진분수', sub: '분자 < 분모', desc: '분자가 분모보다 작은 분수예요.\n1보다 작아서 "진짜" 분수라고 해요!',
                examples: ['1/2', '2/3', '3/5', '4/7'],
                barN: 2, barD: 3, barColor: '#EC4899',
              },
              {
                icon: '🌊', color: 'blue', name: '가분수', sub: '분자 ≥ 분모', desc: '분자가 분모보다 크거나 같은 분수예요.\n1 이상이에요!',
                examples: ['5/3', '4/4', '7/2', '9/4'],
                barN: 5, barD: 3, barColor: '#38BDF8',
              },
              {
                icon: '🌿', color: 'green', name: '대분수', sub: '자연수 + 진분수', desc: '자연수와 진분수가 합쳐진 분수예요.\n가분수를 정리한 형태예요!',
                examples: ['1과 2/3', '2와 1/4', '3과 1/2'],
                barN: null, barD: null, barColor: '#10B981',
              },
            ].map(item => (
              <div key={item.name} className="concept-card" style={{ marginBottom: 12 }}>
                <div className="concept-card-header">
                  <div className={`concept-emoji-badge ${item.color}`}>{item.icon}</div>
                  <div>
                    <div className="concept-card-title">{item.name}</div>
                    <div className="concept-card-subtitle">{item.sub}</div>
                  </div>
                </div>
                <div className="concept-card-body" style={{ whiteSpace: 'pre-line' }}>
                  {item.desc}
                  <div style={{ marginTop: 10, display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {item.examples.map(ex => <span key={ex} className="example-pill" style={{ display: 'inline-flex', alignItems: 'center' }}>{parseMath(ex)}</span>)}
                  </div>
                </div>
                {item.barN && (
                  <div style={{ marginTop: 12 }}>
                    <BarModel num={item.barN} den={item.barD} color={item.barColor} label={`예시: ${item.barN}/${item.barD}`} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 연산 규칙 */}
          {[
            {
              icon: '➕', title: '덧셈 / ➖ 뺄셈', color: '#7C3AED',
              steps: [
                { n: 1, text: '분모가 같은지 확인해요!' },
                { n: 2, text: '다르면 통분으로 분모를 같게 만들어요\n(최소공배수를 찾아요)' },
                { n: 3, text: '분자끼리 더하거나 빼요!' },
                { n: 4, text: '약분이 되면 약분해요' },
              ],
              example: '1/3 + 1/4 = 4/12 + 3/12 = 7/12',
              exBg: '#F5F3FF',
            },
            {
              icon: '✖️', title: '곱셈', color: '#EC4899',
              steps: [
                { n: 1, text: '분자는 분자끼리 곱해요' },
                { n: 2, text: '분모는 분모끼리 곱해요' },
                { n: 3, text: '약분이 되면 약분해요' },
              ],
              example: '2/3 × 3/4 = 6/12 = 1/2',
              exBg: '#FDF2F8',
            },
            {
              icon: '➗', title: '나눗셈', color: '#0EA5E9',
              steps: [
                { n: 1, text: '뒤의 분수를 뒤집어요 (역수)' },
                { n: 2, text: '곱셈으로 바꿔서 계산해요' },
                { n: 3, text: '약분이 되면 약분해요' },
              ],
              example: '1/2 ÷ 3/4 = 1/2 × 4/3 = 4/6 = 2/3',
              exBg: '#EFF6FF',
            },
          ].map(rule => (
            <div key={rule.title} className="card">
              <div className="card-title" style={{ color: rule.color }}>{rule.icon} {rule.title}</div>
              <div className="rule-card">
                {rule.steps.map(step => (
                  <div key={step.n} className="rule-step">
                    <div className="rule-number" style={{ background: `linear-gradient(135deg, ${rule.color}, ${rule.color}CC)` }}>{step.n}</div>
                    <div className="rule-text" style={{ whiteSpace: 'pre-line', lineHeight: 1.5 }}>{parseMath(step.text)}</div>
                  </div>
                ))}
                <div style={{ background: rule.exBg, borderRadius: 10, padding: '12px 14px', marginTop: 12, fontSize: '1.15rem', fontWeight: 800, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  📌 예시: {parseMath(rule.example)}
                </div>
              </div>
            </div>
          ))}

          {/* 약분 + 통분 */}
          <div className="card">
            <div className="card-title">✂️ 약분 & 🔧 통분</div>

            <div className="concept-card" style={{ marginBottom: 12 }}>
              <div className="concept-card-header">
                <div className="concept-emoji-badge yellow">✂️</div>
                <div>
                  <div className="concept-card-title">약분</div>
                  <div className="concept-card-subtitle">분수를 더 간단하게!</div>
                </div>
              </div>
              <div className="concept-card-body">
                분자와 분모를 <strong>같은 수로 나눠서</strong> 간단하게 만들어요!
              </div>
              <div style={{ marginTop: 12 }}>
                <BarModel num={6} den={8} color="#F59E0B" label="6/8 (약분 전)" />
                <BarModel num={3} den={4} color="#10B981" label="3/4 (약분 후) ← 넓이가 같아요!" />
              </div>
            </div>

            <div className="concept-card">
              <div className="concept-card-header">
                <div className="concept-emoji-badge blue">🔧</div>
                <div>
                  <div className="concept-card-title">통분</div>
                  <div className="concept-card-subtitle">분모를 같게!</div>
                </div>
              </div>
              <div className="concept-card-body">
                두 분수의 분모를 <strong>같은 수로 만드는 것</strong>이에요!
              </div>
              <div style={{ marginTop: 12 }}>
                <BarModel num={1} den={3} color="#7C3AED" label="1/3" />
                <BarModel num={1} den={4} color="#EC4899" label="1/4" />
                <div style={{ textAlign: 'center', padding: '6px 0', fontSize: '0.9rem', fontWeight: 800, color: '#7C3AED' }}>
                  ⬇️ 최소공배수 12로 통분!
                </div>
                <BarModel num={4} den={12} color="#7C3AED" label="4/12 (= 1/3)" />
                <BarModel num={3} den={12} color="#EC4899" label="3/12 (= 1/4)" />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================= 내 기록 탭 ========================= */}
      {tab === 'trophy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 통계 요약 */}
          <div className="card">
            <div className="card-title">📊 내 학습 통계</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { icon: '🏆', label: '총 점수', value: stats.score, color: '#A855F7', bg: '#EDE9FE' },
                { icon: '📝', label: '총 문제', value: stats.total, color: '#0EA5E9', bg: '#E0F2FE' },
                { icon: '✅', label: '정답률', value: stats.total > 0 ? `${Math.round((stats.score / stats.total) * 100)}%` : '-', color: '#10B981', bg: '#DCFCE7' },
                { icon: '🔥', label: '최고 연속', value: `${stats.maxStreak}연속`, color: '#F59E0B', bg: '#FEF3C7' },
              ].map(stat => (
                <div
                  key={stat.label}
                  style={{
                    background: stat.bg,
                    border: `3px solid ${stat.color}44`,
                    borderRadius: 16,
                    padding: '16px 12px',
                    textAlign: 'center',
                    boxShadow: `0 3px 0 ${stat.color}44`,
                  }}
                >
                  <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>{stat.icon}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 레벨 카드 */}
          <div
            className="card"
            style={{
              background: `linear-gradient(135deg, ${levelInfo.bgColor}, white)`,
              border: `3px solid ${levelInfo.color}88`,
              boxShadow: `0 6px 0 ${levelInfo.color}44`,
            }}
          >
            <div className="card-title" style={{ color: levelInfo.color }}>⭐ 현재 레벨</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: levelInfo.color, marginBottom: 4 }}>
                레벨 {stats.level}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: levelInfo.color }}>{levelInfo.label}</div>
              {levelInfo.nextReq && (
                <>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6B7280', marginTop: 12, marginBottom: 8 }}>
                    레벨 {stats.level + 1}까지 {Math.max(0, levelInfo.nextReq - stats.score)}점 남았어요!
                  </div>
                  <div style={{ height: 16, background: 'rgba(255,255,255,0.7)', borderRadius: 10, overflow: 'hidden', border: `2px solid ${levelInfo.color}55` }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, (stats.score / levelInfo.nextReq) * 100)}%`,
                        background: `linear-gradient(90deg, ${levelInfo.color}, ${levelInfo.color}CC)`,
                        borderRadius: 10,
                        transition: 'width 0.8s ease',
                        boxShadow: `0 0 8px ${levelInfo.color}88`,
                      }}
                    />
                  </div>
                </>
              )}
              {!levelInfo.nextReq && (
                <div style={{ marginTop: 10, fontSize: '1rem', fontWeight: 800, color: '#A855F7' }}>
                  🎉 최고 레벨 달성! 당신은 진정한 분수 전문가!
                </div>
              )}
            </div>
          </div>

          {/* 배지 모음 */}
          <div className="card">
            <div className="card-title">🏅 내 배지 모음</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
              {BADGES.map(badge => {
                const owned = stats.badges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    style={{
                      background: owned
                        ? 'linear-gradient(135deg, #EDE9FE, #FDF2F8)'
                        : '#F9FAFB',
                      border: `3px solid ${owned ? '#A855F7' : '#E5E7EB'}`,
                      borderRadius: 16,
                      padding: '14px 10px',
                      textAlign: 'center',
                      boxShadow: owned ? '0 4px 0 #DDD6FE' : '0 3px 0 #E5E7EB',
                      opacity: owned ? 1 : 0.5,
                      filter: owned ? 'none' : 'grayscale(1)',
                      transition: 'all 0.3s',
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: 4 }}>{badge.icon}</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 900, color: owned ? '#5B21B6' : '#9CA3AF' }}>{badge.name}</div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9CA3AF', marginTop: 2 }}>{badge.desc}</div>
                    {owned && (
                      <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#10B981', marginTop: 4 }}>획득 완료! ✅</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 초기화 버튼 */}
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9CA3AF', marginBottom: 12 }}>
              모든 기록을 초기화하려면 아래 버튼을 누르세요
            </div>
            <button
              className="btn"
              style={{ background: '#FEE2E2', color: '#DC2626', border: '3px solid #FCA5A5', boxShadow: '0 4px 0 #FCA5A5', padding: '12px 24px', fontSize: '0.9rem' }}
              onClick={() => {
                if (window.confirm('정말 모든 기록을 지울까요?')) {
                  const reset = { score: 0, total: 0, streak: 0, maxStreak: 0, level: 1, perfectRun: 0, badges: [] };
                  setStats(reset);
                  saveState(reset);
                }
              }}
            >
              🗑️ 기록 초기화
            </button>
          </div>
        </div>
      )}

      {/* 푸터 */}
      <footer style={{ textAlign: 'center', padding: '30px 0 10px', fontSize: '0.78rem', color: '#C4B5FD', fontWeight: 700 }}>
        🍰 달콤 분수 계산기 v2.0 &mdash; 초등학생을 위한 분수 학습 앱
      </footer>
    </div>
  );
}
