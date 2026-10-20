<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
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
      "Sensor configuration loaded",
      "Could not load sensors. Retry Reload sensor configuration.",
      "Loading sensors…",
    );
  }
  async function selectLoad(rom: string) {
    attemptedSensors[rom] = true;
    await perform(
      async () => {
        const value = await loadSensor(rom, catalogue[rom], channels);
        editors[rom] = value;
      },
      "Sensor configuration loaded",
      "Could not load sensors. Retry Reload sensor configuration.",
      "Loading sensors…",
    );
  }
  async function register() {
    const rom = selected,
      name = names[rom] ?? "Temperature";
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
      "Sensor registered",
      "Could not confirm registration. Draft kept; reload to check persistence or explicitly retry Register sensor.",
      "Registering sensor…",
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
      "Saved",
      "Could not confirm sensor save. Draft kept; reload to check persistence or explicitly retry Save. No automatic write retry.",
      "Saving sensor settings…",
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
      const dock=document.querySelector<HTMLElement>('nav[aria-label="Everyday lighting"]');
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
 <div class="heading"><div><h1>Sensors</h1></div><button class="secondary" onclick={refresh} disabled={busy}>Refresh sensor readings</button></div>

 {#if sensorState.errors.length}<p role="alert" data-testid="sensor-state-error">{sensorState.errors.join('; ')}</p>{/if}
 <div class="sensor-workspace"><section class="panel sensor-monitor"> {#if ready}
  {#if !ids.length}<div class="empty-state"><h2>No sensors yet</h2><p>No sensors reported or configured.</p><p>Discovered probes appear after the device scans its bus. Registration is always explicit.</p></div>{:else}
   <div class="sensor-readback readback"><div><label for="sensor-choice">Sensor</label><select id="sensor-choice" bind:value={selected} disabled={busy}>{#each ids as id}<option value={id}>{catalogue[id]?.name??'Unregistered'} · {id}</option>{/each}</select>
   <details class="sensor-identity"><summary>Sensor identity</summary><p>{catalogue[selected]?.name ?? 'Unregistered sensor'} · ROM <code>{selected}</code></p></details></div><div><p>Device readback</p><StateBadge tone={stale?'draft':reading?'active':'error'}>{stale?'Reading may be stale':reading?'Probe connected':'Probe disconnected'}</StateBadge><p class="reading-value" class:reading-status={!reading || (editor && !editor.supported) || reading.device !== 1} data-testid="sensor-reading">{reading ? editor&&!editor.supported?`${reading.value} raw (unsupported configuration)`:formatReading(reading) : 'Disconnected'}</p>
   <p>{reading?stale?'Last reported reading · stale':'Currently reported by device':'Missing from the last device scan; saved configuration is retained.'}</p></div></div>
   {#if !catalogue[selected]}<ConfigurationNotice revision={snapshotRevision}/>
    {#if reading?.device===1}<label for="sensor-new-name">Sensor name</label><input id="sensor-new-name" bind:value={names[selected]} placeholder="Temperature" disabled={busy} oninput={onedit} /><p>Register writes temperature defaults: inactive control, correction 0, thresholds 15–35°C, all months. Factory correction is +1°C; firmware includes it in subsequent readings.</p><button onclick={register} disabled={busy||!configurationReconciled||!(names[selected]??'Temperature').trim()}>Register sensor</button>
    {:else}<p>Unsupported sensor device type. Raw readings are shown; registration is unavailable.</p>{/if}
   {/if}
  {/if}
 {:else}<div class="empty-state"><h2>{busy?'Loading sensors…':'Sensor settings unavailable'}</h2><p>{busy?'Reading the sensor catalogue and saved configuration.':'Use Reload sensor configuration to try again.'}</p></div>{/if}<div class="form-actions"><button class="secondary" onclick={reload} disabled={busy}>Reload sensor configuration</button></div><p>Reload discards unsaved sensor drafts. Reading refreshes do not.</p>
<details class="reading-details"><summary>Reading details{stale?' · stale':''}</summary> <p class:stale>{stale?'Last snapshot · stale':'Device snapshot'} · Readings refresh every 30 seconds while visible; failures back off to 120 seconds. Firmware scans on its own cycle (about 60 seconds); Refresh only reads state.</p></details>
</section>
 {#if editor}
  {#if !editor.supported}<section class="panel"><h2>Unsupported sensor settings</h2><p>This device or unit format is read-only. Its stored configuration is preserved.</p></section>
  {:else}<form class="panel sensor-configuration" onsubmit={save} oninput={onedit} onfocusin={e=>revealControl(e.target)} novalidate>
   <DraftBar {snapshotRevision} {feedback} dirty={!!Object.keys(patch).length} {busy} disabled={!valid||!Object.keys(patch).length} label="Save sensor settings" scope="sensor " detail="Save applies to this sensor. Reading refreshes keep all drafts." />
   <fieldset disabled={busy}><legend>Temperature settings</legend>
   <div class="field-grid"><div><label for="sensor-name">Sensor name</label><input id="sensor-name" bind:value={editor.draft.name} aria-invalid={!editor.draft.name.trim()} /></div><div>
   <label class="check"><input type="checkbox" bind:checked={editor.draft.active} />Enable sensor control</label><p>Control uses the saved thresholds and assignments below.</p></div></div>
   <div class="field-grid three-columns sensor-thresholds"><div><label for="sensor-correction">Correction °C</label><input id="sensor-correction" inputmode="decimal" bind:value={editor.draft.offset} aria-invalid={tenths(editor.draft.offset) === undefined || Math.abs(tenths(editor.draft.offset)!) > 50} />
   <p>−5 to +5°C in tenths. Device readings already include corrections; unsaved edits never change the displayed reading.</p>
   </div><div><label for="sensor-min">Minimum °C</label><input id="sensor-min" inputmode="decimal" bind:value={editor.draft.desiredmin} aria-invalid={tenths(editor.draft.desiredmin) === undefined || tenths(editor.draft.desiredmin)! < editor.min || tenths(editor.draft.desiredmin)! > tenths(editor.draft.desiredmax)!} />
   </div><div><label for="sensor-max">Maximum °C</label><input id="sensor-max" inputmode="decimal" bind:value={editor.draft.desiredmax} aria-invalid={tenths(editor.draft.desiredmax) === undefined || tenths(editor.draft.desiredmax)! > editor.max || tenths(editor.draft.desiredmax)! < tenths(editor.draft.desiredmin)!} />
   </div></div><p>Stored bounds {editor.min/10}–{editor.max/10}°C. Minimum must not exceed maximum. Thresholds are inclusive; maximum takes priority when equal.</p>
   <details class="months-editor" open><summary>Active months · none selected means all</summary><fieldset><legend class="visually-hidden">Active months (none selected means all)</legend><div class="sensor-months">{#each Array.from({length:12},(_,i)=>i+1) as n}<label class="check"><input type="checkbox" checked={editor.draft.months.includes(n)} onchange={e=>month(n,e.currentTarget.checked)} />Month {n}</label>{/each}</div></fieldset></details>
   <p class="notice" data-testid="sensor-month-warning">Firmware limitation: changed month selections may retain previously active months until a device reboot. Save confirms persistence, not runtime month replacement. This interface never reboots automatically.</p>
   <div class="assignments-heading"><div><h2>Channel assignments</h2><p>Responses at the inclusive minimum and maximum thresholds. Edits stay local until Save.</p></div><div class="channel-jump"><label for="sensor-response-jump">Jump to channel response</label><div class="jump-controls"><select id="sensor-response-jump" bind:value={responseJump} disabled={busy}><option value="">Choose channel…</option>{#each channels as channel,i}<option value={String(i+1)}>{channelDisplay(i+1,$savedChannels[i],$configurationState.revision===0?channel.name:'')}</option>{/each}</select><button type="button" class="secondary" aria-label="Go to channel response" disabled={busy||!responseJump} onclick={()=>jumpChannel(responseJump)}>Go</button></div></div></div>
   <p class="response-help">Relative: 0–200%. Absolute: 0–100%. Binary: Off/On (0/100%). Save does not enable inactive planners.</p><div class="service-fields sensor-responses">{#each channels as channel,i}<fieldset id={`sensor-channel-${i+1}`} class="sensor-response" tabindex="-1"><legend><ChannelIdentity number={i+1} fallback={channel.name}/></legend>
    {#if channel.manager===0}<p>Planner inactive: sensor assignments will not control this output until planning is enabled separately.</p>{/if}
    <div class="threshold-pair">{#each ['min','max'] as side}{@const s=side as 'min'|'max'}{@const a=editor.draft.channels[i][s]}{@const label=`Channel ${i+1} ${s==='min'?'below minimum':'above maximum'}`}
     <div><label class="check response-enable"><input type="checkbox" aria-label={label} bind:checked={a.enabled} />{s==='min'?'At/below minimum':'At/above maximum'}</label>
     {#if channel.binary}{#if !['0','100'].includes(a.percent)}<p role="alert">Retained draft: {a.percent}%. Choose On then Off if required; binary channels need 0 or 100%.</p>{/if}<label class="check"><input type="checkbox" aria-label={`${label} on`} checked={a.percent==='100'} onchange={e=>a.percent=e.currentTarget.checked?'100':'0'} />On</label>
     {:else}<div class="response-value-row"><div class="response-value"><label class="visually-hidden" for={`sensor-${i}-${s}`}>Level (%)</label><div class="sensor-level"><input class="sensor-percent" id={`sensor-${i}-${s}`} inputmode="numeric" aria-label={`${label} percent`} aria-invalid={!/^\d+$/.test(a.percent) || Number(a.percent)>(a.absolute?100:200)} bind:value={a.percent} /><span aria-hidden="true">%</span></div></div><label class="check"><input type="checkbox" aria-label={`${label} absolute`} bind:checked={a.absolute} />Absolute</label></div>{/if}
    </div>{/each}</div>
   </fieldset>{/each}</div>
   <div class="form-actions"><button type="button" class="secondary" onclick={reset}>Reset sensor draft</button><button type="button" class="secondary" onclick={()=>document.getElementById('sensor-name')?.focus()}>Back to sensor settings ↑</button></div>
   {#if !valid}<p role="alert">Check the name, correction, ordered thresholds and channel percentages before saving.</p>{/if}
   </fieldset>
  </form>{/if}
 {:else if ready&&catalogue[selected]}<section class="panel"><h2>{busy?'Loading selected sensor…':'Selected sensor settings unavailable'}</h2><ConfigurationNotice revision={snapshotRevision}/>{#if !busy&&configurationReconciled}<button class="secondary" onclick={()=>selectLoad(selected)}>Retry selected sensor</button><p>This read keeps other sensor drafts. Reload sensor configuration replaces all sensor drafts.</p>{/if}</section>{/if}
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
