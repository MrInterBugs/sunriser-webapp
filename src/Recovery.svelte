<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import FilePicker from "./ui/FilePicker.svelte";
 import {t,renderText,language,source} from './i18n';
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
    onconfigurationchange,
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
    onconfigurationchange: (outcome:'acknowledged'|'uncertain') => void;
    onread: (state: DeviceState, info: Firmware, name: string) => void;
  } = $props();
  type Operation = "restore" | "firmware" | "factory" | "reset" | "reboot";
  let backup = $state<Uint8Array>(),
    values = $state<Record<string, unknown>>(),
    backupName = $state(""),
    backupMessage = $state(source("recovery.selectOneMessagePackBackup_41830")),
    image = $state<Uint8Array>(),
    imageInfo = $state<BeeInfo>(),
    imageName = $state(""),
    imageMessage = $state(source("recovery.selectOneLocalBEEFile_37a4d"));
  let confirm = $state<Operation>(),
    result = $state(source("recovery.noRecoveryOperationRequested_b80e1")),
    progress = $state(""),
    selecting = $state(false),
    demo = $state<keyof typeof demos>("standard");
  let expected: Uint8Array | undefined;
  let readbackFailed=$state(false);
  // After the device rejected a restore upload with HTTP 413 (see FRAMING_HEADER in recovery.ts), the next deliberate,
  // separately confirmed restore changes the request's framing. Nothing is retried automatically.
  let restoreFraming = $state(false);
  function modal(node: HTMLDialogElement) {
    node.showModal();
    node.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
  }
  const labels: Record<Operation, string> = {
    restore: source("recovery.restoreConfiguration"),
    firmware: source("recovery.installFirmware"),
    factory: source("recovery.replaceFactory"),
    reset: source("recovery.clearConfiguration"),
    reboot: source("recovery.rebootDevice"),
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
        throw Error(source("recovery.fileExceedsLocalSizeLimit_9aa65"));
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (kind === "backup") {
        values = validateBackup(bytes, firmware.pwm_count);
        backup = bytes;
        backupMessage = source("recovery.v0V1KeysV2BytesFormatValidSettingSemantics_6cdba",{v0:file.name,v1:Object.keys(values).length,v2:bytes.length});
      } else {
        imageInfo = await validateBee(bytes, firmware.pwm_count);
        image = bytes;
        imageMessage = source("recovery.v0V1BytesV2V3_7cb37",{v0:file.name,v1:bytes.length,v2:imageInfo.filename,v3:imageInfo.description});
      }
    } catch (e) {
      if (kind === "backup") backupMessage = source("recovery.invalidBackupV0_5f6e4",{v0:String(e)});
      else imageMessage = source("recovery.invalidFirmwareV0_acb6c",{v0:String(e)});
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
      backupMessage = source("recovery.v0V1KeysV2BytesExampleWillMergeIts_0164b",{v0:backupName,v1:Object.keys(values).length,v2:bytes.length});
    } catch (e) {
      backup = undefined;
      values = undefined;
      backupMessage = source("recovery.invalidExampleDetail",{v0:String(e)});
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
      source("recovery.backupDownloaded_2e9e2"),
      source("recovery.backupDownloadFailed_5313c"),
      source("recovery.downloadingBackup_42e9c"),
    );
    result = ok
      ? source("recovery.backupDownloadedStoredOverridesOnlyProtectAnyCredentialsIn_b4b92")
      : source("recovery.downloadFailedTheBackupMayBeMissingOrEmpty_3d2f7");
  }
  async function execute() {
    const op = confirm;
    if (!op || busy) return;
    confirm = undefined;
    expected = op === "restore" ? backup : undefined;
    readbackFailed=false;
    result = source("recovery.operationInProgress_c80f6");
    progress =
      op === "restore"
        ? source("recovery.sendingV0BackupBytes_1fce9",{v0:backup!.length})
        : op === "factory"
          ? source("recovery.sendingV0FactoryImageBytes_2dc9d",{v0:image!.length})
          : op === "reset"
            ? source("recovery.requestingDeletionOfStoredConfiguration_4514b")
            : op === "reboot"
              ? source("recovery.requestingRebootTheConnectionMayClose_65b90")
              : source("recovery.preparingFirmwareUpload_c5ea7");
    let failure: unknown;
    const framing = op === "restore" && restoreFraming;
    const ok = await perform(
      async () => {
        try {
          await run(op, framing);
          if(['restore','reset','factory'].includes(op))onconfigurationchange('acknowledged');
        } catch (e) {
          if(['restore','reset','factory'].includes(op))onconfigurationchange('uncertain');
          failure = e;
          throw e;
        }
      },
      source("recovery.recoveryRequestAcknowledgedCheckDeviceReadback_4286b"),
      source("recovery.recoveryRequestFailedOrOutcomeUncertainNoAutomaticRetry_70175"),
      source("recovery.sendingRecoveryRequest_3cd5b"),
    );
    progress = "";
    if (ok && op === "restore") restoreFraming = false;
    result = ok
      ? {
          restore:
            source("recovery.restoreAccepted"),
          firmware:
            source("recovery.installRequested"),
          factory:
            source("recovery.factoryRequested"),
          reset:
            source("recovery.resetAccepted"),
          reboot:
            source("recovery.rebootRequested"),
        }[op]
      : failureText(op, failure, framing);
  }
  function failureText(op: Operation, e: unknown, framing: boolean): string {
    const what = labels[op];
    if (e instanceof RecoveryError && e.stage === "upload") {
      if (op === "restore" && e.status === 413 && !framing) {
        restoreFraming = true;
        return source("recovery.v0UploadRejectedByTheDeviceWithHTTP413_cd6ac",{v0:what});
      }
      return source("recovery.v0TheDeviceAnsweredHTTPV1InsteadOfAn_29214",{v0:what,v1:e.status});
    }
    if (e instanceof RecoveryError && e.stage === "acknowledgement")
      return source("recovery.v0TheDeviceAnsweredWithoutTheExpectedAcknowledgementThe_86c49",{v0:what});
    if (e instanceof RecoveryError && e.stage === "connection")
      return source("recovery.v0NoCompleteResponseFromTheDeviceV1The_6fd86",{v0:what,v1:e.message.split(": ").pop()});
    return source("recovery.operationFailedOrOutcomeUncertainDoNotAssumeIt_7a4d6");
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
        text = source("recovery.v0DeviceReachableV1FirmwareV2TimestampV3Uptime_b254d",{v0:expected ? source("recovery.restoredValuesVerified_3f019")+" " : "",v1:read.firmware.sunriser,v2:read.firmware.version,v3:read.firmware.timestamp ?? "unavailable",v4:read.state.uptime,v5:read.hostname});
      },
      source("recovery.recoveryReadbackComplete_f8e8b"),
      source("recovery.recoveryReadbackNotVerified_d63fe"),
      source("recovery.checkingDeviceReadback_762a2"),
    );
    readbackFailed=!!expected&&!ok;
    result = ok
      ? text
      : source("recovery.deviceOrValuesNotVerifiedItMayStillBe_676ab");
  }
  async function inspectCurrent() {
    const ok=await perform(async()=>{
      const read=await readRecovery(firmware);
      onread(read.state,read.firmware,read.hostname);
    },source("recovery.currentDeviceReadbackCheckedRestoreRemainsUnverified_b87ac"),source("recovery.currentDeviceReadbackUnavailableNoWriteWasRetried_f07ae"),source("recovery.readingCurrentDeviceState_d43e5"));
    result=ok?source("recovery.currentDeviceReadbackCheckedTheRestoreOutcomeIsStill_2bf8c"):source("recovery.currentDeviceReadbackUnavailableCheckTheKnownDeviceAddress_eb1c8");
  }

</script>

{#if active}
<EditorPage>
  <div class="heading"><div><h1 id="recovery-title">{$t("help.recovery_ea924")}</h1><p>{$t("recovery.backUpRestoreAndVerifyYourDevice_e0ecc")}</p></div>    <button class="secondary" onclick={verify} disabled={busy || selecting}
      >{$t("recovery.checkDeviceReadback_bdde8")}</button
    ></div>
  <section class="panel readback recovery-status" aria-labelledby="recovery-title">
    <StateBadge tone={busy||selecting?'draft':'neutral'}>{selecting?$t("recovery.checkingLocalFile_7ff31"):busy?$t("app.operationPending_c929e"):$t("recovery.recoveryStatus_8cbaf")}</StateBadge>
    <p>
      {$t("recovery.localFilesAndSameOriginDeviceOperationsOnlyBack_fb3a5")}
    </p>
    <p>
      {$t("recovery.unsavedEditsOnOtherPagesRemainInThisTab_4bfe3")}
    </p>
    <p data-testid="recovery-result" aria-live="polite">{$renderText(result)}</p>
    {#if progress}<p aria-live="polite">{$renderText(progress)}</p>{/if}
    {#if readbackFailed}<p>{$t("recovery.theRestoredValuesCouldNotBeConfirmedYouCan_0ce81")}</p><button class="secondary" onclick={inspectCurrent} disabled={busy||selecting}>{$t("recovery.inspectCurrentDeviceState_ac453")}</button>{/if}


  </section>
  <div class="recovery-layout"><section class="panel backups">
    <h2>{$t("recovery.backupsAndRestore_3b5bb")}</h2>
    <p>
      {$t("recovery.backupsContainStoredOverridesNotEveryFactoryDefaultFactory_32402")}
    </p>
    <div class="form-actions">
      <button onclick={() => exportBackup()} disabled={busy || selecting}
        >{$t("recovery.downloadBackup_feddb")}</button
      ><button onclick={() => exportBackup(true)} disabled={busy || selecting}
        >{$t("recovery.downloadFactoryResetBackup_dad09")}</button
      >
    </div>
    <label for="backup-file">{$t("recovery.backupFile_67b33")}</label><FilePicker id="backup-file" label={$t("recovery.backupFile_67b33")}

      accept=".mp,application/octet-stream"
      onchange={(e) => selectFile(e, "backup")}
      disabled={busy || selecting}
    />
    <p data-testid="recovery-validation">{$renderText(backupMessage)}</p>
    {#if values}<details>
        <summary>{$t("recovery.keysToMerge_ffba5")}{Object.keys(values).length})</summary>
        <p class="recovery-keys">{Object.keys(values).join(", ")}</p>
      </details>{/if}
    <p>
      {$t("recovery.restoreMergesSuppliedKeysAndRetainsOtherSettingsIt_390fa")}
    </p>
    <button
      onclick={() => (confirm = "restore")}
      disabled={busy || selecting || !backup}>{$t("recovery.reviewRestore_fcf3c")}</button
    >
    <div class="panel"><h3>{$t("recovery.bundledExamples_c484b")}</h3><p>{$t("recovery.previewPreparesALocalRestoreDraftOnlyAConfirmed_227fd")}</p>
    <label for="example">{$t("recovery.exampleConfiguration_7c784")}</label><select
      id="example"
      bind:value={demo}
      disabled={busy || selecting}
      ><option value="standard">{$t("recovery.standard_2dfa6")}</option><option value="african_sun"
        >aquaLUMix AFRICAN-SUN</option
      ><option value="amazon_grow">aquaLUMix AMAZON-GROW</option><option
        value="deepblue">aquaLUMix DEEP-BLUE</option
      ><option value="spotbeam">spotBEAM</option></select
    >
    <button onclick={previewDemo} disabled={busy || selecting}
      >{$t("recovery.previewExample_69356")}</button
    >
    <button
      class="secondary"
      onclick={() =>
        download(
          Uint8Array.from(atob(demos[demo]), (c) => c.charCodeAt(0)),
          demo + ".mp",
        )}
      disabled={busy || selecting}>{$t("recovery.downloadExample_ae8b8")}</button
    ></div>
  </section>
  <section class="panel">
    <h2>{$t("recovery.localFirmware_69ac6")}</h2>    <p>
      {$t("recovery.checkDeviceReadbackSendsReadsOnlyWithNoAutomatic_66671")} <a href="#network">{$t("recovery.networkRecovery_1b0e2")}</a>{$t("recovery.doNotPowerOffDuringInstallationTheUploadedBundle_68137")}
    </p>
    <p>
      {$t("recovery.useATrustedBEEFileFor_8383f")} {firmware.sunriser}{$t("recovery.structuralChecksAndAChecksumDoNotAuthenticateIts_ef31e")}
    </p>
    <label for="firmware-file">{$t("recovery.firmwareBEEFile_8e65b")}</label><FilePicker id="firmware-file" label={$t("recovery.firmwareBEEFile_8e65b")}

      accept=".bee,.BEE"
      onchange={(e) => selectFile(e, "firmware")}
      disabled={busy || selecting}
    />
    <p data-testid="firmware-validation">{$renderText(imageMessage)}</p>
    {#if imageInfo}<p>
        {$t("recovery.timestamp_a9c75")} {imageInfo.timestamp}{$t("recovery.sha256_df745")}
        <code class="recovery-keys">{imageInfo.sha256}</code>
      </p>{/if}
    <button
      onclick={() => (confirm = "firmware")}
      disabled={busy || selecting || !image}>{$t("recovery.reviewFirmwareUpdate_52509")}</button
    >
  </section>
  <section class="panel danger-zone">
    <h2>{$t("recovery.resetAndRestart_b406a")}</h2><p>{$t("recovery.theseOperationsCanRemoveSettingsOrInterruptTheDevice_98962")}</p>
    <p>
      {$t("recovery.configurationResetDeletesAllStoredOverridesIncludingNetworkSettings_30a2c")}
    </p>
    <button class="danger" onclick={() => (confirm = "reset")} disabled={busy || selecting}
      >{$t("recovery.reviewConfigurationReset_c5c18")}</button
    >
    <button onclick={() => (confirm = "reboot")} disabled={busy || selecting}
      >{$t("recovery.reviewReboot_88341")}</button
    >
    <div class="panel"><h3>{$t("recovery.replaceTheFactoryRecoveryImage_ddcd2")}</h3>    <p>
      {$t("recovery.factoryReplacementAlsoClearsConfigurationAndReplacesTheRecovery_0351a")}
    </p>
    <button class="danger"
      onclick={() => (confirm = "factory")}
      disabled={busy ||
        selecting ||
        !image ||
        imageInfo?.timestamp !== firmware.timestamp}
      >{$t("recovery.reviewFactoryReplacement_7948d")}</button
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
      <h2 id="confirm-title">{$renderText(labels[confirm])}</h2>
      <p>{$t("recovery.target_652ac")} {firmware.sunriser} {$t("recovery.atThisBrowserOrigin_701b8")}</p>
      {#if confirm === "restore"}<p>
          {$t("recovery.merge_ea8f0")} {backupName} ({Object.keys(values ?? {}).length} {$t("recovery.keysExistingSuppliedKeysWillBeOverwrittenOtherKeys_5f16f")}
        </p>
      {:else if confirm === "firmware" || confirm === "factory"}<p>
          {$t("recovery.send_9bc25")} {imageName}: {imageInfo?.filename}. {confirm === "factory"
            ? $t("recovery.thisReplacesTheFactoryRecoveryImageAndClearsConfiguration_bf4cb")
            : $t("recovery.thisInstallsFirmwareAndMayReplaceTheWebsite_153d1")} {$t("recovery.installationCanDisconnectThisBrowserDoNotPowerOff_29292")}
        </p>
      {:else if confirm === "reset"}<p>
          {$t("recovery.deleteEveryStoredConfigurationOverrideThisCannotBeUndone_14b25")}
        </p>
      {:else}<p>
          {$t("recovery.interruptOperationAndRequestADeviceRebootNetworkSettings_6a51d")}
        </p>{/if}
      <p>
        {$t("recovery.noAutomaticRetryALostResponseIsAnUncertain_12d02")}
      </p>
      <div class="form-actions">
        <button class="danger" onclick={execute} disabled={busy}>{$t("recovery.confirmOperation_84d7c")}</button
        ><button
          class="secondary"
          data-cancel
          onclick={() => (confirm = undefined)}>{$t("recovery.cancel_77dfd")}</button
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
