import { GROW_EVERY, RETRACT_SPEED } from './constants.js';
import { Rope } from './rope.js';
import { drawStringBorder } from './border.js';

const canvas  = document.getElementById('canvas');
const ctx     = canvas.getContext('2d');
const video   = document.getElementById('video');
const lyricEl = document.getElementById('lyric');

// ── Layout ─────────────────────────────────────────────────────────────────

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();

function vp() {
  const W = canvas.width, H = canvas.height;
  const w = Math.round(W * 0.70);
  const h = Math.round(w * 9 / 16);
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
}

function positionLyric() {
  if (!lyricEl.complete || lyricEl.naturalHeight === 0) return;
  const v         = vp();
  const spaceBelow = canvas.height - (v.y + v.h);
  lyricEl.style.width = v.w + 'px';
  lyricEl.style.left  = v.x + 'px';
  lyricEl.style.top   = (v.y + v.h + (spaceBelow - lyricEl.offsetHeight) / 2) + 'px';
}

lyricEl.addEventListener('load', positionLyric);
window.addEventListener('resize', () => { resize(); positionLyric(); });

// ── Finger definitions ──────────────────────────────────────────────────────
// pip for the thumb (index 0) is the index-finger MCP (landmark 5) — the thumb's
// own MCP sits too close to the wrist and lets tucked thumbs pass the check.

const FINGERS = [
  { tip: 4,  dip: 3,  pip: 5  },
  { tip: 8,  dip: 7,  pip: 6  },
  { tip: 12, dip: 11, pip: 10 },
  { tip: 16, dip: 15, pip: 14 },
  { tip: 20, dip: 19, pip: 18 },
];

function isExtended(lms, tipId, pipId) {
  const w = lms[0], tip = lms[tipId], pip = lms[pipId];
  return Math.hypot(tip.x - w.x, tip.y - w.y) >
         Math.hypot(pip.x - w.x, pip.y - w.y);
}

// ── State ───────────────────────────────────────────────────────────────────

const ropes      = new Map();   // key → Rope
let handResults  = null;
let frameNum     = 0;
let rafId        = null;

// ── Render loop ─────────────────────────────────────────────────────────────

function render() {
  rafId = requestAnimationFrame(render);
  frameNum++;

  const W   = canvas.width, H = canvas.height;
  const v   = vp();
  const now = performance.now();

  ctx.clearRect(0, 0, W, H);

  // Clip camera + ropes to the video frame
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.x, v.y, v.w, v.h);
  ctx.clip();

  // Camera feed (mirrored)
  ctx.save();
  ctx.translate(v.x + v.w, v.y);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, v.w, v.h);
  ctx.restore();

  const activeKeys   = new Set();
  const visibleHands = new Set();
  const shouldGrow   = (frameNum % GROW_EVERY === 0);

  if (handResults?.multiHandLandmarks?.length) {
    handResults.multiHandLandmarks.forEach((lms, hi) => {
      const side = handResults.multiHandedness?.[hi]?.label ?? `H${hi}`;
      visibleHands.add(side);

      FINGERS.forEach(({ tip: tipId, dip: dipId, pip: pipId }) => {
        const key = `${side}_${tipId}`;
        if (!isExtended(lms, tipId, pipId)) return;

        activeKeys.add(key);

        const tipLm = lms[tipId], dipLm = lms[dipId];

        // Mirror x for selfie view
        const tx  = v.x + (1 - tipLm.x) * v.w;
        const ty  = v.y +      tipLm.y  * v.h;
        const rdx = tx - (v.x + (1 - dipLm.x) * v.w);
        const rdy = ty - (v.y +      dipLm.y  * v.h);
        const rl  = Math.hypot(rdx, rdy);
        const rawDirX = rl > 0.5 ? rdx / rl : 0;
        const rawDirY = rl > 0.5 ? rdy / rl : -1;

        if (!ropes.has(key)) ropes.set(key, new Rope(tx, ty, rawDirX, rawDirY));
        const rope = ropes.get(key);

        rope.simulate(tx, ty, rawDirX, rawDirY, shouldGrow);
        rope.draw(ctx, now);
      });
    });
  }

  // Retract ropes for inactive fingers; fast-retract when the whole hand is gone
  // (handles MediaPipe label flips that would otherwise leave ghost strings)
  for (const [key, rope] of ropes) {
    if (activeKeys.has(key)) continue;
    const side = key.split('_')[0];
    rope.shrink(visibleHands.has(side) ? RETRACT_SPEED : 10);
    if (rope.length === 0) { ropes.delete(key); continue; }
    rope.draw(ctx, now);
  }

  ctx.restore(); // lift viewport clip

  drawStringBorder(ctx, v, now);
}

// ── MediaPipe ───────────────────────────────────────────────────────────────

// Hands and Camera are globals registered by the CDN scripts loaded before this module
const hands = new Hands({                                    // eslint-disable-line no-undef
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
});
hands.setOptions({
  maxNumHands:            2,
  modelComplexity:        1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence:  0.5,
});
hands.onResults(r => { handResults = r; });

const cam = new Camera(video, {                              // eslint-disable-line no-undef
  onFrame: async () => { await hands.send({ image: video }); },
  width: 1280, height: 720,
});

cam.start().catch(() => {
  const errEl = document.getElementById('permission-error');
  if (errEl) errEl.style.display = 'flex';
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
  } else {
    render();
  }
});

render();
