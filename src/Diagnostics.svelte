<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
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
 },'Diagnostics read from controller','Could not refresh diagnostics. Previous snapshot is stale; explicitly retry.','Reading diagnostics…');if(!ok){stale=!!snapshot;failure='Could not refresh diagnostics. Check connectivity and explicitly retry.';}}
 async function log(path:'/errors'|'/log'){await perform(async()=>download(await getLog(path),path==='/errors'?'sunriser-errors.txt':'sunriser-info.txt'),'Log downloaded','Could not download the local log. The file may be absent, unavailable or the connection interrupted. No automatic retry.','Downloading local log…');}
</script>
<div hidden={!active}><EditorPage>
 <div class="heading"><div><h1>Diagnostics</h1><p>Reported device information and local log files.</p></div><ActionButton secondary onclick={load} disabled={busy}>Refresh diagnostics</ActionButton></div>
 <section aria-label="Device diagnostics">
 {#if snapshot&&info}
 <p class:warning={stale}>{stale?'Stale diagnostic snapshot':'Diagnostic snapshot'} · {utc(snapshot.time)} · refreshed only on request.</p>
 <div class="diagnostic-columns">
 <section><h2>Controller and firmware</h2><dl>
 {#each [['Model',info.sunriser],['Firmware version',info.version],['Firmware file',info.filename],['Build time (UTC)',timestampText(info.timestamp)],['Description',info.description],['Author',info.author],['Experimental build',info.experimental],['LAN MAC',macText(info.mac)],...(firmware.wifi?[['Wi-Fi MAC',macText(info.wifi_mac)]]:[])] as [label,value]}<div><dt>{label}</dt><dd>{metadataText(value)}</dd></div>{/each}
 </dl></section>
 <section><h2>Bootloader and connection</h2>
 {#if bootError}<p class="warning">Bootloader information unavailable. Other metadata was read successfully.</p>{/if}
 <dl>{#each [['Bootloader version',boot?.version],['Bootloader build (UTC)',timestampText(boot?.timestamp)],['LAN address',snapshot.lan_ip],...(firmware.wifi?[['Wi-Fi address',snapshot.wifi_ip]]:[]),['Uptime',`${snapshot.uptime} s`],['Error log bytes',stateFields?.errsize],['Info log bytes',stateFields?.logsize]] as [label,value]}<div><dt>{label}</dt><dd>{metadataText(value)}</dd></div>{/each}</dl>
 <p>Log sizes are snapshot values. A missing or zero size does not establish whether logging is enabled.</p>
 </section></div>
 <details><summary>Raw reported metadata</summary><pre>{JSON.stringify({firmware:info,bootloader:boot??null},null,2)}</pre></details>
 {:else}<p>Use Refresh diagnostics to read firmware, state and bootloader information sequentially. No device settings are changed.</p>{/if}
 {#if failure}<p class="warning">{failure}</p>{/if}
 </section>
 <section class="logs"><h2>Local logs</h2><p>Download the controller’s existing files, unchanged. An absent log is reported as unavailable. Downloading does not enable logging or clear records.</p><div class="actions"><ActionButton secondary disabled={busy} onclick={()=>log('/errors')}>Download error log</ActionButton><ActionButton secondary disabled={busy} onclick={()=>log('/log')}>Download info log</ActionButton><a href="#settings">Logging preferences →</a></div></section>
 <section class="connections"><h2>Related information</h2><div class="actions"><a href="#network">Network settings →</a><a href="#sensors">Sensor readings →</a><a href="#recovery">Backup and recovery →</a></div>
 {#if firmware.wifi}<p>The supported firmware HTTP API does not expose the driver's internal Wi-Fi AP list. This interface does not initiate a radio scan or invent an AP endpoint.</p>{/if}</section>
</EditorPage></div>
<style>
 .diagnostic-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:40px;max-width:1200px;margin-top:24px}.diagnostic-columns section{min-width:0}dl{margin:0}dl>div{display:grid;grid-template-columns:160px minmax(0,1fr);gap:16px;padding:10px 0;border-bottom:1px solid var(--sr-line)}dt{color:var(--sr-muted);font-size:13px}.diagnostic-columns dl dd{margin:0;font:400 14px/1.5 var(--sr-font);overflow-wrap:anywhere}.warning{color:var(--sr-error)!important}.logs,.connections{margin-top:28px;padding-top:20px;border-top:1px solid var(--sr-line)}.actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px}.actions a{display:inline-flex;align-items:center;min-height:44px;font-size:14px}summary{cursor:pointer;min-height:44px;padding:12px 0;font-size:14px}details{margin-top:20px}pre{max-width:100%;overflow:auto;background:var(--sr-input);padding:16px;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
 @media(max-width:800px){.diagnostic-columns{grid-template-columns:1fr;gap:24px}dl>div{grid-template-columns:minmax(100px,.8fr) minmax(0,1fr);gap:12px}}
</style>
