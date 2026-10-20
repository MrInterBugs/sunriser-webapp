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
        "Browser time is outside the device clock range (100001–4294967295 UTC seconds). Correct the browser clock first.";
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
    await perform(
      async () => {
        editor = await loadSettings(kind, wifi);
        snapshotRevision=configurationRevision();
      },
      `${title} settings loaded`,
      `Could not load ${title} settings. Retry Reload ${title} settings.`,
      `Loading ${title} settings…`,
    );
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
      "Saved",
      `Could not confirm ${title} save. The device may have applied it. Draft kept. Verify saved settings before another Save; no automatic write retry.`,
      `Saving ${title} settings…`,
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
      "Verified saved settings; drafts kept.",
      `Could not verify ${title} settings at this address. Draft kept. Check the device address; no write was retried.`,
      "Verifying saved settings…",
    );
  }
  function summary() {
    if (!editor) return "";
    return Object.entries(editor.saved)
      .filter(([key]) => key !== "time")
      .map(
        ([key, v]) =>
          `${key}: ${key === "wifi_pass" ? (v ? "[stored]" : "[empty]") : Array.isArray(v) ? v.join(".") : v === null ? "unset" : String(v)}`,
      )
      .join(" · ");
  }
  const networkGroups = [
    {title:'LAN addressing',keys:['useip4','ip4','ip4_netmask','ip4_gateway','ip4_dns','enforcenet']},
    {title:'Network services',keys:['ntpserver','webport','nofinder']},
    {title:'Wi-Fi · SunRiser 10',keys:['nowifi','wifi_connect','wifi_ssid','wifi_pass','wifi_ip4','wifi_ip4_netmask','wifi_ip4_gateway','wifi_ip4_dns']}
  ];
</script>

{#if active}
<EditorPage>
  <section class="system-page" class:clock-page={kind==='clock'} aria-label={`${title} settings`}>
    <div class="heading">
      <div>

        <h1>{kind === "clock" ? "Clock and timezone" : "Network"}</h1>
      </div>
      <button class="secondary" onclick={refresh} disabled={busy}
        >Refresh {title} state</button
      >
    </div>
    {#if stale}<p class="stale">Last snapshot · stale</p>{/if}
    {#if kind === "clock"}
      <section class="panel readback">
        <dl class="facts">
          <div>
            <dt>Device time (UTC)</dt>
            <dd><ClockReadout text={utc(snapshot.time)}/></dd>
          </div>
          <div>
            <dt>Device local time</dt>
            <dd data-testid="clock-local">
              <ClockReadout text={snapshot.localtime ?? "Not reported"}/>
            </dd>
          </div>
          <div>
            <dt>UTC offset</dt>
            <dd data-testid="clock-offset">
              {snapshot.utc_offset === undefined
                ? "Not reported"
                : `${snapshot.utc_offset} minutes`}
            </dd>
          </div>
        </dl>
        <p>
          Device readback, not your browser's timezone. Clock
          and timezone changes affect schedules. Refresh after saving to read
          the updated clock; an immediate read can precede the next RTC tick.
          Planner time may transition gradually.
        </p>
      </section>
    {:else}
      <section class="panel readback"><h2>Reported addresses</h2><p>Current LAN: <strong>{snapshot.lan_ip}</strong>{#if wifi} · Wi-Fi: <strong>{snapshot.wifi_ip ?? 'Not reported'}</strong>{/if}</p><p>Save stores settings. A later restart can change the address or disconnect this page. This interface does not restart the device.</p></section>
    {/if}

    <div class="form-actions">
      <button class="secondary" onclick={reload} disabled={busy}
        >Reload {title} settings</button
      >
      <button class="secondary" onclick={verify} disabled={busy || !editor}
        >Verify saved settings</button
      >
    </div>
    <p>
      Reload replaces unsaved edits. State refresh and verification keep drafts.
      Configuration is not polled; reload before editing after another client.
    </p>
    <div class="configuration-workspace">{#if editor}
      <form class="panel settings system-editor" onsubmit={save} oninput={onedit}>
        <DraftBar {snapshotRevision} {feedback} {dirty} {busy} disabled={!!invalid||!dirty} label={`Save ${title} settings`} scope="" detail="Saved values are verified independently. Reload replaces drafts; Verify keeps them." />
        <fieldset disabled={busy}>
          <legend
            >{kind === "clock"
              ? "Time configuration"
              : "Network configuration"}</legend
          >
          {#if kind === "clock"}
            <label for="timezone-preset">Timezone preset</label>
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
              <option value="">Legacy UTC offset and summer time</option>
              {#each zones.presets as z}<option value={z.tz}>{z.label}</option
                >{/each}
              <option value="__custom__">Custom POSIX rule below</option>
            </select>
            <label for="timezone-rule">POSIX timezone rule</label><input
              id="timezone-rule"
              type="text"
              bind:value={editor.draft.tz}
              spellcheck="false"
            />
            <p>
              Up to 64 ASCII characters. For example {berlin}, UTC0, or
              NPT-5:45. POSIX offset signs are reversed: -5:45 means UTC+05:45.
              Custom DST uses Mmonth.week.weekday rules; no timezone data is
              downloaded.
            </p>
            {#if editor.draft.tz === ""}
              <label for="legacy-timezone">Legacy timezone</label><select
                id="legacy-timezone"
                bind:value={editor.draft.timezone}
                >{#each zones.legacy as z}<option value={String(z.id)}
                    >{z.label}</option
                  >{/each}</select
              >
              <label class="check"
                ><input
                  type="checkbox"
                  checked={editor.draft.summertime === true}
                  onchange={(e) =>
                    (editor!.draft.summertime = e.currentTarget.checked)}
                />Legacy summer time</label
              >
              <p>
                Legacy regions with no DST ignore the summer switch. Legacy
                UTC+1 with DST allowed follows automatic Berlin even with an
                empty rule; use the fixed UTC+01:00 preset for no seasonal
                change.
              </p>
            {/if}
            <label class="check"
              ><input
                type="checkbox"
                checked={editor.draft.usentp === true}
                onchange={(e) =>
                  (editor!.draft.usentp = e.currentTarget.checked)}
              />Use NTP</label
            >
            <p>
              NTP requires a reachable time server. The server is configured on
              Network. Saving this flag does not prove synchronization; network
              services may need device reinitialization.
            </p>
          {:else}
            <p>
              Hostname identity is edited in <a href="#settings">Settings</a>.
              IPv4 fields use four decimal octets, each 0–255. Blank optional
              fields clear stored values. Static LAN requires all four fields.
            </p>
            <div class="network-groups">{#each networkGroups as group}{#if fieldsFor(wifi).some(f=>group.keys.includes(f.key))}<fieldset class="network-group"><legend>{group.title}</legend><div class="field-grid network-fields">
            {#each fieldsFor(wifi).filter(f=>group.keys.includes(f.key)) as f}
              <div class:network-wide={f.type === "bool" || f.key === "ntpserver" || f.key === "wifi_ssid" || f.type === "password"}>
              {#if f.type === "bool"}<label class="check"
                  ><input
                    type="checkbox"
                    checked={editor.draft[f.key] === true}
                    onchange={(e) =>
                      (editor!.draft[f.key] = e.currentTarget.checked)}
                  />{f.label}</label
                >
              {:else}<label for={`network-${f.key}`}>{f.label}</label><input
                  id={`network-${f.key}`}
                  type={f.type === "password" ? "password" : "text"}
                  inputmode={f.type === "port" ? "numeric" : undefined}
                  autocomplete="off"
                  spellcheck="false"
                  bind:value={editor.draft[f.key]}
                />
                {#if "max" in f}<p class="field-help">
                    Maximum {f.max} UTF-8 bytes{f.key === "ntpserver"
                      ? "; blank restores pool.ntp.org on reload"
                      : ""}.
                  </p>{/if}
              {/if}
            </div>{/each}</div></fieldset>{/if}{/each}</div>
            <p>
              Keep trying DHCP prevents the firmware from falling back to its
              static rescue address after repeated DHCP failure. It may reset
              the network interface while trying again. Web port: 1–65534. Save
              does not validate subnet reachability, DNS or the time server.
              Enabling vendor Finder allows the firmware's vendor service; this
              UI never contacts it.
            </p>
            {#if wifi}<p>
                SR10 supports 2.4 GHz Wi-Fi. A reported address alone does not
                prove a working connection. Blank Wi-Fi IPv4 records no static
                address. These static Wi-Fi fields store configuration only:
                this firmware enables DHCP without applying a static-address
                command. Do not rely on them to change the active Wi-Fi address.
              </p>{/if}
            {#if editor.legacyWifi}<p role="note">
                Legacy Wi-Fi address was stored as a Boolean because of an old
                web schema defect. Shown unset; preserved until you explicitly
                enter an address.
              </p>{/if}
          {/if}
          {#if invalid}<p class="notice" role="note">{invalid}</p>{/if}
        </fieldset>
      </form>
      {#if kind === "clock"}<section class="panel clock-command"><h2>Set device time</h2>
          <button
            onclick={setClock}
            disabled={busy || dirty || editor.saved.usentp !== false}
            >Set clock from browser</button
          >
          <p data-testid="clock-input-error">{clockInputError}</p>
          <p>
            Uses your browser's current UTC seconds. Save any edits and disable
            NTP first. This writes once, then reads device state; it never
            retries automatically.
          </p>
        </section>{/if}
      <details class="panel configuration-readback" bind:open={showReadback}>
        <summary>Last configuration readback</summary>{#if dirty}<p>
            {verifiedMatch
              ? "Edited values match the saved configuration."
              : "Device values differ from this draft. Review readback before saving again."}
          </p>{/if}
        <p class="config-readback" data-testid={`${title}-readback`}>
          {summary()}
        </p>
      </details>
    {:else}<div class="empty-state"><h2>{busy?`Loading ${title} settings…`:'Settings unavailable'}</h2><p>{busy?'Reading saved configuration.':`Use Reload ${title} settings to try again.`}</p></div>{/if}
    {#if kind === 'network'}      <section class="panel readback network-recovery" data-testid="network-recovery">
        <h2>Connection and recovery</h2>
        <p>
          Current LAN: {snapshot.lan_ip}{#if wifi}
            · Reported Wi-Fi address: {snapshot.wifi_ip ?? "Not reported"}{/if}
        </p>
        <p>
          Save stores network settings. A later device restart or network
          reinitialization may disconnect this page or change its address and
          port. This interface does not restart the device. A failed response
          does not prove that a save failed.
        </p>
        <p>
          Keep this tab open to retain drafts. First use Verify saved settings
          at the current address. If disconnected, obtain the assigned address
          from your existing network information, then open it explicitly below.
          No scanning or write retries occur. Disabling Wi-Fi can require LAN
          access. Finder assumes port 80.
        </p>
        <label for="recovery-address">Device address</label><input
          id="recovery-address"
          type="url"
          placeholder="http://192.0.2.42:8080"
          bind:value={address}
        />
        {#if recovery}<a
            href={recovery}
            target="_blank"
            rel="noopener noreferrer">Open device address</a
          >{/if}
        <p>
          Enter an HTTP(S) origin only, without a path, credentials or query.
          Opening it leaves this draft in the original tab. Reads and writes in
          either tab use that tab's own origin.
        </p>
      </section>{/if}
    </div><details class="reading-details"><summary>Reading details</summary>    <p class:stale>
      {stale ? "Last snapshot · stale" : "Device snapshot"} · {utc(
        snapshot.time,
      )}
    </p>
<p>State refreshes every 30 seconds while visible; failures back off to 60 then 120 seconds.</p></details>
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
