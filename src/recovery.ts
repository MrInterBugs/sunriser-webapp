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
  type Firmware,
} from "./api.js";
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
const fail = (message: string): never => {
  throw Error(message);
};
/** Parse structure before decode: JS objects alone cannot reveal duplicate/non-string keys. */
export function validateBackup(
  bytes: Uint8Array,
  board?: number,
  encodedValues?: Map<string, Uint8Array>,
): Record<string, unknown> {
  if (!bytes.length || bytes.length > BACKUP_LIMIT)
    fail("Backup size must be 1 byte to 8 MiB");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const take = (n: number) => {
    if (n < 0 || pos + n > bytes.length) fail("Truncated MessagePack");
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
    if (depth > 9) fail("Value nesting exceeds C limit of eight");
    const t = number(1);
    let len = -1,
      map = -1,
      array = -1;
    if ((t & 0xe0) === 0xa0) len = t & 31;
    else if (t === 0xd9 || t === 0xda || t === 0xdb)
      len = number(t === 0xd9 ? 1 : t === 0xda ? 2 : 4);
    if (len >= 0) {
      const at = take(len);
      if (root) fail("Expected map");
      // Canonical BEE/backup records can use STR for opaque binary values.
      // Only map keys require UTF-8. Never decode/re-encode the upload payload.
      return key ? utf8.decode(bytes.subarray(at, at + len)) : undefined;
    }
    if (key) fail("Map keys must be strings");
    if ((t & 0xf0) === 0x80) map = t & 15;
    else if (t === 0xde || t === 0xdf) map = number(t === 0xde ? 2 : 4);
    if (map >= 0) {
      if (root && map === 0) fail("Empty backup");
      const keys = new Set<string>(),
        hashes = new Set<number>();
      for (let i = 0; i < map; i++) {
        const k = scan(depth + 1, true)!;
        if (keys.has(k) || k === "__proto__")
          fail("Duplicate or unsafe map key");
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
            fail("Invalid or colliding configuration key");
          hashes.add(h);
        }
        const start = pos;
        scan(depth + 1);
        if (root) encodedValues?.set(k, bytes.subarray(start, pos));
      }
      return;
    }
    if (root) fail("Expected MessagePack map");
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
    fail("Unsupported MessagePack type");
  }
  scan(0, false, true);
  if (pos !== bytes.length) fail("Trailing bytes");
  const value = decode(bytes) as Record<string, unknown>;
  function finite(v: unknown) {
    if (
      typeof v === "number" &&
      (!Number.isFinite(v) || (Number.isInteger(v) && !Number.isSafeInteger(v)))
    )
      fail("Unsupported numeric precision");
    if (v && typeof v === "object" && !(v instanceof Uint8Array))
      Object.values(v).forEach(finite);
  }
  finite(value);
  if (
    board &&
    value.save_sunriser !== undefined &&
    value.save_sunriser !== `SunRiser${board}`
  )
    fail("Backup belongs to another board");
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
    fail("BEE size must be 2048 bytes to 32 MiB");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (p: number) => {
    if (p < 0 || p + 4 > bytes.length) fail("Truncated CDB");
    return v.getUint32(p, true);
  };
  const tables = Array.from({ length: 256 }, (_, i) => ({
    start: u32(i * 8),
    count: u32(i * 8 + 4),
  }));
  const end = Math.min(...tables.map((t) => t.start));
  if (end < 2048 || end > bytes.length) fail("Invalid CDB index");
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
    if (!k || p + k + n > end) fail("Invalid CDB record");
    const kb = bytes.subarray(p, p + k),
      key = utf8.decode(kb);
    p += k;
    const data = bytes.subarray(p, p + n);
    p += n;
    if (byKey.has(key)) fail("Duplicate CDB key");
    byKey.set(key, data);
    records.set(at, { hash: hash(kb), key, data });
  }
  if (p !== end) fail("Invalid CDB boundary");
  let tableEnd = end;
  const seen = new Set<number>();
  tables.forEach((t, bucket) => {
    if (t.start !== tableEnd || t.start + t.count * 8 > bytes.length)
      fail("Invalid CDB table bounds");
    tableEnd += t.count * 8;
    for (let slot = 0; slot < t.count; slot++) {
      const at = t.start + slot * 8,
        h = u32(at),
        offset = u32(at + 4);
      if (!offset) continue;
      const r = records.get(offset);
      if (!r || r.hash !== h || (h & 255) !== bucket || seen.has(offset))
        fail("Invalid CDB index entry");
      seen.add(offset);
      let probe = (h >>> 8) % t.count;
      while (probe !== slot) {
        if (!u32(t.start + probe * 8 + 4)) fail("Unreachable CDB entry");
        probe = (probe + 1) % t.count;
      }
    }
  });
  if (tableEnd !== bytes.length || seen.size !== records.size)
    fail("Incomplete CDB index");
  if (!byKey.get(board === 8 ? "___firmware" : "___firmware10")?.length)
    fail("Missing selected board firmware");
  const text = (key: string, max: number) => {
    const b = byKey.get("___firmware_" + key);
    if (!b?.length || b.length >= max)
      fail("Missing or invalid firmware " + key);
    const s = utf8.decode(b!);
    if (s.includes("\0")) fail("Invalid metadata");
    return s;
  };
  const filename = text("filename", 32),
    description = text("description", 64);
  text("author", 64);
  const ts = text("timestamp", 11);
  if (!/^\d{1,10}$/.test(ts) || Number(ts) > 4294967295)
    fail("Invalid firmware timestamp");
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
export class RecoveryError extends Error {
  constructor(
    public stage: "upload" | "connection" | "acknowledgement",
    public status: number | undefined,
    message: string,
  ) {
    super(message);
  }
}
/** A header the firmware ignores. Sent only on a deliberate resubmission after an upload was rejected with HTTP 413:
 * the original v1.006 firmware never finds a header terminator that a network segment boundary splits,
 * takes the body for more header and rejects the request when its 6 KiB header buffer fills. That happens when the
 * request's header block length is 1 to 3 bytes past a multiple of the 536-byte segment size, which depends on
 * headers the browser adds and the page cannot see. This line moves the header block by 17 bytes, out of that
 * window; the request is otherwise unchanged. */
export const FRAMING_HEADER = "X-SR-Framing";
export async function recoveryRequest(
  method: "GET" | "PUT" | "DELETE",
  path: string,
  body?: Uint8Array,
  offset?: number,
  framing = false,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
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
        `${method} ${path}: no response (${controller.signal.aborted ? "timed out" : "connection failed"})`,
      );
    }
    if (!response.ok)
      throw new RecoveryError(
        "upload",
        response.status,
        `${method} ${path} rejected with HTTP ${response.status}`,
      );
    try {
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new RecoveryError(
        "connection",
        response.status,
        `${method} ${path}: response interrupted`,
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
) {
  const result = await recoveryRequest(method, path, body, offset, framing);
  if (utf8.decode(result).trim() !== expected)
    throw new RecoveryError(
      "acknowledgement",
      200,
      "Unexpected acknowledgement for " + path,
    );
}
export async function uploadFirmware(
  bytes: Uint8Array,
  progress: (message: string) => void,
) {
  progress("Initializing upload…");
  await acknowledged("PUT", "/firmware-init", "INIT");
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    const end = Math.min(offset + 8192, bytes.length);
    progress(`Uploading ${offset} / ${bytes.length} bytes`);
    await acknowledged(
      "PUT",
      "/firmware-chunk",
      String(end),
      bytes.subarray(offset, end),
      offset,
    );
  }
  progress("Upload accepted. Requesting installation…");
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
  if (firmware.sunriser !== board.sunriser) fail("Different board responded");
  const state = await getState(board.pwm_count);
  if (expectedBytes) {
    const expected = backupValueBytes(expectedBytes),
      keys = [...expected.keys()];
    for (let i = 0; i < keys.length; i += 15) {
      const batch = keys.slice(i, i + 15);
      const actual = backupValueBytes(await readConfigBytes(batch));
      for (const key of batch)
        if (!equalValue(actual.get(key), expected.get(key)))
          fail("Readback mismatch: " + key);
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
