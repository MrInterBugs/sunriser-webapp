import {type Message, MessageError, source} from './messages.js';
/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Includes code/configuration adapted from the SunRiser project contributors.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Adapted for this frontend in 2026; see LICENSING.md and LICENSE.
 */
import { readSavedConfiguration, saveConfiguration, type Firmware } from "./api.js";
import { parseStoredJson } from "./stored-json.js";
import {writable,get} from 'svelte/store';
export interface Point {
  time: string;
  percent: number | undefined;
}
export interface ScheduleChannel {
  manager: number;
  points: Point[];
  week: number[];
}
export interface ScheduleProgram {
  id: number;
  name: string;
  points: Point[];
  entry: Record<string, unknown>;
}
export interface ScheduleBook {
  lastId: number;
  channels: ScheduleChannel[];
  programs: ScheduleProgram[];
}
const integer = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export function parseTime(time: string): number | undefined {
  if (!/^\d{2}:\d{2}$/.test(time)) return;
  const [h, m] = time.split(":").map(Number);
  if (h > 23 || m > 59) return;
  return h * 60 + m;
}
const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export function fromFlat(value: unknown): Point[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length % 2)
    throw new MessageError(source("schedules.malformedMarkerArray_3f987"));
  const points: Point[] = [];
  for (let i = 0; i < value.length; i += 2) {
    if (!integer(value[i], 1440) || !integer(value[i + 1], 100))
      throw new MessageError(source("schedules.malformedMarkerValue_0df3b"));
    points.push({ time: clock(value[i]), percent: value[i + 1] });
  }
  return points;
}
export function validateCurve(points: Point[]): Message[] {
  const errors: Message[] = [];
  const times = points.map((p) => parseTime(p.time));
  if (times.some((t) => t === undefined))
    errors.push(source("schedules.useHHMMFrom0000To2359_e75fe"));
  if (new Set(times).size !== times.length)
    errors.push(source("schedules.pointTimesMustBeUnique_99ece"));
  if (points.some((p) => !integer(p.percent, 100)))
    errors.push(source("schedules.percentMustBeAWholeNumberFrom0To_462ad"));
  return errors;
}
export function flatten(points: Point[]): number[] {
  if (validateCurve(points).length) throw new MessageError(source("schedules.invalidCurve_d0e7d"));
  return points
    .map((p) => [parseTime(p.time)!, p.percent!])
    .sort((a, b) => a[0] - b[0])
    .flat();
}
export function shiftTime(points: Point[], minutes: number): Point[] {
  return fromFlat(
    flatten(points).reduce<number[]>((out, v, i, a) => {
      if (i % 2 === 0)
        out.push((((v + minutes) % 1440) + 1440) % 1440, a[i + 1]);
      return out;
    }, []),
  ).sort((a, b) => parseTime(a.time)! - parseTime(b.time)!);
}
export function shiftLevel(points: Point[], percent: number): Point[] {
  return points.map((p) => ({
    ...p,
    percent:
      p.percent === 0 ? 0 : Math.max(0, Math.min(100, p.percent! + percent)),
  }));
}
export function validateBook(book: ScheduleBook): Message[] {
  const errors: Message[] = [];
  const ids = new Set(book.programs.map((p) => p.id));
  book.channels.forEach((ch, i) => {
    errors.push(
      ...validateCurve(ch.points).map((s) => source("schedules.channelV0V1_a8de0",{v0:i + 1,v1:s})),
    );
    if (
      ch.week.length !== 8 ||
      ch.week.some((id) => !integer(id, 65535) || (id !== 0 && !ids.has(id)))
    )
      errors.push(source("schedules.channelV0UnknownProgramInWeeklyAssignment_4f3e0",{v0:i + 1}));
  });
  for (const p of book.programs) {
    if (!p.name.trim()) errors.push(source("schedules.programV0EnterAName_09134",{v0:p.id}));
    errors.push(...validateCurve(p.points).map((s) => source("schedules.programV0V1_ad394",{v0:p.id,v1:s})));
  }
  return errors;
}
function values(book: ScheduleBook): Record<string, unknown> {
  const out: Record<string, unknown> = {
    "programs#web": JSON.stringify(
      book.programs.map((p) => ({ ...p.entry, id: p.id, name: p.name })),
    ),
    "programs#last_setup_id": book.lastId,
  };
  book.channels.forEach((ch, i) => {
    out[`pwm#${i + 1}#manager`] = ch.manager;
    out[`dayplanner#marker#${i + 1}`] = flatten(ch.points);
    out[`weekplanner#programs#${i + 1}`] = ch.week;
  });
  for (const p of book.programs) {
    out[`programs#setup#${p.id}#name`] = p.name;
    out[`programs#setup#${p.id}#marker`] = flatten(p.points);
    out[`programs#setup#${p.id}#deleted`] = false;
  }
  return out;
}
export function schedulePatch(
  base: ScheduleBook,
  next: ScheduleBook,
): Record<string, unknown> {
  // A loaded 24:00 point is visible/repairable. Its original raw value is retained
  // for comparison, while new edited curves must pass strict validation.
  const oldValues = valuesForComparison(base),
    newValues = values(next),
    patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(newValues))
    if (!equal(value, oldValues[key])) patch[key] = value;
  for (const p of base.programs)
    if (!next.programs.some((n) => n.id === p.id))
      patch[`programs#setup#${p.id}#deleted`] = true;
  next.channels.forEach((ch, i) => {
    if (ch.manager !== base.channels[i].manager) {
      if (ch.manager === 1)
        patch[`dayplanner#marker#${i + 1}`] = flatten(ch.points);
      if (ch.manager === 2) patch[`weekplanner#programs#${i + 1}`] = ch.week;
    }
  });
  return patch;
}
function valuesForComparison(book: ScheduleBook) {
  // Comparison never normalizes a stored out-of-range time into a valid command.
  // Avoid validating legacy duplicates when building the original baseline map.
  const curveValues = (ps: Point[]) =>
    ps
      .map((p) => [p.time === "24:00" ? 1440 : parseTime(p.time)!, p.percent!])
      .sort((a, b) => a[0] - b[0])
      .flat();
  const out: Record<string, unknown> = {
    "programs#web": JSON.stringify(
      book.programs.map((p) => ({ ...p.entry, id: p.id, name: p.name })),
    ),
    "programs#last_setup_id": book.lastId,
  };
  book.channels.forEach((ch, i) => {
    out[`pwm#${i + 1}#manager`] = ch.manager;
    out[`dayplanner#marker#${i + 1}`] = curveValues(ch.points);
    out[`weekplanner#programs#${i + 1}`] = ch.week;
  });
  for (const p of book.programs) {
    out[`programs#setup#${p.id}#name`] = p.name;
    out[`programs#setup#${p.id}#marker`] = curveValues(p.points);
    out[`programs#setup#${p.id}#deleted`] = false;
  }
  return out;
}
export async function getSchedules(count: number, refresh=true): Promise<ScheduleBook> {
  const keys = ["programs#web", "programs#last_setup_id"];
  for (let i = 1; i <= count; i++)
    keys.push(
      `pwm#${i}#manager`,
      `dayplanner#marker#${i}`,
      `weekplanner#programs#${i}`,
    );
  const v = await readSavedConfiguration(keys,refresh);
  if (v["programs#web"] != null && typeof v["programs#web"] !== "string")
    throw new MessageError(source("schedules.invalidCatalogueType_56c2e"));
  const entries: unknown = parseStoredJson("programs#web", (v["programs#web"] ?? "[]") as string);
  const lastId = v["programs#last_setup_id"] ?? 0;
  if (!Array.isArray(entries) || !integer(lastId, 65535))
    throw new MessageError(source("schedules.invalidCatalogue_27a60"));
  const seen = new Set<number>();
  for (const p of entries) {
    if (
      !p ||
      !integer(p.id, 65535) ||
      p.id === 0 ||
      p.id > lastId ||
      typeof p.name !== "string" ||
      seen.has(p.id)
    )
      throw new MessageError(source("schedules.invalidProgram_0a9be"));
    seen.add(p.id);
  }
  const details = await readSavedConfiguration(
    entries.flatMap((p) => [
      `programs#setup#${p.id}#name`,
      `programs#setup#${p.id}#marker`,
      `programs#setup#${p.id}#deleted`,
    ]),refresh,
  );
  const book:ScheduleBook = {
    lastId,
    channels: Array.from({ length: count }, (_, i) => {
      const manager = v[`pwm#${i + 1}#manager`] ?? 0,
        week = v[`weekplanner#programs#${i + 1}`] ?? Array(8).fill(0);
      if (
        !integer(manager, 4) ||
        !Array.isArray(week) ||
        week.length !== 8 ||
        week.some((id) => !integer(id, 65535))
      )
        throw new MessageError(source("schedules.invalidChannelPlan_17ece"));
      return {
        manager,
        week,
        points: fromFlat(v[`dayplanner#marker#${i + 1}`]),
      };
    }),
    programs: entries.map((p) => {
      const name = details[`programs#setup#${p.id}#name`] ?? p.name,
        deleted = details[`programs#setup#${p.id}#deleted`];
      if (
        typeof name !== "string" ||
        name !== p.name ||
        (deleted != null && deleted !== false)
      )
        throw new MessageError(source("schedules.invalidProgramMetadata_7d412"));
      return {
        id: p.id,
        name,
        points: fromFlat(details[`programs#setup#${p.id}#marker`]),
        entry: p,
      };
    }),
  };
  publishScheduleBook(book);
  return book;
}
export async function saveSchedules(
  base: ScheduleBook,
  next: ScheduleBook,
  firmware: Firmware,
) {
  if (validateBook(next).length) throw new MessageError(source("schedules.invalidSchedules_739c1"));
  const patch = schedulePatch(base, next);
  if (Object.keys(patch).length) await saveConfiguration(patch, firmware);
  const changed=new Set(Object.keys(patch).flatMap(key=>{const match=/^(?:pwm#(\d+)#manager|dayplanner#marker#(\d+)|weekplanner#programs#(\d+))$/.exec(key);return match?[Number(match[1]||match[2]||match[3])]:[];}));
  publishScheduleBook(next,changed);
}

export interface WeeklyProgram {id:number;name:string;points:Point[]}
export interface DailyPlanState {
  phase:'loading'|'ready'|'error';
  channel?:ScheduleChannel;
  /** Weekly channels only: the distinct non-deleted programs their slots reference. */
  programs?:WeeklyProgram[];
}
/** Slots are Sunday=0..Saturday=6, default=7; a zero weekday slot falls back to the default. */
export function weeklyProgramFor(plan:DailyPlanState|undefined,weekday:number):WeeklyProgram|undefined{
  const week=plan?.channel?.week;
  if(plan?.channel?.manager!==2||!week||!Number.isInteger(weekday)||weekday<0||weekday>6)return;
  const id=week[weekday]||week[7];
  return plan.programs?.find(p=>p.id===id);
}
export const savedDailyPlans=writable<Record<number,DailyPlanState>>({});
let dailyEpoch=0;
const pendingDaily=new Map<number,Promise<ScheduleChannel>>();
export function resetSavedDailyPlans(){dailyEpoch++;pendingDaily.clear();savedDailyPlans.set({});}
const weeklyPrograms=(book:ScheduleBook,channel:ScheduleChannel):WeeklyProgram[]=>
  [...new Set(channel.week)].flatMap(id=>{const p=book.programs.find(q=>q.id===id);return p&&!validateCurve(p.points).length?[{id,name:p.name,points:clone(p.points)}]:[];});
function publishScheduleBook(book:ScheduleBook,changed?:Set<number>){
  savedDailyPlans.update(previous=>({...previous,...Object.fromEntries(book.channels.flatMap((channel,i)=>changed&&!changed.has(i+1)?[]:[[i+1,{phase:channel.manager===1&&validateCurve(channel.points).length?'error':'ready',channel:clone(channel),...(channel.manager===2?{programs:weeklyPrograms(book,channel)}:{})}]]))}));
}
/** One selected channel, through the same bounded configuration reader as the editor.
 * Mode, daily curve and weekly slots share one read; weekly channels then read only
 * the programmes their slots reference. Other channels and drafts are never requested. */
export function loadDailyPlan(number:number,refresh=false):Promise<ScheduleChannel>{
  if(!Number.isInteger(number)||number<1||number>10) return Promise.reject(new MessageError(source("schedules.invalidChannel_f48c8")));
  const existing=get(savedDailyPlans)[number];
  if(!refresh&&existing?.phase==='ready'&&existing.channel)return Promise.resolve(clone(existing.channel));
  const pending=pendingDaily.get(number);if(pending)return pending.then(clone);
  const epoch=dailyEpoch;
  savedDailyPlans.update(all=>({...all,[number]:{...existing,phase:'loading'}}));
  const task=(async()=>{
    try{
      const keys=[`pwm#${number}#manager`,`dayplanner#marker#${number}`,`weekplanner#programs#${number}`];
      const values=await readSavedConfiguration(keys,refresh),manager=values[keys[0]]??0;
      if(!integer(manager,4))throw new MessageError(source("schedules.invalidChannelPlan_17ece"));
      const channel:ScheduleChannel={manager,points:manager===1?fromFlat(values[keys[1]]):[],week:[]};
      if(manager===1&&validateCurve(channel.points).length)throw new MessageError(source("schedules.invalidDailyPoints_55861"));
      let programs:WeeklyProgram[]|undefined;
      if(manager===2){
        const week=values[keys[2]]??Array(8).fill(0);
        if(!Array.isArray(week)||week.length!==8||week.some(id=>!integer(id,65535)))throw new MessageError(source("schedules.invalidChannelPlan_17ece"));
        channel.week=week as number[];
        const ids=[...new Set(channel.week)].filter(id=>id!==0);
        const details=ids.length?await readSavedConfiguration(ids.flatMap(id=>[`programs#setup#${id}#name`,`programs#setup#${id}#marker`,`programs#setup#${id}#deleted`]),refresh):{};
        programs=ids.flatMap(id=>{
          const name=details[`programs#setup#${id}#name`],deleted=details[`programs#setup#${id}#deleted`];
          if(deleted===true||typeof name!=='string')return [];
          const points=fromFlat(details[`programs#setup#${id}#marker`]);
          if(validateCurve(points).length)throw new MessageError(source("schedules.invalidDailyPoints_55861"));
          return [{id,name,points}];
        });
      }
      if(epoch!==dailyEpoch)throw new MessageError(source("schedules.obsoleteDailyPlan_5f4cb"));
      savedDailyPlans.update(all=>({...all,[number]:{phase:'ready',channel:clone(channel),...(programs?{programs}:{})}}));
      return channel;
    }catch(error){
      if(epoch===dailyEpoch)savedDailyPlans.update(all=>({...all,[number]:{...existing,phase:'error'}}));
      throw error;
    }finally{if(epoch===dailyEpoch)pendingDaily.delete(number);}
  })();pendingDaily.set(number,task);return task.then(clone);
}
