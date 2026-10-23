import {translate} from './i18n.js';
import {source} from './messages.js';
/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Includes code/configuration adapted from the SunRiser project contributors.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Adapted for this frontend in 2026; see LICENSING.md and LICENSE.
 */
import { writable, get, type Writable } from 'svelte/store';
import { readSavedConfiguration, acceptSavedConfiguration } from './api.js';
import {configurationState} from './configuration-state.js';
import {presets,presetName} from './channel-presets.js';
export { presets };
export type Channel = {color:unknown; binary:unknown; name:unknown};
const identities = writable<Channel[]>([]);
function publish(channels: Channel[]) {
  if(channels.length&&get(configurationState).recovery)return;
  const snapshot=JSON.parse(JSON.stringify(channels)) as Channel[];
  identities.set(snapshot);
  acceptSavedConfiguration(Object.fromEntries(snapshot.flatMap((ch,i)=>[
    [`pwm#${i+1}#color`,ch.color],[`pwm#${i+1}#onoff`,ch.binary],[`pwm#${i+1}#name`,ch.name],
  ])));
}
export const savedChannels: Writable<Channel[]> = {subscribe:identities.subscribe,set:publish,update:fn=>publish(fn(get(identities)))};
export function decodeChannels(values:Record<string,unknown>, count:number):Channel[] {
  return Array.from({length:count},(_,i)=>({color:values[`pwm#${i+1}#color`]??null,binary:values[`pwm#${i+1}#onoff`]??false,name:values[`pwm#${i+1}#name`]??null}));
}
export async function readChannels(count:number, refresh=true){
  const values=await readSavedConfiguration(Array.from({length:count},(_,i)=>['color','onoff','name'].map(k=>`pwm#${i+1}#${k}`)).flat(),refresh);
  return decodeChannels(values,count);
}
export function channelLabel(channel?:Channel,language:'en'|'de'='en'):string {
  if(typeof channel?.name==='string'&&channel.name) return channel.name;
  const preset=presets.find(p=>p.id===channel?.color);return preset?presetName(preset,language):'';
}
export function channelDisplay(number:number,channel?:Channel,fallback='',language:'en'|'de'='en'):string {
  const label=channelLabel(channel,language)||fallback;
  return label?`${String(number).padStart(2,'0')} · ${label}`:translate(language,'channels.channelV0_04477',{v0:number});
}
/** "Not used" in the Channels editor: a saved empty colour and no custom name. A never-saved colour stays listed. */
export function channelUnused(channel?:Channel):boolean{return channel?.color===''&&!(typeof channel.name==='string'&&channel.name.trim());}
/** Session-only choice to list unused channels on every page; a reload hides them again. */
export const showUnusedChannels=writable(false);
/**
 * Channel numbers a page should list. Unused channels are left out unless shown
 * for the session or `keep` reports a setting or output on that page, so nothing
 * that still affects the lights disappears.
 */
export function listedChannels(channels:Channel[],count:number,show:boolean,keep:(n:number)=>boolean=()=>false):number[]{
  return Array.from({length:count},(_,i)=>i+1).filter(n=>show||!channelUnused(channels[n-1])||keep(n));
}
export function channelColor(channel?:Channel){return presets.find(p=>p.id===channel?.color)?.color;}
export function choosePreset(channels:Channel[], index:number, id:string){
  if(!channels[index] || (id!==''&&!presets.some(p=>p.id===id)))throw Error(source("channels.unknownPreset_bab86"));
  const binary=(v:unknown)=>v==='pump'||v==='co';
  function assign(i:number,value:string){
    const c=channels[i];
    if(binary(c.color)!==binary(value))c.binary=binary(value);
    c.color=value;
  }
  assign(index,id);
  presets.find(p=>p.id===id)?.replace_me_with?.forEach((value,offset)=>{
    const replacement=value.toLowerCase(), target=index+offset;
    // Match legacy case-sensitive option lookup, including its skipped UVA entry.
    if(target>=channels.length||!presets.some(p=>p.id===replacement))return;
    if(offset===0)channels[target].color=replacement; else assign(target,replacement);
  });
}
/** Longest custom label the editor accepts; keeps overview, schedule and service pickers readable. */
export const channelNameLimit=32;
export function channelPatch(draft:Channel[],base:Channel[]){
  const patch:Record<string,unknown>={};
  draft.forEach((channel,i)=>{
    if(JSON.stringify(channel.color)!==JSON.stringify(base[i].color)){
      if(typeof channel.color!=='string'||(channel.color!==''&&!presets.some(p=>p.id===channel.color)))throw Error(source("channels.invalidColour_dd67f"));
      patch[`pwm#${i+1}#color`]=channel.color;
    }
    const name=typeof channel.name==='string'?channel.name.trim():channel.name,was=typeof base[i].name==='string'?(base[i].name as string).trim():base[i].name;
    if(JSON.stringify(name??'')!==JSON.stringify(was??'')){
      if(typeof name!=='string'||name.length>channelNameLimit||/[\u0000-\u001f\u007f]/.test(name))throw Error(source("channels.invalidChannelName_4b8e1"));
      patch[`pwm#${i+1}#name`]=name;
    }
    if(JSON.stringify(channel.binary)!==JSON.stringify(base[i].binary)){
      if(typeof channel.binary!=='boolean')throw Error(source("channels.invalidBinarySetting_80f4b"));
      patch[`pwm#${i+1}#onoff`]=channel.binary;
    }
  });
  return patch;
}
