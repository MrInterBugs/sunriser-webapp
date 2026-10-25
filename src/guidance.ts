import {source} from './messages.js';
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
  const n=i+1,manager=values[`pwm#${n}#manager`]??0;let mode=source("guidance.unknownSavedMode_1fbbf"),plan=source("common.value",{v0:JSON.stringify(manager)});
  if(manager===0){mode=source("schedules.noSchedule_15d88");plan=source("guidance.noAutomaticPlannerSelected_37f80");}
  if(manager===1){mode=source("schedules.daily_72829");try{const points=fromFlat(values[`dayplanner#marker#${n}`]);if(validateCurve(points).length)throw Error();plan=points.length?source(points.length===1?"guidance.savedPoint":"guidance.savedPoints",{v0:points.length}):source("guidance.emptyDailyCurveOff_1c442");}catch{plan=source("guidance.invalidSavedCurveInspectStoredConfiguration_11ff8");}}
  if(manager===2){mode=source("schedules.weekly_158f3");const week=values[`weekplanner#programs#${n}`]??Array(8).fill(0);if(!Array.isArray(week)||week.length!==8||week.some(v=>typeof v!=='number'||!Number.isInteger(v)||v<0||v>65535))plan=source("guidance.invalidSavedWeeklyAssignments_c5a17");else {const ids=[...new Set(week.filter(v=>v!==0))];plan=ids.length?source("guidance.assignedPrograms",{v0:ids.join(', ')}):source("guidance.noAssignedProgramsIncludingFallback_ccb1a");}}
  if(manager===3){mode=source("schedules.fixed_ab98f");const v=values[`pwm#${n}#fixed`]??0;plan=typeof v==='number'&&Number.isInteger(v)&&v>=0?source("guidance.v0RawSavedFixedValue_16d0d",{v0:v}):source("guidance.unknownFixed",{v0:JSON.stringify(v)});}
  if(manager===4){mode=source("guidance.otherMode_31ced");plan=source("guidance.existingMode4IsPreserved_845d4");}
  const id=values[`pwm#${n}#weather`]??0;let weather=source("guidance.noAssignedWeatherProfile_59497");
  if(id!==0){const profile=profiles.find(p=>p.id===id);weather=typeof id==='number'&&Number.isInteger(id)&&id>0&&id<=65535?source(profile?"guidance.namedProfile":"guidance.unnamedProfile",{v0:id,v1:profile?.name??''}):source("guidance.unknownWeather",{v0:JSON.stringify(id)});}
  return {number:n,manager,mode,plan,weather};
 });
}
