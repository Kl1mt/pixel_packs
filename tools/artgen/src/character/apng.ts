import { deflateSync } from 'node:zlib';
import type { PNG } from 'pngjs';

/**
 * A minimal APNG encoder (RGBA, full-canvas frames, no blending tricks) so trial
 * animations can be previewed in a browser or a GitHub blob view without a GIF's
 * 1-bit transparency or a new dependency.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Raw scanlines with filter byte 0, deflated. */
function imageData(png: PNG): Buffer {
  const stride = png.width * 4;
  const raw = Buffer.alloc((stride + 1) * png.height);
  for (let y = 0; y < png.height; y++) {
    png.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return deflateSync(raw);
}

export interface ApngFrame {
  image: PNG;
  /** Frame duration in milliseconds. */
  delayMs: number;
}

/** Encodes same-sized RGBA frames as a looping APNG. */
export function encodeApng(frames: ApngFrame[], loops = 0): Buffer {
  const first = frames[0];
  if (!first) throw new Error('no frames');
  const { width, height } = first.image;
  if (frames.some((f) => f.image.width !== width || f.image.height !== height)) {
    throw new Error('all APNG frames must have the same size');
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA, deflate, no filter method, no interlace
  const actl = Buffer.alloc(8);
  actl.writeUInt32BE(frames.length, 0);
  actl.writeUInt32BE(loops, 4);

  const parts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('acTL', actl),
  ];
  let seq = 0;
  frames.forEach((frame, n) => {
    const fctl = Buffer.alloc(26);
    fctl.writeUInt32BE(seq++, 0);
    fctl.writeUInt32BE(width, 4);
    fctl.writeUInt32BE(height, 8);
    fctl.writeUInt32BE(0, 12);
    fctl.writeUInt32BE(0, 16);
    fctl.writeUInt16BE(Math.max(1, Math.round(frame.delayMs)), 20);
    fctl.writeUInt16BE(1000, 22); // delay denominator: milliseconds
    fctl.set([1, 0], 24); // dispose to background, source blend
    parts.push(chunk('fcTL', fctl));
    const data = imageData(frame.image);
    if (n === 0) {
      parts.push(chunk('IDAT', data));
    } else {
      const seqBuf = Buffer.alloc(4);
      seqBuf.writeUInt32BE(seq++);
      parts.push(chunk('fdAT', Buffer.concat([seqBuf, data])));
    }
  });
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}
