<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {timezoneLabel} from "./i18n";
 import {source,t,renderText,language} from './i18n';
 import {configurationState,configurationRevision,configurationCurrent} from './configuration-state';
 let snapshotRevision=$state(configurationRevision());
  import ClockReadout from "./ui/ClockReadout.svelte";
  import EditorPage from './ui/EditorPage.svelte';
  import DraftBar from './ui/DraftBar.svelte';
  import {
    readConfig,
    saveConfiguration,
    utc,
    type Firmware,
    type DeviceState,
  } from "./api";
  import {
    zones,
    berlin,
    fieldsFor,
    keysFor,
    loadSettings,
    validation,
    settingsPatch,
    recoveryURL,
    type SettingsPage,
    type Editor,
  } from "./system";
  let {
    active,
    feedback,
    kind,
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
    kind: SettingsPage;
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
    command: (value: { time: number }) => Promise<void>;
    onedit: () => void;
  } = $props();
  let loadFailure = $state(''),loadingSettings=$state(false);
  let attempted = $state(false),
    editor = $state<Editor>();
  let address = $state(""),
    clockInputError = $state(""),
    showReadback = $state(false);
  async function setClock() {
    const seconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isInteger(seconds) ||
      seconds <= 100000 ||
      seconds > 4294967295
    ) {
      clockInputError =
        source("systemsettings.browserTimeIsOutsideTheDeviceClockRange100001_e97f1");
      return;
    }
    clockInputError = "";
    await command({ time: seconds });
  }
  const wifi = $derived(firmware.wifi && firmware.pwm_count === 10);
  const invalid = $derived(editor ? validation(kind, editor.draft, wifi) : "");
  const dirty = $derived(
    !!editor &&
      JSON.stringify(editor.draft) !== JSON.stringify(editor.baseline),
  );
  const recovery = $derived(recoveryURL(address));
  const verifiedMatch = $derived(
    editor &&
      !invalid &&
      Object.entries(settingsPatch(kind, editor, wifi)).every(
        ([k, v]) => JSON.stringify(editor!.saved[k]) === JSON.stringify(v),
      ),
  );
  const title = $derived(kind === "clock" ? "clock" : "network");
  $effect(() => {
    if (active && !attempted && !busy && !$configurationState.recovery) void reload();
  });
  async function reload() {
    attempted = true;
    loadFailure='';loadingSettings=true;
    try{await perform(
      async () => {
        try{editor = await loadSettings(kind, wifi);snapshotRevision=configurationRevision();}
        catch(e){loadFailure=e instanceof Error?e.message:source("systemsettings.configurationReadFailed_c5b59");throw e;}
      },
      source("systemsettings.v0SettingsLoaded_41a17",{v0:title}),
      source("systemsettings.couldNotLoadV0SettingsRetryReloadV1Settings_d7768",{v0:title,v1:title}),
      source("systemsettings.loadingV0Settings_ffcfc",{v0:title}),
    );}finally{loadingSettings=false;}
  }
  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (!editor || invalid || !dirty || !configurationCurrent(snapshotRevision)) return;
    const current = editor,
      patch = settingsPatch(kind, current, wifi);
    await perform(
      async () => {
        await saveConfiguration(patch, firmware);
        Object.assign(current.saved, patch);
        if ("wifi_ip4" in patch) current.legacyWifi = false;
        if (kind === "clock") {
          if ("gmtoff" in patch) current.draft.gmtoff = String(patch.gmtoff);
          if ("nodst" in patch) current.draft.nodst = patch.nodst as boolean;
        }
        current.baseline = { ...current.draft };
      },
      source("app.saved_c0ae8"),
      source("systemsettings.couldNotConfirmV0SaveTheDeviceMayHave_8fa1e",{v0:title}),
      source("systemsettings.savingV0Settings_bc9de",{v0:title}),
    );
  }
  async function verify() {
    if (!editor) return;
    // Verification deliberately updates only displayed persistence, never the draft.
    await perform(
      async () => {
        editor!.saved = await readConfig(keysFor(kind, wifi));
        showReadback = true;
      },
      source("systemsettings.verifiedSavedSettingsDraftsKept_a7de5"),
      source("systemsettings.couldNotVerifyV0SettingsAtThisAddressDraft_ce343",{v0:title}),
      source("systemsettings.verifyingSavedSettings_d8ee3"),
    );
  }
  function summary() {
    if (!editor) return "";
    return Object.entries(editor.saved)
      .filter(([key]) => key !== "time")
      .map(
        ([key, v]) =>
          source("systemsettings.v0V1_98b58",{v0:key,v1:key === "wifi_pass" ? (v ? $t('common.stored') : $t('common.empty')) : Array.isArray(v) ? v.join(".") : v === null ? $t('common.unset') : String(v)}),
      )
      .join(" · ");
  }
  const networkGroups = [
    {title:source("network.lanAddressing"),keys:['useip4','ip4','ip4_netmask','ip4_gateway','ip4_dns','enforcenet']},
    {title:source("network.services"),keys:['ntpserver','webport','nofinder']},
    {title:source("network.wifiSR10"),keys:['nowifi','wifi_connect','wifi_ssid','wifi_pass','wifi_ip4','wifi_ip4_netmask','wifi_ip4_gateway','wifi_ip4_dns']}
  ];
</script>

{#if active}
<EditorPage>
  <section class="system-page" class:clock-page={kind==='clock'} aria-label={$t("systemsettings.v0Settings_2e59c",{v0: $language==='de'?(kind==='clock'?'Uhrzeit':'Netzwerk'):title})}>
    <div class="heading">
      <div>

        <h1>{kind === "clock" ? $t("systemsettings.clockAndTimezone_798fe") : $t("help.network_53ebc")}</h1>
      </div>
      <button class="secondary" onclick={refresh} disabled={busy}
        >{kind==='clock'?$t('clock.refreshState'):$t('network.refreshState')}</button
      >
    </div>
    {#if stale}<p class="stale">{$t("app.lastSnapshotStale_329af")}</p>{/if}
    {#if kind === "clock"}
      <section class="panel readback">
        <dl class="facts">
          <div>
            <dt>{$t("app.deviceTimeUTC_99f56")}</dt>
            <dd><ClockReadout text={utc(snapshot.time)}/></dd>
          </div>
          <div>
            <dt>{$t("systemsettings.deviceLocalTime_50001")}</dt>
            <dd data-testid="clock-local">
              <ClockReadout text={snapshot.localtime ?? source("systemsettings.notReported_98e85")}/>
            </dd>
          </div>
          <div>
            <dt>{$t("systemsettings.utcOffset_c545d")}</dt>
            <dd data-testid="clock-offset">
              {snapshot.utc_offset === undefined
                ? $t("systemsettings.notReported_98e85")
                : $t("systemsettings.v0Minutes_5e99e",{v0: snapshot.utc_offset})}
            </dd>
          </div>
        </dl>
        <p>
          {$t("systemsettings.deviceReadbackNotYourBrowserSTimezoneClockAnd_86e1c")}
        </p>
      </section>
    {:else}
      <section class="panel readback"><h2>{$t("systemsettings.reportedAddresses_343af")}</h2><p>{$t("systemsettings.currentLAN_949e8")} <strong>{snapshot.lan_ip}</strong>{#if wifi} {$t("systemsettings.wiFi_de13c")} <strong>{snapshot.wifi_ip ?? $t("systemsettings.notReported_98e85")}</strong>{/if}</p><p>{$t("systemsettings.saveStoresSettingsALaterRestartCanChangeThe_538a0")}</p></section>
    {/if}

    <div class="form-actions">
      <button class="secondary" onclick={reload} disabled={busy}
        >{kind==='clock'?$t('clock.reloadSettings'):$t('network.reloadSettings')}</button
      >
      <button class="secondary" onclick={verify} disabled={busy || !editor}
        >{$t("systemsettings.verifySavedSettings_8b41f")}</button
      >
    </div>
    <p>
      {$t("systemsettings.reloadReplacesUnsavedEditsStateRefreshAndVerificationKeep_f19ab")}
    </p>
    {#if loadFailure}<p class="notice" role="note">{$t('systemsettings.savedConfigurationUnavailable',{v0:$language==='de'?(kind==='clock'?'Uhrzeit':'Netzwerk'):title,v1:$renderText(loadFailure)})} {kind==='clock'?$t("systemsettings.liveClockReadbackIsIndependentOfThisSettingsRequest_d4b64"):$t("systemsettings.reportedAddressesAreIndependentOfThisSettingsRequest_d5a07")} {$t("systemsettings.reloadRetriesTheReadItDoesNotWriteSettings_aaef7")}</p>{/if}
    <div class="configuration-workspace">{#if editor}
      <form class="panel settings system-editor" onsubmit={save} oninput={onedit}>
        <DraftBar {snapshotRevision} feedback={$renderText(feedback)} {dirty} {busy} disabled={!!invalid||!dirty} label={$t("systemsettings.saveV0Settings_f4607",{v0: $language==='de'?(kind==='clock'?'Uhrzeit':'Netzwerk'):title})} scope="" detail={$t("systemsettings.savedValuesAreVerifiedIndependentlyReloadReplacesDraftsVerify_5cbd7")} />
        <fieldset disabled={busy}>
          <legend
            >{kind === "clock"
              ? $t("systemsettings.timeConfiguration_9569d")
              : $t("systemsettings.networkConfiguration_cc38b")}</legend
          >
          {#if kind === "clock"}
            <label for="timezone-preset">{$t("systemsettings.timezonePreset_6f4bb")}</label>
            <select
              id="timezone-preset"
              value={zones.presets.some((z) => z.tz === editor!.draft.tz)
                ? editor.draft.tz
                : editor.draft.tz === ""
                  ? ""
                  : "__custom__"}
              onchange={(e) => {
                if (e.currentTarget.value !== "__custom__")
                  editor!.draft.tz = e.currentTarget.value;
                onedit();
              }}
            >
              <option value="">{$t("systemsettings.legacyUTCOffsetAndSummerTime_9f88c")}</option>
              {#each zones.presets as z}<option value={z.tz}>{timezoneLabel(z.label,$language)}</option
                >{/each}
              <option value="__custom__">{$t("systemsettings.customPOSIXRuleBelow_d9e18")}</option>
            </select>
            <label for="timezone-rule">{$t("systemsettings.posixTimezoneRule_3ec79")}</label><input
              id="timezone-rule"
              type="text"
              bind:value={editor.draft.tz}
              spellcheck="false"
            />
            <p>
              {$t("systemsettings.upTo64ASCIICharactersForExample_dc06e")} {berlin}{$t("systemsettings.utc0OrNPT545POSIXOffsetSignsAre_647b7")}
            </p>
            {#if editor.draft.tz === ""}
              <label for="legacy-timezone">{$t("systemsettings.legacyTimezone_45325")}</label><select
                id="legacy-timezone"
                bind:value={editor.draft.timezone}
                >{#each zones.legacy as z}<option value={String(z.id)}
                    >{timezoneLabel(z.label,$language)}</option
                  >{/each}</select
              >
              <label class="check"
                ><input
                  type="checkbox"
                  checked={editor.draft.summertime === true}
                  onchange={(e) =>
                    (editor!.draft.summertime = e.currentTarget.checked)}
                />{$t("systemsettings.legacySummerTime_8d9b2")}</label
              >
              <p>
                {$t("systemsettings.legacyRegionsWithNoDSTIgnoreTheSummerSwitch_0d4d3")}
              </p>
            {/if}
            <label class="check"
              ><input
                type="checkbox"
                checked={editor.draft.usentp === true}
                onchange={(e) =>
                  (editor!.draft.usentp = e.currentTarget.checked)}
              />{$t("systemsettings.useNTP_5bc8b")}</label
            >
            <p>
              {$t("systemsettings.ntpRequiresAReachableTimeServerTheServerIs_59b4c")}
            </p>
          {:else}
            <p>
              {$t("systemsettings.hostnameIdentityIsEditedIn_71425")} <a href="#settings">{$t("app.settings_c7f73")}</a>{$t("systemsettings.ipv4FieldsUseFourDecimalOctetsEach0255_6a2d2")}
            </p>
            <div class="network-groups">{#each networkGroups as group}{#if fieldsFor(wifi).some(f=>group.keys.includes(f.key))}<fieldset class="network-group"><legend>{$renderText(group.title)}</legend><div class="field-grid network-fields">
            {#each fieldsFor(wifi).filter(f=>group.keys.includes(f.key)) as f}
              <div class:network-wide={f.type === "bool" || f.key === "ntpserver" || f.key === "wifi_ssid" || f.type === "password"}>
              {#if f.type === "bool"}<label class="check"
                  ><input
                    type="checkbox"
                    checked={editor.draft[f.key] === true}
                    onchange={(e) =>
                      (editor!.draft[f.key] = e.currentTarget.checked)}
                  />{$renderText(f.label)}</label
                >
              {:else}<label for={`network-${f.key}`}>{$renderText(f.label)}</label><input
                  id={`network-${f.key}`}
                  type={f.type === "password" ? "password" : "text"}
                  inputmode={f.type === "port" ? "numeric" : undefined}
                  autocomplete="off"
                  spellcheck="false"
                  bind:value={editor.draft[f.key]}
                />
                {#if "max" in f}<p class="field-help">
                    {$t("systemsettings.maximum_a8df2")} {f.max} {$t("systemsettings.utf8Bytes_83134")}{f.key === "ntpserver"
                      ? $t("systemsettings.blankRestoresPoolNtpOrgOnReload_777ca")
                      : ""}.
                  </p>{/if}
              {/if}
            </div>{/each}</div></fieldset>{/if}{/each}</div>
            <p>
              {$t("systemsettings.keepTryingDHCPPreventsTheFirmwareFromFallingBack_4222e")}
            </p>
            {#if wifi}<p>
                {$t("systemsettings.sr10Supports24GHzWiFiAReported_40a81")}
              </p>{/if}
            {#if editor.legacyWifi}<p role="note">
                {$t("systemsettings.legacyWiFiAddressWasStoredAsABoolean_a0624")}
              </p>{/if}
          {/if}
          {#if invalid}<p class="notice" role="note">{$renderText(invalid)}</p>{/if}
        </fieldset>
      </form>
      {#if kind === "clock"}<section class="panel clock-command"><h2>{$t("systemsettings.setDeviceTime_8355e")}</h2>
          <button
            onclick={setClock}
            disabled={busy || dirty || editor.saved.usentp !== false}
            >{$t("systemsettings.setClockFromBrowser_cdbf5")}</button
          >
          <p data-testid="clock-input-error">{$renderText(clockInputError)}</p>
          <p>
            {$t("systemsettings.usesYourBrowserSCurrentUTCSecondsSaveAny_3a6ba")}
          </p>
        </section>{/if}
      <details class="panel configuration-readback" bind:open={showReadback}>
        <summary>{$t("systemsettings.lastConfigurationReadback_530f1")}</summary>{#if dirty}<p>
            {verifiedMatch
              ? $t("systemsettings.editedValuesMatchTheSavedConfiguration_c62e9")
              : $t("systemsettings.deviceValuesDifferFromThisDraftReviewReadbackBefore_d4f3c")}
          </p>{/if}
        <p class="config-readback" data-testid={`${$language==='de'?(kind==='clock'?'Uhrzeit':'Netzwerk'):title}-readback`}>
          {summary()}
        </p>
      </details>
    {:else}<div class="empty-state"><h2>{loadingSettings?$t("systemsettings.loadingV0Settings_ffcfc",{v0: $language==='de'?(kind==='clock'?'Uhrzeit':'Netzwerk'):title}):$t("systemsettings.settingsUnavailable_4b7b1")}</h2><p>{loadingSettings?$t("systemsettings.readingSavedConfiguration_e2dcf"):$t("systemsettings.useReloadV0SettingsToTryAgain_9b5c9",{v0: $language==='de'?(kind==='clock'?'Uhrzeit':'Netzwerk'):title})}</p></div>{/if}
    {#if kind === 'network'}      <section class="panel readback network-recovery" data-testid="network-recovery">
        <h2>{$t("systemsettings.connectionAndRecovery_8f4bf")}</h2>
        <p>
          {$t("systemsettings.currentLAN_949e8")} {snapshot.lan_ip}{#if wifi}
            {$t("systemsettings.reportedWiFiAddress_a6973")} {snapshot.wifi_ip ?? $t("systemsettings.notReported_98e85")}{/if}
        </p>
        <p>
          {$t("systemsettings.saveStoresNetworkSettingsALaterDeviceRestartOr_e2df8")}
        </p>
        <p>
          {$t("systemsettings.keepThisTabOpenToRetainDraftsFirstUse_1dec5")}
        </p>
        <label for="recovery-address">{$t("systemsettings.deviceAddress_5feb5")}</label><input
          id="recovery-address"
          type="url"
          placeholder="http://192.0.2.42:8080"
          bind:value={address}
        />
        {#if recovery}<a
            href={recovery}
            target="_blank"
            rel="noopener noreferrer">{$t("systemsettings.openDeviceAddress_94e80")}</a
          >{/if}
        <p>
          {$t("systemsettings.enterAnHTTPSOriginOnlyWithoutAPath_a41d3")}
        </p>
      </section>{/if}
    </div><details class="reading-details"><summary>{$t("app.readingDetails_28520")}</summary>    <p class:stale>
      {stale ? $t("app.lastSnapshotStale_329af") : $t("sensors.deviceSnapshot_35538")} · {utc(
        snapshot.time,
      )}
    </p>
<p>{$t("systemsettings.stateRefreshesEvery30SecondsWhileVisibleFailuresBack_318d2")}</p></details>
  </section>
</EditorPage>
{/if}

<style>
 .configuration-workspace { display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:0 32px; align-items:start; }
 .system-page .system-editor { min-width:0; grid-column:1; }
 .system-page section.clock-command { grid-column:2; grid-row:1; background:var(--sr-surface); border-left:2px solid var(--sr-accent); padding:24px; border-radius:var(--sr-radius); }
 .configuration-readback { grid-column:1; min-width:0; }
 .system-page section.network-recovery { grid-column:2; grid-row:1/3; position:sticky; top:20px; }
 .network-groups { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px; align-items:start; }
 .system-page .network-group { padding:20px; border:1px solid var(--sr-line); border-radius:var(--sr-radius); background:var(--sr-surface); margin:12px 0; }
 .network-group>legend { font-size:17px; padding:0 8px; margin:0; }
 .network-group:last-child:nth-child(3) { grid-column:1/-1; }
 .network-group .field-grid { gap:4px 16px; } .network-wide { grid-column:1/-1; }
 .clock-page .readback dd { font-size:22px; letter-spacing:-.5px; }
 .clock-page input#timezone-rule,.clock-page select#timezone-preset,.clock-page select#legacy-timezone { max-width:760px; }
 @media(max-width:1250px) { .configuration-workspace { grid-template-columns:minmax(0,1fr) 260px; gap:0 24px; } .network-groups { grid-template-columns:1fr; gap:8px; } .network-group:last-child:nth-child(3) { grid-column:1; } }
 @media(max-width:900px) { .configuration-workspace { grid-template-columns:1fr; } .system-page section.clock-command,.system-page section.network-recovery { grid-column:1; grid-row:auto; position:static; } .clock-page .facts { grid-template-columns:1fr 1fr; } }
 @media(max-width:760px) { .clock-page .readback dd { font-size:16px; letter-spacing:0; } .system-page .network-group { padding:16px 12px; } .system-page .field-grid.network-fields { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 12px; } }
</style>
