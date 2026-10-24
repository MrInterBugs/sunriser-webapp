import {source,isMessage} from './messages.js';
/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern frontend adapted from the SunRiser project and its workflows.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Frontend adaptation (2026); see LICENSING.md and LICENSE.
 * Third-party material retains its own terms.
 */
export const metadataText=(value:unknown)=>value==null?source("systemsettings.notReported_98e85"):isMessage(value)?value:typeof value==='string'?value:JSON.stringify(value);
export function macText(value:unknown){
 return Array.isArray(value)&&value.length===6&&value.every(n=>Number.isInteger(n)&&n>=0&&n<=255)?value.map(n=>n.toString(16).padStart(2,'0')).join(':').toUpperCase():metadataText(value);
}
export function timestampText(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=8.64e12?new Date(value*1000).toISOString().replace('.000Z','Z'):metadataText(value);}
