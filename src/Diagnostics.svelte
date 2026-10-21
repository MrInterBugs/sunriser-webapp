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
 import {getFirmware,getState,getBootloader,getLog,utc,type Firmware,type DeviceState} from './api';
 import {metadataText,macText,timestampText} from './diagnostics';
 import {download} from './recovery';
 import EditorPage from './ui/EditorPage.svelte';
 import ActionButton from './ui/ActionButton.svelte';
 let {active,busy,firmware,perform}:{active:boolean;busy:boolean;firmware:Firmware;perform:(task:()=>Promise<void>,success:string,failure:string,pending:string)=>Promise<boolean>}=$props();
 let info=$state<Record<string,unknown>>(),snapshot=$state<DeviceState>(),boot=$state<Record<string,unknown>>(),stale=$state(false),bootError=$state(false),failure=$state('');
 const stateFields=$derived(snapshot as unknown as Record<string,unknown>|undefined);
 async function load(){failure='';const ok=await perform(async()=>{
  const nextInfo=await getFirmware(),nextState=await getState(firmware.pwm_count);let nextBoot:Record<string,unknown>|undefined;
  try{nextBoot=await getBootloader();bootError=false;}catch{bootError=true;}
  info=nextInfo as unknown as Record<string,unknown>;snapshot=nextState;boot=nextBoot;stale=false;
 },source("diagnostics.diagnosticsReadFromController_0e7c9"),source("diagnostics.couldNotRefreshDiagnosticsPreviousSnapshotIsStaleExplicitly_00911"),source("diagnostics.readingDiagnostics_824ac"));if(!ok){stale=!!snapshot;failure=source("diagnostics.couldNotRefreshDiagnosticsCheckConnectivityAndExplicitlyRetry_c8805");}}
 async function log(path:'/errors'|'/log'){await perform(async()=>download(await getLog(path),path==='/errors'?'sunriser-errors.txt':'sunriser-info.txt'),source("diagnostics.logDownloaded_dddbc"),source("diagnostics.couldNotDownloadTheLocalLogTheFileMay_6b84f"),source("diagnostics.downloadingLocalLog_2bbc5"));}
</script>
<div hidden={!active}><EditorPage>
 <div class="heading"><div><h1>{$t("diagnostics.diagnostics_3af22")}</h1><p>{$t("diagnostics.reportedDeviceInformationAndLocalLogFiles_ca195")}</p></div><ActionButton secondary onclick={load} disabled={busy}>{$t("diagnostics.refreshDiagnostics_574ec")}</ActionButton></div>
 <section aria-label={$t("diagnostics.deviceDiagnostics_252c3")}>
 {#if snapshot&&info}
 <p class:warning={stale}>{stale?$t("diagnostics.staleDiagnosticSnapshot_eb6a8"):$t("diagnostics.diagnosticSnapshot_c9674")} · {utc(snapshot.time)} {$t("diagnostics.refreshedOnlyOnRequest_97550")}</p>
 <div class="diagnostic-columns">
 <section><h2>{$t("diagnostics.controllerAndFirmware_0eb1f")}</h2><dl>
 {#each [[source("diagnostics.model_68c2c"),info.sunriser],[source("diagnostics.firmwareVersion_e4a5e"),info.version],[source("diagnostics.firmwareFile_2a899"),info.filename],[source("diagnostics.buildTimeUTC_ad507"),timestampText(info.timestamp)],[source("diagnostics.description_55f8e"),info.description],[source("diagnostics.author_5fda2"),info.author],[source("diagnostics.experimentalBuild_8bbad"),info.experimental],['LAN MAC',macText(info.mac)],...(firmware.wifi?[[source("diagnostics.wiFiMAC_e90f5"),macText(info.wifi_mac)]]:[])] as [label,value]}<div><dt>{$renderText(label)}</dt><dd>{metadataText(value)}</dd></div>{/each}
 </dl></section>
 <section><h2>{$t("diagnostics.bootloaderAndConnection_9872c")}</h2>
 {#if bootError}<p class="warning">{$t("diagnostics.bootloaderInformationUnavailableOtherMetadataWasReadSuccessfully_b27f9")}</p>{/if}
 <dl>{#each [[source("diagnostics.bootloaderVersion_9d093"),boot?.version],[source("diagnostics.bootloaderBuildUTC_c0601"),timestampText(boot?.timestamp)],[source("app.lanAddress_99741"),snapshot.lan_ip],...(firmware.wifi?[[source("diagnostics.wiFiAddress_d8177"),snapshot.wifi_ip]]:[]),[source("app.uptime_6aafa"),source("diagnostics.v0S_2260e",{v0: snapshot.uptime})],[source("diagnostics.errorLogBytes_4cc27"),stateFields?.errsize],[source("diagnostics.infoLogBytes_4dde3"),stateFields?.logsize]] as [label,value]}<div><dt>{$renderText(label)}</dt><dd>{metadataText(value)}</dd></div>{/each}</dl>
 <p>{$t("diagnostics.logSizesAreSnapshotValuesAMissingOrZero_51b25")}</p>
 </section></div>
 <details><summary>{$t("diagnostics.rawReportedMetadata_af4fb")}</summary><pre>{JSON.stringify({firmware:info,bootloader:boot??null},null,2)}</pre></details>
 {:else}<p>{$t("diagnostics.useRefreshDiagnosticsToReadFirmwareStateAndBootloader_afbb2")}</p>{/if}
 {#if failure}<p class="warning">{$renderText(failure)}</p>{/if}
 </section>
 <section class="logs"><h2>{$t("diagnostics.localLogs_a44c4")}</h2><p>{$t("diagnostics.downloadTheControllerSExistingFilesUnchangedAnAbsent_4bcf1")}</p><div class="actions"><ActionButton secondary disabled={busy} onclick={()=>log('/errors')}>{$t("diagnostics.downloadErrorLog_28684")}</ActionButton><ActionButton secondary disabled={busy} onclick={()=>log('/log')}>{$t("diagnostics.downloadInfoLog_2e35f")}</ActionButton><a href="#settings">{$t("diagnostics.loggingPreferences_7c0dc")}</a></div></section>
 <section class="connections"><h2>{$t("diagnostics.relatedInformation_f08ac")}</h2><div class="actions"><a href="#network">{$t("diagnostics.networkSettings_75e33")}</a><a href="#sensors">{$t("diagnostics.sensorReadings_4c4f1")}</a><a href="#recovery">{$t("diagnostics.backupAndRecovery_5d048")}</a></div>
 {#if firmware.wifi}<p>{$t("diagnostics.theSupportedFirmwareHTTPAPIDoesNotExposeThe_65926")}</p>{/if}</section>
</EditorPage></div>
<style>
 .diagnostic-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:40px;max-width:1200px;margin-top:24px}.diagnostic-columns section{min-width:0}dl{margin:0}dl>div{display:grid;grid-template-columns:160px minmax(0,1fr);gap:16px;padding:10px 0;border-bottom:1px solid var(--sr-line)}dt{color:var(--sr-muted);font-size:13px}.diagnostic-columns dl dd{margin:0;font:400 14px/1.5 var(--sr-font);overflow-wrap:anywhere}.warning{color:var(--sr-error)!important}.logs,.connections{margin-top:28px;padding-top:20px;border-top:1px solid var(--sr-line)}.actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px}.actions a{display:inline-flex;align-items:center;min-height:44px;font-size:14px}summary{cursor:pointer;min-height:44px;padding:12px 0;font-size:14px}details{margin-top:20px}pre{max-width:100%;overflow:auto;background:var(--sr-input);padding:16px;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
 @media(max-width:800px){.diagnostic-columns{grid-template-columns:1fr;gap:24px}dl>div{grid-template-columns:minmax(100px,.8fr) minmax(0,1fr);gap:12px}}
</style>
