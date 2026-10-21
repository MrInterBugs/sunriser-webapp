<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {source,t,renderText,language} from './i18n';
 import {savedChannels,channelDisplay} from './channels';
 import {parseTime,type Point,type ScheduleBook} from './schedules';
 import {parseRawCurve,shiftSelectedDaily} from './schedule-tools';
 import {inRange} from './api';
 import ActionButton from './ui/ActionButton.svelte';
 let {book,curve,curveKey,showDaily,busy,reset,pending=$bindable(false),oncurve,onbook,onselect}:{book:ScheduleBook;curve:Point[]|undefined;curveKey:string;showDaily:boolean;busy:boolean;reset:number;pending?:boolean;oncurve:(points:Point[])=>void;onbook:(book:ScheduleBook)=>void;onselect:(key:string)=>void}=$props();
 let texts=$state<Record<string,string>>({}),channels=$state<number[]>([]),minutes=$state<number|undefined>(15),percent=$state<number|undefined>(5),shiftError=$state('');
 $effect(()=>{reset;texts={};channels=[];shiftError='';});
 const pendingKeys=$derived(Object.keys(texts));
 $effect(()=>{pending=pendingKeys.length>0;});
 const text=$derived(texts[curveKey]??JSON.stringify((curve??[]).flatMap(p=>[p.time==='24:00'?1440:parseTime(p.time),p.percent])));
 const rawError=$derived.by(()=>{try{parseRawCurve(text);return '';}catch(e){return (e as Error).message;}});
 function discard(){delete texts[curveKey];}
 function apply(){if(rawError||busy)return;oncurve(parseRawCurve(text));discard();}
 function shift(direction:number,level=false){if(busy)return;try{onbook(shiftSelectedDaily(book,channels,level?'level':'time',(level?percent!:minutes!)*direction));shiftError='';}catch(e){shiftError=(e as Error).message;}}
 const label=(key:string)=>key.startsWith('day:')?channelDisplay(Number(key.slice(4)),$savedChannels[Number(key.slice(4))-1],'',$language):source("scheduletools.programV0_f7356",{v0:key.slice(8)});
</script>
<div class="schedule-tools">
 {#if pendingKeys.length}<div class="notice" aria-live="polite"><p>{$t("scheduletools.unappliedRawTextBlocksSaveUseItAsA_0b609")}</p><div class="actions">{#each pendingKeys as key}<ActionButton secondary disabled={busy} onclick={()=>onselect(key)}>{$renderText(label(key))}</ActionButton>{/each}</div></div>{/if}
 {#if curve}<details><summary>{$t("scheduletools.rawCurveData_6ceb5")}</summary><section aria-label={$t("scheduletools.rawCurveEditor_599c7")}><p>{$t("scheduletools.alternatingIntegerMinutes01439AndPercentages0100_08e8a")}</p>
 <label for="raw-curve-text">{$t("scheduletools.rawMinutePercentArray_051b3")}</label><textarea id="raw-curve-text" rows="5" value={text} disabled={busy} oninput={e=>texts[curveKey]=e.currentTarget.value} aria-invalid={!!rawError} aria-describedby="raw-curve-error"></textarea>
 <p id="raw-curve-error" class:error={!!rawError} aria-live="polite">{$renderText(rawError)||$t("scheduletools.validIntegerMinutePercentageArray_4daf9")}</p><div class="actions"><ActionButton secondary disabled={busy||!!rawError||!Object.hasOwn(texts,curveKey)} onclick={apply}>{$t("scheduletools.useRawPointsAsDraft_1c675")}</ActionButton><ActionButton secondary disabled={busy||!Object.hasOwn(texts,curveKey)} onclick={discard}>{$t("scheduletools.discardRawText_a0125")}</ActionButton></div></section></details>{/if}
 {#if showDaily}<details><summary>{$t("scheduletools.shiftSelectedDailyChannels_6398e")}</summary><section aria-label={$t("scheduletools.selectedDailyShift_350f9")}><p>{$t("scheduletools.changesSelectedDailyModeDraftsTogetherWeeklyAndFixed_bcd9f")}</p>
 <div class="targets">{#each book.channels as ch,i}<label><input type="checkbox" disabled={busy||ch.manager!==1} aria-label={$t("scheduletools.shiftChannelV0_815d7",{v0: i+1})} checked={channels.includes(i+1)} onchange={e=>channels=e.currentTarget.checked?[...channels,i+1]:channels.filter(n=>n!==i+1)}/>{channelDisplay(i+1,$savedChannels[i],'',$language)}{ch.manager!==1?$t("scheduletools.notDaily_0ca43"):''}</label>{/each}</div>
 <div class="shift-grid"><div><label>{$t("scheduletools.selectedShiftMinutes_779b5")}<input type="number" min="1" max="720" step="1" bind:value={minutes} disabled={busy}/></label><div class="actions"><ActionButton secondary disabled={busy||!channels.length||!inRange(minutes,720)||minutes===0||pending} onclick={()=>shift(-1)}>{$t("scheduletools.selectedEarlier_cf66c")}</ActionButton><ActionButton secondary disabled={busy||!channels.length||!inRange(minutes,720)||minutes===0||pending} onclick={()=>shift(1)}>{$t("scheduletools.selectedLater_be401")}</ActionButton></div></div>
 <div><label>{$t("scheduletools.selectedShiftPercent_19424")}<input type="number" min="1" max="100" step="1" bind:value={percent} disabled={busy}/></label><div class="actions"><ActionButton secondary disabled={busy||!channels.length||!inRange(percent,100)||percent===0||pending} onclick={()=>shift(-1,true)}>{$t("scheduletools.selectedDarker_d65ab")}</ActionButton><ActionButton secondary disabled={busy||!channels.length||!inRange(percent,100)||percent===0||pending} onclick={()=>shift(1,true)}>{$t("scheduletools.selectedBrighter_4b76e")}</ActionButton></div></div></div>
 <p>{$t("scheduletools.timesWrapAtMidnightLevelsClampAt0100_6df76")}</p>{#if shiftError}<p class="error" role="alert">{$renderText(shiftError)}</p>{/if}</section></details>{/if}
</div>
<style>
 .schedule-tools{margin:24px 0}details{border-top:1px solid var(--sr-line);padding:8px 0}summary{min-height:44px;padding:12px 0;font-size:16px;font-weight:600;cursor:pointer}section{padding:8px 0 16px;min-width:0}p{color:var(--sr-muted);font-size:13px;line-height:1.6}.notice{border-left:2px solid var(--sr-accent);padding:8px 16px;margin:12px 0}.actions{display:flex;gap:8px;flex-wrap:wrap}label{display:block;font-size:14px;margin:8px 0}textarea,input[type=number]{font:16px/1.5 var(--sr-mono);color:var(--sr-ink);background:var(--sr-input);border:1px solid var(--sr-control-line);border-radius:var(--sr-radius);padding:10px;min-height:44px;width:100%;max-width:100%;box-sizing:border-box}textarea{resize:vertical}textarea[aria-invalid=true]{border-color:var(--sr-error)}textarea:focus-visible{outline:3px solid var(--sr-focus);outline-offset:3px}.error{color:var(--sr-error)}.targets{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:8px}.targets label{display:flex;gap:10px;align-items:center;min-height:44px;font-size:14px}.targets input{width:20px;height:20px;flex-shrink:0}.shift-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.shift-grid input{display:block;max-width:180px;margin-top:8px}
 @media(max-width:700px){.shift-grid{grid-template-columns:1fr;gap:16px}}
</style>
