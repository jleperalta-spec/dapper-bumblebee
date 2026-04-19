const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const character = params.get('character') || 'peppa';
const level     = Math.min(10, Math.max(1, parseInt(params.get('level') || '1', 10)));
const levelT    = (level - 1) / 9; // 0 at L1, 1 at L10

// --- Config ---
const GRAVITY      = 0.04 + levelT * 0.44;  // 0.04 (L1) → 0.48 (L10)
const INIT_VX_BASE = 0.4  + levelT * 4.0;   // 0.4  → 4.4
const INIT_VX_RAND = 0.3  + levelT * 2.0;   // 0.3  → 2.3
const INIT_VY      = 0.5  + levelT * 2.0;   // 0.5  → 2.5
const PADDLE_SPEED = 9;
const PADDLE_W     = 110;
const PADDLE_H     = 20;
const BALLOON_RX   = 30;
const BALLOON_RY   = 38;

// --- State ---
let paddleX, balloonX, balloonY, balloonVX, balloonVY;
let score = 0;
let highScore = 0;
let gameOver = false;
let musicStarted = false;
let keys = {};
let frameCount = 0;
let charSprite = null;

// --- Audio ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playPop(score) {
  const base = 440;
  const extra = Math.min(score, 30) * 8;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(base + extra, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(base + extra + 120, audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.22);
}

function startMusic() {
  if (musicStarted) return;
  musicStarted = true;

  const master = audioCtx.createGain();
  master.gain.value = 0.11;
  master.connect(audioCtx.destination);

  // C major pentatonic melody (8 notes, loops forever)
  const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 783.99, 880.00, 783.99];
  const bass   = [130.81, 130.81, 196.00, 196.00, 130.81, 130.81, 196.00, 196.00];
  const beat   = 0.38;
  let nextTime = audioCtx.currentTime + 0.05;
  let idx = 0;

  function scheduleNote(freq, bassFreq, t) {
    const osc = audioCtx.createOscillator();
    const g   = audioCtx.createGain();
    osc.connect(g); g.connect(master);
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.7, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.78);
    osc.start(t); osc.stop(t + beat * 0.8);

    const bOsc = audioCtx.createOscillator();
    const bG   = audioCtx.createGain();
    bOsc.connect(bG); bG.connect(master);
    bOsc.type = 'sine';
    bOsc.frequency.value = bassFreq;
    bG.gain.setValueAtTime(0.28, t);
    bG.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.88);
    bOsc.start(t); bOsc.stop(t + beat * 0.9);
  }

  function tick() {
    while (nextTime < audioCtx.currentTime + 0.2) {
      scheduleNote(melody[idx % melody.length], bass[idx % bass.length], nextTime);
      nextTime += beat;
      idx++;
    }
    setTimeout(tick, 80);
  }

  tick();
}

// --- Character SVGs ---
const PEPPA_SVG = `<svg width="110" height="120" viewBox="0 0 180 220" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="90" cy="168" rx="46" ry="52" fill="#FF4B8A"/>
  <ellipse cx="40" cy="158" rx="16" ry="10" fill="#FF9EB5" transform="rotate(-30 40 158)"/>
  <ellipse cx="140" cy="158" rx="16" ry="10" fill="#FF9EB5" transform="rotate(30 140 158)"/>
  <rect x="68" y="208" width="18" height="26" rx="9" fill="#FF6699"/>
  <rect x="94" y="208" width="18" height="26" rx="9" fill="#FF6699"/>
  <ellipse cx="77" cy="232" rx="13" ry="8" fill="#222"/>
  <ellipse cx="103" cy="232" rx="13" ry="8" fill="#222"/>
  <ellipse cx="90" cy="92" rx="52" ry="50" fill="#FF9EB5"/>
  <ellipse cx="90" cy="115" rx="28" ry="18" fill="#FF6699"/>
  <circle cx="82" cy="113" r="5" fill="#CC3366"/>
  <circle cx="98" cy="113" r="5" fill="#CC3366"/>
  <circle cx="72" cy="82" r="10" fill="#fff"/>
  <circle cx="108" cy="82" r="10" fill="#fff"/>
  <circle cx="75" cy="82" r="6" fill="#111"/>
  <circle cx="111" cy="82" r="6" fill="#111"/>
  <circle cx="77" cy="80" r="2" fill="#fff"/>
  <circle cx="113" cy="80" r="2" fill="#fff"/>
  <ellipse cx="50" cy="58" rx="16" ry="12" fill="#FF9EB5" transform="rotate(-20 50 58)"/>
  <ellipse cx="130" cy="58" rx="16" ry="12" fill="#FF9EB5" transform="rotate(20 130 58)"/>
  <path d="M74 102 Q90 115 106 102" stroke="#CC3366" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;

const SUZY_SVG = `<svg width="110" height="120" viewBox="0 0 180 220" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="90" cy="168" rx="46" ry="52" fill="#6BAED6"/>
  <ellipse cx="40" cy="158" rx="16" ry="10" fill="#e0e0e0" transform="rotate(-30 40 158)"/>
  <ellipse cx="140" cy="158" rx="16" ry="10" fill="#e0e0e0" transform="rotate(30 140 158)"/>
  <rect x="68" y="208" width="18" height="26" rx="9" fill="#4d8ab5"/>
  <rect x="94" y="208" width="18" height="26" rx="9" fill="#4d8ab5"/>
  <ellipse cx="77" cy="232" rx="13" ry="8" fill="#222"/>
  <ellipse cx="103" cy="232" rx="13" ry="8" fill="#222"/>
  <circle cx="60" cy="88" r="26" fill="#f0f0f0"/>
  <circle cx="80" cy="68" r="24" fill="#f0f0f0"/>
  <circle cx="100" cy="64" r="24" fill="#f0f0f0"/>
  <circle cx="120" cy="74" r="24" fill="#f0f0f0"/>
  <circle cx="130" cy="96" r="22" fill="#f0f0f0"/>
  <circle cx="50" cy="106" r="22" fill="#f0f0f0"/>
  <circle cx="90" cy="110" r="22" fill="#f0f0f0"/>
  <ellipse cx="90" cy="98" rx="38" ry="32" fill="#FFCCD5"/>
  <ellipse cx="90" cy="116" rx="22" ry="14" fill="#FFB0C0"/>
  <circle cx="83" cy="114" r="4" fill="#CC6677"/>
  <circle cx="97" cy="114" r="4" fill="#CC6677"/>
  <circle cx="76" cy="90" r="9" fill="#fff"/>
  <circle cx="104" cy="90" r="9" fill="#fff"/>
  <circle cx="78" cy="90" r="5" fill="#111"/>
  <circle cx="106" cy="90" r="5" fill="#111"/>
  <circle cx="79" cy="88" r="2" fill="#fff"/>
  <circle cx="107" cy="88" r="2" fill="#fff"/>
  <ellipse cx="52" cy="76" rx="10" ry="14" fill="#FFB0C0" transform="rotate(-15 52 76)"/>
  <ellipse cx="128" cy="76" rx="10" ry="14" fill="#FFB0C0" transform="rotate(15 128 76)"/>
  <path d="M76 106 Q90 118 104 106" stroke="#CC6677" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;

const MICKEY_SVG = `<svg width="110" height="120" viewBox="0 0 180 220" xmlns="http://www.w3.org/2000/svg">
  <circle cx="42" cy="44" r="36" fill="#111"/>
  <circle cx="138" cy="44" r="36" fill="#111"/>
  <circle cx="90" cy="100" r="58" fill="#111"/>
  <ellipse cx="90" cy="107" rx="46" ry="44" fill="#FFDBA4"/>
  <ellipse cx="72" cy="88" rx="9" ry="11" fill="#111"/>
  <ellipse cx="108" cy="88" rx="9" ry="11" fill="#111"/>
  <circle cx="74" cy="85" r="3.5" fill="#fff"/>
  <circle cx="110" cy="85" r="3.5" fill="#fff"/>
  <ellipse cx="90" cy="114" rx="12" ry="9" fill="#111"/>
  <path d="M70 126 Q90 145 110 126" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="90" cy="178" rx="46" ry="48" fill="#CC0000"/>
  <circle cx="83" cy="157" r="5" fill="#FFD700"/>
  <circle cx="97" cy="157" r="5" fill="#FFD700"/>
  <circle cx="26" cy="166" r="20" fill="#fff"/>
  <circle cx="154" cy="166" r="20" fill="#fff"/>
  <rect x="66" y="210" width="20" height="28" rx="10" fill="#111"/>
  <rect x="94" y="210" width="20" height="28" rx="10" fill="#111"/>
  <ellipse cx="76" cy="234" rx="18" ry="11" fill="#FFD700"/>
  <ellipse cx="104" cy="234" rx="18" ry="11" fill="#FFD700"/>
</svg>`;

const MINNIE_SVG = `<svg width="110" height="120" viewBox="0 0 180 220" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="65" cy="18" rx="28" ry="18" fill="#CC0000" transform="rotate(-15 65 18)"/>
  <ellipse cx="115" cy="18" rx="28" ry="18" fill="#CC0000" transform="rotate(15 115 18)"/>
  <circle cx="90" cy="18" r="13" fill="#CC0000"/>
  <circle cx="55" cy="12" r="3.5" fill="#FF8080"/>
  <circle cx="68" cy="23" r="3" fill="#FF8080"/>
  <circle cx="125" cy="12" r="3.5" fill="#FF8080"/>
  <circle cx="112" cy="23" r="3" fill="#FF8080"/>
  <circle cx="42" cy="50" r="34" fill="#111"/>
  <circle cx="138" cy="50" r="34" fill="#111"/>
  <circle cx="90" cy="106" r="56" fill="#111"/>
  <ellipse cx="90" cy="112" rx="45" ry="43" fill="#FFDBA4"/>
  <ellipse cx="72" cy="92" rx="9" ry="11" fill="#111"/>
  <ellipse cx="108" cy="92" rx="9" ry="11" fill="#111"/>
  <circle cx="74" cy="89" r="3.5" fill="#fff"/>
  <circle cx="110" cy="89" r="3.5" fill="#fff"/>
  <line x1="64" y1="82" x2="60" y2="76" stroke="#111" stroke-width="2" stroke-linecap="round"/>
  <line x1="69" y1="80" x2="67" y2="74" stroke="#111" stroke-width="2" stroke-linecap="round"/>
  <line x1="75" y1="80" x2="75" y2="74" stroke="#111" stroke-width="2" stroke-linecap="round"/>
  <line x1="100" y1="80" x2="100" y2="74" stroke="#111" stroke-width="2" stroke-linecap="round"/>
  <line x1="106" y1="80" x2="104" y2="74" stroke="#111" stroke-width="2" stroke-linecap="round"/>
  <line x1="111" y1="82" x2="115" y2="76" stroke="#111" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="90" cy="118" rx="12" ry="9" fill="#111"/>
  <path d="M70 130 Q90 149 110 130" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="90" cy="178" rx="46" ry="48" fill="#E91E8C"/>
  <circle cx="75" cy="162" r="5" fill="#fff" opacity="0.6"/>
  <circle cx="93" cy="170" r="4" fill="#fff" opacity="0.6"/>
  <circle cx="80" cy="180" r="3.5" fill="#fff" opacity="0.6"/>
  <rect x="66" y="210" width="20" height="28" rx="10" fill="#111"/>
  <rect x="94" y="210" width="20" height="28" rx="10" fill="#111"/>
  <ellipse cx="76" cy="234" rx="18" ry="11" fill="#111"/>
  <ellipse cx="104" cy="234" rx="18" ry="11" fill="#111"/>
</svg>`;

const BLUEY_SVG = `<svg width="110" height="120" viewBox="0 0 180 220" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="90" cy="168" rx="46" ry="52" fill="#4A90D9"/>
  <ellipse cx="38" cy="158" rx="16" ry="10" fill="#5A9FE9" transform="rotate(-30 38 158)"/>
  <ellipse cx="142" cy="158" rx="16" ry="10" fill="#5A9FE9" transform="rotate(30 142 158)"/>
  <rect x="68" y="210" width="18" height="26" rx="9" fill="#3A7BC8"/>
  <rect x="94" y="210" width="18" height="26" rx="9" fill="#3A7BC8"/>
  <ellipse cx="77" cy="234" rx="14" ry="9" fill="#F5DEB3"/>
  <ellipse cx="103" cy="234" rx="14" ry="9" fill="#F5DEB3"/>
  <circle cx="90" cy="92" r="54" fill="#4A90D9"/>
  <ellipse cx="90" cy="100" rx="40" ry="36" fill="#F0F0E8"/>
  <ellipse cx="46" cy="62" rx="18" ry="26" fill="#4A90D9" transform="rotate(10 46 62)"/>
  <ellipse cx="134" cy="62" rx="18" ry="26" fill="#4A90D9" transform="rotate(-10 134 62)"/>
  <ellipse cx="46" cy="64" rx="11" ry="18" fill="#D4821E" transform="rotate(10 46 64)"/>
  <ellipse cx="134" cy="64" rx="11" ry="18" fill="#D4821E" transform="rotate(-10 134 64)"/>
  <ellipse cx="72" cy="82" rx="16" ry="14" fill="#D4821E"/>
  <ellipse cx="108" cy="82" rx="16" ry="14" fill="#D4821E"/>
  <circle cx="72" cy="82" r="9" fill="#fff"/>
  <circle cx="108" cy="82" r="9" fill="#fff"/>
  <circle cx="74" cy="82" r="5" fill="#222"/>
  <circle cx="110" cy="82" r="5" fill="#222"/>
  <circle cx="75" cy="80" r="2" fill="#fff"/>
  <circle cx="111" cy="80" r="2" fill="#fff"/>
  <ellipse cx="90" cy="112" rx="24" ry="18" fill="#F0EAD0"/>
  <ellipse cx="90" cy="105" rx="8" ry="6" fill="#333"/>
  <path d="M74 120 Q90 132 106 120" stroke="#aaa" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M80 46 Q90 32 100 46" stroke="#D4821E" stroke-width="8" fill="none" stroke-linecap="round"/>
</svg>`;

const BINGO_SVG = `<svg width="110" height="120" viewBox="0 0 180 220" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="90" cy="168" rx="46" ry="52" fill="#CC4A1A"/>
  <ellipse cx="38" cy="158" rx="16" ry="10" fill="#D85A2A" transform="rotate(-30 38 158)"/>
  <ellipse cx="142" cy="158" rx="16" ry="10" fill="#D85A2A" transform="rotate(30 142 158)"/>
  <rect x="68" y="210" width="18" height="26" rx="9" fill="#A83A10"/>
  <rect x="94" y="210" width="18" height="26" rx="9" fill="#A83A10"/>
  <ellipse cx="77" cy="234" rx="14" ry="9" fill="#F5DEB3"/>
  <ellipse cx="103" cy="234" rx="14" ry="9" fill="#F5DEB3"/>
  <circle cx="90" cy="92" r="54" fill="#D85A2A"/>
  <ellipse cx="90" cy="100" rx="40" ry="36" fill="#F5EDD8"/>
  <ellipse cx="46" cy="62" rx="18" ry="26" fill="#D85A2A" transform="rotate(10 46 62)"/>
  <ellipse cx="134" cy="62" rx="18" ry="26" fill="#D85A2A" transform="rotate(-10 134 62)"/>
  <ellipse cx="46" cy="64" rx="11" ry="18" fill="#8B2500" transform="rotate(10 46 64)"/>
  <ellipse cx="134" cy="64" rx="11" ry="18" fill="#8B2500" transform="rotate(-10 134 64)"/>
  <ellipse cx="72" cy="82" rx="16" ry="14" fill="#8B2500"/>
  <ellipse cx="108" cy="82" rx="16" ry="14" fill="#8B2500"/>
  <circle cx="72" cy="82" r="9" fill="#fff"/>
  <circle cx="108" cy="82" r="9" fill="#fff"/>
  <circle cx="74" cy="82" r="5" fill="#222"/>
  <circle cx="110" cy="82" r="5" fill="#222"/>
  <circle cx="75" cy="80" r="2" fill="#fff"/>
  <circle cx="111" cy="80" r="2" fill="#fff"/>
  <ellipse cx="90" cy="112" rx="24" ry="18" fill="#F5EDD8"/>
  <ellipse cx="90" cy="105" rx="8" ry="6" fill="#333"/>
  <path d="M74 120 Q90 132 106 120" stroke="#aaa" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M80 46 Q90 32 100 46" stroke="#8B2500" stroke-width="8" fill="none" stroke-linecap="round"/>
</svg>`;

function buildSprite(svgStr) {
  return new Promise(resolve => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.src = url;
  });
}

function init(fresh = true) {
  if (fresh) { score = 0; gameOver = false; }
  paddleX   = canvas.width / 2;
  if (fresh) {
    balloonX  = canvas.width  / 2;
    balloonY  = canvas.height * 0.25;
    balloonVX = (Math.random() > 0.5 ? 1 : -1) * (INIT_VX_BASE + Math.random() * INIT_VX_RAND);
    balloonVY = INIT_VY;
  }
}

// --- Draw helpers ---
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y,     x + w, y + r,     r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x,     y + h, x,     y + h - r, r);
  c.lineTo(x,     y + r);
  c.arcTo(x,     y,     x + r, y,         r);
  c.closePath();
}

const BALLOON_COLOR = { peppa: '#FF80AB', suzy: '#90CAF9', mickey: '#FF5252', minnie: '#FF80C0', bluey: '#82B1FF', bingo: '#FFB74D' };
const STRING_COLOR  = { peppa: '#CC3366', suzy: '#1565C0', mickey: '#990000', minnie: '#C2185B', bluey: '#1565C0', bingo: '#E65100' };
const GRASS_H = 60;

function drawBackground() {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#87CEEB');
  grad.addColorStop(0.75, '#B0E0FF');
  grad.addColorStop(1, '#87CEEB');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grass
  ctx.fillStyle = '#6CC644';
  ctx.fillRect(0, canvas.height - GRASS_H, canvas.width, GRASS_H);
  ctx.fillStyle = '#5aab37';
  ctx.fillRect(0, canvas.height - GRASS_H, canvas.width, 10);

  // Clouds
  drawCloud(canvas.width * 0.15, 60, 70);
  drawCloud(canvas.width * 0.65, 40, 55);
  drawCloud(canvas.width * 0.85, 80, 45);
}

function drawCloud(x, y, r) {
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(x,         y,     r * 0.6, 0, Math.PI * 2);
  ctx.arc(x + r * 0.55, y - r * 0.2, r * 0.5, 0, Math.PI * 2);
  ctx.arc(x - r * 0.45, y + r * 0.1, r * 0.45, 0, Math.PI * 2);
  ctx.arc(x + r,     y + r * 0.1, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawBalloon() {
  const sway = Math.sin(frameCount * 0.04) * 3;
  const bx = balloonX + sway;
  const by = balloonY;
  const col = BALLOON_COLOR[character] || '#FF80AB';
  const strCol = STRING_COLOR[character] || '#CC3366';

  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(bx, by + BALLOON_RY + 4, BALLOON_RX * 0.8, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Balloon body
  ctx.save();
  const bGrad = ctx.createRadialGradient(bx - 8, by - 12, 4, bx, by, BALLOON_RY);
  bGrad.addColorStop(0, lighten(col));
  bGrad.addColorStop(1, col);
  ctx.fillStyle = bGrad;
  ctx.beginPath();
  ctx.ellipse(bx, by, BALLOON_RX, BALLOON_RY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = darken(col);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(bx - 9, by - 13, 10, 7, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Knot
  ctx.fillStyle = darken(col);
  ctx.beginPath();
  ctx.arc(bx, by + BALLOON_RY, 5, 0, Math.PI * 2);
  ctx.fill();

  // String (bezier)
  const paddleTop = canvas.height - GRASS_H - 110;
  ctx.strokeStyle = strCol;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx, by + BALLOON_RY + 5);
  ctx.bezierCurveTo(bx + 15, by + BALLOON_RY + 40, paddleX - 15, paddleTop - 40, paddleX, paddleTop);
  ctx.stroke();
}

function lighten(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,r+60)},${Math.min(255,g+60)},${Math.min(255,b+60)})`;
}
function darken(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,r-50)},${Math.max(0,g-50)},${Math.max(0,b-50)})`;
}

function drawPaddle() {
  const py = canvas.height - GRASS_H - 110;
  if (charSprite) {
    ctx.drawImage(charSprite, paddleX - 55, py, 110, 120);
  }
}

function drawScore() {
  ctx.save();
  ctx.font = 'bold clamp(2rem,8vw,4rem) "Comic Sans MS", cursive';
  ctx.textAlign = 'center';
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillText(`🎈 ${score}`, canvas.width / 2 + 3, 73);
  ctx.fillStyle = '#fff';
  ctx.fillText(`🎈 ${score}`, canvas.width / 2, 70);

  // High score
  if (highScore > 0) {
    ctx.font = 'bold 18px "Comic Sans MS", cursive';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`Best: ${highScore}`, canvas.width / 2, 95);
  }
  ctx.restore();
}

function drawHint() {
  ctx.save();
  ctx.font = '16px "Comic Sans MS", cursive';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText(`← → to move  |  Level ${level}`, canvas.width / 2, canvas.height - 8);
  ctx.restore();
}

// --- Game over overlay ---
function drawGameOver() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.fillStyle = '#fff';
  roundRect(ctx, cx - 170, cy - 130, 340, 260, 30);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FF4B8A';
  ctx.font = 'bold 2.2rem "Comic Sans MS", cursive';
  ctx.fillText('Oh no! 😮', cx, cy - 72);

  ctx.fillStyle = '#444';
  ctx.font = 'bold 1.3rem "Comic Sans MS", cursive';
  ctx.fillText(`You scored ${score}!`, cx, cy - 28);

  if (score >= highScore && score > 0) {
    ctx.fillStyle = '#f5a623';
    ctx.font = 'bold 1.1rem "Comic Sans MS", cursive';
    ctx.fillText('🏆 New Best!', cx, cy + 8);
  } else if (highScore > 0) {
    ctx.fillStyle = '#888';
    ctx.font = '1rem "Comic Sans MS", cursive';
    ctx.fillText(`Best: ${highScore}`, cx, cy + 8);
  }

  // Play again button
  ctx.fillStyle = '#FF4B8A';
  roundRect(ctx, cx - 100, cy + 40, 200, 60, 20);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 1.4rem "Comic Sans MS", cursive';
  ctx.fillText('Play Again! 🎈', cx, cy + 79);
  ctx.restore();
}

canvas.addEventListener('click', e => {
  if (!gameOver) return;
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const bx = cx - 100, by = cy + 40;
  const mx = e.clientX, my = e.clientY;
  if (mx >= bx && mx <= bx + 200 && my >= by && my <= by + 60) {
    init(true);
  }
});

// Touch support for mobile
let touchStartX = null;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  audioCtx.resume().then(startMusic);
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (touchStartX === null || gameOver) return;
  const dx = e.touches[0].clientX - touchStartX;
  paddleX = Math.max(PADDLE_W / 2, Math.min(canvas.width - PADDLE_W / 2, paddleX + dx * 1.2));
  touchStartX = e.touches[0].clientX;
}, { passive: true });

// --- Game loop ---
function update() {
  if (gameOver) return;
  frameCount++;

  // Move paddle
  if (keys['ArrowLeft'])  paddleX = Math.max(PADDLE_W / 2,                  paddleX - PADDLE_SPEED);
  if (keys['ArrowRight']) paddleX = Math.min(canvas.width - PADDLE_W / 2,   paddleX + PADDLE_SPEED);

  // Physics
  balloonVY += GRAVITY;
  balloonX  += balloonVX;
  balloonY  += balloonVY;

  // Wall bounce
  if (balloonX - BALLOON_RX < 0)                { balloonX = BALLOON_RX;               balloonVX *= -1; }
  if (balloonX + BALLOON_RX > canvas.width)      { balloonX = canvas.width - BALLOON_RX; balloonVX *= -1; }
  if (balloonY - BALLOON_RY < 0)                 { balloonY = BALLOON_RY;               balloonVY  =  Math.abs(balloonVY) * 0.7; }

  // Paddle collision — check if balloon bottom overlaps paddle zone
  const paddleTop = canvas.height - GRASS_H - 110;
  const paddleLeft  = paddleX - PADDLE_W / 2;
  const paddleRight = paddleX + PADDLE_W / 2;
  const ballBottom  = balloonY + BALLOON_RY;

  if (
    balloonVY > 0 &&
    ballBottom >= paddleTop &&
    ballBottom <= paddleTop + 30 &&
    balloonX >= paddleLeft &&
    balloonX <= paddleRight
  ) {
    balloonY  = paddleTop - BALLOON_RY;
    balloonVY = -(Math.abs(balloonVY) * 0.92 + 2.5);
    const nudge = 0.6 + levelT * 2.0;
    const maxVX = 1.2 + levelT * 4.8;
    balloonVX += (Math.random() - 0.5) * nudge;
    balloonVX  = Math.max(-maxVX, Math.min(maxVX, balloonVX));
    score++;
    if (score > highScore) highScore = score;
    playPop(score);
  }

  // Floor = game over
  if (balloonY - BALLOON_RY > canvas.height) {
    gameOver = true;
  }
}

function draw() {
  drawBackground();
  drawBalloon();
  drawPaddle();
  drawScore();
  drawHint();
  if (gameOver) drawGameOver();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// --- Input ---
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  audioCtx.resume().then(startMusic);
  if (gameOver && e.key === ' ') init(true);
  if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup',  e => { keys[e.key] = false; });

// --- Boot ---
window.addEventListener('resize', () => {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  // Only reposition paddle on live resize; balloon keeps going
  paddleX = Math.max(PADDLE_W / 2, Math.min(canvas.width - PADDLE_W / 2, paddleX || canvas.width / 2));
});

// Size canvas first, then init + start loop once sprite is ready
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

const SVG_MAP = { peppa: PEPPA_SVG, suzy: SUZY_SVG, mickey: MICKEY_SVG, minnie: MINNIE_SVG, bluey: BLUEY_SVG, bingo: BINGO_SVG };
buildSprite(SVG_MAP[character] || PEPPA_SVG).then(img => {
  charSprite = img;
  init(true);
  loop();
});
