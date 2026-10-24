import {errorText, type Message, MessageError, source} from './messages.js';
/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Includes code/configuration adapted from the SunRiser project contributors.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Adapted for this frontend in 2026; see LICENSING.md and LICENSE.
 */
import { readConfig } from "./api.js";
import zones from "./timezones.json" with { type: "json" };
export { zones };
export type SettingsPage = "clock" | "network";
export type Values = Record<string, string | boolean>;
export const berlin = "CET-1CEST,M3.5.0,M10.5.0/3";
export const clockKeys = [
  "tz",
  "timezone",
  "gmtoff",
  "nodst",
  "summertime",
  "usentp",
];
export const networkFields = [
  { key: "ntpserver", label: source("system.ntpServer"), type: "text", max: 128 },
  { key: "nofinder", label: source("system.disableVendorFinder_d7b6d"), type: "bool" },
  { key: "enforcenet", label: source("system.keepTryingDHCP_df6fb"), type: "bool" },
  { key: "useip4", label: source("system.useStaticLANIPv4_d38f1"), type: "bool" },
  { key: "ip4", label: source("system.lanIPv4_1ae4a"), type: "ip" },
  { key: "ip4_netmask", label: source("system.lanNetmask"), type: "ip" },
  { key: "ip4_gateway", label: source("system.lanGateway"), type: "ip" },
  { key: "ip4_dns", label: source("system.lanDns"), type: "ip" },
  { key: "webport", label: source("system.webPort_4822a"), type: "port" },
  { key: "nowifi", label: source("system.disableWiFi_1baea"), type: "bool", wifi: true },
  { key: "wifi_connect", label: source("system.connectToWiFi_0825f"), type: "bool", wifi: true },
  { key: "wifi_ssid", label: source("system.wiFiSSID_97bad"), type: "text", max: 32, wifi: true },
  {
    key: "wifi_pass",
    label: source("system.wiFiPassword_ad4a3"),
    type: "password",
    max: 64,
    wifi: true,
  },
  { key: "wifi_ip4", label: source("system.wiFiIPv4_a835b"), type: "ip", wifi: true },
  { key: "wifi_ip4_netmask", label: source("system.wiFiNetmask_6bd72"), type: "ip", wifi: true },
  { key: "wifi_ip4_gateway", label: source("system.wiFiGateway_cf02d"), type: "ip", wifi: true },
  { key: "wifi_ip4_dns", label: source("system.wiFiDNS_59919"), type: "ip", wifi: true },
] as const;
export const fieldsFor = (wifi: boolean) =>
  networkFields.filter((f) => !("wifi" in f) || wifi);
export const keysFor = (route: SettingsPage, wifi: boolean) =>
  route === "clock" ? clockKeys : fieldsFor(wifi).map((f) => f.key);
// Firmware tz.c grammar, validated independently with boundary/transition examples.
export function validTimezone(value: string): boolean {
  if (value === "") return true;
  if (value.length > 64 || !/^[\x21-\x7e]+$/.test(value)) return false;
  let rest = value;
  const take = (pattern: RegExp) => {
    const m = pattern.exec(rest);
    if (!m) return null;
    rest = rest.slice(m[0].length);
    return m;
  };
  const name = () => !!take(/^(?:[A-Za-z]{3,}|<[A-Za-z0-9+-]{3,}>)/);
  const offset = (max: number) => {
    const m = take(/^[+-]?(\d+)(?::(\d{2})(?::(\d{2}))?)?/);
    return (
      !!m &&
      Number(m[1]) <= max &&
      Number(m[2] ?? 0) < 60 &&
      Number(m[3] ?? 0) < 60
    );
  };
  const rule = () => {
    const m = take(/^M(\d+)\.(\d+)\.(\d+)/);
    if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] < 1 || +m[2] > 5 || +m[3] > 6)
      return false;
    return rest.startsWith("/") ? ((rest = rest.slice(1)), offset(167)) : true;
  };
  if (!name() || !offset(24)) return false;
  if (!rest) return true;
  if (!name()) return false;
  if (!rest.startsWith(",") && !offset(24)) return false;
  if (!take(/^,/) || !rule() || !take(/^,/) || !rule()) return false;
  return rest === "";
}
export function parseIPv4(s: string): number[] | null {
  if (s === "") return null;
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s))
    throw new MessageError(source("system.useFourIPv4OctetsFrom0To255_bf691"));
  const v = s.split(".").map(Number);
  if (v.some((n) => n > 255))
    throw new MessageError(source("system.useFourIPv4OctetsFrom0To255_bf691"));
  return v;
}
export function recoveryURL(s: string): string {
  try {
    const u = new URL(s);
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash
    )
      return "";
    u.hash = "network";
    return u.href;
  } catch {
    return "";
  }
}
const defaults: Record<string, unknown> = {
  tz: "",
  timezone: 31,
  gmtoff: 60,
  nodst: false,
  summertime: false,
  usentp: true,
  ntpserver: "pool.ntp.org",
  webport: 80,
};
export interface Editor {
  draft: Values;
  baseline: Values;
  saved: Record<string, unknown>;
  legacyWifi: boolean;
}
export async function loadSettings(
  route: SettingsPage,
  wifi: boolean,
): Promise<Editor> {
  const raw = await readConfig(keysFor(route, wifi));
  const draft: Values = {};
  for (const key of keysFor(route, wifi)) {
    const value = raw[key] ?? defaults[key];
    const field = fieldsFor(wifi).find((f) => f.key === key);
    if (
      ["nodst", "summertime", "usentp"].includes(key) ||
      field?.type === "bool"
    ) {
      // Legacy stored configuration can contain this flag as integer 0/1.
      // Both supported firmware releases read it via bee_bool_in. Keep the
      // compatibility boundary narrow: no truthiness or arbitrary coercion.
      const flag = key === "summertime" && (value === 0 || value === 1)
        ? value === 1 : value;
      if (flag != null && typeof flag !== "boolean")
        throw new MessageError(source("system.invalidBooleanSettingV0_8773f",{v0:key}));
      draft[key] = flag ?? false;
    } else if (field?.type === "ip") {
      if (key === "wifi_ip4" && typeof value === "boolean") draft[key] = "";
      else if (value == null) draft[key] = "";
      else if (
        Array.isArray(value) &&
        value.length === 4 &&
        value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
      )
        draft[key] = value.join(".");
      else throw new MessageError(source("system.invalidIPv4SettingV0_f27c7",{v0:key}));
    } else if (
      key === "timezone" ||
      key === "gmtoff" ||
      field?.type === "port"
    ) {
      if (typeof value !== "number" || !Number.isInteger(value))
        throw new MessageError(source("system.invalidIntegerSettingV0_dc350",{v0:key}));
      draft[key] = String(value);
    } else {
      if (value != null && typeof value !== "string")
        throw new MessageError(source("system.invalidTextSettingV0_ce36a",{v0:key}));
      draft[key] = (value ?? "") as string;
    }
  }
  if (
    route === "clock" &&
    draft.tz === "" &&
    draft.gmtoff === "60" &&
    !draft.nodst
  )
    draft.tz = berlin;
  return {
    draft,
    baseline: { ...draft },
    saved: raw,
    legacyWifi: typeof raw.wifi_ip4 === "boolean",
  };
}
export function validation(
  route: SettingsPage,
  draft: Values,
  wifi: boolean,
): Message | "" {
  if (route === "clock") {
    if (!validTimezone(String(draft.tz)))
      return source("system.useAValidPOSIXTimezoneRuleOfAtMost_41df0");
    if (!zones.legacy.some((z) => String(z.id) === draft.timezone))
      return source("system.chooseASupportedLegacyTimezone_1fc78");
  } else {
    for (const f of fieldsFor(wifi)) {
      const v = draft[f.key];
      if (f.type === "bool") {
        if (typeof v !== "boolean") return source("api.invalidBooleanSetting_0481f");
        continue;
      }
      if (typeof v !== "string") return source("system.invalidTextSetting_a8009");
      if (f.type === "ip") {
        try {
          parseIPv4(v);
        } catch (e) {
          return errorText(e);
        }
      }
      if (f.type === "port" && (!/^\d+$/.test(v) || +v < 1 || +v > 65534))
        return source("system.webPortMustBeAnIntegerFrom1To_ae34a");
      if ("max" in f && new TextEncoder().encode(v).length > f.max)
        return source("system.v0MustBeAtMostV1UTF8Bytes_47401",{v0:f.label,v1:f.max});
      if (/[\x00-\x1f\x7f]/.test(v))
        return source("system.controlCharactersAreNotAllowed_4f369");
    }
    if (
      draft.useip4 &&
      ["ip4", "ip4_netmask", "ip4_gateway", "ip4_dns"].some((k) => !draft[k])
    )
      return source("system.staticLANAddressingRequiresAllFourIPv4Fields_f34d6");
    if (
      wifi &&
      draft.wifi_ip4 &&
      ["wifi_ip4_netmask", "wifi_ip4_gateway", "wifi_ip4_dns"].some(
        (k) => !draft[k],
      )
    )
      return source("system.storedWiFiAddressingRequiresAllFourIPv4Fields_95b20");
    if (wifi && draft.wifi_connect && !draft.nowifi && !draft.wifi_ssid)
      return source("system.enterAnSSIDBeforeEnablingWiFiConnection_1be52");
  }
  return "";
}
export function settingsPatch(
  route: SettingsPage,
  editor: Editor,
  wifi: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keysFor(route, wifi)) {
    const v = editor.draft[key];
    if (v === editor.baseline[key]) continue;
    const f = fieldsFor(wifi).find((f) => f.key === key);
    out[key] =
      f?.type === "ip"
        ? parseIPv4(String(v))
        : f?.type === "port" || key === "timezone" || key === "gmtoff"
          ? Number(v)
          : v === "" && key !== "tz"
            ? null
            : v;
  }
  if (route === "clock" && ("timezone" in out || out.tz === "")) {
    const z = zones.legacy.find((z) => String(z.id) === editor.draft.timezone)!;
    Object.assign(out, { timezone: z.id, gmtoff: z.gmtoff, nodst: z.nodst });
  }
  return out;
}
