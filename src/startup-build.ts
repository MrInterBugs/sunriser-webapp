/* SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern SunRiser frontend; see LICENSING.md and LICENSE.
 */
import {en} from './locales/en.js';
import {de} from './locales/de.js';
import {createHash} from 'node:crypto';
import type {Plugin} from 'vite';

// Build-time only. The SR10 Wi-Fi server accepts one connection. A normal HTML
// module + stylesheet pair lets the preload scanner race those critical reads.
export function sequentialStartup(): Plugin {
  return {
    name: 'sunriser-sequential-startup', apply: 'build', enforce: 'post',
    generateBundle: {order: 'post', handler(_options, bundle) {
      const page = bundle['index.html'];
      if (!page || page.type !== 'asset') throw Error('Missing startup HTML');
      let html = String(page.source);
      const scripts = [...html.matchAll(/<script\b[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)];
      const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
      if (scripts.length !== 1 || styles.length !== 1)
        throw Error('Startup requires exactly one entry and one stylesheet');
      const script = scripts[0], style = styles[0];
      for (const url of [script[1],style[1]])
        if (!/^\.\/a\/[A-Za-z0-9_-]+\.(js|css)$/.test(url)) throw Error('Unexpected startup asset path');
      // No automatic resource retry or API work. On failure, keep the application
      // unmounted and offer an ordinary, explicitly chosen reload.
      const startupMessages=Object.fromEntries(['en','de'].map(locale=>{const catalogue=locale==='de'?de:en;return [locale,Object.fromEntries(['loading','starting','failed','reload','label'].map(name=>[name,catalogue[('startup.'+name) as keyof typeof en]]))];}));
      const source = `/* SunRiser sequential startup; GPL-3.0-or-later */
let locale='en';try{if(localStorage.getItem('sunriser.language')==='de')locale='de';}catch{}
document.documentElement.lang=locale;
const messages=${JSON.stringify(startupMessages)}[locale];
const status=document.getElementById('startup-status');
status.textContent=messages.loading;
document.getElementById('startup').setAttribute('aria-label',messages.label);
document.querySelector('#startup a').textContent=messages.reload;
try {
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL(${JSON.stringify(style[1].replace('./a/','./'))},import.meta.url).href;
 await new Promise((resolve,reject)=>{css.onload=resolve;css.onerror=()=>reject(Error('stylesheet'));document.head.append(css)});
 if(!css.sheet||css.sheet.cssRules.length===0)throw Error('stylesheet');
 status.textContent=messages.starting;
 await import(${JSON.stringify(script[1].replace('./a/','./'))});
 if(!document.getElementById('app')?.childElementCount)throw Error('application');
 // App keeps this same panel through the first controller read, then removes it.
} catch {
 status.textContent=messages.failed;
 status.setAttribute('role','alert');
}
`;
      const name = `a/boot-${createHash('sha256').update(source).digest('hex').slice(0,10)}.js`;
      this.emitFile({type:'asset', fileName:name, source});
      // Self-contained critical presentation: no font/image/style dependency and
      // no layout change when the full stylesheet arrives. Hide the mounted app
      // rather than exposing a second connection screen underneath this panel.
      const css = '#startup{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:#142f29;color:#edf0e4;font:400 16px/1.5 system-ui,sans-serif}#startup,#startup *{box-sizing:border-box}#startup .startup-panel{width:min(100%,32rem);padding:32px;border:1px solid #41614f;border-radius:12px;background:#1b3a30}#startup h1{margin:0 0 16px;font:600 26px/1.25 system-ui,sans-serif;letter-spacing:-.5px}#startup p{min-height:6em;margin:0 0 16px;color:#bdcdbb;font:400 16px/1.5 system-ui,sans-serif}#startup a{display:inline-block;padding:12px 0;color:#e4c497;font:500 16px/1.5 system-ui,sans-serif}#startup a:focus-visible{outline:3px solid #ecd3a5;outline-offset:4px}#startup~#app{display:none}';
      const hash = createHash('sha256').update(css).digest('base64');
      html = html.replace(script[0],`<script type="module" src="./${name}"></script>`).replace(style[0],'')
        .replace("style-src 'self';",`style-src 'self' 'sha256-${hash}';`)
        .replace('</head>',`<style>${css}</style>\n</head>`)
        .replace('<div id="app"></div>', '<section id="startup" aria-label="Interface loading"><div class="startup-panel"><h1>SunRiser</h1><p id="startup-status" role="status">'+en['startup.loading']+'</p><a href="">Reload interface</a></div></section>\n<div id="app"></div>');
      page.source = html;
    }},
  };
}
