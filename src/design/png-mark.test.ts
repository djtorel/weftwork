// story: e16s02
// Numbered boxes drawn on a screenshot: the box lands where the mark says,
// the image keeps its size, and a PNG this file cannot read gives null.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decodePng, encodePng, markPng, pngSize } from './png-mark.ts';

/** A white RGBA image of `width` by `height` as a PNG file. */
function whitePng(width: number, height: number): Buffer {
  return encodePng({ width, height, rgba: Buffer.alloc(width * height * 4, 255) });
}

function pixel(png: Buffer, x: number, y: number): number[] {
  const image = decodePng(png);
  assert.ok(image !== null);
  const at = (y * image.width + x) * 4;
  return [...image.rgba.subarray(at, at + 4)];
}

test('pngSize reads the header; a file that is not a PNG has none', () => {
  assert.deepEqual(pngSize(whitePng(30, 20)), { width: 30, height: 20 });
  assert.equal(pngSize(Buffer.from('not a png')), null);
});

test('a mark draws a red box on its edge and leaves the inside and the outside alone', () => {
  const marked = markPng(whitePng(200, 120), [{ n: 1, x: 50, y: 40, w: 100, h: 60 }]);
  assert.ok(marked !== null);
  assert.deepEqual(pngSize(marked), { width: 200, height: 120 });
  assert.deepEqual(pixel(marked, 100, 99), [230, 0, 80, 255], 'the bottom edge is red');
  assert.deepEqual(pixel(marked, 100, 70), [255, 255, 255, 255], 'the inside is untouched');
  assert.deepEqual(pixel(marked, 190, 110), [255, 255, 255, 255], 'the outside is untouched');
});

test('a box past the edge of the image is clipped, not an error', () => {
  const marked = markPng(whitePng(40, 40), [{ n: 12, x: 30, y: 30, w: 100, h: 100 }]);
  assert.ok(marked !== null);
  assert.deepEqual(pngSize(marked), { width: 40, height: 40 });
});

test('every filter type of a real encoder is read back to the same pixels', () => {
  // Two rows of RGB, the first with filter 1 (sub), the second with 4 (paeth).
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const raw = Buffer.from([1, 10, 20, 30, 5, 5, 5, 4, 1, 1, 1, 2, 2, 2]);
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, data, Buffer.alloc(4)]);
  };
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  const image = decodePng(png);
  assert.ok(image !== null);
  assert.deepEqual([...image.rgba], [10, 20, 30, 255, 15, 25, 35, 255, 11, 21, 31, 255, 17, 27, 37, 255]);
});

test('a palette PNG is not drawn on: null, so the marks stay text', () => {
  const png = whitePng(4, 4);
  png[25] = 3;
  assert.equal(markPng(png, [{ n: 1, x: 0, y: 0, w: 2, h: 2 }]), null);
});

test('labels of marks that share a corner sit side by side, not on top of each other', () => {
  const box = { x: 10, y: 40, w: 100, h: 50 };
  const marked = markPng(whitePng(200, 120), [{ n: 1, ...box }, { n: 2, ...box }]);
  assert.ok(marked !== null);
  // Each label is 5 by 7 cells of 2 pixels: the first spans x 10 to 19; the second starts at 22, with a red pad at its edge.
  assert.deepEqual(pixel(marked, 22, 27), [230, 0, 80, 255], 'the second label is to the right of the first');
});
