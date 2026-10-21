import {source} from './messages.js';
/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Includes code/configuration adapted from the SunRiser project contributors.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Adapted for this frontend in 2026; see LICENSING.md and LICENSE.
 */
import { readConfig } from "./api.js";
export const key = (rom: string, field: string) =>
  `sensors#sensor#${rom}#${field}`;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const romPattern = /^[0-9a-fA-F]{16}$/;
export interface Reading {
  device: number;
  value: number;
}
export function parseSensorState(value: unknown) {
  const readings: Record<string, Reading> = {};
  const errors: string[] = [];
  if (value == null) return { readings, errors };
  if (!object(value)) return { readings, errors: [source("sensors.invalidSensorStateMap_083aa")] };
  for (const [rom, v] of Object.entries(value)) {
    if (
      !romPattern.test(rom) ||
      !Array.isArray(v) ||
      v.length !== 2 ||
      !Number.isInteger(v[0]) ||
      v[0] < 0 ||
      v[0] > 255 ||
      !Number.isInteger(v[1]) ||
      v[1] < -32768 ||
      v[1] > 32767
    )
      errors.push(source("sensors.invalidSensorReadingV0_1aea1",{v0:rom}));
    else readings[rom] = { device: v[0], value: v[1] };
  }
  return { readings, errors };
}
export const formatReading = (v: Reading) =>
  v.device === 1 ? `${v.value / 10} °C` : `${v.value} raw (device ${v.device})`;
export function tenths(text: string): number | undefined {
  if (!/^-?\d+(?:\.\d)?$/.test(text)) return;
  const value = Number(text) * 10;
  const rounded = Math.round(value);
  return Number.isSafeInteger(rounded) && Math.abs(value - rounded) < 1e-8
    ? rounded
    : undefined;
}
export type Catalogue = Record<string, Record<string, unknown>>;
export interface Channel {
  binary: boolean;
  manager: number;
  name: string;
}
export function sensorCatalogue(value: unknown): Catalogue {
  let catalogue: Catalogue = {};
  if (value != null && value !== "") {
    if (typeof value !== "string")
      throw Error(source("sensors.invalidSensorCatalogue_cd8df"));
    const parsed: unknown = JSON.parse(value);
    if (!object(parsed)) throw Error(source("sensors.invalidSensorCatalogue_cd8df"));
    for (const [rom, entry] of Object.entries(parsed)) {
      if (
        !romPattern.test(rom) ||
        !object(entry) ||
        entry.id !== rom ||
        typeof entry.name !== "string" ||
        !Number.isInteger(entry.device)
      )
        throw Error(source("sensors.invalidSensorCatalogueEntry_77a80"));
    }
    catalogue = parsed as Catalogue;
  }
  return catalogue;
}
export async function loadSensorIndex(count: number) {
  const keys = ["sensors#web"];
  for (let n = 1; n <= count; n++)
    keys.push(`pwm#${n}#onoff`, `pwm#${n}#manager`, `pwm#${n}#name`);
  const values = await readConfig(keys);
  const catalogue = sensorCatalogue(values["sensors#web"]);
  const channels = Array.from({ length: count }, (_, i) => {
    const binary = values[`pwm#${i + 1}#onoff`] ?? false,
      manager = values[`pwm#${i + 1}#manager`] ?? 0,
      name = values[`pwm#${i + 1}#name`] ?? "";
    if (
      typeof binary !== "boolean" ||
      typeof manager !== "number" ||
      !Number.isInteger(manager) ||
      manager < 0 ||
      manager > 4 ||
      typeof name !== "string"
    )
      throw Error(source("sensors.invalidSensorChannelMetadata_7eea4"));
    return { binary, manager, name };
  });
  return { catalogue, channels };
}
export interface Assignment {
  enabled: boolean;
  percent: string;
  absolute: boolean;
}
export interface SensorDraft {
  name: string;
  active: boolean;
  offset: string;
  desiredmin: string;
  desiredmax: string;
  months: number[];
  channels: { min: Assignment; max: Assignment }[];
}
export interface SensorEditor {
  baseline: Record<string, unknown>;
  draft: SensorDraft;
  min: number;
  max: number;
  supported: boolean;
}
export const fields = [
  "name",
  "device",
  "unit",
  "unitcomma",
  "deviceoffset",
  "min",
  "max",
  "active",
  "offset",
  "desiredmin",
  "desiredmax",
  "months",
];
const assignmentFields = [
  "domin",
  "domax",
  "percentmin",
  "percentmax",
  "absmin",
  "absmax",
];
export function defaults(
  count: number,
  name: string,
  min = 150,
  max = 350,
): SensorDraft {
  return {
    name,
    active: false,
    offset: "0",
    desiredmin: String(min / 10),
    desiredmax: String(max / 10),
    months: [],
    channels: Array.from({ length: count }, () => ({
      min: { enabled: false, percent: "0", absolute: false },
      max: { enabled: false, percent: "0", absolute: false },
    })),
  };
}
export async function loadSensor(
  rom: string,
  entry: Record<string, unknown>,
  channels: Channel[],
): Promise<SensorEditor> {
  const keys = fields.map((f) => key(rom, f));
  for (let n = 1; n <= channels.length; n++)
    keys.push(...assignmentFields.map((f) => key(rom, `pwm#${n}#${f}`)));
  const baseline = await readConfig(keys);
  const value = (f: string, fallback: unknown) =>
    baseline[key(rom, f)] ?? fallback;
  const num = (f: string, fallback: number) => {
    const n = value(f, fallback);
    if (
      typeof n !== "number" ||
      !Number.isInteger(n) ||
      n < -32768 ||
      n > 32767
    )
      throw Error(source("sensors.invalidSensorNumber_b5357"));
    return n;
  };
  const bool = (f: string) => {
    const b = value(f, false);
    if (typeof b !== "boolean") throw Error(source("sensors.invalidSensorFlag_cc359"));
    return b;
  };
  const name = value("name", entry.name);
  if (typeof name !== "string") throw Error(source("sensors.invalidSensorName_c0407"));
  const min = num("min", 150),
    max = num("max", 350);
  if (min > max) throw Error(source("sensors.invalidSensorBounds_1bb8f"));
  const months = value("months", []);
  if (
    !Array.isArray(months) ||
    months.some((m) => !Number.isInteger(m) || m < 1 || m > 12) ||
    new Set(months).size !== months.length
  )
    throw Error(source("sensors.invalidSensorMonths_6d03f"));
  const draft = defaults(channels.length, name, min, max);
  Object.assign(draft, {
    active: bool("active"),
    offset: String(num("offset", 0) / 10),
    desiredmin: String(num("desiredmin", min) / 10),
    desiredmax: String(num("desiredmax", max) / 10),
    months: [...months],
  });
  draft.channels = channels.map(
    (ch, i) =>
      Object.fromEntries(
        ["min", "max"].map((side) => {
          const p = `pwm#${i + 1}#`;
          const percent = num(`${p}percent${side}`, 0);
          if (
            percent < 0 ||
            percent > 200 ||
            (ch.binary && percent !== 0 && percent !== 100)
          )
            throw Error(source("sensors.invalidSensorPercent_dfaa3"));
          return [
            side,
            {
              enabled: bool(`${p}do${side}`),
              percent: String(percent),
              absolute: bool(`${p}abs${side}`),
            },
          ];
        }),
      ) as { min: Assignment; max: Assignment },
  );
  const supported =
    num("device", Number(entry.device)) === 1 &&
    num("unit", Number(entry.unit ?? 1)) === 1 &&
    num("unitcomma", Number(entry.unitcomma ?? 1)) === 1;
  num("deviceoffset", 10);
  return { baseline, draft, min, max, supported };
}
export function validDraft(editor: SensorEditor, channels: Channel[]) {
  const d = editor.draft,
    offset = tenths(d.offset),
    min = tenths(d.desiredmin),
    max = tenths(d.desiredmax);
  return (
    editor.supported &&
    !!d.name.trim() &&
    offset !== undefined &&
    offset >= -50 &&
    offset <= 50 &&
    min !== undefined &&
    max !== undefined &&
    min >= editor.min &&
    max <= editor.max &&
    min <= max &&
    d.channels.every((pair, i) =>
      Object.values(pair).every(
        (a) =>
          /^\d+$/.test(a.percent) &&
          Number(a.percent) <=
            (channels[i].binary ? 100 : a.absolute ? 100 : 200) &&
          (!channels[i].binary || [0, 100].includes(Number(a.percent))),
      ),
    )
  );
}
export function sensorPatch(
  rom: string,
  editor: SensorEditor,
  catalogue: Catalogue,
) {
  const d = editor.draft;
  const values: Record<string, unknown> = {
    name: d.name,
    active: d.active,
    offset: tenths(d.offset),
    desiredmin: tenths(d.desiredmin),
    desiredmax: tenths(d.desiredmax),
    months: d.months,
  };
  d.channels.forEach((pair, i) => {
    for (const side of ["min", "max"] as const) {
      const a = pair[side];
      values[`pwm#${i + 1}#do${side}`] = a.enabled;
      values[`pwm#${i + 1}#percent${side}`] = Number(a.percent);
      values[`pwm#${i + 1}#abs${side}`] = a.absolute;
    }
  });
  // Missing firmware fields default to zero. On activation, explicitly persist the visible thresholds/corrections.
  const patch: Record<string, unknown> = {};
  for (const [f, value] of Object.entries(values)) {
    const old = editor.baseline[key(rom, f)];
    const fallback =
      f === "desiredmin"
        ? editor.min
        : f === "desiredmax"
          ? editor.max
          : f === "months"
            ? []
            : typeof value === "boolean"
              ? false
              : typeof value === "number"
                ? 0
                : catalogue[rom].name;
    if (JSON.stringify(old ?? fallback) !== JSON.stringify(value))
      patch[key(rom, f)] = value;
  }
  if (d.active) {
    for (const field of ["desiredmin", "desiredmax"])
      if (editor.baseline[key(rom, field)] == null)
        patch[key(rom, field)] = values[field];
    if (editor.baseline[key(rom, "deviceoffset")] == null)
      patch[key(rom, "deviceoffset")] = 10;
  }
  if (key(rom, "name") in patch)
    patch["sensors#web"] = JSON.stringify({
      ...catalogue,
      [rom]: { ...catalogue[rom], name: d.name },
    });
  return patch;
}
export function registration(rom: string, name: string, catalogue: Catalogue) {
  const entry = {
    id: rom,
    sorting:
      Math.max(
        0,
        ...Object.values(catalogue).map((e) =>
          typeof e.sorting === "number" ? e.sorting : 0,
        ),
      ) + 1,
    device: 1,
    unit: 1,
    unitcomma: 1,
    min: 150,
    max: 350,
    deviceoffset: 10,
    name,
  };
  const { id: _, sorting: __, ...settings } = entry;
  return {
    entry,
    patch: {
      ...Object.fromEntries(
        Object.entries({
          ...settings,
          active: false,
          offset: 0,
          desiredmin: 150,
          desiredmax: 350,
          months: [],
        }).map(([f, v]) => [key(rom, f), v]),
      ),
      "sensors#web": JSON.stringify({ ...catalogue, [rom]: entry }),
    },
  };
}
