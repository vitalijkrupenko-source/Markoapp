// Builds the phone prototype: the real screens bundled into one HTML page that
// runs on the artifact's shared database instead of the server.
//   node prototype/build.mjs [out.html] [share-url]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'prototype/dist/urnik-prototip.html'));
const shareUrl = process.argv[3] || '';

const shims = {
  react: 'module.exports = window.React;',
  'react-dom/client': 'module.exports = window.ReactDOM;',
  'react/jsx-runtime': `
    const R = window.React;
    const jsx = (type, props, key) => R.createElement(type, key === undefined ? props : { ...props, key });
    module.exports = { jsx, jsxs: jsx, Fragment: R.Fragment };`,
};

const resolver = {
  name: 'urnik',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom\/client|react\/jsx-runtime)$/ }, (a) => ({ path: a.path, namespace: 'shim' }));
    build.onLoad({ filter: /.*/, namespace: 'shim' }, (a) => ({ contents: shims[a.path], loader: 'js' }));
    build.onResolve({ filter: /^@\// }, (a) => ({ path: withExt(path.join(root, a.path.slice(2))) }));
    // Screens import './client' or '../client'; point them at the prototype's version.
    build.onResolve({ filter: /^\.\.?\/client$/ }, (a) =>
      (a.importer.includes(`${path.sep}components${path.sep}`) ? { path: path.join(root, 'prototype/client.js') } : undefined));
  },
};

function withExt(p) {
  for (const ext of ['', '.js', '.jsx']) if (fs.existsSync(p + ext) && fs.statSync(p + ext).isFile()) return p + ext;
  return p;
}

const result = await esbuild.build({
  entryPoints: [path.join(root, 'prototype/main.jsx')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [resolver],
  logLevel: 'error',
});

const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8') + `
.proto { background: var(--accent-soft); color: var(--accent-dark); font-size: 13px; line-height: 1.4; padding: 8px 16px; text-align: center; }
.proto a { color: inherit; font-weight: 700; }
`;
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const html = `<title>Urnik klinike</title>
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>window.URNIK_SHARE_URL = ${JSON.stringify(shareUrl)};</script>
<script>${js}</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${out} (${Math.round(html.length / 1024)} KB)`);
