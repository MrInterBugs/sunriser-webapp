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
  import {PWM_RAW_MAX} from "./pwm";
  import {preferredReportedAddress} from './network-address';
  import OverviewLighting from "./ui/OverviewLighting.svelte";
  import {savedDailyPlans,loadDailyPlan,resetSavedDailyPlans} from "./schedules";
  import {configurationState,configurationRevision,configurationCurrent,configurationChanged,configurationVerified,configurationReconnected,configurationConnection} from './configuration-state';
  import OperatingState from './ui/OperatingState.svelte';
  let overviewChannel=$state(1),scheduleUnsaved=$state(false);
  let labelsPhase=$state<'idle'|'loading'|'ready'|'error'>('idle');
  let hostnameStale=$state(false);
  let readingState=$state(false),visible=$state(document.visibilityState==='visible');
  import {readChannels,savedChannels,channelLabel,listedChannels,showUnusedChannels} from './channels';
  import UnusedChannels from './ui/UnusedChannels.svelte';
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
  import { onMount,untrack } from "svelte";
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
  const reportedAddress=$derived(snapshot&&firmware?preferredReportedAddress(snapshot,firmware.wifi):undefined);
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
  let serviceRevision=$state(configurationRevision()),hostnameRevision=$state(configurationRevision());
  const serviceReconciled=$derived(!$configurationState.recovery&&serviceRevision===$configurationState.revision);
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
        if(reconnecting){
          configurationReconnected();invalidateConfiguration();hostnameStale=true;
          if(!$configurationState.recovery){
            try{const name=await getHostname();if(hostname===persisted){hostname=name;hostnameRevision=configurationRevision();}persisted=name;hostnameStale=false;}
            catch{/* State is valid; saved identity stays explicitly last-loaded. */}
          }
        }
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
    if (loaded && route === "service" && !serviceAttempted && !busy && !$configurationState.recovery)
      void loadService();
  });
  const identityPage=()=>['index',"channels",'service','schedules',"weather",'sensors','lighting-tools'].includes(route);
  // A successful editor Retry/Reload can also provide the shared identities.
  // Only a new saved-map publication clears a previous label-load error.
  $effect(()=>{const channels=$savedChannels;if(channels.length===firmware?.pwm_count&&!$configurationState.recovery)untrack(()=>{if(labelsPhase!=='loading')labelsPhase='ready';});});
  function invalidateConfiguration(){
    invalidateSavedConfiguration();resetSavedDailyPlans();savedChannels.set([]);labelsPhase='idle';
  }
  // Bounded lazy reads share the existing gate. Failures stay local and require
  // explicit retry; neither labels nor planning add a recurring poll.
  $effect(()=>{
    if(!loaded||!firmware||busy||stale||!visible||$configurationState.recovery)return;
    if(identityPage()&&labelsPhase==='idle')void loadLabels();
    else if(route==='index'&&!$savedDailyPlans[overviewChannel])void readDaily();
  });
  function recoveryChanged(outcome:'acknowledged'|'uncertain'){configurationChanged(outcome);invalidateConfiguration();}
  async function loadLabels(refresh=false){
    if(!firmware||$configurationState.recovery||!begin())return;
    labelsPhase='loading';
    try{savedChannels.set(await readChannels(firmware.pwm_count,refresh));labelsPhase='ready';}
    catch{labelsPhase='error';}finally{end();}
  }
  async function readDaily(refresh=false){
    if(!firmware||$configurationState.recovery||!begin())return;
    const selected=overviewChannel;
    try{await loadDailyPlan(selected,refresh);}catch{/* Per-channel saved-plan error is displayed locally. */}finally{end();}
  }
  // Unused channels leave the Overview unless they are currently lit.
  const overviewListed=$derived(firmware?listedChannels($savedChannels,firmware.pwm_count,$showUnusedChannels,n=>Number(snapshot?.pwms[String(n)])>0):[]);
  $effect(()=>{const listed=overviewListed;if(listed.length&&!listed.includes(overviewChannel))untrack(()=>overviewChannel=listed[0]);});
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
  async function reloadHostname(){
    await perform(async()=>{const name=await getHostname();hostname=persisted=name;hostnameStale=false;hostnameRevision=configurationRevision();},source("app.hostnameLoadedDraftReplaced_b7d3e"),source("app.couldNotReloadHostnameDraftKept_db9b1"),source("app.readingSavedHostname_bb39a"));
  }
  async function load() {
    if (!begin()) return;
    error = "";
    status = source("app.loadingDevice_f8d0a");
    loaded = false;
    invalidateConfiguration();
    try {
      const info = await getFirmware();
      const initialState = await getState(info.pwm_count);
      const name = await getHostname();
      firmware = info;
      snapshot = initialState;
      hostname = persisted = name;
      hostnameStale=false;
      raw = Object.fromEntries(
        Array.from({ length: info.pwm_count }, (_, i) => [i + 1, 0]),
      );
      loaded = true;
      stale = false;
      hostnameRevision=configurationRevision();
      status = source("app.deviceLoaded_eb386");
    } catch {
      error = source("app.couldNotLoadDeviceCheckTheConnectionThenRetry_a39ae");
      status = "";
    } finally {
      end();
    }
  }
  async function refresh(background = false) {
    if (!firmware || !begin()) return;
    if (!background) {
      error = "";
      status = source("app.refreshingState_66f03");
    }
    try {
      await readState();
      if (!background) status = source("app.stateRefreshed_0e050");
      if (error.startsWith(source("app.stateRefreshFailed_7ccca"))) error = "";
    } catch {
      uncertain();
      error =
        source("app.stateRefreshFailedTheLastSnapshotIsStaleReconnecting_d1a6a");
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
    status = source("app.sendingCommand_49557");
    try {
      await putState(value);
      await readState();
      status = value.timewarp !== undefined
        ? source("app.timeLapseCommandAcknowledgedDisplayingIndependentControllerReadbackPhysical_87775")
        : value.time !== undefined
        ? source("app.commandAcknowledgedDisplayingDeviceReadback_263df")
        : value.thunder !== undefined
        ? source("app.commandAcknowledgedDisplayingDeviceReadbackWeatherEffectsAreNot_02d8e")
        : source("app.commandAcknowledgedDisplayingDeviceReadbackOutputsMayStillBe_b94e1");
    } catch {
      uncertain();
      status = "";
      error =
        source("app.couldNotConfirmCommandTheDeviceMayHaveApplied_8fe0f");
    } finally {
      end();
    }
  }
  async function applyRaw(channel: number | "all") {
    const value = channel === "all" ? allRaw : raw[channel];
    if (!inRange(value, PWM_RAW_MAX) || !firmware) return;
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
    status = source("app.loadingServiceSettings_04eec");
    try {
      serviceSettings = await getService(firmware.pwm_count);
      serviceBaseline = JSON.stringify(serviceSettings);
      serviceRevision=configurationRevision();
      status = source("app.serviceSettingsLoaded_aa5d1");
    } catch {
      error = source("app.couldNotLoadServiceSettingsRetryReloadServiceSettings_62d50");
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
      !configurationCurrent(serviceRevision) ||
      !begin()
    )
      return;
    error = "";
    status = source("app.saving_56a22");
    try {
      await saveService(serviceSettings, firmware);
      serviceBaseline = JSON.stringify(serviceSettings);
      status = source("app.saved_c0ae8");
    } catch {
      error =
        source("app.couldNotConfirmSaveDraftKeptReloadSettingsTo_9484c");
      status = "";
    } finally {
      end();
    }
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!firmware || !valid || !dirty || !configurationCurrent(hostnameRevision) || !begin()) return;
    error = "";
    status = source("app.saving_56a22");
    const draft = hostname;
    try {
      await putHostname(draft, firmware);
      const actual = await getHostname();
      if (actual !== draft) throw new Error(source("app.readbackMismatch_2cf0d"));
      persisted = actual;
      status = source("app.saved_c0ae8");
    } catch {
      status = "";
      error =
        source("app.couldNotConfirmSaveYourDraftIsKeptReload_bbbe1");
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
      <span class="connection-state">{busy?$t("app.operationPending_c929e"):stale?$t("app.readbackStale_e56ed"):loaded?$t("app.readbackAvailable_465ca"):$t("app.noReadback_429db")}</span>
      <div class="operation-status">{#if status}<span aria-hidden="true">{$t("app.lastOperation_ab986")}</span>{/if}<p role="status" aria-label={$t("app.lastOperation_961a2")} aria-live="polite">{$renderText(status)}</p></div>
      {#if error}<p role="alert">{$renderText(error)}</p>{/if}
    </div>
    {#if loaded&&$configurationState.recovery}<div class="configuration-recovery" aria-live="polite"><strong>{$configurationState.recovery==='acknowledged'?$t("app.configurationChangeAcknowledgedVerificationRequired_defa1"):$t("app.configurationOutcomeUncertain_d08a6")}</strong><p>{$t("app.savedLabelsAndPlanningAreNotVerifiedRetainedEditor_d87f3")} <a href="#recovery">{$t("app.checkDeviceReadbackInRecovery_3826c")}</a></p></div>{/if}
    {#if loaded&&$configurationConnection>0&&!$configurationState.recovery}<p class="reconnect-notice" role="note">{$t("app.deviceReconnectedEditorsRetainTheirLastLoadedConfigurationSnapshots_9083c")}</p>{/if}
    {#if loaded&&identityPage()&&labelsPhase!=='ready'&&!$configurationState.recovery}<div class="label-status" aria-live="polite"><p>{labelsPhase==='error'?$t("app.savedChannelLabelsUnavailableNumberedChannelsRemainUsable_27ac9"):labelsPhase==='loading'?$t("app.loadingSavedChannelLabels_80d2e"):$t("app.channelLabelsWaitingForTheCurrentOperation_4325c")}</p>{#if labelsPhase==='error'}<button class="secondary" disabled={busy} onclick={()=>loadLabels(true)}>{$t("app.retryChannelLabels_9f856")}</button>{/if}</div>{/if}
    {#if !loaded}
      {#if route === 'help'}
        <section aria-label={$t("app.controllerConnection_dddeb")} class="help-connection"><p>{busy?$t("app.connectingToControllerLocalHelpIsAvailableBelow_38750"):$t("app.controllerUnavailableLocalHelpRemainsAvailableReconnectToRead_b81d3")}</p>{#if !busy}<ActionButton secondary onclick={load}>{$t("app.retryConnection_a3512")}</ActionButton>{/if}</section>
      {:else}
      <section class="connection">
        <div class="connection-mark" aria-hidden="true">◒</div>
        <p class="eyebrow">{$t("app.deviceConnection_d8f7f")}</p>
        <h1>{busy ? $t("app.connectingToSunRiser_aae6d") : $t("app.connectionUnavailable_ff33d")}</h1>
        <p>{busy ? $t("app.readingDeviceInformationAndSavedSettingsYourControlsWill_a5c3f") : $t("app.noDeviceReadingsAreAvailableCheckTheConnectionThen_6b8a4")}</p>
        {#if !busy}<ActionButton onclick={load}>{$t("app.retryConnection_a3512")}</ActionButton>{/if}
      </section>
      {/if}
    {:else if firmware && snapshot}
      {#if route === "channels" || route === 'service'}
        <LightingDashboard onconfigure={()=>channelConfiguration?.show()} {serviceRevision} {serviceReconciled} {route} {firmware} {snapshot} {persisted} {stale} {busy} bind:raw bind:allRaw bind:serviceSettings {serviceDirty} {serviceValid} refresh={() => refresh()} {applyRaw} {command} {loadService} {saveServiceForm} onedit={clearFeedback} />
      {:else if route === 'index'}
        <EditorPage>
        <div class="heading">
          <div><h1>{$t("app.overview_0efc2")}</h1></div>
          <div class="overview-heading-actions"><button class="secondary" onclick={() => refresh()} disabled={busy}>{$t("app.refreshState_0a7bf")}</button></div>
        </div>
        <OverviewLighting {firmware} {snapshot} hostname={persisted} {hostnameStale} {stale} {busy} unverified={!!$configurationState.recovery} plan={$savedDailyPlans[overviewChannel]} onretry={()=>readDaily(true)} bind:selected={overviewChannel} channels={overviewListed} unsaved={scheduleUnsaved}/>
        <div class="monitor-workspace living-monitor"><section class="overview-outputs" aria-labelledby="channels-title">
          <div class="overview-top"><h2 id="channels-title">{$t("app.reportedChannelOutput_656b2")}</h2><span>{$t("app.rawCounts_d9b8b")}</span></div>
          <ol class="channels">
            {#each overviewListed as channel}
              <li data-testid="channel"><button type="button" class="output-select" aria-label={$t("app.inspectV0ChannelV1SavedSchedule_327d9",{v0: channelLabel($savedChannels[channel-1],$language)?channelLabel($savedChannels[channel-1],$language)+' · ':'',v1: channel})} aria-pressed={overviewChannel===channel} onclick={()=>overviewChannel=channel}><span class="output-name"><ChannelIdentity number={channel}/></span><strong>{snapshot.pwms[String(channel)]} <small>{$t("app.raw_ce158")}</small></strong></button><RawMeter value={snapshot.pwms[String(channel)]} {stale}/></li>
            {/each}
          </ol>
          <div class="output-footnotes"><p class="meter-key">{$t("app.reportedRawCountsNotBrightnessPercentagesMeterReference0_26f24")}</p><UnusedChannels listed={overviewListed} count={firmware.pwm_count}/></div>
          <div class="overview-links"><a href="#channels">{$t("app.openChannelControls_7799e")} <span aria-hidden="true">→</span></a><a href="#schedules">{$t("app.editSchedules_8a533")} <span aria-hidden="true">→</span></a><a href="#help">{$t("app.gettingStartedAndHelp_915dc")} <span aria-hidden="true">→</span></a></div>
        </section>
        <OperatingState {snapshot} {stale} loading={readingState}/></div>
        <section class="overview-details" aria-label={$t("app.deviceState_a8de1")}>
          <h2>{$t("app.controller_a36a5")}</h2>
          <dl class="facts">

            <div><dt>{$t("app.firmware_0dc5f")}</dt><dd data-testid="version">{firmware.version}</dd></div>
            <div><dt>{$t(reportedAddress?.interface==='lan'?"networkAddress.lanAddress":reportedAddress?.interface==='wifi'?"networkAddress.wifiAddress":"networkAddress.reportedAddress")}</dt><dd data-testid="lan">{reportedAddress?.address??$t("networkAddress.unavailable")}</dd></div>
            <div><dt>{$t("app.deviceTimeUTC_99f56")}</dt><dd data-testid="utc">{utc(snapshot.time)}</dd></div>
            <div><dt>{$t("app.uptime_6aafa")}</dt><dd data-testid="uptime">{snapshot.uptime} s</dd></div>
            <div><dt>{$t("app.wiFiCapability_28a30")}</dt><dd data-testid="wifi">{firmware.wifi ? $t("app.available_7c62a") : $t("app.notAvailable_d1a17")}</dd></div>
          </dl>
        </section>
        <details class="reading-details"><summary>{$t("app.readingDetails_28520")}{stale?$t("app.readbackStale_e56ed"):''}</summary>
        <p class:stale data-testid="snapshot">{stale ? $t("app.lastSnapshotStale_329af") : $t("app.snapshot_b08ae")} · {utc(snapshot.time)} {$t("app.refreshesEvery30SecondsWhileVisibleFailuresBackOff_809d6")}</p>
        </details>
        </EditorPage>
      {:else if route === 'help' || route === 'lighting-tools' || route === 'diagnostics' || route === 'recovery' || route === 'schedules' || route === 'sensors' || route === "weather" || route === 'clock' || route === 'network'}
        <!-- The retained editor below owns drafts across navigation. -->
      {:else if route === 'settings'}
        <EditorPage>
        <div class="heading"><div><h1>{$t("app.settings_c7f73")}</h1><p>{$t("app.controllerIdentityAndDevicePreferences_603f4")}</p></div></div>
        <div class="hostname-workspace"><form class="panel settings hostname-form" onsubmit={save}>
          <h2>{$t("app.hostname_c983a")}</h2><p class="saved-hostname">{$t("app.savedHostname_e0495")}{hostnameStale?$t("app.lastLoadedRefreshUnavailable_51d3e"):''}<strong>{persisted}</strong></p>
          <label for="device-name">{$t("app.hostname_c983a")}</label>
          <input id="device-name" name="hostname" type="text" bind:value={hostname} oninput={() => { status = ''; error = ''; }} disabled={busy} aria-describedby="name-help" aria-invalid={!valid} autocomplete="off" spellcheck="false" />
          <p id="name-help">{$t("app.use163LettersNumbersOrHyphensStartAnd_b6f89")}</p>
          <DraftBar snapshotRevision={hostnameRevision} feedback={$renderText(error)} {dirty} {busy} disabled={!dirty||!valid} label={$t("app.saveHostname_2dd43")} scope="" />
        {#if hostnameStale||hostnameRevision!==$configurationState.revision}<button type="button" class="secondary" disabled={busy||!!$configurationState.recovery} onclick={reloadHostname}>{$t("app.reloadHostnameReplaceDraft_c5476")}</button>{/if}
        </form><aside class="hostname-guidance"><h2>{$t("app.afterChangingTheHostname_f73cb")}</h2><p>{$t("app.aChangedNetworkHostnameMayTakeEffectAfterDevice_558be")}</p><p>{$t("app.ifAccessChangesNetworkRecoveryProvidesExplicitReadOnly_b185e")}</p><a href="#network">{$t("app.networkAndConnectionGuidance_8a165")}</a></aside></div></EditorPage>
      {:else}
        <EditorPage><section class="empty-state"><h1>{$t("app.pageUnavailable_0687f")}</h1><p>{$t("app.chooseADestinationFromLightingOrDeviceNavigationOr_fe862")}</p><a href="#index">{$t("app.returnToOverview_b401f")}</a></section></EditorPage>
      {/if}
    {/if}
    <Help active={route === 'help'} {busy} {firmware} {perform}/>
    {#if loaded && firmware && snapshot}
      <LightingTools active={route === 'lighting-tools'} {busy} {firmware} {snapshot} {stale} feedback={$renderText(error)} {perform} {command} refresh={()=>refresh()} readback={async()=>{try{await readState();}catch(e){uncertain();throw e;}}} onedit={clearFeedback}/>
      <Diagnostics active={route === 'diagnostics'} {busy} {firmware} {perform}/>
      <Recovery active={route === 'recovery'} {busy} {firmware} {perform} onconfigurationchange={recoveryChanged} onread={(next, info, name) => { ++revision; snapshot=next; firmware=info; configurationVerified(); if(hostname===persisted){hostname=name;hostnameRevision=configurationRevision();} persisted=name; hostnameStale=false;stale=false; overviewChannel=Math.min(overviewChannel,info.pwm_count); invalidateConfiguration(); }} />
      <SystemSettings feedback={$renderText(error)} active={route === 'clock'} kind="clock" {busy} {firmware} {snapshot} {stale} {perform} {command} refresh={() => refresh()} onedit={clearFeedback} />
      <SystemSettings feedback={$renderText(error)} active={route === 'network'} kind="network" {busy} {firmware} {snapshot} {stale} {perform} {command} refresh={() => refresh()} onedit={clearFeedback} />
    {/if}
    {#if loaded && firmware && snapshot}<Weather feedback={$renderText(error)} active={route === 'weather'} {busy} {firmware} {snapshot} {stale} {perform} {command} refresh={() => refresh()} onedit={clearFeedback} />{/if}
    {#if loaded && firmware && snapshot}<Sensors feedback={$renderText(error)} active={route === 'sensors'} {busy} {firmware} {snapshot} {stale} {perform} refresh={() => refresh()} onedit={clearFeedback} />{/if}
    {#if loaded && firmware}<ChannelConfiguration feedback={$renderText(error)} bind:this={channelConfiguration} active={route === 'channels'} {busy} {firmware} {perform} onedit={clearFeedback} onsaved={(channels)=>{
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
    {#if loaded && firmware}<DevicePreferences active={route === 'settings'} {busy} {firmware} feedback={$renderText(error)} {perform} onedit={clearFeedback}/>{/if}
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
  /* Meter key left, unused-channel note right; they wrap onto two lines when narrow. */
  .output-footnotes { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0 24px; margin-top:12px; }
  .output-footnotes :global(.meter-key), .output-footnotes :global(.unused-channels) { margin:0; }
  .overview-links { display:flex; flex-wrap:wrap; gap:8px 24px; }
  .overview-links a { min-height:44px; display:flex; align-items:center; gap:12px; font-size:14px; font-weight:600; }
  .overview-details { margin-top:18px; padding-top:16px; border-top:1px solid var(--sr-line); }
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
  .reconnect-notice{font-size:12px;line-height:1.5;color:var(--sr-muted);margin:8px 0 16px;max-width:95ch}
  .configuration-recovery{border-left:2px solid var(--sr-accent);padding:10px 14px;background:var(--sr-surface);font-size:13px;margin-bottom:12px}.configuration-recovery p{font-size:12px;margin:6px 0}.configuration-recovery a{display:inline-flex;align-items:center;min-height:44px}
  .label-status{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--sr-muted);margin-bottom:8px}.label-status p{margin:0}
</style>
