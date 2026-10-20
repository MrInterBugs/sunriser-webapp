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
 let value:unknown;try{value=JSON.parse(text);}catch{throw Error('Enter a JSON array of alternating integer minutes and percentages.');}
 if(!Array.isArray(value))throw Error('Use a JSON array, for example [0,0,720,100].');
 const points=fromFlat(value),errors=validateCurve(points);if(errors.length)throw Error(errors.join(' '));return points;
}
export function shiftSelectedDaily(book:ScheduleBook,channels:number[],kind:'time'|'level',amount:number):ScheduleBook{
 if(!channels.length||new Set(channels).size!==channels.length||channels.some(n=>!Number.isInteger(n)||n<1||n>book.channels.length||book.channels[n-1].manager!==1))throw Error('Select daily-mode channels.');
 if(!Number.isInteger(amount)||amount===0||Math.abs(amount)>(kind==='time'?720:100))throw Error('Enter a valid nonzero shift.');
 for(const n of channels)if(validateCurve(book.channels[n-1].points).length)throw Error(`Correct channel ${n} before shifting.`);
 const next=clone(book);for(const n of channels)next.channels[n-1].points=kind==='time'?shiftTime(next.channels[n-1].points,amount):shiftLevel(next.channels[n-1].points,amount);return next;
}
