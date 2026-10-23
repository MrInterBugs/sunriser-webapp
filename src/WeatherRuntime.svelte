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
 import {getState,getWeatherRuntime,utc,type Firmware} from './api';
 import {parseRuntime,runtimeGroups,runtimeValue,type RuntimeChannel} from './weather-runtime';
 import {savedChannels,channelDisplay,listedChannels,showUnusedChannels} from './channels';
 import ChannelIdentity from './ui/ChannelIdentity.svelte';
 import ActionButton from './ui/ActionButton.svelte';
 let {busy,firmware,connectionStale,savedValues={},perform}:{busy:boolean;firmware:Firmware;connectionStale:boolean;savedValues?:Record<string,unknown>;perform:(task:()=>Promise<void>,success:string,failure:string,pending:string)=>Promise<boolean>}=$props();
 let channels=$state<RuntimeChannel[]>(),selected=$state(0),tick=$state<unknown>(),captured=$state(0),failed=$state(false),failure=$state('');
 // Unused channels stay listed while the controller reports weather for them.
 const listed=$derived(channels?listedChannels($savedChannels,channels.length,$showUnusedChannels,n=>channels![n-1]!==null):[]);
 $effect(()=>{const shown=listed;if(shown.length&&!shown.includes(selected+1))selected=shown[0]-1;});
 const inactive=$derived(listed.filter(n=>channels?.[n-1]===null));
 const entry=$derived(channels?.[selected]);
 const profileName=$derived(entry? savedValues[`weather#setup#${entry.weather_program_id}#name`]:undefined);
 async function read(){failure='';const ok=await perform(async()=>{
  const snapshot=await getState(firmware.pwm_count),values=parseRuntime(await getWeatherRuntime(),firmware.pwm_count);
  tick=(snapshot as unknown as Record<string,unknown>).tick;captured=snapshot.time;
  if(!channels)selected=Math.max(0,values.findIndex(c=>c!==null));channels=values;failed=false;
 },source("weatherruntime.weatherRuntimeReadFromController_6b4fc"),source("weatherruntime.couldNotReadWeatherRuntimePreviousSnapshotIsStale_48d32"),source("weatherruntime.readingWeatherRuntime_51545"));if(!ok){failed=true;failure=source("weatherruntime.couldNotReadWeatherRuntimeCheckConnectivityAndExplicitly_10280");}}
</script>
<section class="weather-runtime" aria-label={$t("weatherruntime.weatherRuntime_0b627")}>
 <div class="runtime-heading"><div><h2>{$t("weatherruntime.reportedWeatherRuntime_1ed1e")}</h2><p>{$t("weatherruntime.inspectChannelEffectsIndependentlyOfConfigurationDrafts_7df89")}</p></div><ActionButton secondary disabled={busy} onclick={read}>{$t("weatherruntime.readWeatherRuntime_82201")}</ActionButton></div>
 {#if channels}
 <p class:warning={failed||connectionStale}>{failed||connectionStale?$t("weatherruntime.staleRuntimeSnapshot_2f658"):$t("weatherruntime.runtimeSnapshot_32fa9")} · {utc(captured)}{$t("weatherruntime.timesAreRelativeToTheCapturedDeviceTickThis_28783")}</p>
 <div class="runtime-workspace"><div class="runtime-selection"><label for="runtime-channel">{$t("weatherruntime.runtimeChannel_6e67d")}</label><select id="runtime-channel" bind:value={selected}>{#each listed as n}{@const i=n-1}{@const channel=channels[i]}<option value={i}>{channelDisplay(i+1,$savedChannels[i],'',$language)}{channel===null?$t('common.inactiveSuffix'):''}</option>{/each}</select>
 <p>{#if inactive.length}{$t("weatherruntime.noActiveWeatherReportedForChannels_d0f0c")} {inactive.join(', ')}.{:else}{$t("weatherruntime.eachChannelHasARuntimeRecordInThisSnapshot_61cb0")}{/if}</p>
 <p>{$t("weatherruntime.phaseCodesAreFirmwareStateValuesNotOutputLevels_ec25c")}</p></div>
 <div class="runtime-detail"><h3><ChannelIdentity number={selected+1}/></h3>
 {#if entry===null}<p>{$t("weatherruntime.noActiveWeatherReportedForThisChannel_9a5b8")}</p>
 {:else if entry}<p class="runtime-profile">{$t("weatherruntime.profile_ff4fc")} {typeof entry.weather_program_id==='number'?entry.weather_program_id:$t("weatherruntime.notReported_4b71e")}{typeof profileName==='string'?' · '+profileName:''}</p>
 <div class="runtime-effects">{#each runtimeGroups as group}<section><h4>{$renderText(group.name)}</h4>{#if group.fields.some(([key])=>Object.hasOwn(entry!,key))}<dl>{#each group.fields as [key,label,kind]}<div><dt>{$renderText(label)}</dt><dd>{$renderText(runtimeValue(entry[key],kind,tick))}</dd></div>{/each}</dl>{:else}<p>{$t("weatherruntime.noEffectFieldsReported_c8c94")}</p>{/if}</section>{/each}</div>
 {/if}</div></div>
 {:else}<p>{$t("weatherruntime.noRuntimeSnapshotLoadedReadUsesTheExistingState_65541")}</p>{/if}
 {#if failure}<p class="warning">{$renderText(failure)}</p>{/if}
</section>
<style>
 .weather-runtime{margin-top:28px;padding-top:24px;border-top:1px solid var(--sr-line)}.runtime-heading{display:flex;justify-content:space-between;align-items:center;gap:24px}.runtime-workspace{display:grid;grid-template-columns:260px minmax(0,1fr);gap:32px;margin-top:20px}.runtime-selection,.runtime-detail{min-width:0}label{display:block;font-size:14px;margin-bottom:6px}select{display:block;width:100%;min-width:0;min-height:44px;padding:8px;font-size:16px;background:var(--sr-input);color:var(--sr-ink);border:1px solid var(--sr-control-line);border-radius:var(--sr-radius)}.runtime-effects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 28px}h4{font-size:14px;margin:8px 0}dl{margin:0}dl>div{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-top:1px solid var(--sr-line);font-size:13px}dt{color:var(--sr-muted)}.runtime-effects dl dd{margin:0;font:500 14px/1.5 var(--sr-mono);text-align:right;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.warning{color:var(--sr-error)!important}
 @media(max-width:900px){.runtime-workspace{grid-template-columns:1fr;gap:16px}.runtime-selection{max-width:600px}}
 @media(max-width:600px){.runtime-heading{flex-direction:column;align-items:flex-start;gap:8px}.runtime-effects{grid-template-columns:1fr}}
</style>
