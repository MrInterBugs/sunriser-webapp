import {MessageError, source} from './messages.js';
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
 if(!Array.isArray(value)||value.length!==count||value.some(v=>v!==null&&(typeof v!=='object'||Array.isArray(v))))throw new MessageError(source("weather-runtime.invalidWeatherRuntimeSnapshot_a275e"));
 return value;
}
export const nextTransition=(next:unknown,tick:unknown)=>!uint(next)||!uint(tick)?source("systemsettings.notReported_98e85"):next===0?source("weather-runtime.noneScheduled_d5072"):source("diagnostics.v0S_2260e",{v0:Math.floor((next-tick)/1000)});
export const cloudMinutes=(ticks:unknown)=>uint(ticks)?`${Math.floor(ticks/60000)} min`:source("systemsettings.notReported_98e85");
export const runtimeNumber=(value:unknown,unit='')=>uint(value)?`${value}${unit?' '+unit:''}`:source("systemsettings.notReported_98e85");
export const planningTime=(value:unknown)=>!uint(value)||value>8.64e12?source("systemsettings.notReported_98e85"):value===0?source("weather-runtime.notStarted_db2c4"):new Date(value*1000).toISOString().slice(0,19).replace('T',' ');
export const runtimeGroups: {name: import("./messages.js").Message; fields: [string, import("./messages.js").Message, string][]}[]=[
 {name:source("weather.clouds_99990"),fields:[['cloudticks',source("weather-runtime.remainingCloudBudgetToday_afd76"),'cloud'],['clouds_state',source("weather-runtime.phaseCode_16fd0"),'number'],['clouds_next_state_tick',source("weather-runtime.nextPhaseRelativeToSnapshot_f8f02"),'next']]},
 {name:source("weather.rain_0a858"),fields:[['rainmins',source("weather-runtime.remainingRainBudgetToday_6e1f4"),'minutes'],['rainfront_start',source("weather-runtime.frontStartDevicePlanningTime_f6ddd"),'time'],['rainfront_length',source("weather-runtime.frontDuration_5cf99"),'minutes'],['rain_next_tick',source("weather-runtime.nextEventRelativeToSnapshot_64e49"),'next']]},
 {name:source("weather.thunderstorms_b57d4"),fields:[['daycount',source("weather-runtime.chancesUsedToday_f8e8b"),'number'],['stormfront_start',source("weather-runtime.frontStartDevicePlanningTime_f6ddd"),'time'],['stormfront_length',source("weather-runtime.frontDuration_5cf99"),'minutes'],['thunder_state',source("weather-runtime.phaseCode_16fd0"),'number'],['thunder_next_state_tick',source("weather-runtime.nextPhaseRelativeToSnapshot_f8f02"),'next']]},
 {name:source("weather.moonlight_f61a8"),fields:[['moon_state',source("weather-runtime.phaseCode_16fd0"),'number'],['moon_next_state_tick',source("weather-runtime.nextPhaseRelativeToSnapshot_f8f02"),'next']]},
];
export function runtimeValue(value:unknown,kind:string,tick:unknown){return kind==='cloud'?cloudMinutes(value):kind==='next'?nextTransition(value,tick):kind==='time'?planningTime(value):runtimeNumber(value,kind==='minutes'?'min':'');}
