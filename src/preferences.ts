/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Includes code/configuration adapted from the SunRiser project contributors.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Adapted for this frontend in 2026; see LICENSING.md and LICENSE.
 */
import {readSavedConfiguration} from './api.js';
export type Preferences=Record<string,unknown>;
const buttonActions=[{value:0,label:'None'},{value:1,label:'Toggle service mode'},{value:2,label:'Toggle thunderstorms'},{value:3,label:'Restart controller'},{value:4,label:'Toggle blackout'}];
export const actions=(press:'short'|'long'|'double')=>buttonActions.filter(a=>press!=='short'||a.value!==3);
const defaults:Preferences={button_short:1,button_long:0,button_double:0,nobutton:false,no_error_logging:false,info_logging:false,nostatus:false};
export const preferenceKeys=(board:8|10)=>Object.keys(defaults).filter(k=>board===10||k!=='nostatus');
export function decodePreferences(values:Preferences,board:8|10):Preferences{return Object.fromEntries(preferenceKeys(board).map(k=>[k,values[k]??defaults[k]]));}
export function preferencePatch(draft:Preferences,base:Preferences,board:8|10){
 const patch:Preferences={};
 for(const key of preferenceKeys(board)){
  const value=draft[key];if(JSON.stringify(value)===JSON.stringify(base[key]))continue;
  if(key.startsWith('button_')){
   if(!actions(key.slice(7) as 'short'|'long'|'double').some(a=>a.value===value))throw Error('Invalid button action');
  }else if(typeof value!=='boolean')throw Error('Invalid Boolean preference');
  patch[key]=value;
 }
 return patch;
}
export const thunderIds=(values:Preferences,count:number,ids:number[])=>ids.filter(id=>values[`weather#setup#${id}#thunder#activated`]===true&&Array.from({length:count},(_,i)=>i+1).some(n=>values[`pwm#${n}#weather`]===id&&(values[`pwm#${n}#onoff`]==null||values[`pwm#${n}#onoff`]===false)));
export async function readThunderEligibility(count:number,refresh=false){
 const catalogue=(await readSavedConfiguration(['weather#web'],refresh))['weather#web'];
 const profiles:unknown=catalogue==null?[]:typeof catalogue==='string'?JSON.parse(catalogue):null;
 if(!Array.isArray(profiles)||profiles.some(p=>!p||!Number.isInteger(p.id)||p.id<1||p.id>65535))throw Error('Invalid weather catalogue');
 const ids:number[]=profiles.map(p=>p.id);
 const keys=Array.from({length:count},(_,i)=>[`pwm#${i+1}#weather`,`pwm#${i+1}#onoff`]).flat().concat(ids.map(id=>`weather#setup#${id}#thunder#activated`));
 return thunderIds(await readSavedConfiguration(keys,refresh),count,ids);
}
