import {MessageError, source} from './messages.js';
/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern frontend adapted from the SunRiser project and its workflows.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Frontend adaptation (2026); see LICENSING.md and LICENSE.
 * Third-party material retains its own terms.
 */
import {fromFlat,validateCurve,clone,shiftTime,shiftLevel,type ScheduleBook,type Point} from './schedules.js';
export function parseRawCurve(text:string):Point[]{
 let value:unknown;try{value=JSON.parse(text);}catch{throw new MessageError(source("schedule-tools.enterAJSONArrayOfAlternatingIntegerMinutesAnd_9989b"));}
 if(!Array.isArray(value))throw new MessageError(source("schedule-tools.useAJSONArrayForExample00720_260ae"));
 const points=fromFlat(value),errors=validateCurve(points);
 if(errors.length)throw new MessageError(errors.reduce((left,right)=>source('common.joinMessages',{v0:left,v1:right})));
 return points;
}
export function shiftSelectedDaily(book:ScheduleBook,channels:number[],kind:'time'|'level',amount:number):ScheduleBook{
 if(!channels.length||new Set(channels).size!==channels.length||channels.some(n=>!Number.isInteger(n)||n<1||n>book.channels.length||book.channels[n-1].manager!==1))throw new MessageError(source("schedule-tools.selectDailyModeChannels_47205"));
 if(!Number.isInteger(amount)||amount===0||Math.abs(amount)>(kind==='time'?720:100))throw new MessageError(source("schedule-tools.enterAValidNonzeroShift_93f7f"));
 for(const n of channels)if(validateCurve(book.channels[n-1].points).length)throw new MessageError(source("schedule-tools.correctChannelV0BeforeShifting_2ac1d",{v0:n}));
 const next=clone(book);for(const n of channels)next.channels[n-1].points=kind==='time'?shiftTime(next.channels[n-1].points,amount):shiftLevel(next.channels[n-1].points,amount);return next;
}
