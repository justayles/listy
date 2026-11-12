import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2] ?? 'C:/Users/justa/Desktop/listy.png';
const OUT = process.argv[3] ?? 'C:/GIT/todo/assets/images';
const SIZE = 1024;
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

function isBrown(r, g, b) {
  return r > 70 && r > g + 15 && r - b > 30;
}

function layout(data, width, height) {
  let rMinX = width;
  let rMinY = height;
  let rMaxX = 0;
  let rMaxY = 0;
  let ring = 0;
  let mass = 0;
  let mx = 0;
  let my = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < 12) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (isBrown(data[i], data[i + 1], data[i + 2])) {
        ring++;
        mass += a;
        mx += x * a;
        my += y * a;
        if (x < rMinX) rMinX = x;
        if (y < rMinY) rMinY = y;
        if (x > rMaxX) rMaxX = x;
        if (y > rMaxY) rMaxY = y;
      }
    }
  }

  const cx = ring > 100 ? mx / mass : (minX + maxX) / 2;
  const cy = ring > 100 ? my / mass : (minY + maxY) / 2;
  const ringSize =
    ring > 100
      ? Math.max(rMaxX - rMinX + 1, rMaxY - rMinY + 1)
      : Math.max(maxX - minX + 1, maxY - minY + 1);

  return { cx, cy, ringSize };
}

async function fitOnCanvas(srcBuf, info, layout, canvas, ringScale) {
  const scale = (canvas * ringScale) / layout.ringSize;
  const w = Math.round(info.width * scale);
  const h = Math.round(info.height * scale);
  const resized = await sharp(srcBuf, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(w, h)
    .png()
    .toBuffer();

  let left = Math.round(canvas / 2 - layout.cx * scale);
  let top = Math.round(canvas / 2 - layout.cy * scale);
  let cropX = 0;
  let cropY = 0;
  let cropW = w;
  let cropH = h;
  if (left < 0) {
    cropX = -left;
    cropW += left;
    left = 0;
  }
  if (top < 0) {
    cropY = -top;
    cropH += top;
    top = 0;
  }
  if (left + cropW > canvas) cropW = canvas - left;
  if (top + cropH > canvas) cropH = canvas - top;

  const piece = await sharp(resized)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .png()
    .toBuffer();

  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background: CLEAR },
  })
    .composite([{ input: piece, left, top }])
    .png();
}

await mkdir(OUT, { recursive: true });
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const box = layout(data, info.width, info.height);

// Adaptive: keep the ring inside the ~66% mask. Splash/icon can sit a bit larger.
const foreground = await fitOnCanvas(data, info, box, SIZE, 0.6);
await foreground.toFile(path.join(OUT, 'android-icon-foreground.png'));

const iconBuf = await (await fitOnCanvas(data, info, box, SIZE, 0.7)).toBuffer();
await sharp(iconBuf).toFile(path.join(OUT, 'icon.png'));
await sharp(iconBuf).toFile(path.join(OUT, 'splash-icon.png'));
await sharp(iconBuf).resize(48, 48).toFile(path.join(OUT, 'favicon.png'));

const monoBuf = await (await fitOnCanvas(data, info, box, SIZE, 0.6)).toBuffer();
await sharp(monoBuf).greyscale().toFile(path.join(OUT, 'android-icon-monochrome.png'));

console.log('Wrote centered transparent icons to', OUT);
