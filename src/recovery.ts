import {MessageError, type Message, source} from './messages.js';
/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Includes code/configuration adapted from the SunRiser project contributors.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Adapted for this frontend in 2026; see LICENSING.md and LICENSE.
 */
import { sha256 } from "./sha256.js";
import { decode } from "@msgpack/msgpack";
import {
  getFirmware,
  getState,
  readConfig,
  readConfigBytes,
  FRAMING_HEADER,
  type Firmware,
} from "./api.js";
export { FRAMING_HEADER };
export const BACKUP_LIMIT = 8 * 1024 * 1024,
  BEE_LIMIT = 32 * 1024 * 1024;
const utf8 = new TextDecoder("utf-8", { fatal: true });
const hash = (bytes: Uint8Array) => {
  let h = 5381;
  for (const b of bytes) h = ((h * 33) ^ b) >>> 0;
  return h;
};
const configHash = (bytes: Uint8Array) => {
  let h = 5381;
  for (const b of bytes) h = (h * 33 + (b > 127 ? b - 256 : b)) >>> 0;
  return h;
};
const fail = (message: Message): never => {
  throw new MessageError(message);
};
/** Parse structure before decode: JS objects alone cannot reveal duplicate/non-string keys. */
export function validateBackup(
  bytes: Uint8Array,
  board?: number,
  encodedValues?: Map<string, Uint8Array>,
): Record<string, unknown> {
  if (!bytes.length || bytes.length > BACKUP_LIMIT)
    fail(source("recovery.backupSizeMustBe1ByteTo8MiB_fc1a5"));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const take = (n: number) => {
    if (n < 0 || pos + n > bytes.length) fail(source("recovery.truncatedMessagePack_96a79"));
    const start = pos;
    pos += n;
    return start;
  };
  const number = (n: number) => {
    const at = take(n);
    return n === 1
      ? view.getUint8(at)
      : n === 2
        ? view.getUint16(at)
        : view.getUint32(at);
  };
  function scan(depth: number, key = false, root = false): string | undefined {
    if (depth > 9) fail(source("recovery.valueNestingExceedsCLimitOfEight_4a7db"));
    const t = number(1);
    let len = -1,
      map = -1,
      array = -1;
    if ((t & 0xe0) === 0xa0) len = t & 31;
    else if (t === 0xd9 || t === 0xda || t === 0xdb)
      len = number(t === 0xd9 ? 1 : t === 0xda ? 2 : 4);
    if (len >= 0) {
      const at = take(len);
      if (root) fail(source("recovery.expectedMap_69230"));
      // Canonical BEE/backup records can use STR for opaque binary values.
      // Only map keys require UTF-8. Never decode/re-encode the upload payload.
      return key ? utf8.decode(bytes.subarray(at, at + len)) : undefined;
    }
    if (key) fail(source("recovery.mapKeysMustBeStrings_afd68"));
    if ((t & 0xf0) === 0x80) map = t & 15;
    else if (t === 0xde || t === 0xdf) map = number(t === 0xde ? 2 : 4);
    if (map >= 0) {
      if (root && map === 0) fail(source("recovery.emptyBackup_e51b5"));
      const keys = new Set<string>(),
        hashes = new Set<number>();
      for (let i = 0; i < map; i++) {
        const k = scan(depth + 1, true)!;
        if (keys.has(k) || k === "__proto__")
          fail(source("recovery.duplicateOrUnsafeMapKey_83fcf"));
        keys.add(k);
        if (root) {
          const encoded = new TextEncoder().encode(k);
          const h = configHash(encoded);
          if (
            !encoded.length ||
            encoded.length > 127 ||
            k.includes("\0") ||
            hashes.has(h)
          )
            fail(source("recovery.invalidOrCollidingConfigurationKey_83661"));
          hashes.add(h);
        }
        const start = pos;
        scan(depth + 1);
        if (root) encodedValues?.set(k, bytes.subarray(start, pos));
      }
      return;
    }
    if (root) fail(source("recovery.expectedMessagePackMap_bd78e"));
    if ((t & 0xf0) === 0x90) array = t & 15;
    else if (t === 0xdc || t === 0xdd) array = number(t === 0xdc ? 2 : 4);
    if (array >= 0) {
      for (let i = 0; i < array; i++) scan(depth + 1);
      return;
    }
    if (t <= 0x7f || t >= 0xe0 || [0xc0, 0xc2, 0xc3].includes(t)) return;
    if ([0xc4, 0xc5, 0xc6].includes(t)) {
      take(number(t === 0xc4 ? 1 : t === 0xc5 ? 2 : 4));
      return;
    }
    const sizes: Record<number, number> = {
      0xca: 4,
      0xcb: 8,
      0xcc: 1,
      0xcd: 2,
      0xce: 4,
      0xcf: 8,
      0xd0: 1,
      0xd1: 2,
      0xd2: 4,
      0xd3: 8,
    };
    if (sizes[t]) {
      take(sizes[t]);
      return;
    }
    fail(source("recovery.unsupportedMessagePackType_98aab"));
  }
  scan(0, false, true);
  if (pos !== bytes.length) fail(source("recovery.trailingBytes_a3935"));
  const value = decode(bytes) as Record<string, unknown>;
  function finite(v: unknown) {
    if (
      typeof v === "number" &&
      (!Number.isFinite(v) || (Number.isInteger(v) && !Number.isSafeInteger(v)))
    )
      fail(source("recovery.unsupportedNumericPrecision_5f010"));
    if (v && typeof v === "object" && !(v instanceof Uint8Array))
      Object.values(v).forEach(finite);
  }
  finite(value);
  if (
    board &&
    value.save_sunriser !== undefined &&
    value.save_sunriser !== `SunRiser${board}`
  )
    fail(source("recovery.backupBelongsToAnotherBoard_8130e"));
  return value;
}
export interface BeeInfo {
  filename: string;
  description: string;
  timestamp: number;
  sha256: string;
}
/** CDB record and lookup-table verification, not a signature or executable-code audit. */
export async function validateBee(
  bytes: Uint8Array,
  board: number,
): Promise<BeeInfo> {
  if (bytes.length < 2048 || bytes.length > BEE_LIMIT)
    fail(source("recovery.beeSizeMustBe2048BytesTo32MiB_0c9dc"));
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (p: number) => {
    if (p < 0 || p + 4 > bytes.length) fail(source("recovery.truncatedCDB_31bc6"));
    return v.getUint32(p, true);
  };
  const tables = Array.from({ length: 256 }, (_, i) => ({
    start: u32(i * 8),
    count: u32(i * 8 + 4),
  }));
  const end = Math.min(...tables.map((t) => t.start));
  if (end < 2048 || end > bytes.length) fail(source("recovery.invalidCDBIndex_2bf6f"));
  const records = new Map<
      number,
      { hash: number; key: string; data: Uint8Array }
    >(),
    byKey = new Map<string, Uint8Array>();
  let p = 2048;
  while (p < end) {
    const at = p,
      k = u32(p),
      n = u32(p + 4);
    p += 8;
    if (!k || p + k + n > end) fail(source("recovery.invalidCDBRecord_5efcf"));
    const kb = bytes.subarray(p, p + k),
      key = utf8.decode(kb);
    p += k;
    const data = bytes.subarray(p, p + n);
    p += n;
    if (byKey.has(key)) fail(source("recovery.duplicateCDBKey_c481e"));
    byKey.set(key, data);
    records.set(at, { hash: hash(kb), key, data });
  }
  if (p !== end) fail(source("recovery.invalidCDBBoundary_57154"));
  let tableEnd = end;
  const seen = new Set<number>();
  tables.forEach((t, bucket) => {
    if (t.start !== tableEnd || t.start + t.count * 8 > bytes.length)
      fail(source("recovery.invalidCDBTableBounds_66abb"));
    tableEnd += t.count * 8;
    for (let slot = 0; slot < t.count; slot++) {
      const at = t.start + slot * 8,
        h = u32(at),
        offset = u32(at + 4);
      if (!offset) continue;
      const r = records.get(offset);
      if (!r || r.hash !== h || (h & 255) !== bucket || seen.has(offset))
        fail(source("recovery.invalidCDBIndexEntry_6b35f"));
      seen.add(offset);
      let probe = (h >>> 8) % t.count;
      while (probe !== slot) {
        if (!u32(t.start + probe * 8 + 4)) fail(source("recovery.unreachableCDBEntry_a83e9"));
        probe = (probe + 1) % t.count;
      }
    }
  });
  if (tableEnd !== bytes.length || seen.size !== records.size)
    fail(source("recovery.incompleteCDBIndex_8a1ad"));
  if (!byKey.get(board === 8 ? "___firmware" : "___firmware10")?.length)
    fail(source("recovery.missingSelectedBoardFirmware_2a6c4"));
  const text = (key: string, max: number) => {
    const b = byKey.get("___firmware_" + key);
    if (!b?.length || b.length >= max)
      fail(source("recovery.invalidFirmwareDetail",{v0:key}));
    const s = utf8.decode(b!);
    if (s.includes("\0")) fail(source("recovery.invalidMetadata_aee53"));
    return s;
  };
  const filename = text("filename", 32),
    description = text("description", 64);
  text("author", 64);
  const ts = text("timestamp", 11);
  if (!/^\d{1,10}$/.test(ts) || Number(ts) > 4294967295)
    fail(source("recovery.invalidFirmwareTimestamp_8ac2c"));
  return {
    filename,
    description,
    timestamp: Number(ts),
    sha256: sha256(bytes),
  };
}
/** The stage at which a recovery request failed: "upload" - the device answered with an error status (the request
 * was rejected, not acknowledged); "connection" - no complete response (the outcome is uncertain); "acknowledgement" -
 * a response other than the expected acknowledgement (uncertain). */
export class RecoveryError extends MessageError {
  constructor(
    public stage: "upload" | "connection" | "acknowledgement",
    public status: number | undefined,
    message: Message,
    public chunkOffset?: number,
  ) {
    super(message);
  }
}
/** Single-request uploads (restore, factory image) get 30 s plus 1 s per 10 KiB.
 * A ~1.3 MB factory image needs over 26 s at the ~50 kB/s measured on SR10 Wi-Fi. */
export const uploadTimeout = (bytes: number) => 30000 + Math.ceil(bytes / 10240) * 1000;
/** `framing` adds FRAMING_HEADER, a header the firmware ignores. Recovery sends it only on a deliberate restore
 * resubmission after an upload was rejected with HTTP 413: the original v1.006 firmware never finds a
 * header terminator that a network segment boundary splits, takes the body for more header and rejects the request
 * when its 6 KiB header buffer fills. That happens when the request's header block length is 1 to 3 bytes past a
 * multiple of the 536-byte segment size, which depends on headers the browser adds and the page cannot see. The
 * header moves the header block by 17 bytes, out of that window; the request is otherwise unchanged. */
export async function recoveryRequest(
  method: "GET" | "PUT" | "DELETE",
  path: string,
  body?: Uint8Array,
  offset?: number,
  framing = false,
  timeoutMs = 30000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        body: body ? new Uint8Array(body) : undefined,
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
        credentials: "same-origin",
        headers: {
          ...(method === "PUT"
            ? { "Content-Type": "application/octet-stream" }
            : {}),
          ...(offset === undefined ? {} : { "X-SR-Offset": String(offset) }),
          ...(framing ? { [FRAMING_HEADER]: "x" } : {}),
        },
      });
    } catch {
      throw new RecoveryError(
        "connection",
        undefined,
        source("recovery.v0V1NoResponseV2_acb82",{v0:method,v1:path,v2:controller.signal.aborted ? source("recovery.timedOut_d6f17") : source("recovery.connectionFailed_00472")}),
      );
    }
    if (!response.ok)
      throw new RecoveryError(
        "upload",
        response.status,
        source("recovery.v0V1RejectedWithHTTPV2_008b8",{v0:method,v1:path,v2:response.status}),
      );
    try {
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new RecoveryError(
        "connection",
        response.status,
        source("recovery.v0V1ResponseInterrupted_e78ae",{v0:method,v1:path}),
      );
    }
  } finally {
    clearTimeout(timer);
  }
}
export async function acknowledged(
  method: "GET" | "PUT" | "DELETE",
  path: string,
  expected: string,
  body?: Uint8Array,
  offset?: number,
  framing = false,
  timeoutMs = 30000,
) {
  const result = await recoveryRequest(method, path, body, offset, framing, timeoutMs);
  if (utf8.decode(result).trim() !== expected)
    throw new RecoveryError(
      "acknowledgement",
      200,
      source("recovery.unexpectedAcknowledgementDetail",{v0:path}),
    );
}
// Only these verified contracts seek to X-SR-Offset before writing a chunk.
// An older/unknown implementation might append a retransmission instead.
export const supportsFirmwareChunkRetry = (version: string) =>
  version === "1.006" || version === "1.007";

async function uploadChunk(
  bytes: Uint8Array,
  offset: number,
  retry: boolean,
  progress: (message: Message) => void,
) {
  // Stay below the firmware's 60 s inactivity watchdog. Recheck after waits,
  // since a background/suspended tab may wake well after its scheduled delay.
  const deadline = performance.now() + 45000;
  for (let attempt = 0; ; attempt++) {
    try {
      await acknowledged(
        "PUT", "/firmware-chunk", String(offset + bytes.length),
        bytes, offset, false,
        retry ? Math.max(1, Math.min(30000, deadline - performance.now())) : 30000,
      );
      return;
    } catch (e) {
      if (!(e instanceof RecoveryError)) throw e;
      const stopped = () => new RecoveryError(
        e.stage, e.status,
        source("recovery.chunkStopped", { v0: offset, v1: attempt + 1, v2: e.uiMessage }),
        offset,
      );
      const transient = e.stage === "connection" ||
        (e.stage === "upload" && [408, 429, 502, 503, 504].includes(e.status ?? 0));
      const delay = 1000 * 2 ** attempt + Math.floor(Math.random() * 250);
      if (!retry || !transient || attempt >= 3 || performance.now() + delay >= deadline)
        throw stopped();
      progress(source("recovery.chunkRetrying", {
        v0: attempt + 1, v1: offset, v2: (delay / 1000).toFixed(2),
      }));
      await new Promise<void>(resolve => setTimeout(resolve, delay));
      if (performance.now() >= deadline) throw stopped();
    }
  }
}
export async function uploadFirmware(
  bytes: Uint8Array,
  progress: (message: Message) => void,
  firmwareVersion: string,
) {
  progress(source("recovery.initializingUpload_04d65"));
  await acknowledged("PUT", "/firmware-init", "INIT");
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    const end = Math.min(offset + 8192, bytes.length);
    progress(source("recovery.uploadingV0V1Bytes_f1d33",{v0:offset,v1:bytes.length}));
    await uploadChunk(
      bytes.subarray(offset, end), offset,
      supportsFirmwareChunkRetry(firmwareVersion), progress,
    );
  }
  progress(source("recovery.uploadAcceptedRequestingInstallation_d0e47"));
  await acknowledged("PUT", "/firmware-install", "INSTALL");
}
export function equalValue(a: unknown, b: unknown): boolean {
  if (a instanceof Uint8Array || b instanceof Uint8Array)
    return (
      a instanceof Uint8Array &&
      b instanceof Uint8Array &&
      a.length === b.length &&
      a.every((v, i) => v === b[i])
    );
  if (a && b && typeof a === "object" && typeof b === "object") {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ak = Object.keys(a),
      bk = Object.keys(b);
    return (
      ak.length === bk.length &&
      ak.every(
        (k) =>
          Object.hasOwn(b, k) &&
          equalValue(
            (a as Record<string, unknown>)[k],
            (b as Record<string, unknown>)[k],
          ),
      )
    );
  }
  return a === b;
}
/** C cmp_full_object_copy preserves each value marker and payload, including binary STR.
 * Raw value equality is intentional here; map order/key encoding and response time are ignored.
 */
export function backupValueBytes(bytes: Uint8Array) {
  const values = new Map<string, Uint8Array>();
  validateBackup(bytes, undefined, values);
  return values;
}
export async function readRecovery(
  board: Firmware,
  expectedBytes?: Uint8Array,
) {
  await acknowledged("GET", "/ok", "OK");
  const firmware = await getFirmware();
  if (firmware.sunriser !== board.sunriser) fail(source("recovery.differentBoardResponded_a0139"));
  const state = await getState(board.pwm_count);
  if (expectedBytes) {
    const expected = backupValueBytes(expectedBytes),
      keys = [...expected.keys()];
    for (let i = 0; i < keys.length; i += 15) {
      const batch = keys.slice(i, i + 15);
      const actual = backupValueBytes(await readConfigBytes(batch));
      for (const key of batch)
        if (!equalValue(actual.get(key), expected.get(key)))
          fail(source("recovery.readbackMismatchDetail",{v0:key}));
    }
  }
  const name = await readConfig(["hostname"]);
  return { firmware, state, hostname: String(name.hostname) };
}
export function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
