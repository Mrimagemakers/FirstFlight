// Draw text and stripes onto a body() UV layout (u = around from the belly, v = nose -> tail).
import * as THREE from 'three';

/**
 * Creates a canvas livery for a fuselage.
 * @param {object} o { W, H, circumference (m), length (m), base, draw(ctx, api) }
 */
export function makeLivery(o) {
  const W = o.W || 2048, H = o.H || 2048;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = o.base || '#f2f1ec';
  ctx.fillRect(0, 0, W, H);
  const sx = W / o.circumference, sy = H / o.length;
  const api = {
    W, H, sx, sy,
    /** canvas coordinates for (u, v) */
    at: (u, v) => [u * W, (1 - v) * H],
    /** fill a band between two u values along a v range, mirrored on both sides */
    band(u0, u1, v0, v1, color, mirror = true) {
      ctx.fillStyle = color;
      ctx.fillRect(u0 * W, (1 - v1) * H, (u1 - u0) * W, (v1 - v0) * H);
      if (mirror) ctx.fillRect((1 - u1) * W, (1 - v1) * H, (u1 - u0) * W, (v1 - v0) * H);
    },
    /**
     * Draw in a local, metre-based frame on one side of the body.
     * side: 'right' (+x) or 'left'. Local +x reads towards the nose on the right side, towards the tail on the left.
     */
    side(side, u, v, fn) {
      ctx.save();
      const [cx, cy] = api.at(u, v);
      if (side === 'right') ctx.setTransform(0, sy, -sx, 0, cx, cy);
      else ctx.setTransform(0, -sy, sx, 0, cx, cy);
      fn(ctx);
      ctx.restore();
    },
  };
  o.draw?.(ctx, api);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas: c, ctx, texture, api };
}
