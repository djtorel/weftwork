// story: e16s02
// Annotated screenshots for the design loop (docs/DESIGN-LOOP.md): a numbered
// box drawn on a PNG for each mark a reviewer made, so the agent and the owner
// see what a finding points at. Only the PNGs screenshot tools write are
// read (8-bit grey, grey and alpha, RGB or RGBA, not interlaced); any other
// gives null and the record lists the marks with their boxes as text.
import { crc32, deflateSync, inflateSync } from 'node:zlib';

export type Box = { x: number; y: number; w: number; h: number };
export type NumberedBox = Box & { n: number };
type Image = { width: number; height: number; rgba: Buffer };

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Larger images are not drawn on: decoding one holds 4 bytes a pixel. */
const maxPixels = 40_000_000;
const channelsOf: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

/** The width and height in a PNG's header, or null when it is not a PNG. */
export function pngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature) || bytes.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** The pixels of a PNG as RGBA, or null when it is a kind this file does not read. */
export function decodePng(bytes: Buffer): Image | null {
  const size = pngSize(bytes);
  if (size === null || size.width === 0 || size.height === 0 || size.width * size.height > maxPixels) return null;
  const depth = bytes[24];
  const channels = channelsOf[bytes[25] ?? -1];
  if (depth !== 8 || channels === undefined || bytes[28] !== 0) return null;
  const idat: Buffer[] = [];
  for (let at = 8; at + 8 <= bytes.length; ) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('latin1', at + 4, at + 8);
    if (type === 'IDAT') idat.push(bytes.subarray(at + 8, at + 8 + length));
    if (type === 'IEND') break;
    at += 12 + length;
  }
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const { width, height } = size;
  const stride = width * channels;
  if (raw.length < height * (stride + 1)) return null;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const value = raw[y * (stride + 1) + 1 + i] ?? 0;
      const left = i >= channels ? (pixels[y * stride + i - channels] ?? 0) : 0;
      const up = y > 0 ? (pixels[(y - 1) * stride + i] ?? 0) : 0;
      const corner = y > 0 && i >= channels ? (pixels[(y - 1) * stride + i - channels] ?? 0) : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, corner)][filter ?? 0];
      if (predicted === undefined) return null;
      pixels[y * stride + i] = (value + predicted) & 0xff;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const s = p * channels;
    const grey = channels <= 2;
    rgba[p * 4] = pixels[s] ?? 0;
    rgba[p * 4 + 1] = pixels[grey ? s : s + 1] ?? 0;
    rgba[p * 4 + 2] = pixels[grey ? s : s + 2] ?? 0;
    rgba[p * 4 + 3] = channels === 2 ? (pixels[s + 1] ?? 255) : channels === 4 ? (pixels[s + 3] ?? 255) : 255;
  }
  return { width, height, rgba };
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** An RGBA image as a PNG file. */
export function encodePng(image: Image): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = image.width * 4;
  const raw = Buffer.alloc(image.height * (stride + 1));
  for (let y = 0; y < image.height; y++) image.rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** The mark colour: a strong red that reads on light and dark screens. */
const red = [230, 0, 80];

function fill(image: Image, x0: number, y0: number, w: number, h: number, colour: number[]): void {
  const x1 = Math.min(image.width, x0 + w);
  const y1 = Math.min(image.height, y0 + h);
  for (let y = Math.max(0, y0); y < y1; y++) {
    for (let x = Math.max(0, x0); x < x1; x++) {
      const at = (y * image.width + x) * 4;
      image.rgba[at] = colour[0] ?? 0;
      image.rgba[at + 1] = colour[1] ?? 0;
      image.rgba[at + 2] = colour[2] ?? 0;
      image.rgba[at + 3] = 255;
    }
  }
}

/** Digits 0 to 9 on a 3 by 5 grid, one string of 15 bits each, row by row. */
const digits = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];

type Rect = { left: number; top: number; width: number; height: number };

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

/** Draw mark `n`'s number at the box's top left corner, moved right past any
 * label already there, so marks that share a corner stay readable. */
function label(image: Image, x: number, y: number, n: number, scale: number, placed: Rect[]): void {
  const text = String(n);
  const width = (text.length * 4 + 1) * scale;
  const height = 7 * scale;
  let left = Math.min(Math.max(0, x), Math.max(0, image.width - width));
  const top = y - height >= 0 ? y - height : Math.min(Math.max(0, y), Math.max(0, image.height - height));
  while (placed.some((rect) => overlaps(rect, { left, top, width, height })) && left + width + scale <= image.width - width) {
    left = Math.max(...placed.filter((rect) => overlaps(rect, { left, top, width, height })).map((rect) => rect.left + rect.width)) + scale;
  }
  placed.push({ left, top, width, height });
  fill(image, left, top, width, height, red);
  [...text].forEach((char, index) => {
    const bits = digits[Number(char)] ?? '';
    for (let bit = 0; bit < 15; bit++) {
      if (bits[bit] === '1') fill(image, left + (1 + index * 4 + (bit % 3)) * scale, top + (1 + Math.floor(bit / 3)) * scale, scale, scale, [255, 255, 255]);
    }
  });
}

/** `bytes` with a numbered red box for each mark, or null when the PNG is a
 * kind this file does not read. Boxes are clipped to the image. */
export function markPng(bytes: Buffer, boxes: NumberedBox[]): Buffer | null {
  const image = decodePng(bytes);
  if (image === null) return null;
  const line = Math.max(2, Math.round(Math.min(image.width, image.height) / 300));
  const scale = Math.max(2, Math.round(Math.min(image.width, image.height) / 200));
  for (const box of boxes) {
    const { x, y, w, h } = box;
    fill(image, x, y, w, line, red);
    fill(image, x, y + h - line, w, line, red);
    fill(image, x, y, line, h, red);
    fill(image, x + w - line, y, line, h, red);
  }
  const placed: Rect[] = [];
  for (const box of boxes) label(image, box.x, box.y, box.n, scale, placed);
  return encodePng(image);
}
