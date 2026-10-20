<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
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
 async function load(){if(!firmware||busy)return;const count=firmware.pwm_count;const ok=await perform(async()=>{const values=await readConfig(configurationKeys(count));rows=configuredRows(values,count);snapshotRevision=configurationRevision();savedChannels.set(decodeChannels(values,count));readAt=new Date().toISOString();stale=false;},'Configured state read from controller','Could not read configured state. Previous snapshot retained as stale; no changes were made.','Reading configured state…');if(!ok)stale=true;}
</script>
<div hidden={!active} class="help-page">
 <header><h1>Help and getting started</h1><p>Local guidance for SunRiser. Reading help never applies settings or commands.</p></header>
 <div class="guidance-layout"><section aria-label="Getting started"><h2>Getting started</h2><ol>
 <li><a href="#index">Check reported state</a>. Confirm the controller is reachable; stale readings are not current output.</li>
 <li><a href="#channels">Identify channels</a>. Saved channel configuration loads automatically. Choose display presets and confirm binary/on-off behavior for your existing hardware. Colour labels do not change physical spectrum.</li>
 <li><a href="#clock">Check device-local time</a>. Daily and weekly schedules follow the controller’s local calendar.</li>
 <li><a href="#schedules">Create or inspect a schedule</a>. Choose daily or weekly mode, edit precise times and percentages, then explicitly Save. Drafts do not control the device.</li>
 <li><a href="#recovery">Keep a local backup</a>. Review recovery operations and connectivity guidance before applying changes that may interrupt access.</li>
 </ol><p>This is guidance, not a setup wizard. Nothing is written by following these links. Configuration readback does not establish physical operation.</p></section>
 <aside><h2>Three different states</h2><dl><dt>Draft</dt><dd>A local editable value. It remains in the mounted editor while navigating, until Save or explicit Reload.</dd><dt>Saved configuration</dt><dd>Acknowledged and verified stored settings. Save scope is shown beside each action.</dd><dt>Reported output</dt><dd>The controller’s independent reading. It can differ from drafts or newly saved configuration.</dd></dl><p>Raw channel commands use 0–1000; schedule/service settings use 0–100%. Some readbacks can exceed 1000 raw. No spectrum, power or aggregate brightness is inferred.</p></aside></div>
 <section aria-label="Configured-state summary" class="configured"><div class="section-heading"><div><h2>Configured-state summary</h2><p>A snapshot of saved configuration, not proof of active output or a complete hardware setup.</p></div><ActionButton secondary disabled={busy||!firmware} onclick={load}>{rows?'Refresh configured state':'Read configured state'}</ActionButton></div>
 {#if !firmware}<p>Connect to the controller to read saved configuration. The guidance below remains available.</p>{:else if rows}<ConfigurationNotice revision={snapshotRevision}/><p class:warning={stale}>{stale?'Stale snapshot':'Configuration snapshot'} · {readAt} · refresh explicitly after editing settings elsewhere.</p><div class="summary-grid">{#each rows as row}<article><h3><ChannelIdentity number={row.number}/></h3><strong>{row.mode}</strong><p>{row.plan}</p><p>{row.weather}</p></article>{/each}</div>{:else}<p>{busy?'Reading configured state…':stale?'Configuration unavailable. Explicitly retry the read.':'Read saved settings on request. This does not change controller configuration.'}</p>{/if}
 </section>
 <section aria-label="Workflow reference"><h2>Workflow reference</h2><p>Open a topic for the complete local workflow and its important limitations.</p>
 {#each helpSections as section}<details><summary>{section.name}</summary><section aria-label={`Help: ${section.name}`}>{#each section.text as paragraph}<p>{paragraph}</p>{/each}<a class="destination" href={`#${section.route}`}>Open {section.name} →</a></section></details>{/each}
 </section>
 <section class="connection-help" aria-label="Connection and error help"><h2>Connection, pending operations and errors</h2><p>Keep the controller’s known local address. The connection indicator distinguishes available, stale and pending readback. “Last operation” can describe a previous page. An error after a write can mean the controller applied it but the reply was lost; refresh or explicitly reload to verify before choosing whether to repeat it.</p><p>Writes are single-flight and never automatically retried. Read-only refresh backs off on failure and pauses when the page is hidden or ineligible. Reload replaces an editor’s draft; normal navigation retains it. Refreshing the browser itself loses local unsaved drafts.</p><p>Use <a href="#network">Network</a> for address guidance and <a href="#recovery">Recovery</a> for reviewed local operations. Offline help is available once the application assets are loaded; this is not an offline-cache or service-worker feature.</p></section>
 <section aria-label="Contact and attribution"><h2>Contact and attribution</h2><p>SunRiser is an aquarium lighting controller associated with LEDaquaristik. Firmware and original interface attribution includes Torsten Raudssus and the SunRiser project. This modern interface is a separate frontend in this workspace, preserving the existing controller protocol.</p><p>The links below leave this local application only when you choose them. No catalogue, analytics, font or vendor service is contacted automatically.</p><div class="external-links"><a href="https://www.ledaquaristik.de/Kontakt/" target="_blank" rel="noopener noreferrer">LEDaquaristik contact (external)</a><a href="https://github.com/LEDaquaristik/sunriser" target="_blank" rel="noopener noreferrer">Original SunRiser project (external)</a><a href="notices.html" target="_blank" rel="noopener">Local third-party notices (new tab)</a></div></section>
</div>
<style>
 .help-page{color:var(--sr-ink);font-size:15px}header{display:block;margin:12px 0 24px}h1{font-size:var(--sr-title);font-weight:600;letter-spacing:-1px;margin:0 0 8px}h2{font-size:20px;margin:0 0 14px}h3{font-size:15px;margin:0 0 10px}p,li,dd{font-size:14px;line-height:1.65;color:var(--sr-muted);max-width:100ch}p{margin:8px 0 16px}a{color:var(--sr-accent)}.guidance-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:48px}.guidance-layout aside{border-left:1px solid var(--sr-line);padding-left:32px}ol{padding-left:24px}li{padding:0 0 16px 4px}li a{font-weight:600}dt{font-size:15px;font-weight:600;margin-top:16px}dd{font-weight:400;margin:6px 0 16px}.configured,.help-page>section{margin-top:32px;padding-top:24px;border-top:1px solid var(--sr-line)}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:24px}.summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px 32px}.summary-grid article{border-bottom:1px solid var(--sr-line);padding:16px 0;min-width:0}.summary-grid p{font-size:13px;overflow-wrap:anywhere}.summary-grid strong{font-size:14px}.warning{color:var(--sr-error)}details{border-bottom:1px solid var(--sr-line)}summary{font-size:16px;font-weight:600;min-height:48px;padding:14px 0;cursor:pointer}details section{padding:0 0 16px}.destination,.external-links a{min-height:44px;display:inline-flex;align-items:center;padding:8px 0}.external-links{display:flex;gap:12px 28px;flex-wrap:wrap}a:focus-visible,summary:focus-visible{outline:3px solid var(--sr-focus);outline-offset:3px}
 @media(max-width:900px){.guidance-layout{grid-template-columns:1fr;gap:20px}.guidance-layout aside{border-left:0;border-top:1px solid var(--sr-line);padding:20px 0 0}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.section-heading{flex-direction:column;align-items:flex-start;gap:0}}
 @media(max-width:500px){.summary-grid{grid-template-columns:1fr}.external-links{display:block}.external-links a{display:flex}h1{font-size:28px}}
</style>
