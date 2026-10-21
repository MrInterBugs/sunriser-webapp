<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {t,renderText,language} from '../i18n';
  import type { Point } from '../schedules';
  import { parseTime } from '../schedules';
  let { points, preview, valid, draft = false, selected = -1, disabled=false, onpointchange, onselect }: {
    points: Point[]; preview: string; valid: boolean; draft?: boolean; selected?:number; disabled?:boolean; onpointchange?:(index:number,point:Point)=>void; onselect?:(index:number)=>void;
  } = $props();
  let plot:HTMLDivElement;
  let drag:{index:number;original:Point;pointer:number}|undefined;
  const clock=(minute:number)=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
  function move(event:PointerEvent){
    if(!drag||event.pointerId!==drag.pointer||disabled)return;
    const bounds=plot.querySelector('svg')!.getBoundingClientRect();
    const minute=Math.max(0,Math.min(1439,Math.round((event.clientX-bounds.left)/bounds.width*1440)));
    const percent=Math.max(0,Math.min(100,Math.round(100-(event.clientY-bounds.top)/bounds.height*100)));
    onpointchange?.(drag.index,{time:clock(minute),percent});
  }
  function start(event:PointerEvent,index:number){
    if(event.button!==0||disabled)return;event.preventDefault();
    const button=event.currentTarget as HTMLButtonElement;button.focus({preventScroll:true});onselect?.(index);
    drag={index,original:{...points[index]},pointer:event.pointerId};button.setPointerCapture(event.pointerId);
  }
  function cancel(){if(drag){onpointchange?.(drag.index,drag.original);drag=undefined;}}
  function key(event:KeyboardEvent,index:number){
    if(event.key==='Escape'&&drag){event.preventDefault();cancel();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||disabled)return;
    event.preventDefault();const point=points[index],time=parseTime(point.time);if(time===undefined||point.percent===undefined)return;
    const horizontal=event.key==='ArrowLeft'||event.key==='ArrowRight',direction=event.key==='ArrowLeft'||event.key==='ArrowDown'?-1:1;
    onpointchange?.(index,horizontal?{...point,time:clock(Math.max(0,Math.min(1439,time+direction*(event.shiftKey?15:1))))}:{...point,percent:Math.max(0,Math.min(100,point.percent+direction*(event.shiftKey?5:1)))});
  }
</script>
<figure aria-label={$t("schedulepreview.scheduleCurve_d9778")}>
  <figcaption><span>{$t("schedulepreview.scheduledLevel_13353")} <strong>%</strong></span><span>{draft ? $t("schedulepreview.draftPreview_89f24") : $t("schedulepreview.savedPreview_2e0ae")}</span></figcaption>
  <div class="chart">
    <div class="levels" aria-hidden="true"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
    <div class="plot" bind:this={plot}>
      <svg role="img" aria-label={$t("schedulepreview.schedulePercentagePreview_2ad43")} viewBox="0 0 1440 100" preserveAspectRatio="none">
        <title>{$t("schedulepreview.schedulePercentagesOverOneDeviceLocalDay_a5f66")}</title>
        <path d="M0 0H1440M0 25H1440M0 50H1440M0 75H1440M0 100H1440 M360 0V100 M720 0V100 M1080 0V100" class="grid" vector-effect="non-scaling-stroke" />
        {#if preview}
          <polygon points={`0,100 ${preview} 1440,100`} class="area" />
          <polyline points={preview} fill="none" vector-effect="non-scaling-stroke" />
        {/if}
      </svg>
      {#each points as point,i}
        {#if parseTime(point.time)!==undefined && typeof point.percent==='number' && Number.isInteger(point.percent) && point.percent>=0 && point.percent<=100}
          {#if onpointchange}<button type="button" class="point-handle" class:selected={selected===i} {disabled} aria-label={$t("schedulepreview.graphPointV0V1V2_a5fd5",{v0: i+1,v1: point.time,v2: point.percent})} aria-describedby="graph-edit-help" style:left={`${parseTime(point.time)!/1440*100}%`} style:top={`${100-point.percent}%`} onfocus={()=>onselect?.(i)} onkeydown={e=>key(e,i)} onpointerdown={e=>start(e,i)} onpointermove={move} onpointerup={()=>drag=undefined} onpointercancel={cancel} onlostpointercapture={cancel}><span class="marker" aria-hidden="true"></span></button>
          {:else}<span class="marker" class:selected={selected===i} aria-hidden="true" style:left={`${parseTime(point.time)!/1440*100}%`} style:top={`${100-point.percent}%`}></span>{/if}
        {/if}
      {/each}
      {#if !valid || !points.length}<div class="empty">{valid ? $t("schedulepreview.noPointsYet_c294f") : $t("schedulepreview.previewUnavailable_36d31")}<small>{valid ? $t("schedulepreview.addAPointBelowToBegin_d0db4") : $t("schedulepreview.correctThePointValuesBelow_a5640")}</small></div>{/if}
    </div>
    <div class="times" aria-hidden="true">{#each ["00:00","06:00","12:00","18:00","24:00"] as time,i}<span style:left={`${i*25}%`}>{time}</span>{/each}</div>
  </div>
  <p>{$t("schedulepreview.deviceLocalTimeSchematicPercentagesNotMeasuredOutput_1f04f")}</p>
  {#if onpointchange}<p id="graph-edit-help">{$t("schedulepreview.dragPointsToEditTheDraftOnlyArrowKeys_9df69")}</p>{/if}
</figure>
<style>
  figure { margin:0; min-width:0; }
  figcaption { display:flex; justify-content:space-between; gap:12px; margin-bottom:20px; font-size:12px; color:var(--sr-muted); }
  figcaption strong { font-weight:600; }
  .chart { display:grid; grid-template-columns:28px minmax(0,1fr); column-gap:10px; row-gap:12px; padding:0 22px 0 0; }
  .levels { height:260px; display:flex; flex-direction:column; justify-content:space-between; font:12px/1 var(--sr-mono); color:var(--sr-muted); text-align:right; }
  .levels span:first-child { transform:translateY(-50%); }
  .levels span:last-child { transform:translateY(50%); }
  .plot { height:260px; background:var(--sr-input); position:relative; border-left:1px solid var(--sr-control-line); color:var(--sr-teal); }
  svg { position:absolute; width:100%; height:100%; overflow:visible; }
  .grid { stroke:var(--sr-line); stroke-width:1; }
  .area { fill:var(--sr-accent); fill-opacity:.12; }
  polyline { stroke:var(--sr-teal); stroke-width:3; }
  .marker { position:absolute; width:9px; height:9px; border:2px solid var(--sr-teal); background:var(--sr-input); border-radius:50%; transform:translate(-50%,-50%); pointer-events:none; }
  .marker.selected,.point-handle.selected .marker { background:var(--sr-accent); box-shadow:0 0 0 4px var(--sr-surface),0 0 0 6px var(--sr-accent); }
  .point-handle{position:absolute;transform:translate(-50%,-50%);width:44px;height:44px;min-height:44px;padding:0;border:0;background:transparent;touch-action:none;cursor:grab;z-index:1;border-radius:4px}
  .point-handle .marker{left:50%;top:50%}.point-handle.selected{z-index:3}.point-handle:active{cursor:grabbing}.point-handle:focus-visible{outline:3px solid var(--sr-focus);outline-offset:0}.point-handle:disabled{cursor:default;opacity:.5}.point-handle:hover{background:transparent}
  .times { grid-column:2; position:relative; height:16px; color:var(--sr-muted); font:12px/1.4 var(--sr-mono); font-variant-numeric:tabular-nums; }
  .times span { transform:translateX(-50%); position:absolute; }
  .times span:first-child { transform:none; }
  .times span:last-child { transform:translateX(-100%); }
  .empty { pointer-events:none; position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:var(--sr-muted); font-size:14px; padding:16px; }
  .empty small { display:block; font-size:12px; margin-top:4px; }
  p { color:var(--sr-muted); font-size:12px; margin:16px 0 0; }
  @media(max-width:360px) { .times { font-size:10px; } }
  @media(max-width:600px) { .plot,.levels { height:180px; } }
</style>
