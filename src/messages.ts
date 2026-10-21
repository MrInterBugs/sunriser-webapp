// SPDX-License-Identifier: GPL-3.0-or-later
// Locale-independent message identities. No browser, store, API or translation effects.
import {en,type MessageKey} from './locales/en.js';
export const source=<K extends MessageKey>(key:K,values:Record<string,unknown>={}):string=>en[key].replace(/\{(v\d+)\}/g,(_,name:string)=>Object.hasOwn(values,name)?String(values[name]):`{${name}}`);
