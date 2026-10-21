<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {presetName} from "./channel-presets";
 import {t,renderText,language,source} from './i18n';
 import {configurationState,configurationRevision,configurationCurrent} from './configuration-state';
 let snapshotRevision=$state(configurationRevision());
 import {tick} from 'svelte';
 import {readChannels,savedChannels,choosePreset,channelPatch,presets,type Channel} from './channels';
 import {saveConfiguration,type Firmware} from './api';
 import ActionButton from './ui/ActionButton.svelte';
 import DraftBar from './ui/DraftBar.svelte';
 import ChannelIdentity from './ui/ChannelIdentity.svelte';
 let {active,busy,firmware,perform,onedit,onsaved,feedback}:{feedback:string;active:boolean;busy:boolean;firmware:Firmware;perform:(task:()=>Promise<void>,success:string,failure:string,pending:string)=>Promise<boolean>;onedit:()=>void;onsaved:(channels:Channel[])=>void}=$props();
 let loading=$state(false),attempted=$state(false),loadFailed=$state(false);
 let draft=$state<Channel[]>(),baseline=$state<Channel[]>([]);
 const patch=$derived(draft?channelPatch(draft,baseline):{});
 const dirty=$derived(Object.keys(patch).length>0);
 $effect(()=>{if(active&&!attempted&&!busy&&!$configurationState.recovery)void load();});
 export async function show(){await tick();const heading=document.getElementById('channel-configuration-title');heading?.focus({preventScroll:true});heading?.scrollIntoView({block:'start'});}
 async function load(refresh=false){attempted=true;loading=true;loadFailed=false;try{loadFailed=!await perform(async()=>{const c=await readChannels(firmware.pwm_count,refresh);baseline=structuredClone(c);draft=c;snapshotRevision=configurationRevision();savedChannels.set(structuredClone(c));},source("channelconfiguration.channelConfigurationLoaded_3cfd3"),source("channelconfiguration.couldNotLoadChannelConfigurationExistingDraftKept_d400f"),source("channelconfiguration.readingChannelConfiguration_3592f"));}finally{loading=false;}}
 async function save(event:SubmitEvent){event.preventDefault();if(!draft||!dirty||!configurationCurrent(snapshotRevision))return;await perform(async()=>{await saveConfiguration(patch,firmware);baseline=JSON.parse(JSON.stringify(draft));savedChannels.set(baseline);onsaved(baseline);},source("channelconfiguration.channelConfigurationSavedAndVerified_28dd1"),source("channelconfiguration.couldNotConfirmChannelConfigurationDraftKeptReloadTo_f1a4c"),source("channelconfiguration.savingChannelConfiguration_509e4"));}
 function select(index:number,value:string){if(!draft)return;choosePreset(draft,index,value);onedit();}
</script>
<section hidden={!active} class="channel-configuration" aria-label={$t("channelconfiguration.channelConfiguration_98b61")}>
 <div class="title"><div><h2 id="channel-configuration-title" tabindex="-1">{$t("channelconfiguration.channelConfiguration_98b61")}</h2><p>{$t("channelconfiguration.savedDisplayColoursAndBinaryOutputSettingsCommandsAbove_43f0f")}</p></div>{#if draft||loadFailed}<ActionButton secondary onclick={()=>load(true)} disabled={busy}>{draft?$t("channelconfiguration.reloadChannelConfiguration_a0da7"):$t("channelconfiguration.retryChannelConfiguration_688c6")}</ActionButton>{/if}</div>
 {#if draft}
 <p>{$t("channelconfiguration.displayColourDoesNotChangeThePhysicalLightSpectrum_5d638")}</p>
 <form onsubmit={save}>
 <DraftBar {snapshotRevision} feedback={$renderText(feedback)} {dirty} {busy} disabled={!dirty} label={$t("channelconfiguration.saveChannelConfiguration_90956")} scope={$language==='en'?$t("channelconfiguration.channel_fbe7d")+' ':$t("channelconfiguration.channel_fbe7d")} detail={$t("channelconfiguration.onlyChangedColourAndBinaryKeysAreSavedReported_27624")}/>
 <div class="configuration-grid">
 {#each draft as channel,i}
 <fieldset disabled={busy}><legend><ChannelIdentity number={i+1}/></legend>
 <label for={`channel-colour-${i}`}>{$t("channelconfiguration.channel_879f0")} {i+1} {$t("channelconfiguration.displayColour_cdefb")}</label>
 <select id={`channel-colour-${i}`} value={channel.color==null?'__absent__':typeof channel.color==='string'?channel.color:'__unknown__'} onchange={e=>select(i,e.currentTarget.value)}>
 {#if channel.color==null}<option value="__absent__" disabled>{$t("channelconfiguration.notConfigured_81193")}</option>{:else if typeof channel.color!=='string'||(channel.color!==''&&!presets.some(p=>p.id===channel.color))}<option value={typeof channel.color==='string'?channel.color:'__unknown__'} disabled>{$t("channelconfiguration.unknownValuePreserved_dc58b")} {JSON.stringify(channel.color)}</option>{/if}
 <option value="">{$t("channelconfiguration.notUsed_72a86")}</option>{#each presets as p}<option value={p.id}>{presetName(p,$language)}{p.replace_me_with?$t("channelconfiguration.multiChannelPreset_879fc"):''}</option>{/each}
 </select>
 {#if typeof channel.binary==='boolean'}<label class="binary"><input type="checkbox" bind:checked={channel.binary} oninput={onedit}/>{$t("channelconfiguration.channel_879f0")} {i+1} {$t("channelconfiguration.binaryOnOff_0f4b1")}</label>
 {:else}<p>{$t("channelconfiguration.unknownBinaryValueRetained_7948a")} {JSON.stringify(channel.binary)}{$t("channelconfiguration.chooseAnExplicitReplacementOnlyIfIntended_806ad")}</p><select aria-label={$t("channelconfiguration.channelV0BinaryOnOff_d3e71",{v0: i+1})} value="unknown" onchange={e=>{channel.binary=e.currentTarget.value==='true';onedit();}}><option value="unknown" disabled>{$t("channelconfiguration.unknownPreserved_d5e08")}</option><option value="false">{$t("channelconfiguration.dimming_c71eb")}</option><option value="true">{$t("channelconfiguration.binaryOnOff_b7593")}</option></select>{/if}
 </fieldset>{/each}</div>
 <p>{$t("channelconfiguration.pumpCOSelectionsSetBinaryModeWhenEnteringThat_05b00")}</p>
 <p>{$t("channelconfiguration.reloadReplacesUnsavedChannelConfigurationEditsBinaryChangesAffect_2d892")}</p>
 </form>{:else}<p class:error={loadFailed} aria-live="polite">{loading?$t("channelconfiguration.readingChannelConfiguration_3592f"):loadFailed?$t("channelconfiguration.couldNotLoadChannelConfigurationRetryTheReadNo_d08ec"):$configurationState.recovery?$t("channelconfiguration.configurationNotVerifiedCheckDeviceReadbackInRecoveryBefore_89f43"):$t("channelconfiguration.waitingToReadSavedChannelConfiguration_5685a")}</p>{/if}
 <div class="links"><a href="#schedules">{$t("channelconfiguration.scheduleModesAndPlanning_1cb61")}</a><a href="#service">{$t("channelconfiguration.serviceLevelsAndChannelExclusions_88f68")}</a></div>
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
