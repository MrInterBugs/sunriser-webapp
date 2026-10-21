<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {t,renderText,language,source} from './i18n';
 import {configurationState,configurationRevision,configurationCurrent} from './configuration-state';
 let snapshotRevision=$state(configurationRevision());
 import {readSavedConfiguration,saveConfiguration,type Firmware} from './api';
 import {actions,preferenceKeys,decodePreferences,preferencePatch,readThunderEligibility,type Preferences} from './preferences';
 import DraftBar from './ui/DraftBar.svelte';
 import ActionButton from './ui/ActionButton.svelte';
 let {active,busy,firmware,feedback,perform,onedit}:{active:boolean;busy:boolean;firmware:Firmware;feedback:string;perform:(task:()=>Promise<void>,success:string,failure:string,pending:string)=>Promise<boolean>;onedit:()=>void}=$props();
 let draft=$state<Preferences>(),base=$state<Preferences>({}),attempted=$state(false),loading=$state(false),loadFailed=$state(false),eligible=$state<number[]|undefined>();
 const patch=$derived(draft?preferencePatch(draft,base,firmware.pwm_count):{}),dirty=$derived(Object.keys(patch).length>0);
 const usesThunder=$derived(draft&&['button_short','button_long','button_double'].some(k=>draft![k]===2));
 const flags=[['no_error_logging',source("devicepreferences.disableErrorLogging_71ce0")],['info_logging',source("devicepreferences.enableInfoLogging_b7cd6")]];
 $effect(()=>{if(active&&!attempted&&!busy&&!$configurationState.recovery)void load();});
 async function load(refresh=false){attempted=true;loading=true;loadFailed=false;try{loadFailed=!await perform(async()=>{
  const next=decodePreferences(await readSavedConfiguration(preferenceKeys(firmware.pwm_count),refresh),firmware.pwm_count);
  // A missing/malformed weather catalogue must not block unrelated preferences.
  try{eligible=await readThunderEligibility(firmware.pwm_count,refresh);}catch{eligible=undefined;}
  base=JSON.parse(JSON.stringify(next));draft=next;snapshotRevision=configurationRevision();
 },source("devicepreferences.devicePreferencesLoaded_fa205"),source("devicepreferences.couldNotLoadDevicePreferencesDraftKeptExplicitlyReload_05a80"),source("devicepreferences.readingDevicePreferences_1b8fb"));}finally{loading=false;}}
 async function save(e:SubmitEvent){e.preventDefault();if(!draft||!dirty||!configurationCurrent(snapshotRevision))return;await perform(async()=>{await saveConfiguration(patch,firmware);base=JSON.parse(JSON.stringify(draft));},source("devicepreferences.preferencesSavedAndVerified_cedb8"),source("devicepreferences.couldNotConfirmPreferencesDraftKeptReloadToVerify_ee247"),source("devicepreferences.savingDevicePreferences_59f05"));}
 function set(key:string,value:unknown){if(draft){draft[key]=value;onedit();}}
</script>
<section hidden={!active} class="preferences" aria-label={$t("devicepreferences.devicePreferences_f0e32")}>
 <div class="section-heading"><div><h2>{$t("devicepreferences.devicePreferences_f0e32")}</h2><p>{$t("devicepreferences.buttonActionsStatusIndicationAndLoggingSavingDoesNot_5c51c")}</p></div>{#if draft||loadFailed}<ActionButton secondary disabled={busy} onclick={()=>load(true)}>{draft?$t("devicepreferences.reloadDevicePreferences_a405d"):$t("devicepreferences.retryDevicePreferences_b23c9")}</ActionButton>{/if}</div>
 {#if draft}
 <form onsubmit={save}>
 <DraftBar {snapshotRevision} {dirty} {busy} feedback={$renderText(feedback)} disabled={!dirty} label={$t("devicepreferences.saveDevicePreferences_412b6")} scope={$t("devicepreferences.preference_281ad")} detail={$t("devicepreferences.changedPreferencesAreSavedAndReadBackIndependentlyOf_8400b")}/>
 <div class="preferences-grid">
 <section class="preference-group"><h3>{$t("devicepreferences.physicalButton_86f1c")}</h3>
 {#if typeof draft.nobutton==='boolean'}<label class="check"><input type="checkbox" disabled={busy} checked={draft.nobutton} onchange={e=>set('nobutton',e.currentTarget.checked)}/>{$t("devicepreferences.disablePhysicalButton_905bc")}</label>
 {:else}<label>{$t("devicepreferences.disablePhysicalButton_905bc")}<select disabled={busy} value="unknown" onchange={e=>set('nobutton',e.currentTarget.value==='true')}><option disabled value="unknown">{$t("devicepreferences.unknownPreserved_50f93")} {JSON.stringify(draft.nobutton)}</option><option value="false">{$t("devicepreferences.no_816c5")}</option><option value="true">{$t("devicepreferences.yes_5397e")}</option></select></label>{/if}
 <fieldset disabled={busy||draft.nobutton!==false}><legend class="visually-hidden">{$t("devicepreferences.physicalButtonActions_0f074")}</legend>
 {#each ['short','long','double'] as press}{@const kind=press as 'short'|'long'|'double'}{@const key=`button_${press}`}{@const known=actions(kind).some(a=>a.value===draft![key])}
 <label>{press==='short'?$t("devicepreferences.short_0fe7d"):press==='long'?$t("devicepreferences.long_11eda"):$t("devicepreferences.double_81581")} {$t("devicepreferences.pressAction_0588d")}<select value={known?String(draft[key]):'unknown'} onchange={e=>set(key,Number(e.currentTarget.value))}>
 {#if !known}<option value="unknown" disabled>{$t("devicepreferences.unknownPreserved_50f93")} {JSON.stringify(draft[key])}</option>{/if}{#each actions(kind) as action}<option value={String(action.value)}>{$renderText(action.label)}</option>{/each}</select></label>
 {/each}</fieldset>
 <p>{$t("devicepreferences.longPress3SecondsAConfiguredDoublePressAdds_0f9f4")}</p>
 {#if usesThunder&&draft.nobutton===false}<p class="notice">{eligible===undefined?$t("devicepreferences.thunderEligibilityUnavailableReloadPreferencesToCheckSavedAssignments_ea086"):eligible.length?source("devicepreferences.eligibleSavedThunderProfiles_93bf7")+eligible.join(', '):$t("devicepreferences.noEligibleSavedThunderProfileAssignAnEnabledThunder_2fae2")}</p>{/if}
 <p>{$t("devicepreferences.blackoutRespectsServiceExclusionsAndTheSavedTimeoutThese_db574")}</p>
 </section>
 <section class="preference-group"><h3>{$t("devicepreferences.loggingAndIndication_b206c")}</h3>
 <fieldset disabled={busy}><legend class="visually-hidden">{$t("devicepreferences.loggingAndStatusLED_281d8")}</legend>
 {#each [...flags,...(firmware.pwm_count===10?[['nostatus',source("devicepreferences.disableStatusLED_254fc")]]:[])] as [key,label]}
 {#if typeof draft[key]==='boolean'}<label class="check"><input type="checkbox" checked={draft[key]===true} onchange={e=>set(key,e.currentTarget.checked)}/>{$renderText(label)}</label>
 {:else}<label>{$renderText(label)}<select value="unknown" onchange={e=>set(key,e.currentTarget.value==='true')}><option disabled value="unknown">{$t("devicepreferences.unknownPreserved_50f93")} {JSON.stringify(draft[key])}</option><option value="false">{$t("devicepreferences.no_816c5")}</option><option value="true">{$t("devicepreferences.yes_5397e")}</option></select></label>{/if}{/each}
 </fieldset>
 {#if firmware.pwm_count===8}<p>{$t("devicepreferences.statusLEDConfigurationIsAvailableOnSunRiser10Only_d4d4c")}</p>{/if}
 <p>{$t("devicepreferences.loggingPreferencesControlFutureRecordsExistingFilesCanStill_8645b")}</p><a href="#diagnostics">{$t("devicepreferences.deviceDiagnosticsAndLocalLogs_b1ff8")}</a>
 <details><summary>{$t("devicepreferences.helpAndAdvancedControls_225f6")}</summary><p>{$t("devicepreferences.modernSunRiserKeepsAdvancedSectionsDiscoverableAndProvidesLocal_7618b")}</p></details>
 </section></div>
 </form>
 <p>{$t("devicepreferences.reloadReplacesUnsavedPreferenceEditsNavigationAndReportedState_26dcb")}</p>
 {:else}<p class:error={loadFailed} aria-live="polite">{loading?$t("devicepreferences.readingDevicePreferences_1b8fb"):loadFailed?$t("devicepreferences.couldNotLoadDevicePreferencesRetryTheReadNo_20526"):$configurationState.recovery?$t("channelconfiguration.configurationNotVerifiedCheckDeviceReadbackInRecoveryBefore_89f43"):$t("devicepreferences.waitingToReadSavedDevicePreferences_f684c")}</p>{/if}
</section>
<style>
 .preferences{margin:32px 0 0;padding-top:24px;border-top:1px solid var(--sr-line)}.section-heading{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:20px}h2{font-size:20px;margin:0}h3{font-size:17px;margin:0 0 16px}p{font-size:13px;line-height:1.6;color:var(--sr-muted)}p.error{color:var(--sr-error)}.preferences-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px;max-width:1120px}.preference-group{min-width:0}fieldset{border:0;padding:0;margin:0;min-width:0}label{display:block;font-size:14px;margin:12px 0}select{display:block;min-width:0;width:100%;min-height:44px;background:var(--sr-input);color:var(--sr-ink);border:1px solid var(--sr-control-line);border-radius:var(--sr-radius);padding:8px;font-size:16px;margin-top:6px}.check{display:flex;align-items:center;gap:10px;min-height:44px}.check input{width:20px;height:20px}a{display:inline-flex;align-items:center;min-height:44px;font-size:14px}details{margin-top:20px}summary{min-height:44px;padding:12px 0;cursor:pointer;font-size:14px}
 @media(max-width:800px){.preferences-grid{grid-template-columns:1fr;gap:24px}.section-heading{align-items:flex-start;flex-direction:column;gap:12px}}
</style>
