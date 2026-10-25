import {MessageError, source} from './messages.js';
/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern frontend adapted from the SunRiser project and its workflows.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Frontend adaptation (2026); see LICENSING.md and LICENSE.
 * Third-party material retains its own terms.
 */
import { decode, encode } from "@msgpack/msgpack";
import {configurationSaved} from './configuration-state.js';

export interface Firmware {
  sunriser: string;
  version: string;
  pwm_count: 8 | 10;
  wifi: boolean;
  timestamp?: number;
}
export interface DeviceState {
  localtime?: string;
  utc_offset?: number;
  wifi_ip?: string;
  sensors?: unknown;
  thunder?: boolean;
  timewarp?: number;
  time: number;
  uptime: number;
  lan_ip: string;
  service_mode: number;
  blackout?: boolean;
  pwms: Record<string, number>;
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const integer = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Header the firmware ignores; it moves the end of the request headers by 17 bytes.
 * Firmware 1.006 and 1.007 drop or reject (HTTP 413) a request whose header block ends
 * 1-3 bytes past a 536-byte TCP segment boundary. That length depends on headers the
 * browser adds, so one request shape can fail every time in one browser. */
export const FRAMING_HEADER = "X-SR-Framing";
const framingStorage = "sunriser.framing";
// Request shapes (method, path, Content-Length digits) that needed the header.
const framed = new Set<string>(((): string[] => {
  try { const v = JSON.parse(localStorage.getItem(framingStorage) ?? "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; }
  catch { return []; }
})());
function rememberFraming(shape: string, padded: boolean) {
  if (framed.has(shape) === padded) return;
  if (padded) framed.add(shape); else framed.delete(shape);
  try { localStorage.setItem(framingStorage, JSON.stringify([...framed])); } catch { /* Session memory still applies. */ }
}
class HttpStatus extends MessageError {
  constructor(readonly status: number) { super(source("common.httpStatus", {v0: status})); }
}
// Transient read failures: another client holding the controller's only Wi-Fi
// link, a busy SR8 slot (503), or the header-framing defect (413 or no reply).
const retryStatuses = new Set([408, 413, 429, 502, 503, 504]);
const transient = (error: unknown) =>
  error instanceof HttpStatus ? retryStatuses.has(error.status)
    : error instanceof TypeError || (error instanceof Error && /^(AbortError|TimeoutError)$/.test(error.name));
async function exchange(method: string, path: string, body: Uint8Array<ArrayBuffer> | undefined, padded: boolean, accept: (response: Response) => Promise<unknown>) {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(path, {
      method,
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
      credentials: "same-origin",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/x-msgpack" }),
        ...(padded ? { [FRAMING_HEADER]: "x" } : {}),
      },
      body,
    });
    if (!response.ok) throw new HttpStatus(response.status);
    return await accept(response);
  } finally {
    clearTimeout(deadline);
  }
}
/** Same-origin calls with an 8 s deadline per attempt. A read is retried once after
 * a short pause with the opposite framing; writes are never retried automatically.
 * A write rejected with 413 was not parsed, so its next deliberate attempt is reframed. */
async function exchangeWithRetry(method: "GET" | "POST" | "PUT", path: string, body: Uint8Array<ArrayBuffer> | undefined, accept: (response: Response) => Promise<unknown>) {
  const read = method !== "PUT";
  const shape = `${method} ${path} ${body ? String(body.length).length : 0}`;
  let padded = framed.has(shape);
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await exchange(method, path, body, padded, accept);
      if (attempt) rememberFraming(shape, padded);
      return result;
    } catch (error) {
      if (!read && error instanceof HttpStatus && error.status === 413) rememberFraming(shape, !padded);
      if (!read || attempt || !transient(error)) throw error;
      padded = !padded;
      await new Promise(resolve => setTimeout(resolve, 300 + Math.floor(Math.random() * 200)));
    }
  }
}
async function request(
  method: "GET" | "POST" | "PUT",
  path: "/" | "/state" | "/firmware.mp" | "/bootload.mp" | "/weather",
  value?: unknown,
  raw = false,
) {
  return exchangeWithRetry(method, path, value === undefined ? undefined : new Uint8Array(encode(value)), async response => {
    if (method === "PUT") {
      if ((await response.text()).trim() !== "OK")
        throw new MessageError(source("api.unexpectedSaveAcknowledgement_eec64"));
      return undefined;
    }
    if (
      response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/x-msgpack"
    )
      throw new MessageError(source("api.unexpectedResponseType_3a3f3"));
    const bytes = new Uint8Array(await response.arrayBuffer());
    return raw ? bytes : decode(bytes);
  });
}
export async function getFirmware(): Promise<Firmware> {
  const v = await request("GET", "/firmware.mp");
  if (
    !record(v) ||
    (v.pwm_count !== 8 && v.pwm_count !== 10) ||
    v.sunriser !== `SunRiser${v.pwm_count}` ||
    typeof v.version !== "string" ||
    !v.version ||
    typeof v.wifi !== "boolean"
  )
    throw new MessageError(source("api.invalidFirmwareMetadata_ca53a"));
  return v as unknown as Firmware;
}
export async function getBootloader(): Promise<Record<string,unknown>> {
  const value=await request('GET','/bootload.mp');
  if(!record(value))throw new MessageError(source("api.invalidBootloaderMetadata_39e0b"));
  return value;
}
export const getWeatherRuntime=()=>request('GET','/weather');
/** Explicit local file download. Preserve bytes; do not normalize log newlines. */
export async function getLog(path:'/errors'|'/log'):Promise<Uint8Array>{
  return await exchangeWithRetry('GET',path,undefined,async response=>{
    if(response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='text/plain')throw new MessageError(source("api.unexpectedLogResponseType_53729"));
    return new Uint8Array(await response.arrayBuffer());
  }) as Uint8Array;
}
export async function getState(channels: number): Promise<DeviceState> {
  const v = await request("GET", "/state");
  if (
    !record(v) ||
    !integer(v.time) ||
    v.time > 8.64e12 ||
    !integer(v.uptime) ||
    typeof v.lan_ip !== "string" ||
    !integer(v.service_mode) ||
    !record(v.pwms)
  )
    throw new MessageError(source("api.invalidDeviceState_aef23"));
  for (let i = 1; i <= channels; i++)
    if (!integer(v.pwms[String(i)])) throw new MessageError(source("api.invalidChannelState_d1c24"));
  return v as unknown as DeviceState;
}
export async function getHostname(): Promise<string> {
  const v = await request("POST", "/", ["hostname"]);
  if (!record(v) || typeof v.hostname !== "string")
    throw new MessageError(source("api.invalidHostnameResponse_a3c11"));
  return v.hostname;
}
export async function putHostname(hostname: string, firmware: Firmware) {
  await request("PUT", "/", {
    hostname,
    save_version: firmware.version,
    save_sunriser: firmware.sunriser,
  });
}
export const validHostname = (name: string) =>
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(name);
export const utc = (seconds: number) =>
  new Date(seconds * 1000).toISOString().replace(".000Z", "Z");

export const inRange = (value: unknown, max: number): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= max;
export async function putState(value: {
  pwms?: Record<string, number>;
  service_mode?: number;
  blackout?: number;
  thunder?: number;
  timewarp?: number;
  time?: number;
}) {
  await request("PUT", "/state", value);
}
export interface ServiceSettings {
  timeout: number;
  channels: { percent: number; ignore: boolean; binary: boolean }[];
}
/** Fresh read of exactly these keys. Values already in the session cache are
 * refreshed too, so an explicit editor reload never leaves another page an older copy. */
export async function readConfig(keys: string[]) {
  const result: Record<string, unknown> = {}, epoch = configurationEpoch;
  for (let i = 0; i < keys.length; i += 15) {
    const v = await request("POST", "/", keys.slice(i, i + 15));
    if (!record(v)) throw new MessageError(source("api.invalidConfiguration_0444e"));
    for (const key of keys.slice(i, i + 15)) {
      if (!(key in v)) throw new MessageError(source("api.missingConfigurationKeyV0_188ae",{v0:key}));
      result[key] = v[key];
    }
  }
  if (epoch === configurationEpoch)
    for (const key of keys) if (savedConfiguration.has(key)) savedConfiguration.set(key, structuredClone(result[key]));
  return result;
}
// Session-local saved configuration only. Raw readConfig and write verification never
// read from this cache (they refresh entries already in it). Callers still use App's existing operation gate.
const savedConfiguration = new Map<string, unknown>();
const pendingSavedReads = new Map<string, Promise<Record<string, unknown>>>();
let savedReadTail: Promise<unknown> = Promise.resolve(), configurationEpoch = 0;
export function invalidateSavedConfiguration() {
  configurationEpoch++;
  savedConfiguration.clear();
  pendingSavedReads.clear();
}
export function acceptSavedConfiguration(values: Record<string, unknown>) {
  for (const [key,value] of Object.entries(values)) savedConfiguration.set(key, structuredClone(value));
}
export function readSavedConfiguration(keys: string[], refresh = false): Promise<Record<string, unknown>> {
  const requested=[...new Set(keys)], epoch=configurationEpoch;
  const signature=JSON.stringify([epoch,refresh,[...requested].sort()]);
  const pending=pendingSavedReads.get(signature);
  if(pending) return pending.then(value=>structuredClone(value));
  const task=savedReadTail.then(async()=>{
    if(epoch!==configurationEpoch) throw new MessageError(source("api.obsoleteConfigurationRead_01b70"));
    const missing=requested.filter(key=>refresh||!savedConfiguration.has(key));
    if(missing.length){
      const values=await readConfig(missing);
      if(epoch!==configurationEpoch) throw new MessageError(source("api.obsoleteConfigurationRead_01b70"));
      acceptSavedConfiguration(values);
    }
    return Object.fromEntries(requested.map(key=>[key,structuredClone(savedConfiguration.get(key))]));
  }).finally(()=>pendingSavedReads.delete(signature));
  pendingSavedReads.set(signature,task);
  savedReadTail=task.catch(()=>{});
  return task.then(value=>structuredClone(value));
}

export async function getService(count: number): Promise<ServiceSettings> {
  const keys = ["service_timeout", "service_value"];
  for (let i = 1; i <= count; i++)
    keys.push(`pwm#${i}#service`, `pwm#${i}#onoff`, `pwm#${i}#nomaint`);
  const v = await readConfig(keys);
  const number = (key: string, fallback: number) => {
    const value = v[key];
    if (value == null) return fallback;
    if (!integer(value)) throw new MessageError(source("api.invalidNumericSetting_1efab"));
    return value;
  };
  const boolean = (key: string) => {
    if (v[key] == null) return false;
    if (typeof v[key] !== "boolean") throw new MessageError(source("api.invalidBooleanSetting_0481f"));
    return v[key];
  };
  return {
    timeout: Math.min(10080, number("service_timeout", 1440)),
    channels: Array.from({ length: count }, (_, i) => {
      const n = i + 1,
        binary = boolean(`pwm#${n}#onoff`);
      const percent = Math.min(
        100,
        number(
          `pwm#${n}#service`,
          binary ? 0 : Math.floor(number("service_value", 1000) / 10),
        ),
      );
      return {
        percent: binary ? (percent > 0 ? 100 : 0) : percent,
        ignore: boolean(`pwm#${n}#nomaint`),
        binary,
      };
    }),
  };
}
export async function saveService(
  settings: ServiceSettings,
  firmware: Firmware,
) {
  const values: Record<string, number | boolean | string> = {
    service_timeout: settings.timeout,
    save_version: firmware.version,
    save_sunriser: firmware.sunriser,
  };
  settings.channels.forEach((ch, i) => {
    values[`pwm#${i + 1}#service`] = ch.percent;
    values[`pwm#${i + 1}#nomaint`] = ch.ignore;
  });
  await request("PUT", "/", values);
  const actual = await readConfig(Object.keys(values));
  for (const key of Object.keys(values))
    if (actual[key] !== values[key])
      throw new MessageError(source("api.serviceReadbackMismatch_6c09b"));
}

/** Partial configuration write, followed by typed readback of exactly those keys. */
export async function saveConfiguration(
  values: Record<string, unknown>,
  firmware: Firmware,
) {
  const payload = {
    ...values,
    save_version: firmware.version,
    save_sunriser: firmware.sunriser,
  };
  await request("PUT", "/", payload);
  const actual = await readConfig(Object.keys(payload));
  for (const [key, value] of Object.entries(payload))
    if (JSON.stringify(actual[key]) !== JSON.stringify(value))
      throw new MessageError(source("api.configurationReadbackMismatch_95937"));
  acceptSavedConfiguration(actual);
  configurationSaved();
}

/** Raw configuration values for recovery: C copies stored MessagePack objects verbatim. */
export async function readConfigBytes(keys: string[]): Promise<Uint8Array> {
  if (!keys.length || keys.length > 15) throw new MessageError(source("api.invalidRecoveryReadBatch_0e79f"));
  return await request("POST", "/", keys, true) as Uint8Array;
}
