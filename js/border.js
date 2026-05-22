// Draws the animated twisted-string border around the video viewport.
// Uses the same dark-maroon cord + sinusoidal-dot visual as the finger ropes.
export function drawStringBorder(ctx, v, t) {
  const { x, y, w, h } = v;
  const S   = 6;
  const pts = [];

  for (let px = x;     px < x + w; px += S) pts.push([px,    y    ]);
  for (let py = y;     py < y + h; py += S) pts.push([x + w, py   ]);
  for (let px = x + w; px > x;     px -= S) pts.push([px,    y + h]);
  for (let py = y + h; py > y;     py -= S) pts.push([x,     py   ]);
  pts.push([x, y]);

  ctx.strokeStyle = 'rgba(118, 0, 14, 0.92)';
  ctx.lineWidth   = 3.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();

  ctx.fillStyle = 'rgba(215, 75, 95, 0.62)';
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const dx  = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) continue;
    const nx    = -dy / len, ny = dx / len;
    const steps = Math.ceil(len / 4);
    for (let s = 0; s <= steps; s++) {
      const f     = s / steps;
      const phase = (i + f + t * 0.00015) * 0.8;
      const off   = Math.sin(phase) * 1.5;
      ctx.beginPath();
      ctx.arc(x0 + dx * f + nx * off, y0 + dy * f + ny * off, 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
