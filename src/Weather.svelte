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
      source("weather.weatherLoaded_9a15a"),
      source("weather.couldNotLoadWeatherDraftsKeptExplicitlyRetryReload_32fed"),
      source("weather.loadingWeather_bc236"),
    );
  }
  async function selectLoad(id: number) {
    attemptedIds[id] = true;
    await perform(
      async () => {
        await loadProfile(book!, id);
      },
      source("weather.weatherLoaded_9a15a"),
      source("weather.couldNotLoadWeatherProfileDraftsKeptRetryLoad_89ffe"),
      source("weather.loadingWeather_bc236"),
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
      source("app.saved_c0ae8"),
      source("weather.couldNotConfirmWeatherSaveDraftsKeptReloadTo_203f4"),
      source("weather.savingWeather_7fc8d"),
    );
  }
  function add() {
    if (!book) return;
    const id = addProfile(book);
    if (id) {book.profiles.find(profile=>profile.id===id)!.name=$t("weather.newProfileV0_3363f",{v0:id});selected = id;}
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

      <h1>{$t("weather.weather_284af")}</h1>
    </div>
    <button class="secondary" onclick={refresh} disabled={busy}
      >{$t("weather.refreshWeatherState_c0483")}</button
    >
  </div>
  <p class:stale>
    {$t("weather.thunderstorms_b57d4")}{stale ? $t("app.readbackStale_e56ed") : ''}:
    <strong data-testid="weather-thunder"
      >{typeof snapshot.thunder === "boolean"
        ? snapshot.thunder
          ? $t("lightingdashboard.active_a733b")
          : $t("lightingdashboard.off_e3de5")
        : $t("weather.unknown_bc781")}</strong
    >
  </p>

  {#if book}<form class="panel" onsubmit={save} oninput={onedit} novalidate>
      <DraftBar {snapshotRevision} feedback={$renderText(feedback)} {dirty} {busy} disabled={!valid||!dirty} label={$t("weather.saveWeather_5241a")} scope={$t("weather.weather_f9866")} detail={$t("weather.saveAppliesToAllEditedProfilesAndChannelAssignments_5fe83")} />
      <fieldset disabled={busy}>
        <legend class="visually-hidden">{$t("weather.weatherConfiguration_74d13")}</legend>
        <div class="weather-workspace"><aside class="weather-profiles" aria-label={$t("weather.weatherProfiles_3b38a")}><h2>{$t("weather.profiles_0c2a9")}</h2><div><label for="weather-profile">{$t("weather.weatherProfile_9a2f1")}</label><select
            id="weather-profile"
            bind:value={selected}
            >{#each book.profiles as p}<option value={p.id}
                >{p.name} · #{p.id}</option
              >{/each}</select
          >
          </div>        <div class="form-actions">
          <button type="button" onclick={add} disabled={nextId(book) > 65535}
            >{$t("weather.addWeatherProfile_777d8")}</button
          ><button
            type="button"
            class="secondary"
            onclick={remove}
            disabled={!profile ||
              book.channels.some((c) => c.profile === selected)}
            >{$t("weather.deleteWeatherProfile_e4c91")}</button
          >
        </div>
        {#if nextId(book) > 65535}<p>
            {$t("weather.profileIDsExhausted65535NoIDWillBeReused_3de4e")}
          </p>{/if}
<p>{$t("weather.profilesConfigureEffectsAssignThemToChannelsBelow_e493e")}</p>  <section class="weather-reload">
    <button type="button" class="secondary" onclick={reload} disabled={busy}
      >{$t("weather.reloadWeather_b6431")}</button
    >
    <p>
      {$t("weather.reloadDiscardsAllWeatherDraftsStateRefreshAndNavigation_d2c5f")}
    </p>
  </section>
</aside><section class="profile-editor" aria-label={$t("weather.weatherProfileEditor_6e375")}>
        {#if book.profiles.length}
          <div class="profile-name">{#if profile}<div><label for="weather-name">{$t("weather.profileName_77574")}</label><input
              id="weather-name"
              bind:value={profile.name}
              aria-invalid={!profile.name.trim()}
            /></div>{/if}</div>
          {#if draft}
            <div class="panel effect-editor"><StateBadge tone={dirty?'draft':'neutral'}>{dirty?$t("weather.profileEditorUnsavedChangesInWeather_c5125"):$t("weather.profileEditorSavedConfiguration_21c53")}</StateBadge>
            <div class="effect-switch" role="group" aria-label={$t("weather.weatherEffect_4afe3")}>{#each [['clouds',source("weather.clouds_99990")],['rain',source("weather.rain_0a858")],['thunder',source("weather.thunderstorms_b57d4")],['moon',source("weather.moonlight_f61a8")]] as [value,label]}<button type="button" aria-pressed={selectedEffect===value} onclick={()=>selectedEffect=value as Effect}>{$renderText(label)}</button>{/each}</div>
            {#if selectedEffect === "moon"}<p>
                {$t("weather.moonlightFollowsRealMoonPhasesAndTimesItCan_faf17")}
              </p>{:else if selectedEffect === "thunder"}<p>
                {$t("weather.plannerRestrictionsReferToPlannedLevelsAllZeroOr_af492")}
              </p>{:else if selectedEffect === "rain"}<p>
                {$t("weather.weekdaysRestrictRainFrontStartsAFrontMayContinue_cb5ff")}
              </p>{/if}
            <div class="field-grid weather-values">
            {#each fields.filter((f) => f.group === selectedEffect) as f}{@const k =
                fieldKey(f)}
              <div class:wide={f.type==='array' || f.type==='boolean'}>{#if f.type === "boolean"}<label class="check"
                  ><input
                    type="checkbox"
                    checked={draft[k] === true}
                    onchange={(e) => (draft[k] = e.currentTarget.checked)}
                  />{$renderText(f.label)}</label
                >
              {:else if f.type === "array"}<fieldset>
                  <legend>{$renderText(f.label)} {$t("weather.noneMeansEveryDay_4b11f")}</legend>
                  <div class="sensor-months">
                    {#each [1, 2, 3, 4, 5, 6, 0] as n}<label class="check"
                        ><input
                          type="checkbox"
                          aria-label={$t("weather.weekdayV0_dbc34",{v0: n})}
                          checked={(draft[k] as number[]).includes(n)}
                          onchange={(e) => weekday(n, e.currentTarget.checked)}
                        />{[
                          $t("schedules.sunday_bc5dd"),
                          $t("schedules.monday_932ee"),
                          $t("schedules.tuesday_42e43"),
                          $t("schedules.wednesday_5656b"),
                          $t("schedules.thursday_76031"),
                          $t("schedules.friday_d166e"),
                          $t("schedules.saturday_17063"),
                        ][n]}</label
                      >{/each}
                  </div>
                </fieldset>
              {:else}<label for={`weather-${k}`}>{$renderText(f.label)}</label><input
                  id={`weather-${k}`}
                  inputmode="numeric"
                  value={String(draft[k])}
                  oninput={(e) => (draft[k] = e.currentTarget.value)}
                  aria-invalid={!/^\d+$/.test(String(draft[k])) || Number(draft[k]) < f.min! || Number(draft[k]) > f.max!}
                />
                <p class="field-help">
                  {$t("weather.integer_9edcf")} {f.min}–{f.max}{$t("weather.default_887ff")} {String(f.default)}.
                </p>{/if}
            </div>{/each}</div>
            {#if selectedEffect === "thunder" && draft["thunder#zeroonly"] && draft["thunder#nozeroonly"]}<p
              >
                {$t("weather.bothPlannerRestrictionsAreSetAutomaticThunderstormsCannotStart_cb20e")}
              </p>{/if}
            <button type="button" class="secondary" onclick={reset}
              >{$t("weather.resetEffectDraft_c16b1")}</button
            ></div>
          {:else}<p>{$t("weather.selectedProfileSettingsAreUnavailable_811df")}</p>
            <button type="button" onclick={() => selectLoad(selected)}
              >{$t("weather.loadSelectedProfile_35799")}</button
            >{/if}
        {:else}<div class="empty-state"><h2>{$t("weather.noWeatherProfiles_9f244")}</h2><p>{$t("weather.noWeatherProfilesAddCreatesALocalDraftUntil_225a1")}</p></div>{/if}
        </section><section class="weather-channels" aria-label={$t("weather.weatherChannelAssignments_857f2")}><h2>{$t("sensors.channelAssignments_433f0")}</h2>
        <p>
          {$t("weather.channelsSharingAProfileHaveSynchronizedWeatherAssignmentDoes_77eed")}
        </p>
        <div class="weather-assignments">
          {#each book.channels as ch, i}<div>
              <label for={`weather-channel-${i}`}
                ><ChannelIdentity number={i+1}/></label
              ><select id={`weather-channel-${i}`} aria-label={$t("weather.channelV0WeatherProfile_3aeeb",{v0: i + 1})} bind:value={ch.profile}
                ><option value={0}>{$t("weather.none_6eef6")}</option
                >{#if ch.profile && !book.profiles.some((p) => p.id === ch.profile)}<option
                    value={ch.profile}>{$t("weather.unknownProfile_b4e36")} {ch.profile}</option
                  >{/if}{#each book.profiles as p}<option value={p.id}
                    >{p.name} · #{p.id}</option
                  >{/each}</select
              >{#if ch.binary}<p>{$t("weather.binaryOutputWeatherIgnored_966de")}</p>{/if}
            </div>{/each}
        </div>
        </section></div>
        {#if !valid}<p role="alert">
            {$t("weather.checkProfileNamesChannelReferencesIntegerRangesAndMinimum_320b9")}
          </p>{/if}
        <p>
          {$t("weather.saveWritesAllChangedWeatherDraftsVerifiesPersistedValues_f2942")}
        </p>
      </fieldset>
    </form>{:else}  <section class="weather-reload">
    <button type="button" class="secondary" onclick={reload} disabled={busy}
      >{$t("weather.reloadWeather_b6431")}</button
    >
    <p>
      {$t("weather.reloadDiscardsAllWeatherDraftsStateRefreshAndNavigation_d2c5f")}
    </p>
  </section>
<div class="empty-state"><h2>{busy?$t("weather.loadingWeather_bc236"):$t("weather.weatherSettingsUnavailable_c09c1")}</h2><p>{busy?$t("weather.readingSavedProfilesAndChannelAssignments_76a87"):$t("weather.useReloadWeatherToTryAgainNoDraftHas_6c1b6")}</p></div>{/if}
  <details class="reading-details"><summary>{$t("app.readingDetails_28520")}{stale?$t("app.readbackStale_e56ed"):''}</summary><p>{$t("weather.stateRefreshesEvery30SecondsWhileVisibleFailuresBack_a0363")}</p></details>
  <section class="panel readback weather-commands">
    <h2>{$t("weather.globalThunderstormCommands_2f34e")}</h2>
    <p>
      {$t("weather.startAffectsAllSavedEnabledProfilesAssignedToDimmable_dad12")}
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
          dirty}>{$t("weather.startAllThunderstorms_e9e21")}</button
      ><button
        onclick={() => command({ thunder: 0 })}
        disabled={busy || snapshot.thunder !== true}
        >{$t("weather.stopAllThunderstorms_4ded4")}</button
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
 .weather-values { max-width:960px; } .weather-values label { overflow-wrap:anywhere; hyphens:auto; }
 .weather-channels { grid-column:2; border-top:1px solid var(--sr-line); padding-top:24px; min-width:0; }
 .weather-assignments { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px 20px; }
 .weather-assignments label { margin:0; } .weather-assignments p { font-size:12px; }
 .weather-commands { display:grid; grid-template-columns:1fr auto; gap:0 24px; align-items:center; }
 .weather-commands h2 { grid-column:1/-1; } .weather-commands .form-actions { margin:0; }
 @media(max-width:1100px) { .weather-assignments { grid-template-columns:repeat(2,minmax(0,1fr)); } .weather-commands { display:block; } }
 @media(max-width:800px) { .weather-workspace { grid-template-columns:1fr; gap:16px; } .weather-profiles { position:static; border:0; padding:0; display:grid; grid-template-columns:1fr; } .weather-profiles h2,.weather-profiles>p { display:none; } .weather-profiles .form-actions { display:flex; margin:8px 0; } .weather-profiles .weather-reload { margin:8px 0; } .weather-profiles .weather-reload p { font-size:12px; } .weather-channels { grid-column:1; } .weather-reload { display:block; } .weather-reload p { margin-top:12px; } .effect-switch { gap:0; justify-content:space-between; } .effect-switch button { padding:10px 5px; font-size:12px; } }
 @media(min-width:360px) and (max-width:760px) { .profile-editor .field-grid.weather-values { grid-template-columns:repeat(2,minmax(0,1fr)); } .weather-values>div:not(.wide)>label { min-height:42px; display:flex; align-items:end; } }
.effect-switch button:hover:not(:disabled){background:var(--sr-soft);color:var(--sr-ink)}
</style>
