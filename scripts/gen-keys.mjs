// 批量生成小手机专属密钥：node scripts/gen-keys.mjs 100
// 算法必须与 src/lib/access.ts 保持一致（SALT / CHARS / checksum）。
import fs from 'node:fs';
import path from 'node:path';

const SALT = 'XN-2026-11-18-7f3c9a';
const CHARS = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789';

function checksum(body) {
  const input = `${body}|${SALT}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    out += CHARS[hash & 31];
    hash >>>= 5;
  }
  return out;
}

function group() {
  let out = '';
  for (let i = 0; i < 4; i += 1) out += CHARS[Math.floor(Math.random() * CHARS.length)];
  return out;
}

const count = Math.max(1, Number(process.argv[2]) || 100);
const target = process.argv[3] || path.resolve('小手机密钥.txt');
const keys = new Set();
while (keys.size < count) {
  const a = group();
  const b = group();
  keys.add(`XN-${a}-${b}-${checksum(`XN${a}${b}`)}`);
}

const list = [...keys];
fs.writeFileSync(target, `${list.join('\n')}\n`, 'utf8');
console.log(`已生成 ${list.length} 个密钥：${target}`);
console.log(list.slice(0, 3).join('\n'));
