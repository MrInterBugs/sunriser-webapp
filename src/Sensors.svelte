<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {t,renderText,language,source,numberText,decimalDraft,canonicalDecimal} from './i18n';
 import ConfigurationNotice from './ui/ConfigurationNotice.svelte';
 import {configurationState,configurationRevision,configurationCurrent} from './configuration-state';
 let snapshotRevision=$state(configurationRevision());
 const configurationReconciled=$derived(!$configurationState.recovery&&snapshotRevision===$configurationState.revision);
  import {untrack,onDestroy} from 'svelte';
  import ChannelIdentity from './ui/ChannelIdentity.svelte';
  import {savedChannels,channelDisplay} from './channels';
  import EditorPage from './ui/EditorPage.svelte';
  import DraftBar from './ui/DraftBar.svelte';
  import StateBadge from './ui/StateBadge.svelte';
  import { saveConfiguration, type Firmware, type DeviceState } from "./api";
  import {
    parseSensorState,
    tenths,
    formatReading,
    loadSensorIndex,
    loadSensor,
    defaults,
    validDraft,
    sensorPatch,
    registration,
    type Catalogue,
    type Channel,
    type SensorEditor,
  } from "./sensors";
  let {
    active,
    feedback,
    busy,
    firmware,
    snapshot,
    stale,
    perform,
    refresh,
    onedit,
  }: {
    active: boolean;
    feedback: string;
    busy: boolean;
    firmware: Firmware;
    snapshot: DeviceState;
    stale: boolean;
    perform: (
      task: () => Promise<void>,
      success: string,
      failure: string,
      pending: string,
    ) => Promise<boolean>;
    refresh: () => Promise<void>;
    onedit: () => void;
  } = $props();
  let attempted = $state(false),
    ready = $state(false),
    selected = $state("");
  let catalogue = $state<Catalogue>({}),
    channels = $state<Channel[]>([]),
    editors = $state<Record<string, SensorEditor>>({}),
    names = $state<Record<string, string>>({}),
    attemptedSensors = $state<Record<string, boolean>>({});
  $effect(()=>{const saved=$savedChannels;untrack(()=>{for(let i=0;i<channels.length;i++)if(typeof saved[i]?.binary==='boolean')channels[i].binary=saved[i].binary as boolean;});});
  const sensorState = $derived(parseSensorState(snapshot.sensors));
  const ids = $derived([
    ...new Set([...Object.keys(catalogue), ...Object.keys(sensorState.readings)]),
  ]);
  const editor = $derived(editors[selected]);
  const reading = $derived(sensorState.readings[selected]);
  const valid = $derived(!!editor && validDraft(editor, channels));
  const patch = $derived(editor ? sensorPatch(selected, editor, catalogue) : {});
  $effect(() => {
    if (active && !attempted && !busy && !$configurationState.recovery) void reload();
  });
  $effect(() => {
    if (ready && (!selected || !ids.includes(selected))) selected = ids[0] ?? "";
  });
  $effect(() => {
    if (
      active &&
      ready &&
      selected &&
      catalogue[selected] &&
      !editors[selected] &&
      configurationReconciled &&
      !attemptedSensors[selected] &&
      !busy
    )
      void selectLoad(selected);
  });
  async function reload() {
    attempted = true;
    await perform(
      async () => {
        const index = await loadSensorIndex(firmware.pwm_count);
        const target =
          selected && index.catalogue[selected]
            ? selected
            : Object.keys(index.catalogue)[0];
        const next = target
          ? await loadSensor(target, index.catalogue[target], index.channels)
          : undefined;
        catalogue = index.catalogue;
        channels = index.channels;
        editors = next ? { [target]: next } : {};
        attemptedSensors = target ? { [target]: true } : {};
        names = {};
        ready = true;
        snapshotRevision=configurationRevision();
      },
      source("sensors.sensorConfigurationLoaded_de09a"),
      source("sensors.couldNotLoadSensorsRetryReloadSensorConfiguration_88a6c"),
      source("sensors.loadingSensors_9e8a1"),
    );
  }
  async function selectLoad(rom: string) {
    attemptedSensors[rom] = true;
    await perform(
      async () => {
        const value = await loadSensor(rom, catalogue[rom], channels);
        editors[rom] = value;
      },
      source("sensors.sensorConfigurationLoaded_de09a"),
      source("sensors.couldNotLoadSensorsRetryReloadSensorConfiguration_88a6c"),
      source("sensors.loadingSensors_9e8a1"),
    );
  }
  async function register() {
    const rom = selected,
      name = names[rom] ?? $t("sensors.temperature_0a906");
    if (!name.trim() || reading?.device !== 1 || !configurationCurrent(snapshotRevision)) return;
    const { entry, patch } = registration(rom, name, catalogue);
    await perform(
      async () => {
        await saveConfiguration(patch, firmware);
        // Registration leaves existing assignment keys intact. Read them before
        // offering activation; an absent catalogue is not proof of empty settings.
        const registered = await loadSensor(rom, entry, channels);
        catalogue = { ...catalogue, [rom]: entry };
        editors[rom] = registered;
        attemptedSensors[rom] = true;
      },
      source("sensors.sensorRegistered_27c15"),
      source("sensors.couldNotConfirmRegistrationDraftKeptReloadToCheck_dd82c"),
      source("sensors.registeringSensor_c087c"),
    );
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!editor || !valid || !Object.keys(patch).length || !configurationCurrent(snapshotRevision)) return;
    const rom = selected,
      values = { ...patch },
      current = editor;
    await perform(
      async () => {
        await saveConfiguration(values, firmware);
        current.baseline = { ...current.baseline, ...values };
        if (values["sensors#web"])
          catalogue = JSON.parse(values["sensors#web"] as string);
      },
      source("app.saved_c0ae8"),
      source("sensors.couldNotConfirmSensorSaveDraftKeptReloadTo_8bc0c"),
      source("sensors.savingSensorSettings_722b7"),
    );
  }
  function reset() {
    if (!editor) return;
    const next = defaults(
      channels.length,
      editor.draft.name,
      editor.min,
      editor.max,
    );
    next.channels.forEach((p, i) => {
      if (channels[i].binary) {
        p.min.absolute = editor!.draft.channels[i].min.absolute;
        p.max.absolute = editor!.draft.channels[i].max.absolute;
      }
    });
    editor.draft = next;
    onedit();
  }
  function month(n: number, checked: boolean) {
    if (editor)
      editor.draft.months = checked
        ? [...editor.draft.months, n].sort((a, b) => a - b)
        : editor.draft.months.filter((m) => m !== n);
  }
  let responseJump=$state(''),revealFrame=0;
  function jumpChannel(value:string){
    const number=Number(value);
    if(Number.isInteger(number)&&number>=1&&number<=channels.length){
      const target=document.getElementById(`sensor-channel-${number}`);
      target?.focus({preventScroll:true});target?.scrollIntoView({block:'start'});
    }
    responseJump='';
  }
  // Keep focused inputs above the mobile dock and below the sticky draft bar.
  // This is the same visible-viewport boundary used by the schedule editor.
  function revealControl(target:EventTarget|null){
    if(!(target instanceof HTMLElement)||!target.matches('input,select,button'))return;
    cancelAnimationFrame(revealFrame);revealFrame=requestAnimationFrame(()=>{
      if(!active||document.activeElement!==target)return;
      const viewport=window.visualViewport;
      let top=(viewport?.offsetTop??0)+12,bottom=(viewport?.offsetTop??0)+(viewport?.height??innerHeight)-12;
      const dock=document.querySelector<HTMLElement>('.mobile-dock');
      if(dock?.getClientRects().length)bottom=Math.min(bottom,dock.getBoundingClientRect().top-8);
      const bar=target.closest('form')?.querySelector<HTMLElement>('.draft-bar');
      if(bar&&getComputedStyle(bar).position==='sticky'&&bar.getBoundingClientRect().top<=top)top=Math.max(top,bar.getBoundingClientRect().bottom+8);
      const rect=target.getBoundingClientRect();
      if(rect.top<top)window.scrollBy(0,rect.top-top);else if(rect.bottom>bottom)window.scrollBy(0,rect.bottom-bottom);
    });
  }
  onDestroy(()=>cancelAnimationFrame(revealFrame));
</script>
{#if active}
<EditorPage>
 <div class="heading"><div><h1>{$t("sensors.sensors_711bf")}</h1></div><button class="secondary" onclick={refresh} disabled={busy}>{$t("sensors.refreshSensorReadings_b57a7")}</button></div>

 {#if sensorState.errors.length}<p role="alert" data-testid="sensor-state-error">{sensorState.errors.map(error=>$renderText(error)).join('; ')}</p>{/if}
 <div class="sensor-workspace"><section class="panel sensor-monitor"> {#if ready}
  {#if !ids.length}<div class="empty-state"><h2>{$t("sensors.noSensorsYet_472a1")}</h2><p>{$t("sensors.noSensorsReportedOrConfigured_3405f")}</p><p>{$t("sensors.discoveredProbesAppearAfterTheDeviceScansItsBus_17340")}</p></div>{:else}
   <div class="sensor-readback readback"><div><label for="sensor-choice">{$t("sensors.sensor_9101f")}</label><select id="sensor-choice" bind:value={selected} disabled={busy}>{#each ids as id}<option value={id}>{catalogue[id]?.name??$t("sensors.unregistered_eca5e")} · {id}</option>{/each}</select>
   <details class="sensor-identity"><summary>{$t("sensors.sensorIdentity_1c22e")}</summary><p>{catalogue[selected]?.name ?? $t("sensors.unregisteredSensor_3adba")} {$t("sensors.rom_1ea25")} <code>{selected}</code></p></details></div><div><p>{$t("lightingdashboard.deviceReadback_207fa")}</p><StateBadge tone={stale?'draft':reading?'active':'error'}>{stale?$t("sensors.readingMayBeStale_ed95d"):reading?$t("sensors.probeConnected_f8cf4"):$t("sensors.probeDisconnected_b8bfe")}</StateBadge><p class="reading-value" class:reading-status={!reading || (editor && !editor.supported) || reading.device !== 1} data-testid="sensor-reading">{reading ? editor&&!editor.supported?$t("sensors.v0RawUnsupportedConfiguration_7d607",{v0: reading.value}):(reading.device===1?numberText(reading.value/10,$language,Number.isInteger(reading.value/10)?0:1)+' °C':$t('sensors.unsupportedReading',{v0:reading.value,v1:reading.device})) : $t("sensors.disconnected_771e0")}</p>
   <p>{reading?stale?$t("sensors.lastReportedReadingStale_97cbe"):$t("sensors.currentlyReportedByDevice_ca2bf"):$t("sensors.missingFromTheLastDeviceScanSavedConfigurationIs_acff1")}</p></div></div>
   {#if !catalogue[selected]}<ConfigurationNotice revision={snapshotRevision}/>
    {#if reading?.device===1}<label for="sensor-new-name">{$t("sensors.sensorName_d8c93")}</label><input id="sensor-new-name" bind:value={names[selected]} placeholder={$t("sensors.temperature_0a906")} disabled={busy} oninput={onedit} /><p>{$t("sensors.registerWritesTemperatureDefaultsInactiveControlCorrection0Thresholds_f3a77")}</p><button onclick={register} disabled={busy||!configurationReconciled||!(names[selected]??'Temperature').trim()}>{$t("sensors.registerSensor_7b392")}</button>
    {:else}<p>{$t("sensors.unsupportedSensorDeviceTypeRawReadingsAreShownRegistration_721fd")}</p>{/if}
   {/if}
  {/if}
 {:else}<div class="empty-state"><h2>{busy?$t("sensors.loadingSensors_9e8a1"):$t("sensors.sensorSettingsUnavailable_dd572")}</h2><p>{busy?$t("sensors.readingTheSensorCatalogueAndSavedConfiguration_5093d"):$t("sensors.useReloadSensorConfigurationToTryAgain_e241c")}</p></div>{/if}<div class="form-actions"><button class="secondary" onclick={reload} disabled={busy}>{$t("sensors.reloadSensorConfiguration_360e6")}</button></div><p>{$t("sensors.reloadDiscardsUnsavedSensorDraftsReadingRefreshesDoNot_31fee")}</p>
<details class="reading-details"><summary>{$t("app.readingDetails_28520")}{stale?$t("app.readbackStale_e56ed"):''}</summary> <p class:stale>{stale?$t("app.lastSnapshotStale_329af"):$t("sensors.deviceSnapshot_35538")} {$t("sensors.readingsRefreshEvery30SecondsWhileVisibleFailuresBack_2eda5")}</p></details>
</section>
 {#if editor}
  {#if !editor.supported}<section class="panel"><h2>{$t("sensors.unsupportedSensorSettings_e93c5")}</h2><p>{$t("sensors.thisDeviceOrUnitFormatIsReadOnlyIts_4f855")}</p></section>
  {:else}<form class="panel sensor-configuration" onsubmit={save} oninput={onedit} onfocusin={e=>revealControl(e.target)} novalidate>
   <DraftBar {snapshotRevision} feedback={$renderText(feedback)} dirty={!!Object.keys(patch).length} {busy} disabled={!valid||!Object.keys(patch).length} label={$t("sensors.saveSensorSettings_19f30")} scope={$t("sensors.sensor_2fc03")} detail={$t("sensors.saveAppliesToThisSensorReadingRefreshesKeepAll_f1f54")} />
   <fieldset disabled={busy}><legend>{$t("sensors.temperatureSettings_71778")}</legend>
   <div class="field-grid"><div><label for="sensor-name">{$t("sensors.sensorName_d8c93")}</label><input id="sensor-name" bind:value={editor.draft.name} aria-invalid={!editor.draft.name.trim()} /></div><div>
   <label class="check"><input type="checkbox" bind:checked={editor.draft.active} />{$t("sensors.enableSensorControl_7cd2d")}</label><p>{$t("sensors.controlUsesTheSavedThresholdsAndAssignmentsBelow_0bb96")}</p></div></div>
   <div class="field-grid three-columns sensor-thresholds"><div><label for="sensor-correction">{$t("sensors.correctionC_c8478")}</label><input id="sensor-correction" inputmode="decimal" bind:value={()=>decimalDraft(editor.draft.offset,$language),v=>editor.draft.offset=canonicalDecimal(v,$language)} aria-invalid={tenths(editor.draft.offset) === undefined || Math.abs(tenths(editor.draft.offset)!) > 50} />
   <p>{$t("sensors.5To5CInTenthsDeviceReadingsAlready_90439")}</p>
   </div><div><label for="sensor-min">{$t("sensors.minimumC_82d4f")}</label><input id="sensor-min" inputmode="decimal" bind:value={()=>decimalDraft(editor.draft.desiredmin,$language),v=>editor.draft.desiredmin=canonicalDecimal(v,$language)} aria-invalid={tenths(editor.draft.desiredmin) === undefined || tenths(editor.draft.desiredmin)! < editor.min || tenths(editor.draft.desiredmin)! > tenths(editor.draft.desiredmax)!} />
   </div><div><label for="sensor-max">{$t("sensors.maximumC_83e2c")}</label><input id="sensor-max" inputmode="decimal" bind:value={()=>decimalDraft(editor.draft.desiredmax,$language),v=>editor.draft.desiredmax=canonicalDecimal(v,$language)} aria-invalid={tenths(editor.draft.desiredmax) === undefined || tenths(editor.draft.desiredmax)! > editor.max || tenths(editor.draft.desiredmax)! < tenths(editor.draft.desiredmin)!} />
   </div></div><p>{$t("sensors.storedBounds_31ede")} {numberText(editor.min/10,$language,Number.isInteger(editor.min/10)?0:1)}–{numberText(editor.max/10,$language,Number.isInteger(editor.max/10)?0:1)}{$t("sensors.cMinimumMustNotExceedMaximumThresholdsAreInclusive_bf7b0")}</p>
   <details class="months-editor" open><summary>{$t("sensors.activeMonthsNoneSelectedMeansAll_28793")}</summary><fieldset><legend class="visually-hidden">{$t("sensors.activeMonthsNoneSelectedMeansAll_622b6")}</legend><div class="sensor-months">{#each Array.from({length:12},(_,i)=>i+1) as n}<label class="check"><input type="checkbox" checked={editor.draft.months.includes(n)} onchange={e=>month(n,e.currentTarget.checked)} />{$t("sensors.month_082bc")} {n}</label>{/each}</div></fieldset></details>
   <p class="notice" data-testid="sensor-month-warning">{$t("sensors.firmwareLimitationChangedMonthSelectionsMayRetainPreviouslyActive_f7884")}</p>
   <div class="assignments-heading"><div><h2>{$t("sensors.channelAssignments_433f0")}</h2><p>{$t("sensors.responsesAtTheInclusiveMinimumAndMaximumThresholdsEdits_153dd")}</p></div><div class="channel-jump"><label for="sensor-response-jump">{$t("sensors.jumpToChannelResponse_a9e18")}</label><div class="jump-controls"><select id="sensor-response-jump" bind:value={responseJump} disabled={busy}><option value="">{$t("sensors.chooseChannel_60b53")}</option>{#each channels as channel,i}<option value={String(i+1)}>{channelDisplay(i+1,$savedChannels[i],$configurationState.revision===0?channel.name:'',$language)}</option>{/each}</select><button type="button" class="secondary" aria-label={$t("sensors.goToChannelResponse_797c1")} disabled={busy||!responseJump} onclick={()=>jumpChannel(responseJump)}>{$t("sensors.go_2e0b4")}</button></div></div></div>
   <p class="response-help">{$t("sensors.relative0200Absolute0100BinaryOffOn_becf4")}</p><div class="service-fields sensor-responses">{#each channels as channel,i}<fieldset id={`sensor-channel-${i+1}`} class="sensor-response" tabindex="-1"><legend><ChannelIdentity number={i+1} fallback={channel.name}/></legend>
    {#if channel.manager===0}<p>{$t("sensors.plannerInactiveSensorAssignmentsWillNotControlThisOutput_55dc3")}</p>{/if}
    <div class="threshold-pair">{#each ['min','max'] as side}{@const s=side as 'min'|'max'}{@const a=editor.draft.channels[i][s]}{@const label=$t("sensors.channelV0V1_d0b6e",{v0: i+1,v1: s==='min'?$t("sensors.belowMinimum_f0474"):$t("sensors.aboveMaximum_62554")})}
     <div><label class="check response-enable"><input type="checkbox" aria-label={$renderText(label)} bind:checked={a.enabled} />{s==='min'?$t("sensors.atBelowMinimum_002fc"):$t("sensors.atAboveMaximum_e26e8")}</label>
     {#if channel.binary}{#if !['0','100'].includes(a.percent)}<p role="alert">{$t("sensors.retainedDraft_8887a")} {a.percent}{$t("sensors.chooseOnThenOffIfRequiredBinaryChannelsNeed_f0b78")}</p>{/if}<label class="check"><input type="checkbox" aria-label={$t("sensors.v0On_4be6b",{v0: label})} checked={a.percent==='100'} onchange={e=>a.percent=e.currentTarget.checked?'100':'0'} />{$t("lightingtools.on_e0049")}</label>
     {:else}<div class="response-value-row"><div class="response-value"><label class="visually-hidden" for={`sensor-${i}-${s}`}>{$t("schedules.level_9a874")}</label><div class="sensor-level"><input class="sensor-percent" id={`sensor-${i}-${s}`} inputmode="numeric" aria-label={$t("sensors.v0Percent_ad07f",{v0: label})} aria-invalid={!/^\d+$/.test(a.percent) || Number(a.percent)>(a.absolute?100:200)} bind:value={a.percent} /><span aria-hidden="true">%</span></div></div><label class="check"><input type="checkbox" aria-label={$t("sensors.v0Absolute_85785",{v0: label})} bind:checked={a.absolute} />{$t("sensors.absolute_a6c5f")}</label></div>{/if}
    </div>{/each}</div>
   </fieldset>{/each}</div>
   <div class="form-actions"><button type="button" class="secondary" onclick={reset}>{$t("sensors.resetSensorDraft_023e8")}</button><button type="button" class="secondary" onclick={()=>document.getElementById('sensor-name')?.focus()}>{$t("sensors.backToSensorSettings_f138e")}</button></div>
   {#if !valid}<p role="alert">{$t("sensors.checkTheNameCorrectionOrderedThresholdsAndChannelPercentages_034c6")}</p>{/if}
   </fieldset>
  </form>{/if}
 {:else if ready&&catalogue[selected]}<section class="panel"><h2>{busy?$t("sensors.loadingSelectedSensor_ede94"):$t("sensors.selectedSensorSettingsUnavailable_5ebdf")}</h2><ConfigurationNotice revision={snapshotRevision}/>{#if !busy&&configurationReconciled}<button class="secondary" onclick={()=>selectLoad(selected)}>{$t("sensors.retrySelectedSensor_ffa89")}</button><p>{$t("sensors.thisReadKeepsOtherSensorDraftsReloadSensorConfiguration_b8ee4")}</p>{/if}</section>{/if}
</div>
</EditorPage>
{/if}

<style>
 .sensor-workspace { display:grid; grid-template-columns:280px minmax(0,1fr); gap:32px; align-items:start; }
 .sensor-monitor { position:sticky; top:20px; min-width:0; } .sensor-readback { display:flex; flex-direction:column-reverse; gap:16px; align-items:stretch; }
 .sensor-readback>div:first-child { border-top:1px solid var(--sr-line); padding-top:12px; }
 .sensor-configuration { min-width:0; }
 .sensor-readback :global(.reading-value) { margin:4px 0; } .sensor-readback p { margin:6px 0; }
 .sensor-thresholds { background:var(--sr-surface); padding:16px 20px; border-radius:var(--sr-radius); margin-top:16px; }
 .threshold-pair { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
 .threshold-pair>div { padding:12px; background:var(--sr-surface); border-radius:var(--sr-radius); min-width:0; }
 .threshold-pair label { margin-top:6px; }
 .assignments-heading{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,240px);gap:20px;align-items:end;margin-top:20px}
 .assignments-heading h2{margin-bottom:4px}.channel-jump{min-width:0}.jump-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.response-help{margin-top:8px}
 .sensor-response{scroll-margin-block:180px 90px}.sensor-response:focus-visible{outline:2px solid var(--sr-focus);outline-offset:5px}
 .sensor-response:focus-within{border-top-color:var(--sr-focus)}
 .threshold-pair .response-enable{font-size:13px;font-weight:650;margin:0;border-bottom:1px solid var(--sr-line);padding:0 0 6px}
 .response-value-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:0 12px}.response-value{flex:1 1 76px;min-width:55px}.response-value-row>.check{flex:0 0 auto;margin:0}
 .sensor-level{position:relative}.sensor-level>input.sensor-percent[inputmode=numeric]{padding:10px 23px 10px 8px}.sensor-level>span{position:absolute;right:9px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--sr-muted);pointer-events:none}
 .months-editor { border-block:1px solid var(--sr-line); margin-top:16px; padding:8px 0; }
 @media(max-width:1150px) { .sensor-workspace { grid-template-columns:240px minmax(0,1fr); gap:24px; } .sensor-configuration .service-fields { grid-template-columns:1fr; } }
 @media(max-width:800px) { .sensor-workspace { grid-template-columns:1fr; gap:8px; } .sensor-monitor { position:static; } .sensor-readback { gap:12px; } .sensor-thresholds { padding:12px; } .threshold-pair{grid-template-columns:minmax(0,1fr);gap:8px}.threshold-pair>div { display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,1.4fr);gap:8px;align-items:center;padding:8px; } .threshold-pair .response-enable{border:0;padding:0;gap:8px}.response-value-row{flex-wrap:nowrap;gap:4px}.response-value{flex-basis:60px;min-width:60px}.response-value-row>.check{gap:6px}.assignments-heading{grid-template-columns:minmax(0,1fr);gap:4px}.channel-jump{max-width:none} }
</style>
