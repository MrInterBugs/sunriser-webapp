// SPDX-License-Identifier: GPL-3.0-or-later
// Presentation only. No API imports, controller requests or editor remounts.
import {writable,derived,get} from 'svelte/store';
import type {MessageKey} from './locales/en.js';
import {renderMessage, source, catalogueLoaded, type MessageValues} from './messages.js';
export type Language='en'|'de';
const preferenceKey='sunriser.language';
function initialLanguage():Language {
  try{return typeof window!=='undefined'&&window.localStorage.getItem(preferenceKey)==='de'?'de':'en';}catch{return 'en';}
}
export const language=writable<Language>(initialLanguage());
language.subscribe(value=>{
  if(typeof document!=='undefined'){document.documentElement.lang=value;if(catalogueLoaded(value))document.title=translate(value,'app.documentTitle');}
  try{if(typeof window!=='undefined')window.localStorage.setItem(preferenceKey,value);}catch{/* Restricted browser storage does not prevent in-session switching. */}
});
/** Switch only to a language whose catalogue is already registered (see loadCatalogue). */
export function setLanguage(value:string){if((value==='en'||value==='de')&&catalogueLoaded(value)){language.set(value);if(typeof document!=='undefined')document.title=translate(value,'app.documentTitle');}}
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


/** Format coordinates only. Never parse a device-local wall clock in the browser timezone. */
export function timestampDisplay(iso:string,locale:Language){
 const match=/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(Z)?$/.exec(iso);
 return match?`${dateText(match[1],locale)} ${match[2]}${match[3]?' UTC':''}`:iso;
}
/** Device UTC offset in minutes as UTC±HH:MM. Formatting only. */
export function utcOffsetText(minutes:number):string{
 if(!Number.isSafeInteger(minutes))return '';
 const total=Math.abs(minutes);
 return `UTC${minutes<0?'-':'+'}${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
/** Elapsed seconds as the two largest units, for example 3 d 4 h or 1 min 10 s. */
export function durationText(seconds:number,locale:Language):string{
 if(!Number.isSafeInteger(seconds)||seconds<0)return translate(locale,'diagnostics.v0S_2260e',{v0:seconds});
 const d=Math.floor(seconds/86400),h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
 const units:[number,MessageKey][]=d?[[d,'duration.days'],[h,'duration.hours']]:h?[[h,'duration.hours'],[m,'duration.minutes']]:m?[[m,'duration.minutes'],[s,'diagnostics.v0S_2260e']]:[[s,'diagnostics.v0S_2260e']];
 return units.filter(([n],i)=>i===0||n>0).map(([n,key])=>translate(locale,key,{v0:n})).join(' ');
}
