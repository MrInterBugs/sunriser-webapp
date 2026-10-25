import {type Message, MessageError, source, renderMessage} from './messages.js';
/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Includes code/configuration adapted from the SunRiser project contributors.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Adapted for this frontend in 2026; see LICENSING.md and LICENSE.
 */
import { readConfig } from "./api.js";
import { parseStoredJson } from "./stored-json.js";
export type Effect = "clouds" | "rain" | "thunder" | "moon";
export type Value = string | boolean | number[];
export interface Field {
  group: Effect;
  key: string;
  label: Message;
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
    label: source("weather.enableClouds_6ca5f"),
    default: false,
    type: "boolean",
  },
  {
    group: "clouds",
    key: "daychance",
    label: source("weather.cloudDayChance_4564c"),
    default: 30,
    type: "integer",
    min: 0,
    max: 100,
  },
  {
    group: "clouds",
    key: "mincloudshare",
    label: source("weather.minimumCloudShare_30e87"),
    default: 10,
    type: "integer",
    min: 1,
    max: 100,
  },
  {
    group: "clouds",
    key: "cloudshare",
    label: source("weather.maximumCloudShare_299cb"),
    default: 30,
    type: "integer",
    min: 1,
    max: 100,
  },
  {
    group: "clouds",
    key: "clouddarkness",
    label: source("weather.cloudDarkness110_64844"),
    default: 10,
    type: "integer",
    min: 1,
    max: 10,
  },
  {
    group: "clouds",
    key: "weekdays",
    label: source("weather.cloudWeekdays_ae5dc"),
    default: [],
    type: "array",
  },
  {
    group: "clouds",
    key: "mincloud",
    label: source("weather.minimumCloudSeconds_15f3c"),
    default: 2,
    type: "integer",
    min: 1,
    max: 120,
  },
  {
    group: "clouds",
    key: "randcloud",
    label: source("weather.additionalCloudSeconds_c3b22"),
    default: 40,
    type: "integer",
    min: 0,
    max: 240,
  },
  {
    group: "rain",
    key: "activated",
    label: source("weather.enableRain_90294"),
    default: false,
    type: "boolean",
  },
  {
    group: "rain",
    key: "daychance",
    label: source("weather.rainDayChance_c017d"),
    default: 30,
    type: "integer",
    min: 0,
    max: 100,
  },
  {
    group: "rain",
    key: "minrainshare",
    label: source("weather.minimumRainShare_635a7"),
    default: 10,
    type: "integer",
    min: 1,
    max: 100,
  },
  {
    group: "rain",
    key: "rainshare",
    label: source("weather.maximumRainShare_e7ef4"),
    default: 30,
    type: "integer",
    min: 1,
    max: 100,
  },
  {
    group: "rain",
    key: "weekdays",
    label: source("weather.rainWeekdays_26a8b"),
    default: [],
    type: "array",
  },
  {
    group: "rain",
    key: "minrain",
    label: source("weather.minimumRainMinutes_6bcaf"),
    default: 5,
    type: "integer",
    min: 1,
    max: 240,
  },
  {
    group: "rain",
    key: "randrain",
    label: source("weather.additionalRainMinutes_2f19f"),
    default: 60,
    type: "integer",
    min: 0,
    max: 360,
  },
  {
    group: "rain",
    key: "dropdarkness",
    label: source("weather.dropDarkness110_b385c"),
    default: 10,
    type: "integer",
    min: 1,
    max: 10,
  },
  {
    group: "thunder",
    key: "activated",
    label: source("weather.enableThunderstorms_76ab1"),
    default: false,
    type: "boolean",
  },
  {
    group: "thunder",
    key: "daychance",
    label: source("weather.stormChancePerAttempt_690b0"),
    default: 35,
    type: "integer",
    min: 1,
    max: 100,
  },
  {
    group: "thunder",
    key: "daymax",
    label: source("weather.maximumStormsPerDay_184e1"),
    default: 3,
    type: "integer",
    min: 1,
    max: 50,
  },
  {
    group: "thunder",
    key: "minstorm",
    label: source("weather.minimumStormMinutes_e7b97"),
    default: 30,
    type: "integer",
    min: 2,
    max: 240,
  },
  {
    group: "thunder",
    key: "randstorm",
    label: source("weather.additionalStormMinutes_8920c"),
    default: 120,
    type: "integer",
    min: 0,
    max: 240,
  },
  {
    group: "thunder",
    key: "zeroonly",
    label: source("weather.onlyWhenAllPlannedLevelsAreZero_56d49"),
    default: false,
    type: "boolean",
  },
  {
    group: "thunder",
    key: "nozeroonly",
    label: source("weather.onlyWhenAPlannedLevelIsAboveZero_cd9bc"),
    default: false,
    type: "boolean",
  },
  {
    group: "thunder",
    key: "weekdays",
    label: source("weather.stormWeekdays_466ca"),
    default: [],
    type: "array",
  },
  {
    group: "thunder",
    key: "fixdeload",
    label: source("weather.fixedAfterflashStrength0Dynamic_f2e92"),
    default: 0,
    type: "integer",
    min: 0,
    max: 16,
  },
  {
    group: "thunder",
    key: "minrainextra",
    label: source("weather.minimumRainAfterStormMinutes_caa17"),
    default: 2,
    type: "integer",
    min: 0,
    max: 120,
  },
  {
    group: "thunder",
    key: "randrainextra",
    label: source("weather.additionalRainAfterStormMinutes_5e9b8"),
    default: 10,
    type: "integer",
    min: 0,
    max: 120,
  },
  {
    group: "thunder",
    key: "preflashlength",
    label: source("weather.preflashMilliseconds_ed04a"),
    default: 150,
    type: "integer",
    min: 100,
    max: 1000,
  },
  {
    group: "thunder",
    key: "pauselength",
    label: source("weather.pauseBeforeMainFlashMilliseconds_b61ac"),
    default: 200,
    type: "integer",
    min: 0,
    max: 1000,
  },
  {
    group: "thunder",
    key: "fullflashlength",
    label: source("weather.mainFlashMilliseconds_94f75"),
    default: 300,
    type: "integer",
    min: 100,
    max: 2000,
  },
  {
    group: "thunder",
    key: "deloadflashlength",
    label: source("weather.afterflashMilliseconds_62b2d"),
    default: 150,
    type: "integer",
    min: 100,
    max: 2000,
  },
  {
    group: "thunder",
    key: "deloadpauselength",
    label: source("weather.pauseBetweenAfterflashesMilliseconds_5febe"),
    default: 200,
    type: "integer",
    min: 0,
    max: 2000,
  },
  {
    group: "thunder",
    key: "minflashpause",
    label: source("weather.minimumPauseBetweenFlashesSeconds_23ab1"),
    default: 30,
    type: "integer",
    min: 1,
    max: 300,
  },
  {
    group: "thunder",
    key: "randflashpause",
    label: source("weather.additionalPauseBetweenFlashesSeconds_eff00"),
    default: 120,
    type: "integer",
    min: 0,
    max: 300,
  },
  {
    group: "thunder",
    key: "preflash",
    label: source("weather.preflashStrength116_dfa25"),
    default: 8,
    type: "integer",
    min: 1,
    max: 16,
  },
  {
    group: "thunder",
    key: "flash",
    label: source("weather.mainFlashStrength016_93b50"),
    default: 16,
    type: "integer",
    min: 0,
    max: 16,
  },
  {
    group: "thunder",
    key: "mindeload",
    label: source("weather.minimumAfterflashCount_8579b"),
    default: 2,
    type: "integer",
    min: 0,
    max: 10,
  },
  {
    group: "thunder",
    key: "randdeload",
    label: source("weather.additionalAfterflashCount_8b094"),
    default: 2,
    type: "integer",
    min: 0,
    max: 10,
  },
  {
    group: "thunder",
    key: "permanent",
    label: source("weather.continuousThunderstorms_036b3"),
    default: false,
    type: "boolean",
  },
  {
    group: "moon",
    key: "activated",
    label: source("weather.enableMoonlight_b2449"),
    default: false,
    type: "boolean",
  },
  {
    group: "moon",
    key: "maximum",
    label: source("weather.maximumMoonlight_1f1bf"),
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
          throw new MessageError(source("weather.invalidBoolean_ab602"));
        })();
export async function loadBook(count: number): Promise<Book> {
  const keys = ["weather#web", "weather#last_setup_id"];
  for (let n = 1; n <= count; n++)
    keys.push(`pwm#${n}#weather`, `pwm#${n}#onoff`);
  const baseline = await readConfig(keys);
  const raw = baseline["weather#web"];
  const profiles = (
    raw == null ? [] : typeof raw === "string" ? parseStoredJson("weather#web", raw) : null
  ) as Profile[];
  if (
    !Array.isArray(profiles) ||
    profiles.some(
      (p) =>
        !p || !int(p.id, 1) || typeof p.name !== "string" || !p.name.trim(),
    ) ||
    new Set(profiles.map((p) => p.id)).size !== profiles.length
  )
    throw new MessageError(source("schedules.invalidCatalogue_27a60"));
  const counter = baseline["weather#last_setup_id"] ?? 0;
  if (!int(counter)) throw new MessageError(source("weather.invalidCounter_98dff"));
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
      throw new MessageError(source("weather.conflictingProfile_a36cf"));
    bool(baseline[key(p.id, "thunder#activated")]);
  }
  const channels = Array.from({ length: count }, (_, i) => {
    const profile = baseline[`pwm#${i + 1}#weather`] ?? 0;
    if (!int(profile)) throw new MessageError(source("weather.invalidAssignment_40165"));
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
      if (typeof v !== "boolean") throw new MessageError(source("weather.invalidBoolean_ab602"));
      draft[fieldKey(f)] = v;
    } else if (f.type === "array") {
      if (
        !Array.isArray(v) ||
        v.some((n) => !int(n, 0, 6)) ||
        new Set(v).size !== v.length
      )
        throw new MessageError(source("weather.invalidWeekdays_33964"));
      draft[fieldKey(f)] = v;
    } else {
      if (typeof v !== "number" || !Number.isSafeInteger(v))
        throw new MessageError(source("weather.invalidInteger_30bfc"));
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
/** Default name in the interface language: only that language's catalogue is loaded. */
export function addProfile(book: Book, locale: "en" | "de") {
  const id = nextId(book);
  if (id > 65535) return;
  book.profiles.push({ id, name: renderMessage(source("weather.newProfileV0_3363f",{v0:id}), locale) });
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
