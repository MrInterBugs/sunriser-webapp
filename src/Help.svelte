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
 import {configurationRevision} from './configuration-state';
 import ConfigurationNotice from './ui/ConfigurationNotice.svelte';
 let snapshotRevision=$state(configurationRevision());
 import type {Firmware} from './api';
 import {readConfig} from './api';
 import {decodeChannels,savedChannels} from './channels';
 import {configurationKeys,configuredRows} from './guidance';
 import {helpSections} from './help-content';
 import ActionButton from './ui/ActionButton.svelte';
 import ChannelIdentity from './ui/ChannelIdentity.svelte';
 let {active,busy,firmware,perform}:{active:boolean;busy:boolean;firmware:Firmware|undefined;perform:(task:()=>Promise<void>,success:string,failure:string,pending:string)=>Promise<boolean>}=$props();
 let rows=$state<ReturnType<typeof configuredRows>>(),readAt=$state(''),stale=$state(false);
 async function load(){if(!firmware||busy)return;const count=firmware.pwm_count;const ok=await perform(async()=>{const values=await readConfig(configurationKeys(count));rows=configuredRows(values,count);snapshotRevision=configurationRevision();savedChannels.set(decodeChannels(values,count));readAt=new Date().toISOString();stale=false;},source("help.configuredStateReadFromController_988c9"),source("help.couldNotReadConfiguredStatePreviousSnapshotRetainedAs_a2e62"),source("help.readingConfiguredState_50621"));if(!ok)stale=true;}
</script>
<div hidden={!active} class="help-page">
 <header><h1>{$t("help.helpAndGettingStarted_f0eb5")}</h1><p>{$t("help.localGuidanceForSunRiserReadingHelpNeverAppliesSettings_02fd6")}</p></header>
 <div class="guidance-layout"><section aria-label={$t("help.gettingStarted_76e7a")}><h2>{$t("help.gettingStarted_76e7a")}</h2><ol>
 <li><a href="#index">{$t("help.checkReportedState_be740")}</a>{$t("help.confirmTheControllerIsReachableStaleReadingsAreNot_36705")}</li>
 <li><a href="#channels">{$t("help.identifyChannels_d64bf")}</a>{$t("help.savedChannelConfigurationLoadsAutomaticallyChooseDisplayPresetsAnd_08bd1")}</li>
 <li><a href="#clock">{$t("help.checkDeviceLocalTime_a999d")}</a>{$t("help.dailyAndWeeklySchedulesFollowTheControllerSLocal_fd319")}</li>
 <li><a href="#schedules">{$t("help.createOrInspectASchedule_6b0ad")}</a>{$t("help.chooseDailyOrWeeklyModeEditPreciseTimesAnd_a0edd")}</li>
 <li><a href="#recovery">{$t("help.keepALocalBackup_f53f5")}</a>{$t("help.reviewRecoveryOperationsAndConnectivityGuidanceBeforeApplyingChanges_76ead")}</li>
 </ol><p>{$t("help.thisIsGuidanceNotASetupWizardNothingIs_5589d")}</p></section>
 <aside><h2>{$t("help.threeDifferentStates_a0dac")}</h2><dl><dt>{$t("help.draft_23d33")}</dt><dd>{$t("help.aLocalEditableValueItRemainsInTheMounted_2a57f")}</dd><dt>{$t("help.savedConfiguration_e4bfc")}</dt><dd>{$t("help.acknowledgedAndVerifiedStoredSettingsSaveScopeIsShown_07ba7")}</dd><dt>{$t("help.reportedOutput_ee68d")}</dt><dd>{$t("help.theControllerSIndependentReadingItCanDifferFrom_c71b2")}</dd></dl><p>{$t("help.rawChannelCommandsUse01000ScheduleServiceSettings_8e4f1")}</p></aside></div>
 <section aria-label={$t("help.configuredStateSummary_8380c")} class="configured"><div class="section-heading"><div><h2>{$t("help.configuredStateSummary_8380c")}</h2><p>{$t("help.aSnapshotOfSavedConfigurationNotProofOfActive_33242")}</p></div><ActionButton secondary disabled={busy||!firmware} onclick={load}>{rows?$t("help.refreshConfiguredState_3e878"):$t("help.readConfiguredState_23588")}</ActionButton></div>
 {#if !firmware}<p>{$t("help.connectToTheControllerToReadSavedConfigurationThe_70ea5")}</p>{:else if rows}<ConfigurationNotice revision={snapshotRevision}/><p class:warning={stale}>{stale?$t("help.staleSnapshot_3f3d6"):$t("help.configurationSnapshot_f860d")} · {readAt} {$t("help.refreshExplicitlyAfterEditingSettingsElsewhere_e082f")}</p><div class="summary-grid">{#each rows as row}<article><h3><ChannelIdentity number={row.number}/></h3><strong>{$renderText(row.mode)}</strong><p>{$renderText(row.plan)}</p><p>{$renderText(row.weather)}</p></article>{/each}</div>{:else}<p>{busy?$t("help.readingConfiguredState_50621"):stale?$t("help.configurationUnavailableExplicitlyRetryTheRead_fa385"):$t("help.readSavedSettingsOnRequestThisDoesNotChange_0812f")}</p>{/if}
 </section>
 <section aria-label={$t("help.workflowReference_d6f06")}><h2>{$t("help.workflowReference_d6f06")}</h2><p>{$t("help.openATopicForTheCompleteLocalWorkflowAnd_9d351")}</p>
 {#each helpSections as section}<details><summary>{$renderText(section.name)}</summary><section aria-label={$t("help.helpV0_3d1b0",{v0: $renderText(section.name)})}>{#each section.text as paragraph}<p>{$renderText(paragraph)}</p>{/each}<a class="destination" href={`#${section.route}`}>{$t("help.open_cf9b7")} {$renderText(section.name)} →</a></section></details>{/each}
 </section>
 <section class="connection-help" aria-label={$t("help.connectionAndErrorHelp_450c3")}><h2>{$t("help.connectionPendingOperationsAndErrors_e4f24")}</h2><p>{$t("help.keepTheControllerSKnownLocalAddressTheConnection_fe98f")}</p><p>{$t("help.writesAreSingleFlightAndNeverAutomaticallyRetriedRead_1b804")}</p><p>{$t("help.use_1d4d4")} <a href="#network">{$t("help.network_53ebc")}</a> {$t("help.forAddressGuidanceAnd_560e4")} <a href="#recovery">{$t("help.recovery_ea924")}</a> {$t("help.forReviewedLocalOperationsOfflineHelpIsAvailableOnce_c8326")}</p></section>
 <section aria-label={$t("help.contactAndAttribution_ae3a7")}><h2>{$t("help.contactAndAttribution_ae3a7")}</h2><p>{$t("help.sunriserIsAnAquariumLightingControllerAssociatedWithLEDaquaristik_a3284")}</p><p>{$t("help.theLinksBelowLeaveThisLocalApplicationOnlyWhen_982f1")}</p><div class="external-links"><a href="https://www.ledaquaristik.de/Kontakt/" target="_blank" rel="noopener noreferrer">{$t("help.ledaquaristikContactExternal_61441")}</a><a href="https://github.com/LEDaquaristik/sunriser" target="_blank" rel="noopener noreferrer">{$t("help.originalSunRiserProjectExternal_2604f")}</a><a href="notices.html" target="_blank" rel="noopener">{$t("help.localThirdPartyNoticesNewTab_363c1")}</a></div></section>
</div>
<style>
 .help-page{color:var(--sr-ink);font-size:15px}header{display:block;margin:12px 0 24px}h1{font-size:var(--sr-title);font-weight:600;letter-spacing:-1px;margin:0 0 8px}h2{font-size:20px;margin:0 0 14px}h3{font-size:15px;margin:0 0 10px}p,li,dd{font-size:14px;line-height:1.65;color:var(--sr-muted);max-width:100ch}p{margin:8px 0 16px}a{color:var(--sr-accent)}.guidance-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:48px}.guidance-layout aside{border-left:1px solid var(--sr-line);padding-left:32px}ol{padding-left:24px}li{padding:0 0 16px 4px}li a{font-weight:600}dt{font-size:15px;font-weight:600;margin-top:16px}dd{font-weight:400;margin:6px 0 16px}.configured,.help-page>section{margin-top:32px;padding-top:24px;border-top:1px solid var(--sr-line)}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:24px}.summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px 32px}.summary-grid article{border-bottom:1px solid var(--sr-line);padding:16px 0;min-width:0}.summary-grid p{font-size:13px;overflow-wrap:anywhere}.summary-grid strong{font-size:14px}.warning{color:var(--sr-error)}details{border-bottom:1px solid var(--sr-line)}summary{font-size:16px;font-weight:600;min-height:48px;padding:14px 0;cursor:pointer}details section{padding:0 0 16px}.destination,.external-links a{min-height:44px;display:inline-flex;align-items:center;padding:8px 0}.external-links{display:flex;gap:12px 28px;flex-wrap:wrap}a:focus-visible,summary:focus-visible{outline:3px solid var(--sr-focus);outline-offset:3px}
 @media(max-width:900px){.guidance-layout{grid-template-columns:1fr;gap:20px}.guidance-layout aside{border-left:0;border-top:1px solid var(--sr-line);padding:20px 0 0}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.section-heading{flex-direction:column;align-items:flex-start;gap:0}}
 @media(max-width:500px){.summary-grid{grid-template-columns:1fr}.external-links{display:block}.external-links a{display:flex}h1{font-size:28px}}
</style>
