/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Includes code/configuration adapted from the SunRiser project contributors.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Adapted for this frontend in 2026; see LICENSING.md and LICENSE.
 */
import { readConfig } from "./api";
export type Effect = "clouds" | "rain" | "thunder" | "moon";
export type Value = string | boolean | number[];
export interface Field {
  group: Effect;
  key: string;
  label: string;
  default: number | boolean | number[];
  type: string;
  min?: number;
  max?: number;
}
// Legacy forms supply bounds; config_def supplies defaults. These are UI units,
// not raw PWM counts. The protocol examples live independently in the test suite.
export const fields: Field[] = [
  {
    group: "clouds",
    key: "activated",
    label: "Enable clouds",
    default: false,
    type: "boolean",
  },
  {
    group: "clouds",
    key: "daychance",
    label: "Cloud day chance %",
    default: 30,
    type: "integer",
    min: 0,
    max: 100,
  },
  {
    group: "clouds",
    key: "mincloudshare",
    label: "Minimum cloud share %",
    default: 10,
    type: "integer",
    min: 1,
    max: 100,
  },
  {
    group: "clouds",
    key: "cloudshare",
    label: "Maximum cloud share %",
    default: 30,
    type: "integer",
    min: 1,
    max: 100,
  },
  {
    group: "clouds",
    key: "clouddarkness",
    label: "Cloud darkness (1–10)",
    default: 10,
    type: "integer",
    min: 1,
    max: 10,
  },
  {
    group: "clouds",
    key: "weekdays",
    label: "Cloud weekdays",
    default: [],
    type: "array",
  },
  {
    group: "clouds",
    key: "mincloud",
    label: "Minimum cloud seconds",
    default: 2,
    type: "integer",
    min: 1,
    max: 120,
  },
  {
    group: "clouds",
    key: "randcloud",
    label: "Additional cloud seconds",
    default: 40,
    type: "integer",
    min: 0,
    max: 240,
  },
  {
    group: "rain",
    key: "activated",
    label: "Enable rain",
    default: false,
    type: "boolean",
  },
  {
    group: "rain",
    key: "daychance",
    label: "Rain day chance %",
    default: 30,
    type: "integer",
    min: 0,
    max: 100,
  },
  {
    group: "rain",
    key: "minrainshare",
    label: "Minimum rain share %",
    default: 10,
    type: "integer",
    min: 1,
    max: 100,
  },
  {
    group: "rain",
    key: "rainshare",
    label: "Maximum rain share %",
    default: 30,
    type: "integer",
    min: 1,
    max: 100,
  },
  {
    group: "rain",
    key: "weekdays",
    label: "Rain weekdays",
    default: [],
    type: "array",
  },
  {
    group: "rain",
    key: "minrain",
    label: "Minimum rain minutes",
    default: 5,
    type: "integer",
    min: 1,
    max: 240,
  },
  {
    group: "rain",
    key: "randrain",
    label: "Additional rain minutes",
    default: 60,
    type: "integer",
    min: 0,
    max: 360,
  },
  {
    group: "rain",
    key: "dropdarkness",
    label: "Drop darkness (1–10)",
    default: 10,
    type: "integer",
    min: 1,
    max: 10,
  },
  {
    group: "thunder",
    key: "activated",
    label: "Enable thunderstorms",
    default: false,
    type: "boolean",
  },
  {
    group: "thunder",
    key: "daychance",
    label: "Storm chance per attempt %",
    default: 35,
    type: "integer",
    min: 1,
    max: 100,
  },
  {
    group: "thunder",
    key: "daymax",
    label: "Maximum storms per day",
    default: 3,
    type: "integer",
    min: 1,
    max: 50,
  },
  {
    group: "thunder",
    key: "minstorm",
    label: "Minimum storm minutes",
    default: 30,
    type: "integer",
    min: 2,
    max: 240,
  },
  {
    group: "thunder",
    key: "randstorm",
    label: "Additional storm minutes",
    default: 120,
    type: "integer",
    min: 0,
    max: 240,
  },
  {
    group: "thunder",
    key: "zeroonly",
    label: "Only when all planned levels are zero",
    default: false,
    type: "boolean",
  },
  {
    group: "thunder",
    key: "nozeroonly",
    label: "Only when a planned level is above zero",
    default: false,
    type: "boolean",
  },
  {
    group: "thunder",
    key: "weekdays",
    label: "Storm weekdays",
    default: [],
    type: "array",
  },
  {
    group: "thunder",
    key: "fixdeload",
    label: "Fixed afterflash strength (0 dynamic)",
    default: 0,
    type: "integer",
    min: 0,
    max: 16,
  },
  {
    group: "thunder",
    key: "minrainextra",
    label: "Minimum rain after storm minutes",
    default: 2,
    type: "integer",
    min: 0,
    max: 120,
  },
  {
    group: "thunder",
    key: "randrainextra",
    label: "Additional rain after storm minutes",
    default: 10,
    type: "integer",
    min: 0,
    max: 120,
  },
  {
    group: "thunder",
    key: "preflashlength",
    label: "Preflash milliseconds",
    default: 150,
    type: "integer",
    min: 100,
    max: 1000,
  },
  {
    group: "thunder",
    key: "pauselength",
    label: "Pause before main flash milliseconds",
    default: 200,
    type: "integer",
    min: 0,
    max: 1000,
  },
  {
    group: "thunder",
    key: "fullflashlength",
    label: "Main flash milliseconds",
    default: 300,
    type: "integer",
    min: 100,
    max: 2000,
  },
  {
    group: "thunder",
    key: "deloadflashlength",
    label: "Afterflash milliseconds",
    default: 150,
    type: "integer",
    min: 100,
    max: 2000,
  },
  {
    group: "thunder",
    key: "deloadpauselength",
    label: "Pause between afterflashes milliseconds",
    default: 200,
    type: "integer",
    min: 0,
    max: 2000,
  },
  {
    group: "thunder",
    key: "minflashpause",
    label: "Minimum pause between flashes seconds",
    default: 30,
    type: "integer",
    min: 1,
    max: 300,
  },
  {
    group: "thunder",
    key: "randflashpause",
    label: "Additional pause between flashes seconds",
    default: 120,
    type: "integer",
    min: 0,
    max: 300,
  },
  {
    group: "thunder",
    key: "preflash",
    label: "Preflash strength (1–16)",
    default: 8,
    type: "integer",
    min: 1,
    max: 16,
  },
  {
    group: "thunder",
    key: "flash",
    label: "Main flash strength (0–16)",
    default: 16,
    type: "integer",
    min: 0,
    max: 16,
  },
  {
    group: "thunder",
    key: "mindeload",
    label: "Minimum afterflash count",
    default: 2,
    type: "integer",
    min: 0,
    max: 10,
  },
  {
    group: "thunder",
    key: "randdeload",
    label: "Additional afterflash count",
    default: 2,
    type: "integer",
    min: 0,
    max: 10,
  },
  {
    group: "thunder",
    key: "permanent",
    label: "Continuous thunderstorms",
    default: false,
    type: "boolean",
  },
  {
    group: "moon",
    key: "activated",
    label: "Enable moonlight",
    default: false,
    type: "boolean",
  },
  {
    group: "moon",
    key: "maximum",
    label: "Maximum moonlight %",
    default: 100,
    type: "integer",
    min: 0,
    max: 200,
  },
];
export const effects: Effect[] = ["clouds", "rain", "thunder", "moon"];
export const key = (id: number, field: string) =>
  `weather#setup#${id}#${field}`;
export const fieldKey = (f: Field) => `${f.group}#${f.key}`;
export const defaults = () =>
  Object.fromEntries(
    fields.map((f) => [
      fieldKey(f),
      Array.isArray(f.default)
        ? [...f.default]
        : typeof f.default === "number"
          ? String(f.default)
          : f.default,
    ]),
  ) as Record<string, Value>;
export interface Profile {
  id: number;
  name: string;
  [extra: string]: unknown;
}
export interface Book {
  profiles: Profile[];
  counter: number;
  channels: {
    profile: number;
    binary: boolean;
  }[];
  baseline: Record<string, unknown>;
  drafts: Record<number, Record<string, Value>>;
  removed: number[];
}
const int = (v: unknown, min = 0, max = 65535): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const bool = (v: unknown) =>
  v == null
    ? false
    : typeof v === "boolean"
      ? v
      : (() => {
          throw Error("Invalid Boolean");
        })();
export async function loadBook(count: number): Promise<Book> {
  const keys = ["weather#web", "weather#last_setup_id"];
  for (let n = 1; n <= count; n++)
    keys.push(`pwm#${n}#weather`, `pwm#${n}#onoff`);
  const baseline = await readConfig(keys);
  const raw = baseline["weather#web"];
  const profiles: Profile[] =
    raw == null ? [] : typeof raw === "string" ? JSON.parse(raw) : null;
  if (
    !Array.isArray(profiles) ||
    profiles.some(
      (p) =>
        !p || !int(p.id, 1) || typeof p.name !== "string" || !p.name.trim(),
    ) ||
    new Set(profiles.map((p) => p.id)).size !== profiles.length
  )
    throw Error("Invalid catalogue");
  const counter = baseline["weather#last_setup_id"] ?? 0;
  if (!int(counter)) throw Error("Invalid counter");
  Object.assign(
    baseline,
    await readConfig(
      profiles.flatMap((p) => [
        key(p.id, "name"),
        key(p.id, "deleted"),
        key(p.id, "thunder#activated"),
      ]),
    ),
  );
  for (const p of profiles) {
    if (
      baseline[key(p.id, "name")] !== p.name ||
      bool(baseline[key(p.id, "deleted")])
    )
      throw Error("Conflicting profile");
    bool(baseline[key(p.id, "thunder#activated")]);
  }
  const channels = Array.from({ length: count }, (_, i) => {
    const profile = baseline[`pwm#${i + 1}#weather`] ?? 0;
    if (!int(profile)) throw Error("Invalid assignment");
    return { profile, binary: bool(baseline[`pwm#${i + 1}#onoff`]) };
  });
  return { profiles, counter, channels, baseline, drafts: {}, removed: [] };
}
export async function loadProfile(book: Book, id: number) {
  const values = await readConfig(fields.map((f) => key(id, fieldKey(f))));
  const draft = defaults();
  for (const f of fields) {
    const v = values[key(id, fieldKey(f))];
    if (v == null) continue;
    if (f.type === "boolean") {
      if (typeof v !== "boolean") throw Error("Invalid Boolean");
      draft[fieldKey(f)] = v;
    } else if (f.type === "array") {
      if (
        !Array.isArray(v) ||
        v.some((n) => !int(n, 0, 6)) ||
        new Set(v).size !== v.length
      )
        throw Error("Invalid weekdays");
      draft[fieldKey(f)] = v;
    } else {
      if (typeof v !== "number" || !Number.isSafeInteger(v))
        throw Error("Invalid integer");
      draft[fieldKey(f)] = String(v);
    }
  }
  Object.assign(book.baseline, values);
  book.drafts[id] = draft;
}
export const nextId = (book: Book) =>
  Math.max(
    book.counter,
    ...book.profiles.map((p) => p.id),
    ...book.removed,
    0,
  ) + 1;
export function addProfile(book: Book) {
  const id = nextId(book);
  if (id > 65535) return;
  book.profiles.push({ id, name: `New profile ${id}` });
  book.counter = id;
  book.drafts[id] = defaults();
  return id;
}
export function removeProfile(book: Book, id: number) {
  if (book.channels.some((c) => c.profile === id)) return;
  book.profiles = book.profiles.filter((p) => p.id !== id);
  delete book.drafts[id];
  if (book.baseline[key(id, "name")] != null) book.removed.push(id);
}
export function validBook(book: Book) {
  if (
    book.profiles.some((p) => !p.name.trim()) ||
    book.channels.some(
      (c) => c.profile !== 0 && !book.profiles.some((p) => p.id === c.profile),
    )
  )
    return false;
  for (const draft of Object.values(book.drafts)) {
    for (const f of fields) {
      const v = draft[fieldKey(f)];
      if (
        f.type === "integer" &&
        (typeof v !== "string" ||
          !/^\d+$/.test(v) ||
          !int(Number(v), f.min, f.max))
      )
        return false;
    }
    if (
      Number(draft["clouds#mincloudshare"]) >
        Number(draft["clouds#cloudshare"]) ||
      Number(draft["rain#minrainshare"]) > Number(draft["rain#rainshare"])
    )
      return false;
  }
  return true;
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function weatherPatch(book: Book) {
  const patch: Record<string, unknown> = {};
  const set = (k: string, v: unknown, fallback?: unknown) => {
    if (!same(book.baseline[k] ?? fallback, v)) patch[k] = v;
  };
  let original: unknown = [];
  if (typeof book.baseline["weather#web"] === "string")
    original = JSON.parse(book.baseline["weather#web"]);
  if (!same(original, book.profiles))
    patch["weather#web"] = JSON.stringify(book.profiles);
  set("weather#last_setup_id", book.counter, 0);
  for (const p of book.profiles) {
    set(key(p.id, "name"), p.name);
    if (book.baseline[key(p.id, "name")] == null)
      patch[key(p.id, "deleted")] = false;
    const draft = book.drafts[p.id];
    if (!draft) continue;
    for (const f of fields) {
      const k = key(p.id, fieldKey(f)),
        v = draft[fieldKey(f)];
      const value = f.type === "integer" ? Number(v) : v;
      // C has zero/nil semantics; activation explicitly supplies displayed defaults.
      const missing =
        book.baseline[k] == null && draft[`${f.group}#activated`] === true;
      if (missing) patch[k] = value;
      else set(k, value, f.default);
    }
  }
  book.channels.forEach((c, i) => set(`pwm#${i + 1}#weather`, c.profile, 0));
  for (const id of book.removed) patch[key(id, "deleted")] = true;
  return patch;
}
export const eligible = (book: Book) =>
  book.channels.some(
    (c, i) =>
      !c.binary &&
      Number(book.baseline[`pwm#${i + 1}#weather`]) > 0 &&
      book.baseline[
        key(Number(book.baseline[`pwm#${i + 1}#weather`]), "thunder#activated")
      ] === true,
  );
