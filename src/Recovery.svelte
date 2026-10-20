<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
  import EditorPage from './ui/EditorPage.svelte';
  import StateBadge from './ui/StateBadge.svelte';
  import type { Firmware, DeviceState } from "./api";
  import {
    validateBackup,
    validateBee,
    recoveryRequest,
    acknowledged,
    uploadFirmware,
    readRecovery,
    download,
    RecoveryError,
    BACKUP_LIMIT,
    BEE_LIMIT,
    type BeeInfo,
  } from "./recovery";
  import demos from "./recovery-demos.json";
  let {
    active,
    busy,
    firmware,
    perform,
    onread,
  }: {
    active: boolean;
    busy: boolean;
    firmware: Firmware;
    perform: (
      task: () => Promise<void>,
      success: string,
      failure: string,
      pending: string,
    ) => Promise<boolean>;
    onread: (state: DeviceState, info: Firmware, name: string) => void;
  } = $props();
  type Operation = "restore" | "firmware" | "factory" | "reset" | "reboot";
  let backup = $state<Uint8Array>(),
    values = $state<Record<string, unknown>>(),
    backupName = $state(""),
    backupMessage = $state("Select one MessagePack backup."),
    image = $state<Uint8Array>(),
    imageInfo = $state<BeeInfo>(),
    imageName = $state(""),
    imageMessage = $state("Select one local BEE file.");
  let confirm = $state<Operation>(),
    result = $state("No recovery operation requested."),
    progress = $state(""),
    selecting = $state(false),
    demo = $state<keyof typeof demos>("standard");
  let expected: Uint8Array | undefined;
  // After the device rejected a restore upload with HTTP 413 (see FRAMING_HEADER in recovery.ts), the next deliberate,
  // separately confirmed restore changes the request's framing. Nothing is retried automatically.
  let restoreFraming = $state(false);
  function modal(node: HTMLDialogElement) {
    node.showModal();
    node.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
  }
  const labels: Record<Operation, string> = {
    restore: "Restore configuration",
    firmware: "Install firmware",
    factory: "Replace factory image and clear configuration",
    reset: "Clear configuration",
    reboot: "Reboot device",
  };
  async function selectFile(event: Event, kind: "backup" | "firmware") {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    selecting = true;
    if (kind === "backup") {
      backup = undefined;
      values = undefined;
      backupName = file.name;
    } else {
      image = undefined;
      imageInfo = undefined;
      imageName = file.name;
    }
    try {
      if (file.size > (kind === "backup" ? BACKUP_LIMIT : BEE_LIMIT))
        throw Error("File exceeds local size limit");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (kind === "backup") {
        values = validateBackup(bytes, firmware.pwm_count);
        backup = bytes;
        backupMessage = `${file.name}: ${Object.keys(values).length} keys, ${bytes.length} bytes. Format valid; setting semantics are not fully validated.`;
      } else {
        imageInfo = await validateBee(bytes, firmware.pwm_count);
        image = bytes;
        imageMessage = `${file.name}: ${bytes.length} bytes. ${imageInfo.filename} — ${imageInfo.description}`;
      }
    } catch (e) {
      if (kind === "backup") backupMessage = `Invalid backup: ${String(e)}`;
      else imageMessage = `Invalid firmware: ${String(e)}`;
    } finally {
      selecting = false;
    }
  }
  function previewDemo() {
    const bytes = Uint8Array.from(atob(demos[demo]), (c) => c.charCodeAt(0));
    try {
      values = validateBackup(bytes, firmware.pwm_count);
      backup = bytes;
      backupName = demo + ".mp";
      backupMessage = `${backupName}: ${Object.keys(values).length} keys, ${bytes.length} bytes. Example will merge its supplied settings.`;
    } catch (e) {
      backup = undefined;
      values = undefined;
      backupMessage = "Invalid example: " + String(e);
    }
  }
  async function exportBackup(factory = false) {
    const ok = await perform(
      async () => {
        const bytes = await recoveryRequest(
          "GET",
          factory ? "/factorybackup" : "/backup",
        );
        validateBackup(bytes);
        download(
          bytes,
          factory ? "factory-reset-backup.mp" : "sunriser-backup.mp",
        );
      },
      "Backup downloaded.",
      "Backup download failed.",
      "Downloading backup…",
    );
    result = ok
      ? "Backup downloaded. Stored overrides only; protect any credentials in this file."
      : "Download failed. The backup may be missing or empty, or the connection unavailable. No configuration was changed.";
  }
  async function execute() {
    const op = confirm;
    if (!op || busy) return;
    confirm = undefined;
    expected = op === "restore" ? backup : undefined;
    result = "Operation in progress…";
    progress =
      op === "restore"
        ? `Sending ${backup!.length} backup bytes…`
        : op === "factory"
          ? `Sending ${image!.length} factory image bytes…`
          : op === "reset"
            ? "Requesting deletion of stored configuration…"
            : op === "reboot"
              ? "Requesting reboot; the connection may close…"
              : "Preparing firmware upload…";
    let failure: unknown;
    const framing = op === "restore" && restoreFraming;
    const ok = await perform(
      async () => {
        try {
          await run(op, framing);
        } catch (e) {
          failure = e;
          throw e;
        }
      },
      "Recovery request acknowledged. Check device readback.",
      "Recovery request failed or outcome uncertain. No automatic retry.",
      "Sending recovery request…",
    );
    progress = "";
    if (ok && op === "restore") restoreFraming = false;
    result = ok
      ? {
          restore:
            "Restore accepted for processing. Values are not yet verified.",
          firmware:
            "Installation requested. Upload acceptance is not proof of installation or boot.",
          factory:
            "Factory replacement requested. Configuration may be cleared; installation and boot are not proven.",
          reset:
            "Reset accepted. Stored overrides were requested to be deleted; active settings may remain until explicit reboot.",
          reboot:
            "Reboot requested. A disconnect is expected; successful boot is not proven.",
        }[op]
      : failureText(op, failure, framing);
  }
  function failureText(op: Operation, e: unknown, framing: boolean): string {
    const what = labels[op];
    if (e instanceof RecoveryError && e.stage === "upload") {
      if (op === "restore" && e.status === 413 && !framing) {
        restoreFraming = true;
        return `${what}: upload rejected by the device with HTTP 413 before it was accepted. The device did not acknowledge a restore. This firmware can misread a request whose headers end exactly at a network packet boundary, which depends on headers your browser adds. Nothing was retried. Treat the outcome as uncertain until device readback confirms it. You may review and submit the same backup again: the next attempt adds a small header to change the request's framing.`;
      }
      return `${what}: the device answered HTTP ${e.status} instead of an acknowledgement. The outcome is uncertain: part of the operation may have been applied. Do not assume it was rolled back. No write was retried. Check device readback before deciding to submit again.`;
    }
    if (e instanceof RecoveryError && e.stage === "acknowledgement")
      return `${what}: the device answered without the expected acknowledgement. The outcome is uncertain. Do not assume it was applied or rolled back. No write was retried. Check device readback before deciding to submit again.`;
    if (e instanceof RecoveryError && e.stage === "connection")
      return `${what}: no complete response from the device (${e.message.split(": ").pop()}). The outcome is uncertain. Do not assume it was applied or rolled back. No write was retried. Check device readback before deciding to submit again.`;
    return "Operation failed or outcome uncertain. Do not assume it was rolled back. No write was retried. Check device readback before deciding to submit again.";
  }
  async function run(op: Operation, framing: boolean) {
    if (op === "restore")
      await acknowledged("PUT", "/restore", "OK", backup!, undefined, framing);
    if (op === "firmware")
      await uploadFirmware(image!, (s) => (progress = s));
    if (op === "factory")
      await acknowledged("PUT", "/factory", "FACTORY.BEE", image!);
    if (op === "reset") await acknowledged("DELETE", "/", "OK");
    if (op === "reboot") await acknowledged("GET", "/reboot", "REBOOT");
  }
  async function verify() {
    let text = "";
    const ok = await perform(
      async () => {
        const read = await readRecovery(firmware, expected);
        onread(read.state, read.firmware, read.hostname);
        text = `${expected ? "Restored values verified. " : ""}Device reachable: ${read.firmware.sunriser}, firmware ${read.firmware.version}, timestamp ${read.firmware.timestamp ?? "unavailable"}, uptime ${read.state.uptime} s, hostname: ${read.hostname}. Installation and successful physical boot are not proven. Reload other editors explicitly to reconcile their retained drafts.`;
      },
      "Recovery readback complete.",
      "Recovery readback not verified.",
      "Checking device readback…",
    );
    result = ok
      ? text
      : "Device or values not verified. It may still be processing or unavailable. This check sent reads only; check again explicitly when ready. No write was retried.";
  }
</script>

{#if active}
<EditorPage>
  <div class="heading"><div><h1 id="recovery-title">Recovery</h1><p>Back up, restore and verify your device.</p></div>    <button class="secondary" onclick={verify} disabled={busy || selecting}
      >Check device readback</button
    ></div>
  <section class="panel readback recovery-status" aria-labelledby="recovery-title">
    <StateBadge tone={busy||selecting?'draft':'neutral'}>{selecting?'Checking local file':busy?'Operation pending':'Recovery status'}</StateBadge>
    <p>
      Local files and same-origin device operations only. Back up before
      changing configuration or firmware. Files may contain Wi-Fi credentials.
      Operations can interrupt lighting and connectivity.
    </p>
    <p>
      Unsaved edits on other pages remain in this tab. After recovery, reload or
      reconcile each editor explicitly before saving old drafts. A browser
      reload discards drafts.
    </p>
    <p data-testid="recovery-result" aria-live="polite">{result}</p>
    {#if progress}<p aria-live="polite">{progress}</p>{/if}


  </section>
  <div class="recovery-layout"><section class="panel backups">
    <h2>Backups and restore</h2>
    <p>
      Backups contain stored overrides, not every factory default. Factory-reset
      backup means the configuration saved by a previous bootloader factory
      reset; it may not exist. Configuration reset and factory replacement below
      do not create that backup.
    </p>
    <div class="form-actions">
      <button onclick={() => exportBackup()} disabled={busy || selecting}
        >Download backup</button
      ><button onclick={() => exportBackup(true)} disabled={busy || selecting}
        >Download factory-reset backup</button
      >
    </div>
    <label for="backup-file">Backup file</label><input
      id="backup-file"
      type="file"
      accept=".mp,application/octet-stream"
      onchange={(e) => selectFile(e, "backup")}
      disabled={busy || selecting}
    />
    <p data-testid="recovery-validation">{backupMessage}</p>
    {#if values}<details>
        <summary>Keys to merge ({Object.keys(values).length})</summary>
        <p class="recovery-keys">{Object.keys(values).join(", ")}</p>
      </details>{/if}
    <p>
      Restore merges supplied keys and retains other settings. It can change the
      network address. It is not transactional; a failure can leave partial
      changes. Unknown settings and binary values are preserved.
    </p>
    <button
      onclick={() => (confirm = "restore")}
      disabled={busy || selecting || !backup}>Review restore</button
    >
    <div class="panel"><h3>Bundled examples</h3><p>Preview prepares a local restore draft. Only a confirmed restore writes to the device.</p>
    <label for="example">Example configuration</label><select
      id="example"
      bind:value={demo}
      disabled={busy || selecting}
      ><option value="standard">Standard</option><option value="african_sun"
        >aquaLUMix AFRICAN-SUN</option
      ><option value="amazon_grow">aquaLUMix AMAZON-GROW</option><option
        value="deepblue">aquaLUMix DEEP-BLUE</option
      ><option value="spotbeam">spotBEAM</option></select
    >
    <button onclick={previewDemo} disabled={busy || selecting}
      >Preview example</button
    >
    <button
      class="secondary"
      onclick={() =>
        download(
          Uint8Array.from(atob(demos[demo]), (c) => c.charCodeAt(0)),
          demo + ".mp",
        )}
      disabled={busy || selecting}>Download example</button
    ></div>
  </section>
  <section class="panel">
    <h2>Local firmware</h2>    <p>
      Check device readback sends reads only, with no automatic polling or write retries.
      If the address changes, use <a href="#network">network recovery</a>. Do
      not power off during installation. The uploaded bundle may replace this
      website; reload the browser only after checking the device.
    </p>
    <p>
      Use a trusted BEE file for {firmware.sunriser}. Structural checks and a
      checksum do not authenticate its source or prove executable safety. No
      online catalogue or download is used.
    </p>
    <label for="firmware-file">Firmware BEE file</label><input
      id="firmware-file"
      type="file"
      accept=".bee,.BEE"
      onchange={(e) => selectFile(e, "firmware")}
      disabled={busy || selecting}
    />
    <p data-testid="firmware-validation">{imageMessage}</p>
    {#if imageInfo}<p>
        Timestamp: {imageInfo.timestamp}. SHA-256:
        <code class="recovery-keys">{imageInfo.sha256}</code>
      </p>{/if}
    <button
      onclick={() => (confirm = "firmware")}
      disabled={busy || selecting || !image}>Review firmware update</button
    >
  </section>
  <section class="panel danger-zone">
    <h2>Reset and restart</h2><p>These operations can remove settings or interrupt the device. Each requires a separate confirmation.</p>
    <p>
      Configuration reset deletes all stored overrides, including network
      settings. Defaults become visible in storage immediately; active settings
      may require a separate reboot. Firmware is retained. Physical bootloader
      rescue is not available here.
    </p>
    <button class="danger" onclick={() => (confirm = "reset")} disabled={busy || selecting}
      >Review configuration reset</button
    >
    <button onclick={() => (confirm = "reboot")} disabled={busy || selecting}
      >Review reboot</button
    >
    <div class="panel"><h3>Replace the factory recovery image</h3>    <p>
      Factory replacement also clears configuration and replaces the recovery
      image. It does not preserve a configuration backup. The selected timestamp
      must match the running firmware; no claim about the latest vendor release
      is made.
    </p>
    <button class="danger"
      onclick={() => (confirm = "factory")}
      disabled={busy ||
        selecting ||
        !image ||
        imageInfo?.timestamp !== firmware.timestamp}
      >Review factory replacement</button
    >
</div>
  </section>
  </div>
  {#if confirm}
    <dialog
      class="recovery-confirm"
      use:modal
      oncancel={() => (confirm = undefined)}
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title">{labels[confirm]}</h2>
      <p>Target: {firmware.sunriser} at this browser origin.</p>
      {#if confirm === "restore"}<p>
          Merge {backupName} ({Object.keys(values ?? {}).length} keys). Existing
          supplied keys will be overwritten. Other keys remain. Network access and
          lighting can change.
        </p>
      {:else if confirm === "firmware" || confirm === "factory"}<p>
          Send {imageName}: {imageInfo?.filename}. {confirm === "factory"
            ? "This replaces the factory recovery image and clears configuration."
            : "This installs firmware and may replace the website."} Installation
          can disconnect this browser. Do not power off.
        </p>
      {:else if confirm === "reset"}<p>
          Delete every stored configuration override. This cannot be undone
          without a backup. No automatic reboot.
        </p>
      {:else}<p>
          Interrupt operation and request a device reboot. Network settings may
          take effect and change its address.
        </p>{/if}
      <p>
        No automatic retry. A lost response is an uncertain outcome, not
        success.
      </p>
      <div class="form-actions">
        <button class="danger" onclick={execute} disabled={busy}>Confirm operation</button
        ><button
          class="secondary"
          data-cancel
          onclick={() => (confirm = undefined)}>Cancel</button
        >
      </div>
    </dialog>
  {/if}
</EditorPage>
{/if}

<style>
  .recovery-layout { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); gap:0 32px; align-items:start; }
  .recovery-layout .danger-zone { grid-column:1/-1; border:1px solid var(--sr-error); padding:24px; margin-top:24px; }
  .recovery-layout>section.panel { border:1px solid var(--sr-line); border-radius:var(--sr-radius); padding:24px; background:var(--sr-surface); }
  .recovery-status { display:grid; grid-template-columns:1fr 1fr; gap:0 32px; }
  .recovery-status :global(.badge),.recovery-status [data-testid=recovery-result] { grid-column:1/-1; }
  .recovery-status :global(.badge) { justify-self:start; }
  .recovery-layout .danger-zone>div { max-width:800px; }
  .recovery-layout>section.panel { min-width:0; }
  @media(max-width:900px) { .recovery-layout { grid-template-columns:1fr; } .recovery-status { display:block; } .recovery-layout>section.panel { padding:20px 16px; } }
  .panel > label {
    display: block;
    margin-top: 1rem;
  }
  .panel > button {
    margin: 0.3rem 0.4rem 0.3rem 0;
  }
  .recovery-keys {
    overflow-wrap: anywhere;
  }
  .recovery-confirm {
    max-width: 42rem;
    width: calc(100% - 2rem);
    max-height: 80vh;
    z-index: 20;
    overflow: auto;
    background: var(--sr-surface);
    color: var(--sr-ink);
    border: 1px solid var(--sr-control-line);
    padding: 1.5rem;
    border-radius: var(--sr-radius);
  }
  .recovery-confirm::backdrop {
    background: #0009;
  }
</style>
