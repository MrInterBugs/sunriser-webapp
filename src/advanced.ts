import {MessageError, source} from './messages.js';
import {PWM_RAW_MAX, PWM_DEFAULT_DIMMER_MAX} from './pwm.js';
/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Includes code/configuration adapted from the SunRiser project contributors.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Adapted for this frontend in 2026; see LICENSING.md and LICENSE.
 */
export type LightingValues=Record<string,unknown>;
export function lightingKeys(count:number){return ['higherminimum','oldfade',...Array.from({length:count},(_,i)=>['min','max','nosmart','onoff','manager'].map(k=>`pwm#${i+1}#${k}`)).flat()];}
export function decodeLighting(values:LightingValues,count:number):LightingValues{
 const defaults:LightingValues={higherminimum:false,oldfade:false};
 for(let n=1;n<=count;n++)for(const [key,value] of Object.entries({min:0,max:PWM_DEFAULT_DIMMER_MAX,nosmart:false,onoff:false,manager:0}))defaults[`pwm#${n}#${key}`]=value;
 return Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,values[k]??v]));
}
export function lightingPatch(draft:LightingValues,base:LightingValues,count:number,scope:'minimum'|'expert'){
 const keys=scope==='minimum'?Array.from({length:count},(_,i)=>`pwm#${i+1}#min`):['higherminimum','oldfade',...Array.from({length:count},(_,i)=>[`pwm#${i+1}#max`,`pwm#${i+1}#nosmart`]).flat()];
 const patch:LightingValues={};for(const key of keys){const v=draft[key];if(JSON.stringify(v)===JSON.stringify(base[key]))continue;
  if(key.endsWith('#min')||key.endsWith('#max')){if(typeof v!=='number'||!Number.isInteger(v)||v<(key.endsWith('#max')?10:0)||v>PWM_RAW_MAX)throw new MessageError(source("advanced.v0EnterAWholeRawValueV11000_9688e",{v0:key,v1:key.endsWith('#max')?'10':'0'}));}
  else if(typeof v!=='boolean')throw new MessageError(source("advanced.v0ChooseABooleanValue_888fe",{v0:key}));
  patch[key]=v;
 }return patch;
}
export function timeLapseState(value:{timewarp?:unknown},stale:boolean){if(stale)return source("advanced.uncertain_c6a14");if(!Object.hasOwn(value,'timewarp')||value.timewarp===0)return source("lightingdashboard.off_e3de5");return typeof value.timewarp==='number'&&Number.isInteger(value.timewarp)&&value.timewarp>0&&value.timewarp<=0xffffffff?source("lightingdashboard.active_a733b"):source("weather.unknown_bc781");}
