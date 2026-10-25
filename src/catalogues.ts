// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Aedan Lawrence (original contributions). See LICENSE and LICENSING.md.
import {registerCatalogue, catalogueLoaded, type Locale, type Catalogue} from './messages.js';
// Each language is a separate on-demand build chunk; only the selected one downloads.
const catalogueModules: Record<Locale, () => Promise<Catalogue>> = {
  en: () => import('./locales/en.js').then(module => module.en),
  de: () => import('./locales/de.js').then(module => module.de),
};
export async function loadCatalogue(locale: Locale) {
  if (!catalogueLoaded(locale)) registerCatalogue(locale, await catalogueModules[locale]());
}
