import {germanTimezoneLabels} from './timezone-labels.js';
// SPDX-License-Identifier: GPL-3.0-or-later
// Presentation only. No API imports, controller requests or editor remounts.
import {writable,derived,get} from 'svelte/store';
import {type MessageKey} from './locales/en.js';
import {renderMessage, source, type MessageValues} from './messages.js';
export type Language='en'|'de';
const preferenceKey='sunriser.language';
function initialLanguage():Language {
  try{return typeof window!=='undefined'&&window.localStorage.getItem(preferenceKey)==='de'?'de':'en';}catch{return 'en';}
}
export const language=writable<Language>(initialLanguage());
language.subscribe(value=>{
  if(typeof document!=='undefined'){document.documentElement.lang=value;document.title=translate(value,'app.documentTitle');}
  try{if(typeof window!=='undefined')window.localStorage.setItem(preferenceKey,value);}catch{/* Restricted browser storage does not prevent in-session switching. */}
});
export function setLanguage(value:string){if(value==='en'||value==='de')language.set(value);}
export type Parameters=MessageValues;
export function translate<K extends MessageKey>(locale:Language,key:K,values:Parameters={}):string{
 return renderMessage(source(key,values),locale);
}
export const t=derived(language,locale=><K extends MessageKey>(key:K,values:Parameters={})=>translate(locale,key,values));
export {source} from './messages.js';
/** Raw data stays verbatim; only explicitly keyed messages are translated. */
export const present=renderMessage;
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
