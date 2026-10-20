<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
  import OverviewLighting from "./ui/OverviewLighting.svelte";
  import {savedDailyPlans,loadDailyPlan,resetSavedDailyPlans} from "./schedules";
  import OperatingState from './ui/OperatingState.svelte';
  let overviewChannel=$state(1),scheduleUnsaved=$state(false);
  let labelsPhase=$state<'idle'|'loading'|'ready'|'error'>('idle');
  let readingState=$state(false),visible=$state(document.visibilityState==='visible');
  import {readChannels,savedChannels} from './channels';
  import ChannelConfiguration from './ChannelConfiguration.svelte';
  import DevicePreferences from './DevicePreferences.svelte';
  import Help from './Help.svelte';
  import Diagnostics from './Diagnostics.svelte';
  import LightingTools from './LightingTools.svelte';
  import ChannelIdentity from './ui/ChannelIdentity.svelte';
  import RawMeter from './ui/RawMeter.svelte';
  import EditorPage from './ui/EditorPage.svelte';
  import DraftBar from './ui/DraftBar.svelte';
  import StateBadge from './ui/StateBadge.svelte';
  import AppShell from "./ui/AppShell.svelte";
  import LightingDashboard from "./LightingDashboard.svelte";
  import ActionButton from "./ui/ActionButton.svelte";
  import { onMount } from "svelte";
  import Recovery from "./Recovery.svelte";
  import SystemSettings from "./SystemSettings.svelte";
  import Schedules from "./Schedules.svelte";
  import Weather from "./Weather.svelte";
  import Sensors from "./Sensors.svelte";
  import {
    invalidateSavedConfiguration,
    getFirmware,
    getState,
    putState,
    getService,
    saveService,
    inRange,
    getHostname,
    putHostname,
    validHostname,
    utc,
    type Firmware,
    type DeviceState,
    type ServiceSettings,
  } from "./api";
  let channelConfiguration = $state<{show:()=>Promise<void>}>();
  let firmware = $state<Firmware>();
  let snapshot = $state<DeviceState>();
  let hostname = $state("");
  let persisted = $state("");
  let loaded = $state(false);
  let busy = $state(false);
  let error = $state("");
  let status = $state("");
  let stale = $state(false);
  let route = $state(location.hash.slice(1) || "index");
  let raw = $state<Record<string, number | undefined>>({});
  let allRaw = $state<number | undefined>(0);
  let serviceSettings = $state<ServiceSettings>();
  let serviceBaseline = $state("");
  let serviceAttempted = $state(false);
  let refreshFailures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let mounted = false;
  let revision = 0;
  const statePage = () => ["index", "channels", "service", "sensors", "weather", "clock", "network", "lighting-tools"].includes(route);
  const stopTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  function schedule() {
    stopTimer();
    if (
      mounted &&
      loaded &&
      !busy &&
      statePage() &&
      document.visibilityState === "visible"
    )
      timer = setTimeout(
        () => void refresh(true),
        Math.min(120000, 30000 * 2 ** Math.min(2, refreshFailures)),
      );
  }
  // One gate serializes timer reads, user reads and writes. No queued write replay.
  function begin() {
    if (busy) return false;
    stopTimer();
    busy = true;
    return true;
  }
  function end() {
    busy = false;
    schedule();
  }
  // An aborted/obsolete read must never replace a newer snapshot.
  async function readState() {
    const ticket = ++revision;
    readingState=true;
    try {
      const next = await getState(firmware!.pwm_count);
      if (mounted && ticket === revision) {
        const reconnecting=stale;
        snapshot = next;
        stale = false;
        refreshFailures = 0;
        if(reconnecting) invalidateConfiguration();
      }
    } finally { readingState=false; }
  }
  function uncertain() {
    stale = true;
    refreshFailures = Math.min(2, refreshFailures + 1);
  }
  function navigate() {
    route = location.hash.slice(1) || "index";
    schedule();
  }
  const serviceValid = $derived(
    !!serviceSettings &&
      inRange(serviceSettings.timeout, 10080) &&
      serviceSettings.channels.every((ch) => inRange(ch.percent, 100) && (!ch.binary || ch.percent === 0 || ch.percent === 100)),
  );
  const serviceDirty = $derived(
    JSON.stringify(serviceSettings) !== serviceBaseline,
  );
  $effect(() => {
    if (loaded && route === "service" && !serviceAttempted && !busy)
      void loadService();
  });
  const identityPage=()=>['index','channels','service','schedules','weather','sensors','lighting-tools'].includes(route);
  function invalidateConfiguration(){
    invalidateSavedConfiguration();resetSavedDailyPlans();savedChannels.set([]);labelsPhase='idle';
  }
  // Bounded lazy reads share the existing gate. Failures stay local and require
  // explicit retry; neither labels nor planning add a recurring poll.
  $effect(()=>{
    if(!loaded||!firmware||busy||stale||!visible)return;
    if(identityPage()&&labelsPhase==='idle')void loadLabels();
    else if(route==='index'&&!$savedDailyPlans[overviewChannel])void readDaily();
  });
  async function loadLabels(refresh=false){
    if(!firmware||!begin())return;
    labelsPhase='loading';
    try{savedChannels.set(await readChannels(firmware.pwm_count,refresh));labelsPhase='ready';}
    catch{labelsPhase='error';}finally{end();}
  }
  async function readDaily(refresh=false){
    if(!firmware||!begin())return;
    const selected=overviewChannel;
    try{await loadDailyPlan(selected,refresh);}catch{/* Per-channel saved-plan error is displayed locally. */}finally{end();}
  }
  const dirty = $derived(hostname !== persisted);
  const valid = $derived(validHostname(hostname));

  async function perform(
    task: () => Promise<void>,
    success: string,
    failure: string,
    pending: string,
  ) {
    if (!begin()) return false;
    error = "";
    status = pending;
    try {
      await task();
      status = success;
      return true;
    } catch {
      error = failure;
      status = "";
      return false;
    } finally {
      end();
    }
  }
  function clearFeedback() {
    error = "";
    status = "";
  }
  async function load() {
    if (!begin()) return;
    error = "";
    status = "Loading device…";
    loaded = false;
    invalidateConfiguration();
    try {
      const info = await getFirmware();
      const initialState = await getState(info.pwm_count);
      const name = await getHostname();
      firmware = info;
      snapshot = initialState;
      hostname = persisted = name;
      raw = Object.fromEntries(
        Array.from({ length: info.pwm_count }, (_, i) => [i + 1, 0]),
      );
      loaded = true;
      stale = false;
      status = "Device loaded";
    } catch {
      error = "Could not load device. Check the connection, then retry.";
      status = "";
    } finally {
      end();
    }
  }
  async function refresh(background = false) {
    if (!firmware || !begin()) return;
    if (!background) {
      error = "";
      status = "Refreshing state…";
    }
    try {
      await readState();
      if (!background) status = "State refreshed";
      if (error.startsWith("State refresh failed")) error = "";
    } catch {
      uncertain();
      error =
        "State refresh failed. The last snapshot is stale. Reconnecting with bounded read-only refresh.";
      if (!background) status = "";
    } finally {
      end();
    }
  }
  async function command(value: {
    pwms?: Record<string, number>;
    service_mode?: number;
    blackout?: number;
    thunder?: number;
    timewarp?: number;
    time?: number;
  }) {
    if (!begin()) return;
    error = "";
    status = "Sending command…";
    try {
      await putState(value);
      await readState();
      status = value.timewarp !== undefined
        ? "Time-lapse command acknowledged; displaying independent controller readback. Physical output is not verified."
        : value.time !== undefined
        ? "Command acknowledged; displaying device readback."
        : value.thunder !== undefined
        ? "Command acknowledged; displaying device readback. Weather effects are not verified."
        : "Command acknowledged; displaying device readback. Outputs may still be fading.";
    } catch {
      uncertain();
      status = "";
      error =
        "Could not confirm command. The device may have applied it. Draft kept; refresh to check. No automatic write retry.";
    } finally {
      end();
    }
  }
  async function applyRaw(channel: number | "all") {
    const value = channel === "all" ? allRaw : raw[channel];
    if (!inRange(value, 1000) || !firmware) return;
    const pwms =
      channel === "all"
        ? Object.fromEntries(
            Array.from({ length: firmware.pwm_count }, (_, i) => [i + 1, value]),
          )
        : { [channel]: value };
    await command({ pwms });
  }
  async function loadService() {
    if (!firmware || !begin()) return;
    serviceAttempted = true;
    error = "";
    status = "Loading service settings…";
    try {
      serviceSettings = await getService(firmware.pwm_count);
      serviceBaseline = JSON.stringify(serviceSettings);
      status = "Service settings loaded";
    } catch {
      error = "Could not load service settings. Retry Reload service settings.";
      status = "";
    } finally {
      end();
    }
  }
  async function saveServiceForm(event: SubmitEvent) {
    event.preventDefault();
    if (
      !firmware ||
      !serviceSettings ||
      !serviceValid ||
      !serviceDirty ||
      !begin()
    )
      return;
    error = "";
    status = "Saving…";
    try {
      await saveService(serviceSettings, firmware);
      serviceBaseline = JSON.stringify(serviceSettings);
      status = "Saved";
    } catch {
      error =
        "Could not confirm save. Draft kept; reload settings to check persistence or explicitly retry Save.";
      status = "";
    } finally {
      end();
    }
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!firmware || !valid || !dirty || !begin()) return;
    error = "";
    status = "Saving…";
    const draft = hostname;
    try {
      await putHostname(draft, firmware);
      const actual = await getHostname();
      if (actual !== draft) throw new Error("Readback mismatch");
      persisted = actual;
      status = "Saved";
    } catch {
      status = "";
      error =
        "Could not confirm save. Your draft is kept. Reload to check the saved value, or explicitly retry Save hostname.";
    } finally {
      end();
    }
  }
  onMount(() => {
    mounted = true;
    void load();
    const visibility=()=>{visible=document.visibilityState==='visible';schedule();};
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted = false;
      revision++;
      stopTimer();
      document.removeEventListener("visibilitychange", visibility);
    };
  });
</script>

<svelte:window onhashchange={navigate} />
<AppShell {route}>
  <main id="main-content" tabindex="-1" aria-busy={busy}>
    <div class="feedback" class:stale>
      <span class="connection-state">{busy?'Operation pending':stale?'Readback stale':loaded?'Readback available':'No readback'}</span>
      <div class="operation-status">{#if status}<span aria-hidden="true">Last operation:</span>{/if}<p role="status" aria-label="Last operation" aria-live="polite">{status}</p></div>
      {#if error}<p role="alert">{error}</p>{/if}
    </div>
    {#if loaded&&identityPage()&&labelsPhase!=='ready'}<div class="label-status" aria-live="polite"><p>{labelsPhase==='error'?'Saved channel labels unavailable. Numbered channels remain usable.':labelsPhase==='loading'?'Loading saved channel labels…':'Channel labels waiting for the current operation.'}</p>{#if labelsPhase==='error'&&route!=='index'}<button class="secondary" disabled={busy} onclick={()=>loadLabels(true)}>Retry channel labels</button>{/if}</div>{/if}
    {#if !loaded}
      {#if route === 'help'}
        <section aria-label="Controller connection" class="help-connection"><p>{busy?'Connecting to controller… Local help is available below.':'Controller unavailable. Local help remains available; reconnect to read configured state.'}</p>{#if !busy}<ActionButton secondary onclick={load}>Retry connection</ActionButton>{/if}</section>
      {:else}
      <section class="connection">
        <div class="connection-mark" aria-hidden="true">◒</div>
        <p class="eyebrow">Device connection</p>
        <h1>{busy ? 'Connecting to SunRiser' : 'Connection unavailable'}</h1>
        <p>{busy ? "Reading device information and saved settings. Your controls will appear when the connection is ready." : "No device readings are available. Check the connection, then retry to load your controls."}</p>
        {#if !busy}<ActionButton onclick={load}>Retry connection</ActionButton>{/if}
      </section>
      {/if}
    {:else if firmware && snapshot}
      {#if route === 'channels' || route === 'service'}
        <LightingDashboard onconfigure={()=>channelConfiguration?.show()} {route} {firmware} {snapshot} {persisted} {stale} {busy} bind:raw bind:allRaw bind:serviceSettings {serviceDirty} {serviceValid} refresh={() => refresh()} {applyRaw} {command} {loadService} {saveServiceForm} onedit={clearFeedback} />
      {:else if route === 'index'}
        <EditorPage>
        <div class="heading">
          <div><h1>Overview</h1></div>
          <div class="overview-heading-actions"><button class="secondary" onclick={() => refresh()} disabled={busy}>Refresh state</button></div>
        </div>
        <OverviewLighting {firmware} {snapshot} hostname={persisted} {stale} {busy} plan={$savedDailyPlans[overviewChannel]} onretry={()=>readDaily(true)} bind:selected={overviewChannel} unsaved={scheduleUnsaved}/>
        <div class="monitor-workspace living-monitor"><section class="overview-outputs" aria-labelledby="channels-title">
          <div class="overview-top"><h2 id="channels-title">Reported channel output</h2><span>Raw counts</span></div>
          <ol class="channels">
            {#each Array.from({ length: firmware.pwm_count }, (_, i) => i + 1) as channel}
              <li data-testid="channel"><button type="button" class="output-select" aria-label={`Inspect channel ${channel} saved schedule`} aria-pressed={overviewChannel===channel} onclick={()=>overviewChannel=channel}><span class="output-name"><ChannelIdentity number={channel}/></span><strong>{snapshot.pwms[String(channel)]} <small>raw</small></strong></button><RawMeter value={snapshot.pwms[String(channel)]} {stale}/></li>
            {/each}
          </ol>
          <p class="meter-key">Reported raw counts, not brightness percentages. Meter reference: 0–1000 raw; + marks higher readback.</p>
          <div class="overview-links"><button class="secondary" disabled={busy} onclick={()=>loadLabels(true)}>{labelsPhase==='error'?'Retry channel labels':'Refresh channel labels'}</button><a href="#channels">Open channel controls <span aria-hidden="true">→</span></a><a href="#schedules">Edit schedules <span aria-hidden="true">→</span></a><a href="#help">Getting started and help <span aria-hidden="true">→</span></a></div>
        </section>
        <OperatingState {snapshot} {stale} loading={readingState}/></div>
        <section class="overview-details" aria-label="Device state">
          <h2>Controller</h2>
          <dl class="facts">

            <div><dt>Firmware</dt><dd data-testid="version">{firmware.version}</dd></div>
            <div><dt>LAN address</dt><dd data-testid="lan">{snapshot.lan_ip}</dd></div>
            <div><dt>Device time (UTC)</dt><dd data-testid="utc">{utc(snapshot.time)}</dd></div>
            <div><dt>Uptime</dt><dd data-testid="uptime">{snapshot.uptime} s</dd></div>
            <div><dt>Wi-Fi capability</dt><dd data-testid="wifi">{firmware.wifi ? 'Available' : 'Not available'}</dd></div>
          </dl>
        </section>
        <details class="reading-details"><summary>Reading details{stale?' · stale':''}</summary>
        <p class:stale data-testid="snapshot">{stale ? 'Last snapshot · stale' : 'Snapshot'} · {utc(snapshot.time)} · refreshes every 30 seconds while visible; failures back off to 120 seconds</p>
        </details>
        </EditorPage>
      {:else if route === 'help' || route === 'lighting-tools' || route === 'diagnostics' || route === 'recovery' || route === 'schedules' || route === 'sensors' || route === 'weather' || route === 'clock' || route === 'network'}
        <!-- The retained editor below owns drafts across navigation. -->
      {:else if route === 'settings'}
        <EditorPage>
        <div class="heading"><div><h1>Settings</h1><p>Controller identity and device preferences.</p></div></div>
        <div class="hostname-workspace"><form class="panel settings hostname-form" onsubmit={save}>
          <h2>Hostname</h2><p class="saved-hostname">Saved hostname<strong>{persisted}</strong></p>
          <label for="device-name">Hostname</label>
          <input id="device-name" name="hostname" type="text" bind:value={hostname} oninput={() => { status = ''; error = ''; }} disabled={busy} aria-describedby="name-help" aria-invalid={!valid} autocomplete="off" spellcheck="false" />
          <p id="name-help">Use 1–63 letters, numbers or hyphens. Start and end with a letter or number.</p>
          <DraftBar feedback={error} {dirty} {busy} disabled={!dirty||!valid} label="Save hostname" scope="" />
        </form><aside class="hostname-guidance"><h2>After changing the hostname</h2><p>A changed network hostname may take effect after device restart. Saving here does not restart the device.</p><p>If access changes, network recovery provides explicit read-only verification and address recovery.</p><a href="#network">Network and connection guidance →</a></aside></div></EditorPage>
      {:else}
        <EditorPage><section class="empty-state"><h1>Page unavailable</h1><p>Choose a destination from Lighting or Device navigation, or open local Help.</p><a href="#index">Return to overview</a></section></EditorPage>
      {/if}
    {/if}
    <Help active={route === 'help'} {busy} {firmware} {perform}/>
    {#if loaded && firmware && snapshot}
      <LightingTools active={route === 'lighting-tools'} {busy} {firmware} {snapshot} {stale} feedback={error} {perform} {command} refresh={()=>refresh()} readback={async()=>{try{await readState();}catch(e){uncertain();throw e;}}} onedit={clearFeedback}/>
      <Diagnostics active={route === 'diagnostics'} {busy} {firmware} {perform}/>
      <Recovery active={route === 'recovery'} {busy} {firmware} {perform} onread={(next, info, name) => { ++revision; snapshot=next; firmware=info; if(hostname===persisted) hostname=name; persisted=name; stale=false; overviewChannel=Math.min(overviewChannel,info.pwm_count); invalidateConfiguration(); }} />
      <SystemSettings feedback={error} active={route === 'clock'} kind="clock" {busy} {firmware} {snapshot} {stale} {perform} {command} refresh={() => refresh()} onedit={clearFeedback} />
      <SystemSettings feedback={error} active={route === 'network'} kind="network" {busy} {firmware} {snapshot} {stale} {perform} {command} refresh={() => refresh()} onedit={clearFeedback} />
    {/if}
    {#if loaded && firmware && snapshot}<Weather feedback={error} active={route === 'weather'} {busy} {firmware} {snapshot} {stale} {perform} {command} refresh={() => refresh()} onedit={clearFeedback} />{/if}
    {#if loaded && firmware && snapshot}<Sensors feedback={error} active={route === 'sensors'} {busy} {firmware} {snapshot} {stale} {perform} refresh={() => refresh()} onedit={clearFeedback} />{/if}
    {#if loaded && firmware}<ChannelConfiguration feedback={error} bind:this={channelConfiguration} active={route === 'channels'} {busy} {firmware} {perform} onedit={clearFeedback} onsaved={(channels)=>{
      if(serviceSettings){
        const accepted=JSON.parse(serviceBaseline) as ServiceSettings;
        serviceSettings.channels.forEach((c,i)=>{
          if(typeof channels[i].binary==='boolean'){
            c.binary=channels[i].binary as boolean;
            accepted.channels[i].binary=c.binary;
            // Metadata is accepted; editable service values remain untouched in
            // both their draft and baseline, including invalid intermediate levels.
          }
        });
        serviceBaseline=JSON.stringify(accepted);
      }
    }}/>{/if}
    {#if loaded && firmware}<DevicePreferences active={route === 'settings'} {busy} {firmware} feedback={error} {perform} onedit={clearFeedback}/>{/if}
    {#if loaded && firmware}<Schedules ondraftview={value=>scheduleUnsaved=value} active={route === 'schedules'} {busy} {firmware} {perform} onedit={clearFeedback} />{/if}
  </main>
</AppShell>

<style>
  .feedback { min-height:32px; padding:0 0 8px; color:var(--sr-muted); display:flex; flex-wrap:wrap; align-items:center; gap:4px 16px; }
  .connection-state { font-size:13px; font-weight:650; letter-spacing:.25px; }
  .connection-state::before { content:""; display:inline-block; width:6px; height:6px; background:currentColor; border-radius:50%; margin-right:8px; }
  .feedback p { margin:0; }
  .operation-status { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 6px; font-size:12px; }
  .feedback [role="status"]:not(:empty)::before { content:""; color:var(--sr-muted); }
  .feedback [role="alert"] { flex-basis:100%; }
  .feedback p { font-size:12px; }
  .feedback [role="alert"] { padding:14px 16px; border-radius:6px; margin:8px 0 20px; font-size:14px; }
  .help-connection { padding:12px 0; color:var(--sr-muted); font-size:14px; }
  .connection { padding:48px 0; max-width:520px; }
  .connection h1 { font-size:28px; letter-spacing:-.6px; }
  .connection p { font-size:14px; line-height:1.7; color:var(--sr-muted); margin-bottom:20px; }
  .connection-mark { font-size:48px; color:var(--sr-teal); margin-bottom:24px; }
  main:focus { outline:none; }
  .monitor-workspace { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:40px; align-items:start; margin-top:28px; }
  .overview-top { display:flex; justify-content:space-between; gap:16px; align-items:baseline; margin-bottom:12px; }
  .overview-top h2 { margin:0; font-size:18px; } .overview-top>span { font-size:13px; color:var(--sr-muted); }
  .overview-outputs :global(.channels) { grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 28px; margin:0; }
  .overview-outputs :global(.channels li) { display:grid; grid-template-columns:minmax(86px,1.3fr) minmax(28px,1fr) 88px; align-items:center; gap:12px; padding:22px 0; }
  .overview-outputs :global(.raw-meter) { margin:0; } .overview-outputs :global(.channels strong) { text-align:right; color:var(--sr-ink); font:500 23px var(--sr-mono); letter-spacing:-1px; }
  .overview-outputs small { font:400 11px var(--sr-font); letter-spacing:0; color:var(--sr-muted); }
  .overview-outputs :global(.meter-key) { font-size:12px; margin:12px 0 0; }
  .overview-links { display:flex; flex-wrap:wrap; gap:8px 24px; }
  .overview-links a { min-height:44px; display:flex; align-items:center; gap:12px; font-size:14px; font-weight:600; }
  .overview-details { margin-top:28px; padding-top:20px; border-top:1px solid var(--sr-line); }
  .overview-details :global(h2) { font-size:15px; }
  .overview-details :global(.facts) { grid-template-columns:1fr 1fr 1.7fr .7fr 1fr; gap:16px; }
  .overview-details :global(dd) { font-size:13px; font-weight:500; }
  @media(max-width:1200px) { .monitor-workspace { grid-template-columns:minmax(0,1fr) 250px; gap:24px; } .overview-outputs :global(.channels) { grid-template-columns:1fr; } }
  @media(max-width:800px) { .monitor-workspace { grid-template-columns:1fr; gap:24px; margin-top:20px; } .overview-outputs :global(.channels li) { padding:15px 0; } .overview-details :global(.facts) { grid-template-columns:1fr 1fr; } .overview-details :global(.facts > div:nth-child(3)) { grid-column:1/-1; } }
  .hostname-workspace { display:grid; grid-template-columns:minmax(0,560px) minmax(0,360px); gap:48px; align-items:start; margin-top:28px; }
  .hostname-workspace :global(form.hostname-form) { background:var(--sr-surface); padding:24px; border-radius:var(--sr-radius); margin:0; }
  .saved-hostname strong { display:block; font-size:26px; color:var(--sr-ink); overflow-wrap:anywhere; margin:8px 0 24px; }
  .hostname-workspace :global(.draft-bar) { background:transparent; position:static; border-top:1px solid var(--sr-line); margin:24px 0 0; padding-top:20px; }
  .hostname-guidance { padding:20px 24px; border-left:2px solid var(--sr-line); background:var(--sr-surface); border-radius:var(--sr-radius); }
  .hostname-guidance h2 { font-size:18px; } .hostname-guidance a { display:flex; align-items:center; min-height:44px; font-size:14px; }
  @media(max-width:800px) { .hostname-workspace { grid-template-columns:1fr; gap:24px; margin-top:20px; } .hostname-workspace :global(form.hostname-form) { padding:20px 16px; } }


  .overview-heading-actions{display:flex;align-items:center;gap:20px}
  .living-monitor{display:block}.living-monitor .overview-outputs{min-width:0}
  .label-status{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--sr-muted);margin-bottom:8px}.label-status p{margin:0}
</style>
