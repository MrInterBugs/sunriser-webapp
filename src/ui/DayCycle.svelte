<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
  import {parseTime,validateCurve,type Point} from '../schedules';
  let {points,baseline=[],draft=false,label='Saved daily rhythm',inspectable=true,compact=false,initialMinute=1080}:{points:Point[];baseline?:Point[];draft?:boolean;label?:string;inspectable?:boolean;compact?:boolean;initialMinute?:number}=$props();
  let inspection=$state(1080);
  let initialised=false;
  $effect(()=>{if(!initialised){inspection=initialMinute;initialised=true;}});
  const clock=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const valid=$derived(!validateCurve(points).length), available=$derived(valid&&points.length>0);
  function level(ps:Point[],t:number){
    if(!ps.length||validateCurve(ps).length)return 0;
    const sorted=ps.map(p=>[parseTime(p.time)!,p.percent!] as const).sort((a,b)=>a[0]-b[0]);
    if(sorted.length===1)return sorted[0][1];
    const next=sorted.findIndex(p=>p[0]>t),i=next<0?sorted.length:next;
    const left=i===0?[sorted.at(-1)![0]-1440,sorted.at(-1)![1]]:sorted[i-1];
    const right=i===sorted.length?[sorted[0][0]+1440,sorted[0][1]]:sorted[i];
    return left[1]+(right[1]-left[1])*(t-left[0])/(right[0]-left[0]);
  }
  const coordinate=$derived(available?Math.round(level(points,inspection)*10)/10:null);
  let exact=$derived(clock(inspection));
</script>
<section class="day-cycle" class:compact aria-label={label}>
  <div class="ribbon-heading"><strong>{draft?'Draft rhythm':label}</strong><span>{draft?'Thin upper line: saved baseline':'Tone encodes programmed %'}</span></div>
  <div class="strip">
    <svg aria-hidden="true" viewBox="0 0 1200 140" preserveAspectRatio="none">
      <path d="M0 14H1200M0 122H1200" />
      {#each Array.from({length:240},(_,i)=>i) as i}
        {#if draft&&baseline.length}<rect x={i*5} y="3" width="2.4" height="5" class="saved-band" opacity={level(baseline,(i+.5)*6)/100}/>{/if}
        <rect x={i*5} y="15" width="2.4" height="106" opacity={available?level(points,(i+.5)*6)/100:0}/>
      {/each}
    </svg>
    {#if available&&inspectable}<span class="lens" style:left={`${inspection/1440*100}%`} aria-hidden="true"><small>{clock(inspection)}</small><i></i></span>{/if}
    {#if !available}<div class="empty"><strong>{valid?'No daily points':'Draft preview paused'}</strong><span>{valid?'No schedule percentage is illustrated.':'Correct the point fields to restore this view.'}</span></div>{/if}
  </div>
  <div class="axis" aria-hidden="true"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
  {#if inspectable&&available}<div class="inspection"><div><span>Inspecting · device-local</span><strong>{clock(inspection)}</strong></div><div class="coordinate"><span>{draft?'Draft':'Saved'} plan coordinate</span><strong data-testid="cycle-coordinate">{coordinate}<small>%</small></strong></div><div class="inspect-control"><label>Inspect the day<input aria-label="Inspect daily schedule time" type="range" min="0" max="1439" step="1" bind:value={inspection}/></label><label><span class="visually-hidden">Exact inspection time</span><input aria-label="Exact inspection time" type="time" value={exact} oninput={e=>{const n=parseTime(e.currentTarget.value);if(n!==undefined)inspection=n;}}/></label></div></div>{/if}
  <p>Programmed percentage coordinates · repeating device-local day. Tone is illustrative, not aquarium illumination or reported output.</p>
</section>
<style>
.day-cycle{padding:18px 24px 15px;background:#1b3a30;border:1px solid #718460;color:#edf0e4}.ribbon-heading{display:flex;justify-content:space-between;gap:15px;font-size:12px;color:#bdcdbb;margin-bottom:24px}.ribbon-heading strong{font-weight:500}.strip{position:relative;height:64px;background:#153429}.strip svg{width:100%;height:100%;display:block}.strip path{stroke:#49694e;stroke-width:2;fill:none}.strip rect{fill:#e4c497}.strip .saved-band{fill:#bed0a5}.axis{display:flex;justify-content:space-between;margin-top:9px;font:11px var(--sr-mono);color:#bdcdbb}.lens{position:absolute;top:-8px;bottom:-8px;width:1px;background:#e4c497}.lens small{position:absolute;bottom:calc(100% + 2px);left:0;transform:translateX(-50%);font:10px var(--sr-mono);padding:2px 5px;border:1px solid #81916b;background:#1b3a30}.lens i{position:absolute;top:50%;left:0;transform:translate(-50%,-50%);width:28px;height:28px;border:1px solid #e4c497;border-radius:50%;background:#1b3a30bb}.lens i::after{content:'';position:absolute;left:-6px;right:-6px;top:50%;border-top:1px solid #e4c497}.inspection{display:grid;grid-template-columns:160px 1fr minmax(230px,340px);gap:24px;align-items:center;padding-top:20px;margin-top:14px;border-top:1px solid #49694e}.inspection>div>span{display:block;font-size:11px;color:#bdcdbb}.inspection strong{font:27px var(--sr-mono)}.inspection .coordinate{padding-left:24px;border-left:1px solid #6b8059}.coordinate strong{color:#e4c497;font-size:32px}.coordinate small{font:16px var(--sr-font);margin-left:6px}.inspect-control{display:flex;align-items:center;gap:16px}.inspect-control label{font-size:11px;color:#bdcdbb;min-width:0;margin:0}.inspect-control label:first-child{flex:1}.inspect-control input[type=range]{min-height:36px;margin:0;padding:0;width:100%;accent-color:#e4c497}.inspect-control input[type=time]{font:13px var(--sr-mono);padding:8px;color:#edf0e4;background:#17372d;border:1px solid #7e9a83;min-height:44px;width:100%}.day-cycle>p{font-size:11px;color:#bdcdbb;margin:15px 0 0;line-height:1.6}.empty{position:absolute;inset:0;display:flex;justify-content:center;align-items:center;flex-direction:column;font-size:12px;background:#17372d}.empty span{font-size:11px;color:#bdcdbb}.day-cycle.compact{border:0;border-bottom:1px solid #41614f;padding:12px 0;margin-bottom:12px}.day-cycle.compact .strip{height:44px}.day-cycle.compact .ribbon-heading{margin-bottom:10px}.day-cycle.compact>p{margin-top:8px}.compact>p{font-size:11px}@media(max-width:800px){.day-cycle{padding:17px 15px}.ribbon-heading{font-size:11px;gap:10px}.ribbon-heading span{font-size:10px;text-align:right}.inspection{grid-template-columns:1fr 1fr;gap:18px}.inspection strong{font-size:25px}.inspection .coordinate{padding-left:16px}.inspect-control{grid-column:1/-1;border-top:1px solid #49694e;padding-top:12px}.axis{font-size:10px}.compact{padding:12px 0 18px}.day-cycle>p{font-size:11px}}
</style>
