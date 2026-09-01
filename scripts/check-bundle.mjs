import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('../apps/web/dist/assets/', import.meta.url);
const files = readdirSync(dist).filter((file) => /\.(js|css)$/.test(file));
const entries = files.map((file) => {
  const bytes = readFileSync(new URL(file, dist));
  return { file, bytes: bytes.length, gzip: gzipSync(bytes).length };
});
const largestJs = Math.max(0, ...entries.filter((item) => item.file.endsWith('.js')).map((item) => item.bytes));
const entryJs = entries.filter((item) => /^index-.*\.js$/.test(item.file)).reduce((sum, item) => sum + item.gzip, 0);
const totalCss = entries.filter((item) => item.file.endsWith('.css')).reduce((sum, item) => sum + item.gzip, 0);

for (const item of entries) console.log(`${item.file}: ${item.bytes} bytes, ${item.gzip} gzip`);
if (largestJs > 500_000) throw new Error(`Largest JS chunk exceeds 500 kB: ${largestJs} bytes`);
if (entryJs > 200_000) throw new Error(`Initial JS gzip exceeds 200 KiB: ${entryJs} bytes`);
if (totalCss > 50_000) throw new Error(`CSS gzip exceeds 50 KiB: ${totalCss} bytes`);
