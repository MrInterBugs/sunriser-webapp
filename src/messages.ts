// SPDX-License-Identifier: GPL-3.0-or-later
// Locale-independent message identities. No browser, store, API or translation effects.
import {en,type MessageKey} from './locales/en.js';
export const source=<K extends MessageKey>(key:K,values:Record<string,unknown>={}):string=>en[key].replace(/\{(v\d+)\}/g,(_,name:string)=>Object.hasOwn(values,name)?String(values[name]):`{${name}}`);

/** Singular/plural formatting for retained file feedback; protocol counts stay numeric. */
export const sourceCount=(count:number,unit:'key'|'byte')=>source(unit==='key'?(count===1?'common.keyOne':'common.keyMany'):(count===1?'common.byteOne':'common.byteMany'),{v0:count});
