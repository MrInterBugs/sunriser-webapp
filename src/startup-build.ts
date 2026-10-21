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
 document.getElementById('startup')?.remove();
} catch {
 status.textContent=messages.failed;
 status.setAttribute('role','alert');
}
`;
      const name = `a/boot-${createHash('sha256').update(source).digest('hex').slice(0,10)}.js`;
      this.emitFile({type:'asset', fileName:name, source});
      const css = '#startup{max-width:40rem;margin:4rem auto;padding:1.5rem;font:1rem/1.5 system-ui,sans-serif;color:#eeeede;background:#163128}#startup h1{font-size:1.4rem}#startup a{color:inherit;display:inline-block;padding:.75rem 0}';
      const hash = createHash('sha256').update(css).digest('base64');
      html = html.replace(script[0],`<script type="module" src="./${name}"></script>`).replace(style[0],'')
        .replace("style-src 'self';",`style-src 'self' 'sha256-${hash}';`)
        .replace('</head>',`<style>${css}</style>\n</head>`)
        .replace('<div id="app"></div>', '<section id="startup" aria-label="Interface loading"><h1>SunRiser</h1><p id="startup-status" role="status">Loading interface… If loading does not complete, check the connection and reload.</p><a href="">Reload interface</a></section>\n<div id="app"></div>');
      page.source = html;
    }},
  };
}
