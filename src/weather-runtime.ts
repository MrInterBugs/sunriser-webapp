/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern frontend adapted from the SunRiser project and its workflows.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Frontend adaptation (2026); see LICENSING.md and LICENSE.
 * Third-party material retains its own terms.
 */
export type RuntimeChannel=Record<string,unknown>|null;
const uint=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
export function parseRuntime(value:unknown,count:number):RuntimeChannel[]{
 if(!Array.isArray(value)||value.length!==count||value.some(v=>v!==null&&(typeof v!=='object'||Array.isArray(v))))throw Error('Invalid weather runtime snapshot');
 return value;
}
export const nextTransition=(next:unknown,tick:unknown)=>!uint(next)||!uint(tick)?'Not reported':next===0?'None scheduled':`${Math.floor((next-tick)/1000)} s`;
export const cloudMinutes=(ticks:unknown)=>uint(ticks)?`${Math.floor(ticks/60000)} min`:'Not reported';
export const runtimeNumber=(value:unknown,unit='')=>uint(value)?`${value}${unit?' '+unit:''}`:'Not reported';
export const planningTime=(value:unknown)=>!uint(value)||value>8.64e12?'Not reported':value===0?'Not started':new Date(value*1000).toISOString().slice(0,19).replace('T',' ');
export const runtimeGroups=[
 {name:'Clouds',fields:[['cloudticks','Remaining cloud budget today','cloud'],['clouds_state','Phase code','number'],['clouds_next_state_tick','Next phase relative to snapshot','next']]},
 {name:'Rain',fields:[['rainmins','Remaining rain budget today','minutes'],['rainfront_start','Front start · device planning time','time'],['rainfront_length','Front duration','minutes'],['rain_next_tick','Next event relative to snapshot','next']]},
 {name:'Thunderstorms',fields:[['daycount','Chances used today','number'],['stormfront_start','Front start · device planning time','time'],['stormfront_length','Front duration','minutes'],['thunder_state','Phase code','number'],['thunder_next_state_tick','Next phase relative to snapshot','next']]},
 {name:'Moonlight',fields:[['moon_state','Phase code','number'],['moon_next_state_tick','Next phase relative to snapshot','next']]},
];
export function runtimeValue(value:unknown,kind:string,tick:unknown){return kind==='cloud'?cloudMinutes(value):kind==='next'?nextTransition(value,tick):kind==='time'?planningTime(value):runtimeNumber(value,kind==='minutes'?'min':'');}
