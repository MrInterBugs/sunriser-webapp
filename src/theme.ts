// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Aedan Lawrence (original contributions).
// Part of the modern SunRiser frontend; see LICENSING.md and LICENSE.
// Presentation only: a browser-local colour theme. No API imports or controller requests.
// The inline startup script (startup-build.ts) applies a stored theme before first paint.
import {writable} from 'svelte/store';
export const themes=['aquascape','reef','planted','sun'] as const;
export type Theme=typeof themes[number];
const preferenceKey='sunriser.theme';
const isTheme=(value:unknown):value is Theme=>themes.includes(value as Theme);
function initialTheme():Theme{
  try{const value=typeof window!=='undefined'?window.localStorage.getItem(preferenceKey):null;return isTheme(value)?value:'aquascape';}catch{return 'aquascape';}
}
export const theme=writable<Theme>(initialTheme());
// The default Living Aquascape palette is the unattributed document.
theme.subscribe(value=>{if(typeof document!=='undefined'){if(value==='aquascape')document.documentElement.removeAttribute('data-theme');else document.documentElement.dataset.theme=value;}});
export function setTheme(value:string){
  if(!isTheme(value))return;
  theme.set(value);
  try{window.localStorage.setItem(preferenceKey,value);}catch{/* Restricted browser storage does not prevent in-session switching. */}
}
