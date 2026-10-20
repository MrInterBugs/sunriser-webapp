<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {tick} from 'svelte';
 import {readChannels,savedChannels,choosePreset,channelPatch,presets,type Channel} from './channels';
 import {saveConfiguration,type Firmware} from './api';
 import ActionButton from './ui/ActionButton.svelte';
 import DraftBar from './ui/DraftBar.svelte';
 import ChannelIdentity from './ui/ChannelIdentity.svelte';
 let {active,busy,firmware,perform,onedit,onsaved,feedback}:{feedback:string;active:boolean;busy:boolean;firmware:Firmware;perform:(task:()=>Promise<void>,success:string,failure:string,pending:string)=>Promise<boolean>;onedit:()=>void;onsaved:(channels:Channel[])=>void}=$props();
 let loading=$state(false);
 let draft=$state<Channel[]>(),baseline=$state<Channel[]>([]);
 const patch=$derived(draft?channelPatch(draft,baseline):{});
 const dirty=$derived(Object.keys(patch).length>0);
 export async function show(){if(!draft)await load();await tick();const heading=document.getElementById('channel-configuration-title');heading?.focus({preventScroll:true});heading?.scrollIntoView({block:'start'});}
 async function load(refresh=false){loading=true;try{await perform(async()=>{const c=await readChannels(firmware.pwm_count,refresh);baseline=structuredClone(c);draft=c;savedChannels.set(structuredClone(c));},'Channel configuration loaded','Could not load channel configuration. Existing draft kept.','Reading channel configuration…');}finally{loading=false;}}
 async function save(event:SubmitEvent){event.preventDefault();if(!draft||!dirty)return;await perform(async()=>{await saveConfiguration(patch,firmware);baseline=JSON.parse(JSON.stringify(draft));savedChannels.set(baseline);onsaved(baseline);},'Channel configuration saved and verified','Could not confirm channel configuration. Draft kept; reload to verify or explicitly retry Save.','Saving channel configuration…');}
 function select(index:number,value:string){if(!draft)return;choosePreset(draft,index,value);onedit();}
</script>
<section hidden={!active} class="channel-configuration" aria-label="Channel configuration">
 <div class="title"><div><h2 id="channel-configuration-title" tabindex="-1">Channel configuration</h2><p>Saved display colours and binary output settings. Commands above are separate.</p></div><ActionButton secondary onclick={()=>load(true)} disabled={busy}>{draft?'Reload channel configuration':'Load channel configuration'}</ActionButton></div>
 {#if draft}
 <p>Display colour does not change the physical light spectrum. Multi-channel presets expand into subsequent channels, up to the last available output.</p>
 <form onsubmit={save}>
 <DraftBar {feedback} {dirty} {busy} disabled={!dirty} label="Save channel configuration" scope="channel " detail="Only changed colour and binary keys are saved. Reported output remains independent."/>
 <div class="configuration-grid">
 {#each draft as channel,i}
 <fieldset disabled={busy}><legend><ChannelIdentity number={i+1}/></legend>
 <label for={`channel-colour-${i}`}>Channel {i+1} display colour</label>
 <select id={`channel-colour-${i}`} value={channel.color==null?'__absent__':typeof channel.color==='string'?channel.color:'__unknown__'} onchange={e=>select(i,e.currentTarget.value)}>
 {#if channel.color==null}<option value="__absent__" disabled>Not configured</option>{:else if typeof channel.color!=='string'||(channel.color!==''&&!presets.some(p=>p.id===channel.color))}<option value={typeof channel.color==='string'?channel.color:'__unknown__'} disabled>Unknown value — preserved: {JSON.stringify(channel.color)}</option>{/if}
 <option value="">Not used</option>{#each presets as p}<option value={p.id}>{p.name.trim()}{p.replace_me_with?' · multi-channel preset':''}</option>{/each}
 </select>
 {#if typeof channel.binary==='boolean'}<label class="binary"><input type="checkbox" bind:checked={channel.binary} oninput={onedit}/>Channel {i+1} binary on/off</label>
 {:else}<p>Unknown binary value retained: {JSON.stringify(channel.binary)}. Choose an explicit replacement only if intended.</p><select aria-label={`Channel ${i+1} binary on/off`} value="unknown" onchange={e=>{channel.binary=e.currentTarget.value==='true';onedit();}}><option value="unknown" disabled>Unknown — preserved</option><option value="false">Dimming</option><option value="true">Binary on/off</option></select>{/if}
 </fieldset>{/each}</div>
 <p>Pump / CO₂ selections set binary mode when entering that category; leaving it restores dimming. Manual overrides are retained when switching within a category. The legacy DEEP-BLUE expansion leaves its uppercase UVA entry unchanged; select UVA explicitly if intended.</p>
 <p>Reload replaces unsaved channel-configuration edits. Binary changes affect controller interpretation; review retained service and sensor drafts. Existing saved names are displayed and preserved; this editor does not create a new name field.</p>
 </form>{:else}<p class:error={!!feedback}>{loading?'Reading channel configuration…':feedback||'Load to inspect saved settings. No settings are written by loading.'}</p>{/if}
 <div class="links"><a href="#schedules">Schedule modes and planning →</a><a href="#service">Service levels and channel exclusions →</a></div>
</section>
<style>
 .channel-configuration{border-top:1px solid var(--sr-line);margin-top:28px;padding-top:24px}
 .title{display:flex;justify-content:space-between;align-items:center;gap:20px}.title h2{font-size:18px;margin:0;scroll-margin-top:16px}
 p.error{color:var(--sr-error)}
 p{font-size:13px;color:var(--sr-muted);line-height:1.6}.configuration-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 24px}
 fieldset{min-width:0;border:1px solid var(--sr-line);border-radius:var(--sr-radius);padding:12px 16px}legend{padding:0 6px;font-size:14px;font-weight:600}
 label{display:block;font-size:13px;margin:6px 0}select{width:100%;min-width:0;min-height:44px;font-size:16px;padding:8px;background:var(--sr-input);color:var(--sr-ink);border:1px solid var(--sr-control-line);border-radius:var(--sr-radius)}.binary{display:flex;align-items:center;gap:10px;min-height:44px}.binary input{width:20px;height:20px}
 .links{display:flex;flex-wrap:wrap;gap:16px}.links a{display:flex;align-items:center;min-height:44px;font-size:14px}
 @media(max-width:800px){.configuration-grid{grid-template-columns:1fr}.title{align-items:flex-start;flex-direction:column}}
</style>
