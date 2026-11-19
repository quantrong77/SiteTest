import { cp, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const output = resolve(root, 'dist');

for (const directory of ['js', 'css', 'icons']) {
  await cp(resolve(root, directory), resolve(output, directory), { recursive: true, force: true });
}

await copyFile(resolve(root, 'manifest.webmanifest'), resolve(output, 'manifest.webmanifest'));
await mkdir(resolve(output, 'docs'), { recursive: true });
await copyFile(resolve(root, 'docs/HUONG_DAN_SU_DUNG.md'), resolve(output, 'docs/HUONG_DAN_SU_DUNG.md'));
// ảnh minh họa của Hướng dẫn sử dụng (số liệu giả)
await cp(resolve(root, 'docs/img'), resolve(output, 'docs/img'), { recursive: true, force: true });
await writeFile(resolve(output, '.nojekyll'), '');
