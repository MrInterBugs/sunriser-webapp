import {germanTimezoneLabels} from './timezone-labels.js';
// SPDX-License-Identifier: GPL-3.0-or-later
// Presentation only. No API imports, controller requests or editor remounts.
import {writable,derived,get} from 'svelte/store';
import {en,type MessageKey} from './locales/en.js';
import {de} from './locales/de.js';
export type Language='en'|'de';
const preferenceKey='sunriser.language';
function initialLanguage():Language {
  try{return typeof window!=='undefined'&&window.localStorage.getItem(preferenceKey)==='de'?'de':'en';}catch{return 'en';}
}
export const language=writable<Language>(initialLanguage());
language.subscribe(value=>{
  if(typeof document!=='undefined'){document.documentElement.lang=value;document.title=value==='de'?'SunRiser · Geräteübersicht':'SunRiser · Device overview';}
  try{if(typeof window!=='undefined')window.localStorage.setItem(preferenceKey,value);}catch{/* Restricted browser storage does not prevent in-session switching. */}
});
export function setLanguage(value:string){if(value==='en'||value==='de')language.set(value);}
export type Parameters=Record<string,string|number>;
export function translate<K extends MessageKey>(locale:Language,key:K,values:Parameters={}):string{
 const template=locale==='de'?de[key]:en[key];
 return template.replace(/\{(v\d+)\}/g,(_,name:string)=>Object.hasOwn(values,name)?String(values[name]):`{${name}}`);
}
export const t=derived(language,locale=><K extends MessageKey>(key:K,values:Parameters={})=>translate(locale,key,values));
/** Stable English message identity for existing state machines and validation logic.
 * Translation occurs at the presentation boundary so switching also updates retained
 * feedback. Saved names, protocol data and user text never go through this adapter.
 */
export {source} from './messages.js';
const keys=Object.keys(en) as MessageKey[];
const exact=new Map<string,MessageKey>(keys.filter(k=>!en[k].includes('{v')).map(k=>[en[k],k]));
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=keys.filter(k=>en[k].includes('{v')).map(key=>{
 const names:string[]=[];let index=0,pattern='';
 for(const match of en[key].matchAll(/\{(v\d+)\}/g)){pattern+=escape(en[key].slice(index,match.index))+'([\\s\\S]*?)';names.push(match[1]);index=match.index!+match[0].length;}
 pattern+=escape(en[key].slice(index));
 return {key,names,regex:new RegExp('^'+pattern+'$'),specificity:en[key].replace(/\{v\d+\}/g,'').length};
}).sort((a,b)=>b.specificity-a.specificity);
export function present(text:unknown,locale:Language):string{
 if(typeof text!=='string')return String(text??'');
 const connectionErrors=['TypeError: Failed to fetch','Failed to fetch','TypeError: NetworkError when attempting to fetch resource.','NetworkError when attempting to fetch resource.','TypeError: Load failed'];
 if(connectionErrors.includes(text))return translate(locale,'common.connectionFailure');
 if(text==='AbortError: The operation was aborted.'||text==='TimeoutError: The operation was aborted due to timeout')return translate(locale,'common.requestTimeout');
 if(locale==='en')return text;
 const trimmed=text.trim(),key=exact.get(trimmed);
 if(key)return text.replace(trimmed,de[key]);
 for(const pattern of patterns){
  const match=pattern.regex.exec(trimmed);if(!match)continue;
  const values=Object.fromEntries(pattern.names.map((name,i)=>[name,match[i+1]]));
  if(pattern.key.startsWith('systemsettings.'))for(const name of ['v0','v1'])if(values[name]==='clock'||values[name]==='network')values[name]=values[name]==='clock'?'Uhrzeit':'Netzwerk';
  // Only error/validation reason slots are nested messages. Other interpolated
  // strings (filenames, names, addresses, IDs) remain verbatim.
  const nested:Readonly<Record<string,string[]>>={
   'recovery.invalidBackupV0_5f6e4':['v0'],
   'recovery.sendingV0BackupBytes_1fce9':['v0'],
   'recovery.v0V1KeysV2BytesFormatValidSettingSemantics_6cdba':['v1','v2'],
   'recovery.v0V1KeysV2BytesExampleWillMergeIts_0164b':['v1','v2'], 'recovery.invalidFirmwareV0_acb6c':['v0'],
   'recovery.invalidExampleDetail':['v0'], 'common.errorPrefix':['v0'],
   'systemsettings.savedConfigurationUnavailable':['v1'],
   'system.v0MustBeAtMostV1UTF8Bytes_47401':['v0'],
   'recovery.v0UploadRejectedByTheDeviceWithHTTP413_cd6ac':['v0'],
   'recovery.v0TheDeviceAnsweredHTTPV1InsteadOfAn_29214':['v0'],
   'recovery.v0TheDeviceAnsweredWithoutTheExpectedAcknowledgementThe_86c49':['v0'],
   'recovery.v0NoCompleteResponseFromTheDeviceV1The_6fd86':['v0','v1'],
   'recovery.v0V1NoResponseV2_acb82':['v2'],
   'recovery.chunkStopped':['v2'],
   'schedules.pointV0V1_afc85':['v1'], 'schedules.channelV0V1_a8de0':['v1'],
   'schedules.programV0V1_ad394':['v1']
  };
  for(const name of nested[pattern.key]??[])if(values[name])values[name]=present(values[name],locale);
  return translate(locale,pattern.key,values);
 }

 return text;
}
export const renderText=derived(language,locale=>(text:unknown)=>present(text,locale));
export function numberText(value:number,locale:Language=get(language),digits=0){return new Intl.NumberFormat(locale==='de'?'de-DE':'en-GB',{minimumFractionDigits:digits,maximumFractionDigits:digits,useGrouping:false}).format(value);}
/** Formatting only: keep UTC and already-local wall-clock coordinates distinct. */
export function dateText(iso:string,locale:Language):string{
 const m=/^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(iso);
 return m?`${m[3]}${locale==='de'?'.':'/'}${m[2]}${locale==='de'?'.':'/'}${m[1]}${m[4]}`:iso;
}

export function decimalDraft(value:string,locale:Language){return locale==='de'?value.replace('.',','):value;}
export function canonicalDecimal(value:string,locale:Language){return locale==='de'?value.replace(',','.'):value;}

export const timezoneLabel=(label:string,locale:Language)=>locale==='de'?(germanTimezoneLabels[label]??label):label;

/** Format coordinates only. Never parse a device-local wall clock in the browser timezone. */
export function timestampDisplay(iso:string,locale:Language){
 const match=/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(Z)?$/.exec(iso);
 return match?`${dateText(match[1],locale)} ${match[2]}${match[3]?' UTC':''}`:iso;
}
