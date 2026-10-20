/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern frontend adapted from the SunRiser project and its workflows.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Frontend adaptation (2026); see LICENSING.md and LICENSE.
 * Third-party material retains its own terms.
 */
import {fromFlat,validateCurve} from './schedules.js';
export function configurationKeys(count:number){return ['weather#web',...Array.from({length:count},(_,i)=>[`pwm#${i+1}#manager`,`dayplanner#marker#${i+1}`,`weekplanner#programs#${i+1}`,`pwm#${i+1}#fixed`,`pwm#${i+1}#weather`,`pwm#${i+1}#color`,`pwm#${i+1}#name`,`pwm#${i+1}#onoff`]).flat()];}
export function configuredRows(values:Record<string,unknown>,count:number){
 let profiles:{id:number;name:string}[]=[];try{const parsed=JSON.parse(typeof values['weather#web']==='string'?values['weather#web']:'[]');if(Array.isArray(parsed))profiles=parsed.filter(p=>p&&Number.isInteger(p.id)&&typeof p.name==='string');}catch{/* Labels unavailable; IDs remain visible. */}
 return Array.from({length:count},(_,i)=>{
  const n=i+1,manager=values[`pwm#${n}#manager`]??0;let mode='Unknown saved mode',plan='Value: '+JSON.stringify(manager);
  if(manager===0){mode='No schedule';plan='No automatic planner selected';}
  if(manager===1){mode='Daily';try{const points=fromFlat(values[`dayplanner#marker#${n}`]);if(validateCurve(points).length)throw Error();plan=points.length?`${points.length} ${points.length===1?'point':'points'} in the saved daily curve`:'Empty daily curve · off';}catch{plan='Invalid saved curve · inspect stored configuration';}}
  if(manager===2){mode='Weekly';const week=values[`weekplanner#programs#${n}`]??Array(8).fill(0);if(!Array.isArray(week)||week.length!==8||week.some(v=>typeof v!=='number'||!Number.isInteger(v)||v<0||v>65535))plan='Invalid saved weekly assignments';else {const ids=[...new Set(week.filter(v=>v!==0))];plan=ids.length?'Assigned program IDs: '+ids.join(', '):'No assigned programs, including fallback';}}
  if(manager===3){mode='Fixed';const v=values[`pwm#${n}#fixed`]??0;plan=typeof v==='number'&&Number.isInteger(v)&&v>=0?`${v} raw saved fixed value`:'Unknown fixed value: '+JSON.stringify(v);}
  if(manager===4){mode='Other mode';plan='Existing mode 4 is preserved';}
  const id=values[`pwm#${n}#weather`]??0;let weather='No assigned weather profile';
  if(id!==0){const profile=profiles.find(p=>p.id===id);weather=typeof id==='number'&&Number.isInteger(id)&&id>0&&id<=65535?`Profile #${id}${profile?' · '+profile.name:' · label unavailable'}`:'Unknown weather assignment: '+JSON.stringify(id);}
  return {number:n,mode,plan,weather};
 });
}
