import {
  SEGMENT_PX, MAX_SEGMENTS,
  SWAY_AMP, SWAY_FREQ, SWAY_PER_NODE,
  SMOOTH, GRAVITY, DAMPING, CONSTRAINT_ITERS,
} from './constants.js';

// Each point: { x, y, px, py } — px/py are the previous-frame positions (Verlet).
// Point 0 is the anchor (snapped to the fingertip every frame).
// All other points are simulated freely under gravity + distance constraints.

export class Rope {
  constructor(tipX, tipY, dirX, dirY) {
    this._smoothTipX = tipX;
    this._smoothTipY = tipY;
    this._smoothDirX = dirX;
    this._smoothDirY = dirY;
    this.points = [{ x: tipX, y: tipY, px: tipX, py: tipY }];
  }

  get length() { return this.points.length; }

  // Physics step. Pass shouldGrow=true on frames where the rope should lengthen.
  simulate(tipX, tipY, rawDirX, rawDirY, shouldGrow) {
    // EMA-smooth the anchor position and direction to damp MediaPipe jitter
    this._smoothTipX = this._smoothTipX * SMOOTH + tipX * (1 - SMOOTH);
    this._smoothTipY = this._smoothTipY * SMOOTH + tipY * (1 - SMOOTH);
    this._smoothDirX = this._smoothDirX * SMOOTH + rawDirX * (1 - SMOOTH);
    this._smoothDirY = this._smoothDirY * SMOOTH + rawDirY * (1 - SMOOTH);
    const dl = Math.hypot(this._smoothDirX, this._smoothDirY);
    const sdx = dl > 0.01 ? this._smoothDirX / dl : rawDirX;
    const sdy = dl > 0.01 ? this._smoothDirY / dl : rawDirY;

    // Grow before the physics step so the new point gets constraint-solved this frame
    if (shouldGrow && this.points.length < MAX_SEGMENTS) {
      const last   = this.points[this.points.length - 1];
      const lastVx = last.x - last.px;
      const lastVy = last.y - last.py;
      const nx     = last.x + sdx * SEGMENT_PX;
      const ny     = last.y + sdy * SEGMENT_PX;
      // Inherit the last point's velocity so the new segment flows naturally
      this.points.push({ x: nx, y: ny, px: nx - lastVx, py: ny - lastVy });
    }

    const pts = this.points;

    // Snap anchor to smoothed tip
    pts[0].px = pts[0].x;
    pts[0].py = pts[0].y;
    pts[0].x  = this._smoothTipX;
    pts[0].y  = this._smoothTipY;

    // Verlet integrate every free point
    for (let i = 1; i < pts.length; i++) {
      const p  = pts[i];
      const vx = (p.x - p.px) * DAMPING;
      const vy = (p.y - p.py) * DAMPING;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + GRAVITY;
    }

    // Enforce fixed segment length between consecutive points
    for (let iter = 0; iter < CONSTRAINT_ITERS; iter++) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a  = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d  = Math.hypot(dx, dy);
        if (d < 0.001) continue;
        const diff = (d - SEGMENT_PX) / d;
        if (i === 0) {
          // Anchor is fixed — only push b
          b.x -= dx * diff;
          b.y -= dy * diff;
        } else {
          b.x -= dx * diff * 0.5;
          b.y -= dy * diff * 0.5;
          a.x += dx * diff * 0.5;
          a.y += dy * diff * 0.5;
        }
      }
    }
  }

  // Remove n points from the free end (used during retraction)
  shrink(n) {
    for (let i = 0; i < n && this.points.length > 0; i++) this.points.pop();
  }

  draw(ctx, t) {
    const pts = this.points;
    if (pts.length < 2) return;
    const n = pts.length;

    // Build visual positions: add a small sinusoidal sway perpendicular to the
    // local tangent at each point for the twisted-rope appearance
    const vis = pts.map((p, i) => {
      const prev  = pts[i - 1] ?? p;
      const next  = pts[i + 1] ?? p;
      const tx    = next.x - prev.x, ty = next.y - prev.y;
      const tl    = Math.hypot(tx, ty);
      const nx    = tl > 0.01 ? -ty / tl : 0;
      const ny    = tl > 0.01 ?  tx / tl : 0;
      const sway  = Math.sin(t * SWAY_FREQ + i * SWAY_PER_NODE) * SWAY_AMP;
      return { x: p.x + nx * sway, y: p.y + ny * sway };
    });

    // Pass 1 — smooth bezier cord with fade toward the free end
    const totalDx  = vis[n - 1].x - vis[0].x;
    const totalDy  = vis[n - 1].y - vis[0].y;
    const totalLen = Math.hypot(totalDx, totalDy);
    ctx.strokeStyle = totalLen >= 1
      ? (() => {
          const g = ctx.createLinearGradient(vis[0].x, vis[0].y, vis[n - 1].x, vis[n - 1].y);
          g.addColorStop(0, 'rgba(118, 0, 14, 0.95)');
          g.addColorStop(1, 'rgba(118, 0, 14, 0.38)');
          return g;
        })()
      : 'rgba(118, 0, 14, 0.95)';

    ctx.lineWidth = 4;
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';
    ctx.beginPath();
    ctx.moveTo(vis[0].x, vis[0].y);
    for (let i = 1; i < n - 1; i++) {
      const mx = (vis[i].x + vis[i + 1].x) * 0.5;
      const my = (vis[i].y + vis[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(vis[i].x, vis[i].y, mx, my);
    }
    ctx.lineTo(vis[n - 1].x, vis[n - 1].y);
    ctx.stroke();

    // Pass 2 — sinusoidal twist dots
    for (let i = 1; i < n; i++) {
      const alpha  = 0.85 - (i / n) * 0.5;
      const p0 = vis[i - 1], p1 = vis[i];
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.1) continue;
      const nx    = -dy / len, ny = dx / len;
      const steps = Math.max(1, Math.ceil(len / 3));
      ctx.fillStyle = `rgba(215, 75, 95, ${alpha * 0.65})`;
      for (let s = 0; s <= steps; s++) {
        const f   = s / steps;
        const off = Math.sin((i * 1.1 + s * 0.28) * 0.55) * 1.5;
        ctx.beginPath();
        ctx.arc(p0.x + dx * f + nx * off, p0.y + dy * f + ny * off, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Pass 3 — anchor glow dot
    ctx.beginPath();
    ctx.arc(vis[0].x, vis[0].y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 150, 150, 0.85)';
    ctx.fill();
  }
}
