import {MessageError, source} from './messages.js';
/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Includes code/configuration adapted from the SunRiser project contributors.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Adapted for this frontend in 2026; see LICENSING.md and LICENSE.
 */
import {readSavedConfiguration} from './api.js';
import {parseStoredJson} from './stored-json.js';
export type Preferences=Record<string,unknown>;
const buttonActions=[{value:0,label:source("weather.none_6eef6")},{value:1,label:source("preferences.toggleServiceMode_0572f")},{value:2,label:source("preferences.toggleThunderstorms_f2208")},{value:3,label:source("preferences.restartController_df85d")},{value:4,label:source("preferences.toggleBlackout_48d54")}];
export const actions=(press:'short'|'long'|'double')=>buttonActions.filter(a=>press!=='short'||a.value!==3);
const defaults:Preferences={button_short:1,button_long:0,button_double:0,nobutton:false,no_error_logging:false,info_logging:false,nostatus:false};
export const preferenceKeys=(board:8|10)=>Object.keys(defaults).filter(k=>board===10||k!=='nostatus');
export function decodePreferences(values:Preferences,board:8|10):Preferences{return Object.fromEntries(preferenceKeys(board).map(k=>[k,values[k]??defaults[k]]));}
export function preferencePatch(draft:Preferences,base:Preferences,board:8|10){
 const patch:Preferences={};
 for(const key of preferenceKeys(board)){
  const value=draft[key];if(JSON.stringify(value)===JSON.stringify(base[key]))continue;
  if(key.startsWith('button_')){
   if(!actions(key.slice(7) as 'short'|'long'|'double').some(a=>a.value===value))throw new MessageError(source("preferences.invalidButtonAction_132fb"));
  }else if(typeof value!=='boolean')throw new MessageError(source("preferences.invalidBooleanPreference_f7f06"));
  patch[key]=value;
 }
 return patch;
}
export const thunderIds=(values:Preferences,count:number,ids:number[])=>ids.filter(id=>values[`weather#setup#${id}#thunder#activated`]===true&&Array.from({length:count},(_,i)=>i+1).some(n=>values[`pwm#${n}#weather`]===id&&(values[`pwm#${n}#onoff`]==null||values[`pwm#${n}#onoff`]===false)));
export async function readThunderEligibility(count:number,refresh=false){
 const catalogue=(await readSavedConfiguration(['weather#web'],refresh))['weather#web'];
 const profiles:unknown=catalogue==null?[]:typeof catalogue==='string'?parseStoredJson('weather#web',catalogue):null;
 if(!Array.isArray(profiles)||profiles.some(p=>!p||!Number.isInteger(p.id)||p.id<1||p.id>65535))throw new MessageError(source("preferences.invalidWeatherCatalogue_313d1"));
 const ids:number[]=profiles.map(p=>p.id);
 const keys=Array.from({length:count},(_,i)=>[`pwm#${i+1}#weather`,`pwm#${i+1}#onoff`]).flat().concat(ids.map(id=>`weather#setup#${id}#thunder#activated`));
 return thunderIds(await readSavedConfiguration(keys,refresh),count,ids);
}
