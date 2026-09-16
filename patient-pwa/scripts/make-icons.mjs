// 仮アイコン（単色＋白い丸）を PNG で生成する。正式なアイコンができたら public/ を差し替える
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const bg = [0x1a, 0x6b, 0x8a], fg = [0xff, 0xff, 0xff];
  const rows = [];
  const cx = size / 2, cy = size / 2, r = size * 0.28;
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      const bar = Math.abs(y - cy) < size * 0.05 && Math.abs(x - cx) < size * 0.18; // 横棒（ダンベル風）
      const p = inside && !bar ? fg : bg;
      row.push(p[0], p[1], p[2]);
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));
writeFileSync('public/apple-touch-icon.png', png(180));
console.log('icons written');
