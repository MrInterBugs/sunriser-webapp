<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
  import ChannelIdentity from './ui/ChannelIdentity.svelte';
  import RawMeter from './ui/RawMeter.svelte';
  import {inRange, utc, type Firmware, type DeviceState, type ServiceSettings} from './api';
  import ActionButton from './ui/ActionButton.svelte';
  import StateBadge from './ui/StateBadge.svelte';
  import LevelControl from './ui/LevelControl.svelte';
  let {onconfigure,route,firmware,snapshot,persisted,stale,busy,raw=$bindable(),allRaw=$bindable(),serviceSettings=$bindable(),serviceDirty,serviceValid,refresh,applyRaw,command,loadService,saveServiceForm,onedit}: {
    onconfigure:()=>void; route:string; firmware:Firmware; snapshot:DeviceState; persisted:string; stale:boolean; busy:boolean;
    raw:Record<string,number|undefined>; allRaw:number|undefined; serviceSettings:ServiceSettings|undefined;
    serviceDirty:boolean; serviceValid:boolean; refresh:()=>void; applyRaw:(channel:number|'all')=>void;
    command:(value:{service_mode?:number;blackout?:number})=>void; loadService:()=>void; saveServiceForm:(event:SubmitEvent)=>void; onedit:()=>void;
  }=$props();
  const service=$derived(route==='service');
  const active=$derived(snapshot.service_mode>0);
</script>
<div class="lighting">
  <div class="page-heading">
    <div><h1>{service?'Service':'Channels'}</h1><p class="identity"><span data-testid="model">{firmware.sunriser}</span><span aria-hidden="true"> / </span>{persisted}</p></div>
    <div class="actions">{#if !service}<ActionButton secondary onclick={onconfigure} disabled={busy}>Configure channels</ActionButton>{/if}<ActionButton secondary onclick={refresh} disabled={busy}>Refresh state</ActionButton></div>
  </div>
  {#if service}
    <div class="service-workflow"><section class="service-command" aria-label="Service controls">
      <div class="service-summary"><div><p class="kicker">Reported service state{stale ? ' · stale' : ''}</p><strong data-testid="service" class="service-state">{active?(snapshot.blackout?'Blackout active':'Active'):'Off'}</strong></div><div class="actions"><ActionButton onclick={()=>command({service_mode:1})} disabled={busy}>Start service</ActionButton><ActionButton secondary onclick={()=>command({service_mode:0})} disabled={busy}>Stop service</ActionButton></div></div>
      <p>Start fades outputs to your saved service settings. Stop returns to normal planning and also ends an active blackout.</p><a class="service-output-link" href="#channels">Inspect reported channel output →</a>
      <div class="blackout-controls"><h3>Blackout</h3><p>Turn off participating outputs, including binary channels. Ignored channels continue planning. Blackout uses the saved service timeout. Resume returns to normal planning only when blackout is active; it does not stop service mode.</p><div class="actions"><ActionButton secondary onclick={()=>command({blackout:1})} disabled={busy || typeof snapshot.blackout !== 'boolean'}>Start blackout</ActionButton><ActionButton secondary onclick={()=>command({blackout:0})} disabled={busy || typeof snapshot.blackout !== 'boolean'}>Resume from blackout</ActionButton></div>{#if typeof snapshot.blackout !== 'boolean'}<p>Blackout state is unavailable from this firmware; controls are disabled.</p>{/if}</div>
      <details><summary>Fading and command behaviour</summary><p>Off can still mean fading out. A Start during fade-out may be ignored; wait for outputs to settle before explicitly starting again. Save settings before starting. Commands are never retried automatically.</p></details>
    </section>
    <section aria-labelledby="service-settings-title" class="service-settings">
      <div class="section-title"><div><h2 id="service-settings-title">Service settings</h2><p>Set the light levels to use while you care for your aquarium.</p></div>{#if serviceSettings}<StateBadge tone={serviceDirty?'draft':'neutral'}>{serviceDirty?'Unsaved changes':'Settings saved'}</StateBadge>{/if}</div>
      {#if serviceSettings}
        <form onsubmit={saveServiceForm} oninput={onedit}>
          <div class="service-configuration"><div class="timeout"><div><label for="service-timeout">Timeout minutes</label><p id="timeout-help">0 means no automatic end. Maximum 10080 minutes (one week).</p></div><input id="service-timeout" type="number" min="0" max="10080" step="1" bind:value={serviceSettings.timeout} disabled={busy} aria-describedby="timeout-help" aria-invalid={!inRange(serviceSettings.timeout,10080)} /></div>
          <p class="footnote">Readback meters: 0–1000 raw reference; + marks higher values. Service settings below use percent.</p>

          </div><div class="service-list">
            {#each serviceSettings.channels as channel,i}
              <fieldset class="service-row" disabled={busy} data-testid="channel"><legend class="sr-only">Channel {i+1}</legend>
                <div class="channel-identity"><div><h3><ChannelIdentity number={i+1}/></h3><p class:stale><strong>{snapshot.pwms[String(i+1)]}</strong> raw <span>· {stale?'stale':'reported'}</span></p><RawMeter value={snapshot.pwms[String(i+1)]} {stale}/></div></div>
                <div class="service-inputs"><span class="command-label">Service setting · %</span>
                  {#if channel.binary}<div class="binary"><label for={`service-${i}`}>Channel {i+1} service percent</label><select id={`service-${i}`} bind:value={channel.percent} disabled={channel.ignore}>{#if channel.percent!==0 && channel.percent!==100}<option value={channel.percent} disabled>{channel.percent ?? 'Invalid'}% draft — choose Off or On</option>{/if}<option value={0}>Off (0%)</option><option value={100}>On (100%)</option></select></div>
                  {:else}<LevelControl id={`service-${i}`} label={`Channel ${i+1} service percent`} bind:value={channel.percent} max={100} unit="%" disabled={busy || channel.ignore}/>{/if}
                  <label class="ignore"><input type="checkbox" bind:checked={channel.ignore}/><span>Ignore channel {i+1} during service</span></label>
                </div>
              </fieldset>
            {/each}
          </div>
          {#if !serviceValid}<p role="alert">Use whole percentages from 0 to 100; binary channels must be 0 or 100. Check your retained draft after a channel-type change.</p>{/if}
          <div class="save-bar"><div><strong>{serviceDirty?'Save your changes':'Ready for service'}</strong><p>{serviceDirty?'Save to use these levels the next time service starts.':'Edit levels above, then save before starting service.'}</p></div><div class="actions"><ActionButton secondary onclick={loadService} disabled={busy}>Reload service settings</ActionButton><ActionButton type="submit" disabled={busy || !serviceValid || !serviceDirty}>Save service settings</ActionButton></div></div>
          <p class="footnote">Reload replaces unsaved service edits. Saving settings does not start service mode.</p>
        </form>
      {:else}
        <div class="empty"><h3>{busy?'Reading service settings…':'Service settings unavailable'}</h3><p>{busy?'Your saved levels will appear here.':'No levels have been loaded. Check the connection and reload to try again.'}</p><ActionButton secondary onclick={loadService} disabled={busy}>Reload service settings</ActionButton></div>
      {/if}
    </section></div>
  {:else}
    <div class="section-title"><div><p>{firmware.pwm_count} outputs · Apply sends the command draft. Reported output updates independently.</p></div><StateBadge tone={active?'active':'neutral'}>Service: <span data-testid="service">{active?(snapshot.blackout?'Blackout active':'Active'):'Off'}</span></StateBadge></div>

    <ol class="channel-list">
      {#each Array.from({length:firmware.pwm_count},(_,i)=>i+1) as channel}
        <li data-testid="channel" class="channel-row">
          <div class="channel-identity"><div><h3><ChannelIdentity number={channel}/></h3><p class:stale><strong>{snapshot.pwms[String(channel)]}</strong> raw <span>· {stale?'stale':'reported'}</span></p><RawMeter value={snapshot.pwms[String(channel)]} {stale}/></div></div>
          <div class="command-inputs"><span class="command-label">Local command draft · raw</span><LevelControl id={`raw-${channel}`} label={`Channel ${channel} raw`} bind:value={raw[channel]} max={1000} disabled={busy}/><ActionButton secondary label={`Apply channel ${channel}`} onclick={()=>applyRaw(channel)} disabled={busy || !inRange(raw[channel],1000)}>Apply</ActionButton></div>
        </li>
      {/each}
    </ol>
    <div class="all-channels"><div><h3>All channels</h3><p>One command to all {firmware.pwm_count} outputs.</p></div><div class="command-inputs"><span class="command-label">Local command draft · raw</span><LevelControl id="raw-all" label="All channels raw" bind:value={allRaw} max={1000} disabled={busy}/><ActionButton label="Apply all channels" onclick={()=>applyRaw('all')} disabled={busy || !inRange(allRaw,1000)}>Apply all</ActionButton></div></div>
    <p class="footnote">Raw values are not brightness percentages. Meter reference 0–1000 raw; + marks higher readback.</p>
    <p><a href="#lighting-tools">Minimum output, time-lapse and expert dimming →</a></p><details class="behaviour"><summary>How raw commands affect your lighting</summary><p>Planning usually resumes after about a minute. Fixed-value channels retain changes, including after restart. Raw tests do not stop service mode. Outputs may still be fading after a command; binary outputs can report 1024 raw.</p></details>
  {/if}
  <details class="device-details"><summary>Device details{stale?' · stale':''} <span>Firmware {firmware.version} · {firmware.pwm_count} channels</span></summary>  <div class="readback" class:uncertain={stale}>
    <div class="readback-top"><span class="snapshot" data-testid="snapshot">{stale?'Last snapshot · stale':'Snapshot'} · {utc(snapshot.time)}</span><StateBadge tone={stale?'draft':'neutral'}>{stale?'Check connection':'Device readback'}</StateBadge></div>
    <p>Refreshes every 30 seconds while visible; failures back off to 120 seconds.</p>
  </div>
<dl><div><dt>Firmware</dt><dd data-testid="version">{firmware.version}</dd></div><div><dt>LAN address</dt><dd data-testid="lan">{snapshot.lan_ip}</dd></div><div><dt>Device time (UTC)</dt><dd data-testid="utc">{utc(snapshot.time)}</dd></div><div><dt>Uptime</dt><dd data-testid="uptime">{snapshot.uptime} s</dd></div><div><dt>Wi-Fi capability</dt><dd data-testid="wifi">{firmware.wifi?'Available':'Not available'}</dd></div></dl></details>
</div>
<style>
  .blackout-controls { border-top:1px solid var(--sr-line); padding-top:16px; margin-top:16px; }
  .blackout-controls .actions { margin-top:12px; }
  .lighting { font-size:15px; color:var(--sr-ink); }
  .lighting p { font-size:13px; color:var(--sr-muted); margin:6px 0 0; line-height:1.6; }
  .page-heading { display:flex; align-items:center; justify-content:space-between; gap:20px; margin:20px 0 16px; }
  .lighting .kicker { font-size:13px; letter-spacing:0; font-weight:500; margin:0 0 6px; }
  h1 { font-size:var(--sr-title); letter-spacing:-1.2px; line-height:1.25; margin:0 0 8px; font-weight:600; }
  h2 { font-size:18px; letter-spacing:-.3px; font-weight:650; margin:0; }
  h3 { font-size:14px; font-weight:650; margin:0; line-height:1.5; }
  .identity { overflow-wrap:anywhere; }
  .identity > span[aria-hidden] { margin:0 6px; }
  .readback { padding:10px 0; }
  .readback-top { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .snapshot { font-size:12px; color:var(--sr-muted); font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
  .readback p { font-size:11px; }
  .readback.uncertain { border-color:var(--sr-control-line); }
  .readback.uncertain .snapshot { color:var(--sr-amber); font-weight:650; }
  .section-title { display:flex; align-items:center; justify-content:space-between; gap:16px; margin:0 0 20px; }
  .channel-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 24px; list-style:none; padding:0; margin:0; }
  .channel-row { min-width:0; display:grid; gap:8px; padding:12px 16px; border:1px solid var(--sr-line); border-radius:var(--sr-radius); background:var(--sr-surface); }
  .channel-identity { display:flex; align-items:center; gap:14px; min-width:0; }
  .channel-identity > div { flex:1; min-width:0; display:grid; grid-template-columns:1fr auto; align-items:baseline; gap:0 12px; }
  .channel-identity :global(.raw-meter) { grid-column:1/-1; margin:6px 0 0; }
  .channel-identity p { font-size:13px; font-variant-numeric:tabular-nums; color:var(--sr-ink); margin:2px 0 0; }
  .channel-identity p strong { font:500 23px var(--sr-mono); letter-spacing:-.8px; color:var(--sr-accent); }
  .channel-identity p span { color:var(--sr-muted); font-size:11px; }
  .command-inputs { display:grid; grid-template-columns:minmax(0,1fr) 76px; align-items:center; gap:10px; min-width:0; }
  .command-label { display:block; grid-column:1/-1; font-size:12px; color:var(--sr-muted); margin:0 0 -6px; }
  .all-channels .command-inputs { grid-template-columns:minmax(0,1fr) 100px; }
  .all-channels { display:grid; grid-template-columns:220px minmax(0,1fr); gap:24px; padding:20px 16px; background:var(--sr-soft); border-radius:var(--sr-radius); margin-top:20px; }
  .lighting .footnote { font-size:12px; margin-top:12px; }
  details { font-size:13px; }
  summary { cursor:pointer; min-height:44px; padding:12px 0; color:var(--sr-teal); }
  summary:focus-visible { outline:3px solid var(--sr-focus); outline-offset:3px; }
  .behaviour { margin-top:8px; }
  .device-details { margin-top:28px; border-top:1px solid var(--sr-line); padding-top:4px; }
  .device-details summary { color:var(--sr-ink); }
  .device-details summary span { margin-left:12px; color:var(--sr-muted); font-size:12px; }
  dl { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px; margin:16px 0; }
  dt { color:var(--sr-muted); } dd { font-size:13px; }
  .service-output-link { display:flex; align-items:center; min-height:44px; font-size:13px; margin-top:8px; }
  .service-configuration { background:var(--sr-surface); border:1px solid var(--sr-line); border-radius:var(--sr-radius); padding:16px 20px; margin-bottom:12px; }
  .service-workflow { display:grid; grid-template-columns:280px minmax(0,1fr); gap:32px; align-items:start; }
  .service-settings { min-width:0; }
  .service-command { position:sticky; top:20px; border:1px solid var(--sr-line); border-radius:var(--sr-radius); background:var(--sr-surface); padding:20px; margin-bottom:24px; }
  .service-summary { display:flex; flex-direction:column; gap:20px; align-items:flex-start; }
  .service-state { font-size:32px; font-weight:500; color:var(--sr-accent); }
  .actions { display:flex; gap:10px; flex-wrap:wrap; }
  .timeout { display:flex; justify-content:space-between; gap:24px; align-items:center; padding:0 0 16px; margin-bottom:4px; }
  .timeout label { font-size:14px; font-weight:600; }
  .timeout input { width:112px; flex-shrink:0; min-height:44px; border:1px solid var(--sr-control-line); border-radius:var(--sr-radius); font-size:15px; padding:8px; font-variant-numeric:tabular-nums; }
  .service-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 24px; }
  .service-row { border:0; border-bottom:1px solid var(--sr-line); border-radius:0; margin:0; min-width:0; padding:12px 0; display:grid; gap:8px; align-content:start; }
  .service-inputs { min-width:0; }
  .service-inputs>.command-label { margin:0 0 6px; }
  .ignore { display:flex; align-items:center; gap:10px; min-height:44px; margin:4px 0 0; font-size:12px; color:var(--sr-muted); cursor:pointer; }
  .ignore input { width:20px; height:20px; margin:0; accent-color:var(--sr-teal); }
  .binary { display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:44px; }
  .binary label { margin:0; font-size:12px; color:var(--sr-muted); }
  .binary select { width:146px; min-height:44px; border:1px solid var(--sr-control-line); border-radius:var(--sr-radius); color:var(--sr-ink); background:var(--sr-input); font-size:14px; }
  .save-bar { padding:16px; background:var(--sr-soft); border-radius:var(--sr-radius); margin-top:24px; display:flex; justify-content:space-between; align-items:center; gap:24px; }
  .save-bar strong { font-size:14px; }
  .empty { padding:24px; border:1px dashed var(--sr-control-line); border-radius:var(--sr-radius); }
  .empty p { margin-bottom:16px; }
  input:focus-visible,select:focus-visible { outline:3px solid var(--sr-focus); outline-offset:3px; }
  .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
  @media(max-width:1200px) { .service-list { grid-template-columns:1fr; } }
  @media(max-width:1100px) { .service-workflow { grid-template-columns:1fr; gap:20px; } .service-command { position:static; margin:0; } .service-summary { flex-direction:row; align-items:center; } .service-list { grid-template-columns:repeat(2,minmax(0,1fr)); } .save-bar { align-items:flex-start; flex-direction:column; } }
  @media(max-width:800px) { .channel-list,.service-list { grid-template-columns:1fr; } .all-channels { grid-template-columns:1fr; gap:12px; } }
  @media(max-width:600px) {
    .page-heading { align-items:flex-start; flex-direction:column; gap:16px; margin:8px 0 20px; }
    h1 { font-size:26px; }
    .readback-top { align-items:flex-start; flex-direction:column; gap:8px; }
    .section-title { align-items:flex-start; flex-direction:column; gap:12px; }
    .channel-row { padding:14px 12px; } .command-inputs { gap:8px; grid-template-columns:minmax(0,1fr) 76px; }
    .all-channels { padding:16px; }
    .all-channels .command-inputs { grid-template-columns:minmax(0,1fr); }
    .service-command { padding:18px; }
    .service-summary { display:grid; grid-template-columns:1fr 1fr; align-items:center; gap:12px; } .service-summary .actions { display:grid; gap:8px; }
    .service-command .actions { width:100%; }
    .timeout { align-items:flex-start; gap:12px; }
    .timeout p { font-size:12px; }
    .timeout input { width:92px; }
    .save-bar { padding:16px; gap:16px; }
    .save-bar .actions { flex-direction:column-reverse; width:100%; }
    .device-details summary span { display:block; margin:4px 0 0 16px; }
    dl { grid-template-columns:1fr 1fr; }
  }
  @media(min-width:360px) and (max-width:600px) { .page-heading { display:grid; grid-template-columns:minmax(0,1fr) 116px; align-items:center; gap:12px; } }
  .channel-row:focus-within,.service-row:focus-within { background:var(--sr-surface); }
</style>
