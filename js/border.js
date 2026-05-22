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

}
