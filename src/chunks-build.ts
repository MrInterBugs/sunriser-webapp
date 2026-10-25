/* SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern SunRiser frontend; see LICENSING.md and LICENSE.
 */
import type {Plugin} from 'vite';

// Build-time only. The SR10 Wi-Fi server admits one connection, and a module's
// static imports download in parallel. Everything the entry imports statically
// shares one file; each on-demand page may need at most one further file.
export const entryModules = new Set<string>();
export function singleFileEntry(): Plugin {
  return {
    name: 'sunriser-single-file-entry', apply: 'build',
    buildEnd(error) {
      if (error) return;
      entryModules.clear();
      const pending = [...this.getModuleIds()].filter(id => this.getModuleInfo(id)?.isEntry);
      while (pending.length) {
        const id = pending.pop()!;
        if (entryModules.has(id)) continue;
        entryModules.add(id);
        pending.push(...(this.getModuleInfo(id)?.importedIds ?? []));
      }
    },
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(item => item.type === 'chunk');
      const main = chunks.filter(chunk => chunk.moduleIds.some(id => this.getModuleInfo(id)?.isEntry));
      if (main.length !== 1 || main[0].imports.length) throw Error('The entry must be one chunk without static imports');
      for (const chunk of chunks)
        if (chunk.imports.filter(file => file !== main[0].fileName).length > 1)
          throw Error(`${chunk.fileName} would download several files at once`);
    },
  };
}
