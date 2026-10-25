/* SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern SunRiser frontend; see LICENSING.md and LICENSE.
 */
import {en} from './locales/en.js';
import {de} from './locales/de.js';
import {resolve} from 'node:path';
import type {Plugin} from 'vite';

// Build-time only. Message keys are long descriptive identifiers repeated in the
// code and in both catalogues. Each quoted key becomes a short stable id before
// chunks are hashed, so cached file names always match their contents.
const first = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const rest = first + '0123456789';
const shortId = (index: number) => first[index % first.length] + (index < first.length ? '' : rest[Math.floor(index / first.length) - 1]);
const quoted = /(["'`])([A-Za-z][\w-]*\.[\w.-]+)\1/g;

export function shortMessageKeys(): Plugin {
  const keys = Object.keys(en).sort();
  if (JSON.stringify(keys) !== JSON.stringify(Object.keys(de).sort())) throw Error('Catalogue key sets differ');
  if (keys.length > first.length * rest.length) throw Error('Too many message keys for two-character ids');
  const ids = new Map(keys.map((key, index) => [key, shortId(index)]));
  const source = resolve(import.meta.dirname);
  const catalogue = (locale: string) => resolve(source, `locales/${locale}.ts`);
  return {
    name: 'sunriser-short-message-keys', apply: 'build', enforce: 'post',
    transform(code, id) {
      const file = id.split('?')[0];
      if (!file.startsWith(source + '/') || !/\.(ts|js|svelte)$/.test(file)) return null;
      const next = code.replace(quoted, (match, quote: string, key: string) => ids.has(key) ? quote + ids.get(key) + quote : match);
      return next === code ? null : {code: next, map: null};
    },
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(item => item.type === 'chunk');
      const leftovers = chunks.flatMap(chunk => keys.filter(key => chunk.code.includes(key) && new RegExp(`(?<![\\w.-])${key.replace(/[.]/g, '\\.')}(?![\\w.-])`).test(chunk.code)).map(key => `${chunk.fileName}: ${key}`));
      if (leftovers.length) throw Error(`Unshortened message keys: ${leftovers.slice(0, 10).join(', ')}`);
      // Language split: each catalogue is its own chunk and never part of the entry.
      for (const locale of ['en', 'de']) {
        const owners = chunks.filter(chunk => chunk.moduleIds.includes(catalogue(locale)));
        if (owners.length !== 1 || owners[0].isEntry || owners[0].moduleIds.length !== 1)
          throw Error(`The ${locale} catalogue must be a separate on-demand chunk`);
      }
    },
  };
}
