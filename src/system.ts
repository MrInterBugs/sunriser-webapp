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
  { key: "ntpserver", label: "NTP server", type: "text", max: 128 },
  { key: "nofinder", label: "Disable vendor Finder", type: "bool" },
  { key: "enforcenet", label: "Keep trying DHCP", type: "bool" },
  { key: "useip4", label: "Use static LAN IPv4", type: "bool" },
  { key: "ip4", label: "LAN IPv4", type: "ip" },
  { key: "ip4_netmask", label: "LAN netmask", type: "ip" },
  { key: "ip4_gateway", label: "LAN gateway", type: "ip" },
  { key: "ip4_dns", label: "LAN DNS", type: "ip" },
  { key: "webport", label: "Web port", type: "port" },
  { key: "nowifi", label: "Disable Wi-Fi", type: "bool", wifi: true },
  { key: "wifi_connect", label: "Connect to Wi-Fi", type: "bool", wifi: true },
  { key: "wifi_ssid", label: "Wi-Fi SSID", type: "text", max: 32, wifi: true },
  {
    key: "wifi_pass",
    label: "Wi-Fi password",
    type: "password",
    max: 64,
    wifi: true,
  },
  { key: "wifi_ip4", label: "Wi-Fi IPv4", type: "ip", wifi: true },
  { key: "wifi_ip4_netmask", label: "Wi-Fi netmask", type: "ip", wifi: true },
  { key: "wifi_ip4_gateway", label: "Wi-Fi gateway", type: "ip", wifi: true },
  { key: "wifi_ip4_dns", label: "Wi-Fi DNS", type: "ip", wifi: true },
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
    throw Error("Use four IPv4 octets from 0 to 255.");
  const v = s.split(".").map(Number);
  if (v.some((n) => n > 255))
    throw Error("Use four IPv4 octets from 0 to 255.");
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
      if (value != null && typeof value !== "boolean")
        throw Error("Invalid Boolean setting");
      draft[key] = value ?? false;
    } else if (field?.type === "ip") {
      if (key === "wifi_ip4" && typeof value === "boolean") draft[key] = "";
      else if (value == null) draft[key] = "";
      else if (
        Array.isArray(value) &&
        value.length === 4 &&
        value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
      )
        draft[key] = value.join(".");
      else throw Error("Invalid IPv4 setting");
    } else if (
      key === "timezone" ||
      key === "gmtoff" ||
      field?.type === "port"
    ) {
      if (typeof value !== "number" || !Number.isInteger(value))
        throw Error("Invalid integer setting");
      draft[key] = String(value);
    } else {
      if (value != null && typeof value !== "string")
        throw Error("Invalid text setting");
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
): string {
  if (route === "clock") {
    if (!validTimezone(String(draft.tz)))
      return "Use a valid POSIX timezone rule of at most 64 ASCII characters.";
    if (!zones.legacy.some((z) => String(z.id) === draft.timezone))
      return "Choose a supported legacy timezone.";
  } else {
    for (const f of fieldsFor(wifi)) {
      const v = draft[f.key];
      if (f.type === "bool") {
        if (typeof v !== "boolean") return "Invalid Boolean setting";
        continue;
      }
      if (typeof v !== "string") return "Invalid text setting";
      if (f.type === "ip") {
        try {
          parseIPv4(v);
        } catch (e) {
          return (e as Error).message;
        }
      }
      if (f.type === "port" && (!/^\d+$/.test(v) || +v < 1 || +v > 65534))
        return "Web port must be an integer from 1 to 65534.";
      if ("max" in f && new TextEncoder().encode(v).length > f.max)
        return `${f.label} must be at most ${f.max} UTF-8 bytes.`;
      if (/[\x00-\x1f\x7f]/.test(v))
        return "Control characters are not allowed.";
    }
    if (
      draft.useip4 &&
      ["ip4", "ip4_netmask", "ip4_gateway", "ip4_dns"].some((k) => !draft[k])
    )
      return "Static LAN addressing requires all four IPv4 fields.";
    if (
      wifi &&
      draft.wifi_ip4 &&
      ["wifi_ip4_netmask", "wifi_ip4_gateway", "wifi_ip4_dns"].some(
        (k) => !draft[k],
      )
    )
      return "Stored Wi-Fi addressing requires all four IPv4 fields.";
    if (wifi && draft.wifi_connect && !draft.nowifi && !draft.wifi_ssid)
      return "Enter an SSID before enabling Wi-Fi connection.";
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
