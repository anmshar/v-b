// Procedural tile textures so the demo needs no image assets. Real build: Salsify images.
import { rng, hashStr, hexToRgb, shade, parseFormat } from './util.js';

const cache = new Map();

function addNoise(ctx, w, h, amount, r) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx, w, h, hex, count, r, alpha = 0.1, scale = 0.25) {
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * h, rad = (0.2 + r()) * w * scale;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = shade(hex, (r() - 0.5) * 50);
    const [cr, cg, cb] = hexToRgb(c);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawLook(ctx, look, hex, w, h, r, surfaceHint) {
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, w, h);
  if (look === 'concrete') {
    blotches(ctx, w, h, hex, 40, r, 0.12);
    addNoise(ctx, w, h, 16, r);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 0.6 + r() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look === 'stone') {
    blotches(ctx, w, h, hex, 70, r, 0.16, 0.18);
    addNoise(ctx, w, h, 26, r);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.14)';
      ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
    }
  } else if (look === 'wood') {
    const planks = 1;
    for (let y = 0; y < h; y += 1) {
      const wave = Math.sin(y * 0.09 + r() * 0.3) * 0.5 + Math.sin(y * 0.021) * 0.5;
      ctx.fillStyle = `rgba(${wave > 0 ? '255,240,220' : '60,35,15'},${Math.abs(wave) * 0.09})`;
      ctx.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 70; i++) {
      const y0 = r() * h;
      ctx.strokeStyle = `rgba(70,40,20,${0.06 + r() * 0.12})`;
      ctx.lineWidth = 0.6 + r() * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y0 + Math.sin(x * 0.01 + i) * 6 + (r() - 0.5) * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 3 * planks; i++) {
      const x = r() * w, y = r() * h;
      ctx.strokeStyle = 'rgba(60,35,15,0.25)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(x, y, 6 + k * 5, 2 + k * 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    addNoise(ctx, w, h, 12, r);
  } else if (look === 'marble') {
    blotches(ctx, w, h, hex, 20, r, 0.08, 0.4);
    ctx.filter = 'blur(1.2px)';
    for (let v = 0; v < 7; v++) {
      let x = -20, y = r() * h;
      ctx.strokeStyle = `rgba(110,105,100,${0.18 + r() * 0.3})`;
      ctx.lineWidth = 0.6 + r() * 2.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (x < w + 20) {
        x += 6 + r() * 14;
        y += (r() - 0.45) * 18;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.filter = 'none';
    addNoise(ctx, w, h, 6, r);
  } else if (look === 'terrazzo') {
    addNoise(ctx, w, h, 8, r);
    const palette = [shade(hex, -70), shade(hex, -35), '#ffffff', '#8a8580', '#c9b9a0', shade(hex, 30)];
    const count = Math.floor((w * h) / 140);
    for (let i = 0; i < count; i++) {
      const x = r() * w, y = r() * h, s = 1 + r() * (r() > 0.92 ? 9 : 4);
      ctx.fillStyle = palette[Math.floor(r() * palette.length)];
      ctx.beginPath();
      const sides = 4 + Math.floor(r() * 3);
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2 + r();
        const rr = s * (0.6 + r() * 0.6);
        ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fill();
    }
  } else {
    // plain
    blotches(ctx, w, h, hex, 8, r, 0.05, 0.5);
    addNoise(ctx, w, h, 5, r);
  }
  if (surfaceHint === 'glossy' || surfaceHint === 'polished') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

export function textureCanvas(product, size = 512, variant = 0) {
  const key = `${product.id}:${size}:${variant}`;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const r = rng(hashStr(product.id) + variant * 7919);
  const hint = product.collection.surfaces[0].id;
  drawLook(ctx, product.look, product.hex, size, size, r, hint);
  cache.set(key, cv);
  return cv;
}

const urlCache = new Map();
export function thumbURL(product, size = 260) {
  const key = `${product.id}:${size}`;
  if (!urlCache.has(key)) urlCache.set(key, textureCanvas(product, size).toDataURL('image/jpeg', 0.82));
  return urlCache.get(key);
}

// Render a laid floor/wall with format, pattern and joint.
export function renderLayout(canvas, product, opts) {
  const { format = '60×60', joint = '#bdb8b0', jointMm = 3, pattern = 'half', vertical = false } = opts;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const scale = W / 300; // canvas shows 3 m wide
  let [a, b] = parseFormat(format);
  let tw = Math.max(a, b) * scale, th = Math.min(a, b) * scale;
  if (vertical) [tw, th] = [th, tw];
  const gap = Math.max(1, (jointMm / 10) * scale);
  ctx.fillStyle = joint;
  ctx.fillRect(0, 0, W, H);
  const src = textureCanvas(product, 768, 1);
  const r = rng(hashStr(product.id + format + pattern));
  const shift = pattern === 'half' ? tw / 2 : pattern === 'third' ? tw / 3 : 0;
  let row = 0;
  for (let y = 0; y < H + th; y += th + gap, row++) {
    const off = shift ? -((row * shift) % (tw + gap)) : 0;
    for (let x = off - (shift ? tw : 0); x < W + tw; x += tw + gap) {
      const sw = Math.min(src.width, tw * 1.2), sh = Math.min(src.height, th * 1.2);
      const sx = r() * (src.width - sw), sy = r() * (src.height - sh);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(src, sx, sy, sw, sh, x, y, tw, th);
      ctx.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.05})`;
      ctx.fillRect(x, y, tw, th);
      ctx.restore();
    }
  }
  // soft light for depth
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // scale bar
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(12, H - 40, 100 * scale + 12, 30);
  ctx.fillStyle = '#222';
  ctx.fillRect(18, H - 18, 100 * scale, 3);
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText('1 m', 18 + (100 * scale) / 2 - 10, H - 24);
}

// Reference "room" photos for the photo search demo.
export const REFERENCE_PHOTOS = [
  { id: 'loft', label: 'Concrete loft', productId: 'calce-grigio', tint: '#a8a49c' },
  { id: 'oak', label: 'Warm oak lounge', productId: 'eichenhof-honig', tint: '#c49a66' },
  { id: 'marble', label: 'Marble hotel bath', productId: 'marmara-calacatta', tint: '#ece5d9' },
  { id: 'slate', label: 'Dark slate spa', productId: 'basalto-antracite', tint: '#45433f' },
  { id: 'terrazzo', label: 'Terrazzo café', productId: 'terrazza-salvia', tint: '#b6bea9' },
];

export function referencePhoto(ref, productLookup) {
  const p = productLookup(ref.productId);
  const cv = document.createElement('canvas');
  cv.width = 320; cv.height = 220;
  const ctx = cv.getContext('2d');
  // wall
  ctx.fillStyle = shade(ref.tint, 30);
  ctx.fillRect(0, 0, 320, 220);
  // floor with perspective
  const src = textureCanvas(p, 512, 2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 70); ctx.lineTo(320, 70); ctx.lineTo(320, 220); ctx.lineTo(0, 220); ctx.closePath();
  ctx.clip();
  ctx.drawImage(src, 0, 0, 512, 360, -10, 60, 340, 170);
  ctx.restore();
  ctx.drawImage(src, 0, 0, 512, 160, 0, 0, 320, 72);
  const g = ctx.createLinearGradient(0, 0, 0, 220);
  g.addColorStop(0, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 320, 220);
  return cv;
}
