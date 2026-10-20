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
 for(let n=1;n<=count;n++)for(const [key,value] of Object.entries({min:0,max:1000,nosmart:false,onoff:false,manager:0}))defaults[`pwm#${n}#${key}`]=value;
 return Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,values[k]??v]));
}
export function lightingPatch(draft:LightingValues,base:LightingValues,count:number,scope:'minimum'|'expert'){
 const keys=scope==='minimum'?Array.from({length:count},(_,i)=>`pwm#${i+1}#min`):['higherminimum','oldfade',...Array.from({length:count},(_,i)=>[`pwm#${i+1}#max`,`pwm#${i+1}#nosmart`]).flat()];
 const patch:LightingValues={};for(const key of keys){const v=draft[key];if(JSON.stringify(v)===JSON.stringify(base[key]))continue;
  if(key.endsWith('#min')||key.endsWith('#max')){if(typeof v!=='number'||!Number.isInteger(v)||v<(key.endsWith('#max')?10:0)||v>1000)throw Error(`${key}: enter a whole raw value ${key.endsWith('#max')?'10':'0'}–1000.`);}
  else if(typeof v!=='boolean')throw Error(`${key}: choose a Boolean value.`);
  patch[key]=v;
 }return patch;
}
export function timeLapseState(value:{timewarp?:unknown},stale:boolean){if(stale)return 'Uncertain';if(!Object.hasOwn(value,'timewarp')||value.timewarp===0)return 'Off';return typeof value.timewarp==='number'&&Number.isInteger(value.timewarp)&&value.timewarp>0&&value.timewarp<=0xffffffff?'Active':'Unknown';}
