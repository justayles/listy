import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2] ?? 'C:/Users/justa/Desktop/listy.png';
const OUT = process.argv[3] ?? 'C:/GIT/todo/assets/images';
const SIZE = 1024;
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

function contentBox(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return { left: 0, top: 0, width, height };
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.06);
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  return {
    left,
    top,
    width: Math.min(width, maxX + 1 + pad) - left,
    height: Math.min(height, maxY + 1 + pad) - top,
  };
}

async function transparentMark() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = contentBox(data, info.width, info.height);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(box)
    .png();
}

async function fitOnCanvas(mark, canvas, scale) {
  const inner = Math.round(canvas * scale);
  const resized = await mark
    .clone()
    .resize(inner, inner, { fit: 'contain', background: CLEAR })
    .png()
    .toBuffer();
  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background: CLEAR },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png();
}

await mkdir(OUT, { recursive: true });
const mark = await transparentMark();

const foreground = await fitOnCanvas(mark, SIZE, 0.66);
await foreground.toFile(path.join(OUT, 'android-icon-foreground.png'));

const iconBuf = await (await fitOnCanvas(mark, SIZE, 0.78)).toBuffer();
await sharp(iconBuf).toFile(path.join(OUT, 'icon.png'));
await sharp(iconBuf).toFile(path.join(OUT, 'splash-icon.png'));
await sharp(iconBuf).resize(48, 48).toFile(path.join(OUT, 'favicon.png'));

const mono = await mark
  .clone()
  .resize(Math.round(SIZE * 0.66), Math.round(SIZE * 0.66), { fit: 'contain', background: CLEAR })
  .greyscale()
  .png()
  .toBuffer();
await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: CLEAR } })
  .composite([{ input: mono, gravity: 'centre' }])
  .png()
  .toFile(path.join(OUT, 'android-icon-monochrome.png'));

console.log('Wrote transparent icons to', OUT);
