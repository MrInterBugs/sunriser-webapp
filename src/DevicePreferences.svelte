<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {readConfig,saveConfiguration,type Firmware} from './api';
 import {actions,preferenceKeys,decodePreferences,preferencePatch,readThunderEligibility,type Preferences} from './preferences';
 import DraftBar from './ui/DraftBar.svelte';
 import ActionButton from './ui/ActionButton.svelte';
 let {active,busy,firmware,feedback,perform,onedit}:{active:boolean;busy:boolean;firmware:Firmware;feedback:string;perform:(task:()=>Promise<void>,success:string,failure:string,pending:string)=>Promise<boolean>;onedit:()=>void}=$props();
 let draft=$state<Preferences>(),base=$state<Preferences>({}),attempted=$state(false),loading=$state(false),eligible=$state<number[]|undefined>();
 const patch=$derived(draft?preferencePatch(draft,base,firmware.pwm_count):{}),dirty=$derived(Object.keys(patch).length>0);
 const usesThunder=$derived(draft&&['button_short','button_long','button_double'].some(k=>draft![k]===2));
 const flags=[['no_error_logging','Disable error logging'],['info_logging','Enable info logging']];
 async function load(){attempted=true;loading=true;try{await perform(async()=>{
  const next=decodePreferences(await readConfig(preferenceKeys(firmware.pwm_count)),firmware.pwm_count);
  // A missing/malformed weather catalogue must not block unrelated preferences.
  try{eligible=await readThunderEligibility(firmware.pwm_count);}catch{eligible=undefined;}
  base=JSON.parse(JSON.stringify(next));draft=next;
 },'Device preferences loaded','Could not load device preferences. Draft kept; explicitly reload.','Reading device preferences…');}finally{loading=false;}}
 async function save(e:SubmitEvent){e.preventDefault();if(!draft||!dirty)return;await perform(async()=>{await saveConfiguration(patch,firmware);base=JSON.parse(JSON.stringify(draft));},'Preferences saved and verified','Could not confirm preferences. Draft kept; reload to verify or explicitly retry Save.','Saving device preferences…');}
 function set(key:string,value:unknown){if(draft){draft[key]=value;onedit();}}
</script>
<section hidden={!active} class="preferences" aria-label="Device preferences">
 <div class="section-heading"><div><h2>Device preferences</h2><p>Button actions, status indication and logging. Saving does not simulate a button press.</p></div><ActionButton secondary disabled={busy} onclick={load}>{draft?'Reload device preferences':'Load device preferences'}</ActionButton></div>
 {#if draft}
 <form onsubmit={save}>
 <DraftBar {dirty} {busy} {feedback} disabled={!dirty} label="Save device preferences" scope="preference " detail="Changed preferences are saved and read back independently of reported output."/>
 <div class="preferences-grid">
 <section class="preference-group"><h3>Physical button</h3>
 {#if typeof draft.nobutton==='boolean'}<label class="check"><input type="checkbox" disabled={busy} checked={draft.nobutton} onchange={e=>set('nobutton',e.currentTarget.checked)}/>Disable physical button</label>
 {:else}<label>Disable physical button<select disabled={busy} value="unknown" onchange={e=>set('nobutton',e.currentTarget.value==='true')}><option disabled value="unknown">Unknown — preserved: {JSON.stringify(draft.nobutton)}</option><option value="false">No</option><option value="true">Yes</option></select></label>{/if}
 <fieldset disabled={busy||draft.nobutton!==false}><legend class="visually-hidden">Physical button actions</legend>
 {#each ['short','long','double'] as press}{@const kind=press as 'short'|'long'|'double'}{@const key=`button_${press}`}{@const known=actions(kind).some(a=>a.value===draft![key])}
 <label>{press==='short'?'Short':press==='long'?'Long':'Double'} press action<select value={known?String(draft[key]):'unknown'} onchange={e=>set(key,Number(e.currentTarget.value))}>
 {#if !known}<option value="unknown" disabled>Unknown — preserved: {JSON.stringify(draft[key])}</option>{/if}{#each actions(kind) as action}<option value={String(action.value)}>{action.label}</option>{/each}</select></label>
 {/each}</fieldset>
 <p>Long press: 3 seconds. A configured double press adds a 0.4-second wait after a short press. Restart is available only for long or double press.</p>
 {#if usesThunder&&draft.nobutton===false}<p class="notice">{eligible===undefined?'Thunder eligibility unavailable. Reload preferences to check saved assignments.':eligible.length?'Eligible saved thunder profiles: '+eligible.join(', '):'No eligible saved thunder profile. Assign an enabled thunder profile to a non-binary channel in Weather.'}</p>{/if}
 <p>Blackout respects service exclusions and the saved timeout. These preferences do not verify physical button behavior.</p>
 </section>
 <section class="preference-group"><h3>Logging and indication</h3>
 <fieldset disabled={busy}><legend class="visually-hidden">Logging and status LED</legend>
 {#each [...flags,...(firmware.pwm_count===10?[['nostatus','Disable status LED']]:[])] as [key,label]}
 {#if typeof draft[key]==='boolean'}<label class="check"><input type="checkbox" checked={draft[key]===true} onchange={e=>set(key,e.currentTarget.checked)}/>{label}</label>
 {:else}<label>{label}<select value="unknown" onchange={e=>set(key,e.currentTarget.value==='true')}><option disabled value="unknown">Unknown — preserved: {JSON.stringify(draft[key])}</option><option value="false">No</option><option value="true">Yes</option></select></label>{/if}{/each}
 </fieldset>
 {#if firmware.pwm_count===8}<p>Status-LED configuration is available on SunRiser10 only.</p>{/if}
 <p>Logging preferences control future records; existing files can still be downloaded. Readback confirms storage, not physical LED operation.</p><a href="#diagnostics">Device diagnostics and local logs →</a>
 <details><summary>Help and advanced controls</summary><p>Modern SunRiser keeps advanced sections discoverable and provides local help where needed. Safeguards are always visible. Legacy “hide help” and “show expert” flags are preserved for the legacy interface; they do not hide modern controls.</p></details>
 </section></div>
 </form>
 {:else}<p class:error={attempted&&!!feedback}>{loading?'Reading device preferences…':attempted&&feedback?feedback:'Load preferences to inspect saved values. This does not write to the controller.'}</p>{/if}
</section>
<style>
 .preferences{margin:32px 0 0;padding-top:24px;border-top:1px solid var(--sr-line)}.section-heading{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:20px}h2{font-size:20px;margin:0}h3{font-size:17px;margin:0 0 16px}p{font-size:13px;line-height:1.6;color:var(--sr-muted)}p.error{color:var(--sr-error)}.preferences-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px;max-width:1120px}.preference-group{min-width:0}fieldset{border:0;padding:0;margin:0;min-width:0}label{display:block;font-size:14px;margin:12px 0}select{display:block;min-width:0;width:100%;min-height:44px;background:var(--sr-input);color:var(--sr-ink);border:1px solid var(--sr-control-line);border-radius:var(--sr-radius);padding:8px;font-size:16px;margin-top:6px}.check{display:flex;align-items:center;gap:10px;min-height:44px}.check input{width:20px;height:20px}a{display:inline-flex;align-items:center;min-height:44px;font-size:14px}details{margin-top:20px}summary{min-height:44px;padding:12px 0;cursor:pointer;font-size:14px}
 @media(max-width:800px){.preferences-grid{grid-template-columns:1fr;gap:24px}.section-heading{align-items:flex-start;flex-direction:column;gap:12px}}
</style>
