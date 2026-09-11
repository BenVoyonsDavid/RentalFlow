import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const width = 600;
const height = 400;
const rowSize = width * 4 + 1;
const raw = Buffer.alloc(rowSize * height);

for (let y = 0; y < height; y += 1) {
  raw[y * rowSize] = 0;
}

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = y * rowSize + 1 + x * 4;
  raw[offset] = r;
  raw[offset + 1] = g;
  raw[offset + 2] = b;
  raw[offset + 3] = a;
}

function rect(x, y, w, h, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      setPixel(px, py, ...color);
    }
  }
}

rect(0, 0, width, height, [247, 250, 255]);
rect(0, 0, width, 84, [234, 243, 255]);
rect(28, 24, 154, 34, [17, 109, 255]);
rect(28, 108, 544, 54, [255, 255, 255]);
rect(40, 122, 220, 26, [238, 245, 255]);
rect(276, 122, 180, 26, [238, 245, 255]);
rect(468, 122, 92, 26, [17, 109, 255]);
rect(28, 184, 264, 76, [255, 255, 255]);
rect(308, 184, 264, 76, [255, 255, 255]);
rect(28, 276, 544, 92, [255, 255, 255]);
rect(44, 294, 200, 18, [225, 232, 241]);
rect(44, 324, 120, 18, [225, 232, 241]);
rect(418, 316, 138, 34, [17, 109, 255]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outputs = [
  resolve('public', 'rental-flow-online-booking-thumbnail.png'),
  resolve('public', 'rentalflow-booking.png'),
];

for (const output of outputs) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, png);
  console.log(`Generated ${output}`);
}
