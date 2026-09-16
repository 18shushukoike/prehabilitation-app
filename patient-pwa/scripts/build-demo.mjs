// デモ版を 1 ファイルの HTML に束ねる（Artifact 共有・メール添付での確認用）
// 出力: demo/術前リハ_デモ.html （<!doctype>/<html>/<head>/<body> は付けない = Artifact の要件）
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

execSync('npx vite build --outDir dist-demo --base ./', {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEMO: '1', VITE_HOSPITAL_PHONE: '03-XXXX-XXXX（デモ）', VITE_HOSPITAL_NAME: '順天堂医院 肝胆膵外科外来' }
});

const dist = 'dist-demo';
const assets = readdirSync(join(dist, 'assets'));
const js = assets.find((f) => /^index-.*\.js$/.test(f));
const css = assets.find((f) => /^index-.*\.css$/.test(f));
const jsSrc = readFileSync(join(dist, 'assets', js), 'utf8').replace(/<\/script/gi, '<\\/script');
const cssSrc = readFileSync(join(dist, 'assets', css), 'utf8');

const html = [
  '<title>術前リハビリ デモ</title>',
  '<style>', cssSrc, '</style>',
  '<div id="root"></div>',
  '<script type="module">', jsSrc, '</script>'
].join('\n');

mkdirSync('demo', { recursive: true });
writeFileSync('demo/術前リハ_デモ.html', html);
console.log('demo/術前リハ_デモ.html', (html.length / 1024).toFixed(0), 'KB');
