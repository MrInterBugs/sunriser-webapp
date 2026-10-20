<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {configurationState,configurationRevision,configurationCurrent} from './configuration-state';
 let snapshotRevision=$state(configurationRevision());
 const configurationReconciled=$derived(!$configurationState.recovery&&snapshotRevision===$configurationState.revision);
  import {untrack} from 'svelte';
  import WeatherRuntime from './WeatherRuntime.svelte';
  import ChannelIdentity from './ui/ChannelIdentity.svelte';
  import {savedChannels} from './channels';
  import EditorPage from './ui/EditorPage.svelte';
  import DraftBar from './ui/DraftBar.svelte';
  import StateBadge from './ui/StateBadge.svelte';
  import { saveConfiguration, type Firmware, type DeviceState } from "./api";
  import {
    fields,
    fieldKey,
    defaults,
    loadBook,
    loadProfile,
    nextId,
    addProfile,
    removeProfile,
    validBook,
    weatherPatch,
    eligible,
    type Book,
    type Effect,
  } from "./weather";
  let {
    active,
    feedback,
    busy,
    firmware,
    snapshot,
    stale,
    perform,
    refresh,
    command,
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
    command: (v: { thunder: number }) => Promise<void>;
    onedit: () => void;
  } = $props();
  let book = $state<Book>();
  let attempted = $state(false);
  let attemptedIds = $state<Record<number, boolean>>({});
  let selected = $state(0);
  let selectedEffect = $state<Effect>("clouds");
  $effect(()=>{const saved=$savedChannels;untrack(()=>{if(book)book.channels.forEach((c,i)=>{if(typeof saved[i]?.binary==='boolean')c.binary=saved[i].binary as boolean;});});});
  const profile = $derived(book?.profiles.find((p) => p.id === selected));
  const draft = $derived(book?.drafts[selected]);
  const patch = $derived(book ? weatherPatch(book) : {});
  const dirty = $derived(Object.keys(patch).length > 0);
  const valid = $derived(book && validBook(book));
  $effect(() => {
    if (active && !attempted && !busy && !$configurationState.recovery) void reload();
  });
  $effect(() => {
    if (
      active &&
      book &&
      selected &&
      !draft &&
      configurationReconciled &&
      !attemptedIds[selected] &&
      !busy
    )
      void selectLoad(selected);
  });
  async function reload() {
    attempted = true;
    await perform(
      async () => {
        const next = await loadBook(firmware.pwm_count);
        const id = next.profiles.some((p) => p.id === selected)
          ? selected
          : (next.profiles[0]?.id ?? 0);
        if (id) await loadProfile(next, id);
        book = next;
        snapshotRevision=configurationRevision();
        selected = id;
        attemptedIds = id ? { [id]: true } : {};
      },
      "Weather loaded",
      "Could not load weather. Drafts kept; explicitly retry Reload weather.",
      "Loading weather…",
    );
  }
  async function selectLoad(id: number) {
    attemptedIds[id] = true;
    await perform(
      async () => {
        await loadProfile(book!, id);
      },
      "Weather loaded",
      "Could not load weather profile. Drafts kept; retry Load selected profile.",
      "Loading weather…",
    );
  }
  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (!book || !valid || !dirty || !configurationCurrent(snapshotRevision)) return;
    const current = book,
      values = { ...patch };
    await perform(
      async () => {
        await saveConfiguration(values, firmware);
        Object.assign(current.baseline, values);
        current.removed = [];
      },
      "Saved",
      "Could not confirm weather save. Drafts kept; reload to check persistence or explicitly retry Save. No automatic write retry.",
      "Saving weather…",
    );
  }
  function add() {
    if (!book) return;
    const id = addProfile(book);
    if (id) selected = id;
    onedit();
  }
  function remove() {
    if (!book) return;
    removeProfile(book, selected);
    selected = book.profiles[0]?.id ?? 0;
    onedit();
  }
  function reset() {
    if (!draft) return;
    const values = defaults();
    for (const f of fields.filter((f) => f.group === selectedEffect))
      draft[fieldKey(f)] = values[fieldKey(f)];
    onedit();
  }
  function weekday(n: number, checked: boolean) {
    if (!draft) return;
    const k = `${selectedEffect}#weekdays`;
    const values = draft[k] as number[];
    draft[k] = checked
      ? [...values, n].sort((a, b) => (a || 7) - (b || 7))
      : values.filter((v) => v !== n);
    onedit();
  }
</script>

{#if active}
<EditorPage>
  <div class="heading">
    <div>

      <h1>Weather</h1>
    </div>
    <button class="secondary" onclick={refresh} disabled={busy}
      >Refresh weather state</button
    >
  </div>
  <p class:stale>
    Thunderstorms{stale ? " · stale" : ""}:
    <strong data-testid="weather-thunder"
      >{typeof snapshot.thunder === "boolean"
        ? snapshot.thunder
          ? "Active"
          : "Off"
        : "Unknown"}</strong
    >
  </p>

  {#if book}<form class="panel" onsubmit={save} oninput={onedit} novalidate>
      <DraftBar {snapshotRevision} {feedback} {dirty} {busy} disabled={!valid||!dirty} label="Save weather" scope="weather " detail="Save applies to all edited profiles and channel assignments." />
      <fieldset disabled={busy}>
        <legend class="visually-hidden">Weather configuration</legend>
        <div class="weather-workspace"><aside class="weather-profiles" aria-label="Weather profiles"><h2>Profiles</h2><div><label for="weather-profile">Weather profile</label><select
            id="weather-profile"
            bind:value={selected}
            >{#each book.profiles as p}<option value={p.id}
                >{p.name} · #{p.id}</option
              >{/each}</select
          >
          </div>        <div class="form-actions">
          <button type="button" onclick={add} disabled={nextId(book) > 65535}
            >Add weather profile</button
          ><button
            type="button"
            class="secondary"
            onclick={remove}
            disabled={!profile ||
              book.channels.some((c) => c.profile === selected)}
            >Delete weather profile</button
          >
        </div>
        {#if nextId(book) > 65535}<p>
            Profile IDs exhausted (65535); no ID will be reused.
          </p>{/if}
<p>Profiles configure effects. Assign them to channels below.</p>  <section class="weather-reload">
    <button type="button" class="secondary" onclick={reload} disabled={busy}
      >Reload weather</button
    >
    <p>
      Reload discards all weather drafts. State refresh and navigation keep
      them. Configuration saves and ending service mode reinitialize weather,
      including manually started storms.
    </p>
  </section>
</aside><section class="profile-editor" aria-label="Weather profile editor">
        {#if book.profiles.length}
          <div class="profile-name">{#if profile}<div><label for="weather-name">Profile name</label><input
              id="weather-name"
              bind:value={profile.name}
              aria-invalid={!profile.name.trim()}
            /></div>{/if}</div>
          {#if draft}
            <div class="panel effect-editor"><StateBadge tone={dirty?'draft':'neutral'}>{dirty?'Profile editor · unsaved changes in weather':'Profile editor · saved configuration'}</StateBadge>
            <div class="effect-switch" role="group" aria-label="Weather effect">{#each [['clouds','Clouds'],['rain','Rain'],['thunder','Thunderstorms'],['moon','Moonlight']] as [value,label]}<button type="button" aria-pressed={selectedEffect===value} onclick={()=>selectedEffect=value as Effect}>{label}</button>{/each}</div>
            {#if selectedEffect === "moon"}<p>
                Moonlight follows real moon phases and times. It can illuminate
                a planned-off channel, including during daytime. Use schedules
                for a controlled night light.
              </p>{:else if selectedEffect === "thunder"}<p>
                Planner restrictions refer to planned levels: all zero, or at
                least one above zero. Weekdays restrict storm starts; a front
                may continue into another day. A manual start bypasses these
                restrictions and does not count against the daily quota.
              </p>{:else if selectedEffect === "rain"}<p>
                Weekdays restrict rain-front starts; a front may continue into
                another day. Rain can also make a cloudy day.
              </p>{/if}
            <div class="field-grid weather-values">
            {#each fields.filter((f) => f.group === selectedEffect) as f}{@const k =
                fieldKey(f)}
              <div class:wide={f.type==='array' || f.type==='boolean'}>{#if f.type === "boolean"}<label class="check"
                  ><input
                    type="checkbox"
                    checked={draft[k] === true}
                    onchange={(e) => (draft[k] = e.currentTarget.checked)}
                  />{f.label}</label
                >
              {:else if f.type === "array"}<fieldset>
                  <legend>{f.label} · none means every day</legend>
                  <div class="sensor-months">
                    {#each [1, 2, 3, 4, 5, 6, 0] as n}<label class="check"
                        ><input
                          type="checkbox"
                          aria-label={`Weekday ${n}`}
                          checked={(draft[k] as number[]).includes(n)}
                          onchange={(e) => weekday(n, e.currentTarget.checked)}
                        />{[
                          "Sunday",
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                        ][n]}</label
                      >{/each}
                  </div>
                </fieldset>
              {:else}<label for={`weather-${k}`}>{f.label}</label><input
                  id={`weather-${k}`}
                  inputmode="numeric"
                  value={String(draft[k])}
                  oninput={(e) => (draft[k] = e.currentTarget.value)}
                  aria-invalid={!/^\d+$/.test(String(draft[k])) || Number(draft[k]) < f.min! || Number(draft[k]) > f.max!}
                />
                <p class="field-help">
                  Integer {f.min}–{f.max}; default {String(f.default)}.
                </p>{/if}
            </div>{/each}</div>
            {#if selectedEffect === "thunder" && draft["thunder#zeroonly"] && draft["thunder#nozeroonly"]}<p
              >
                Both planner restrictions are set: automatic thunderstorms
                cannot start. This combination is preserved; change it
                explicitly if unwanted.
              </p>{/if}
            <button type="button" class="secondary" onclick={reset}
              >Reset effect draft</button
            ></div>
          {:else}<p>Selected profile settings are unavailable.</p>
            <button type="button" onclick={() => selectLoad(selected)}
              >Load selected profile</button
            >{/if}
        {:else}<div class="empty-state"><h2>No weather profiles</h2><p>No weather profiles. Add creates a local draft until Save.</p></div>{/if}
        </section><section class="weather-channels" aria-label="Weather channel assignments"><h2>Channel assignments</h2>
        <p>
          Channels sharing a profile have synchronized weather. Assignment does
          not enable planning. Binary channels retain assignments but firmware
          ignores their weather.
        </p>
        <div class="weather-assignments">
          {#each book.channels as ch, i}<div>
              <label for={`weather-channel-${i}`}
                ><ChannelIdentity number={i+1}/></label
              ><select id={`weather-channel-${i}`} aria-label={`Channel ${i + 1} weather profile`} bind:value={ch.profile}
                ><option value={0}>None</option
                >{#if ch.profile && !book.profiles.some((p) => p.id === ch.profile)}<option
                    value={ch.profile}>Unknown profile {ch.profile}</option
                  >{/if}{#each book.profiles as p}<option value={p.id}
                    >{p.name} · #{p.id}</option
                  >{/each}</select
              >{#if ch.binary}<p>Binary output · weather ignored</p>{/if}
            </div>{/each}
        </div>
        </section></div>
        {#if !valid}<p role="alert">
            Check profile names, channel references, integer ranges and
            minimum/maximum shares before saving.
          </p>{/if}
        <p>
          Save writes all changed weather drafts, verifies persisted values, and
          preserves unrelated settings. It does not prove lighting effects.
          Reload before editing after another client; same-key concurrent edits
          cannot be merged.
        </p>
      </fieldset>
    </form>{:else}  <section class="weather-reload">
    <button type="button" class="secondary" onclick={reload} disabled={busy}
      >Reload weather</button
    >
    <p>
      Reload discards all weather drafts. State refresh and navigation keep
      them. Configuration saves and ending service mode reinitialize weather,
      including manually started storms.
    </p>
  </section>
<div class="empty-state"><h2>{busy?'Loading weather…':'Weather settings unavailable'}</h2><p>{busy?'Reading saved profiles and channel assignments.':'Use Reload weather to try again. No draft has been replaced.'}</p></div>{/if}
  <details class="reading-details"><summary>Reading details{stale?' · stale':''}</summary><p>State refreshes every 30 seconds while visible; failures back off to 120 seconds.</p></details>
  <section class="panel readback weather-commands">
    <h2>Global thunderstorm commands</h2>
    <p>
      Start affects all saved enabled profiles assigned to dimmable channels.
      Save drafts first. Time-lapse prevents starting. Stop ends the current
      storm and rain front; continuous mode can restart later. Readback does not
      prove visible flashes.
    </p>
    <div class="form-actions">
      <button
        onclick={() => command({ thunder: 1 })}
        disabled={busy ||
          stale ||
          snapshot.thunder !== false ||
          !!snapshot.timewarp ||
          !book ||
          !eligible(book) ||
          dirty}>Start all thunderstorms</button
      ><button
        onclick={() => command({ thunder: 0 })}
        disabled={busy || snapshot.thunder !== true}
        >Stop all thunderstorms</button
      >
    </div>
  </section>
<WeatherRuntime {busy} {firmware} connectionStale={stale} savedValues={book?.baseline} {perform}/>
</EditorPage>
{/if}

<style>
 .weather-reload { display:block; margin:20px 0 0; } .weather-reload p { margin-top:12px; } .weather-reload>button { flex-shrink:0; } .weather-reload p { margin:0; }
 .weather-workspace { display:grid; grid-template-columns:200px minmax(0,1fr); gap:24px 32px; align-items:start; }
 .weather-profiles { grid-row:span 2; border-right:1px solid var(--sr-line); padding-right:24px; position:sticky; top:100px; }
 .weather-profiles .form-actions { display:grid; } .weather-profiles h2 { font-size:16px; }
 .profile-editor { min-width:0; } .profile-name { max-width:640px; } .profile-name label { margin-top:0; }
 .profile-editor .effect-editor { margin-top:0; padding-top:12px; }
 .effect-switch { display:flex; gap:8px; border-bottom:1px solid var(--sr-line); margin:20px 0; }
 .effect-switch button { background:transparent; border:0; border-radius:0; border-bottom:3px solid transparent; color:var(--sr-muted); }
 .effect-switch button[aria-pressed=true] { color:var(--sr-accent); border-color:var(--sr-accent); }
 .weather-values { max-width:960px; }
 .weather-channels { grid-column:2; border-top:1px solid var(--sr-line); padding-top:24px; min-width:0; }
 .weather-assignments { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px 20px; }
 .weather-assignments label { margin:0; } .weather-assignments p { font-size:12px; }
 .weather-commands { display:grid; grid-template-columns:1fr auto; gap:0 24px; align-items:center; }
 .weather-commands h2 { grid-column:1/-1; } .weather-commands .form-actions { margin:0; }
 @media(max-width:1100px) { .weather-assignments { grid-template-columns:repeat(2,minmax(0,1fr)); } .weather-commands { display:block; } }
 @media(max-width:800px) { .weather-workspace { grid-template-columns:1fr; gap:16px; } .weather-profiles { position:static; border:0; padding:0; display:grid; grid-template-columns:1fr; } .weather-profiles h2,.weather-profiles>p { display:none; } .weather-profiles .form-actions { display:flex; margin:8px 0; } .weather-profiles .weather-reload { margin:8px 0; } .weather-profiles .weather-reload p { font-size:12px; } .weather-channels { grid-column:1; } .weather-reload { display:block; } .weather-reload p { margin-top:12px; } .effect-switch { gap:0; justify-content:space-between; } .effect-switch button { padding:10px 5px; font-size:12px; } }
 @media(min-width:360px) and (max-width:760px) { .profile-editor .field-grid.weather-values { grid-template-columns:repeat(2,minmax(0,1fr)); } .weather-values>div:not(.wide)>label { min-height:42px; display:flex; align-items:end; } }
</style>
