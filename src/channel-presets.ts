/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Includes code/configuration adapted from the SunRiser project contributors.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Adapted for this frontend in 2026; see LICENSING.md and LICENSE.
 */
// Exact legacy display catalogue; colours describe UI labels, not physical spectra.
// Source: sunriser-webapp/app/modules/sunriser_colors_config.js
const originalCatalogue: {id:string; name:string; color:string; replace_me_with?:string[]}[] = [
  {
    id: "625nm",
    name: "Morgenröte",
    color: "#ff5700",
  },
  {
    id: "3500k",
    name: "Sunrise",
    color: "#ffc987",
  },
  {
    id: "4500k",
    name: "Tageslicht warm",
    color: "#ffdf88",
  },
  {
    id: "5500k",
    name: " Tageslicht neutral",
    color: "#fff9fb",
  },
  {
    id: "7500k",
    name: "Tageslicht kühl",
    color: "#eeefff",
  },
  {
    id: "13000k",
    name: "Tageslicht kalt",
    color: "#beceff",
  },
  {
    id: "465nm",
    name: "Mondlicht",
    color: "#66a3ff",
  },
  {
    id: "growx5",
    name: "Pflanzenlicht",
    color: "#ff66cc",
  },
  {
    id: "UVA",
    name: "UVA",
    color: "#9966ff",
  },
  {
    id: "aqualumix_amazon_grow",
    name: "aquaLUMix",
    color: "#d4f0c8",
    replace_me_with: ["5500k", "7500k", "465nm", "3500k"],
  },
  {
    id: "aqualumix_seawater",
    name: "aquaLUMix DEEP-BLUE",
    color: "#9999ff",
    replace_me_with: ["7500k", "13000k", "465nm", "UVA"],
  },
  {
    id: "spotbeam",
    name: "spotBEAM",
    color: "#c9e4ff",
    replace_me_with: ["5500k", "465nm", "3500k"],
  },
  {
    id: "spotbeam_seawater",
    name: "spotBEAM SEAWATER",
    color: "#99c2ff",
    replace_me_with: ["5500k", "465nm", "3500k"],
  },
  {
    id: "powerbeam3K",
    name: "powerBEAM",
    color: "#ffe5b8",
    replace_me_with: ["5500k", "465nm", "3500k"],
  },
  {
    id: "powerbeam2K",
    name: "powerBEAM SEAWATER",
    color: "#b8d4ff",
    replace_me_with: ["5500k", "465nm"],
  },
  {
    id: "pump",
    name: "Minipumpe",
    color: "#94e094",
  },
  {
    id: "co",
    name: "CO2 Ventil",
    color: "#94e094",
  },
  {
    id: "6500k",
    name: "SKY 6500K",
    color: "#e0e0e0",
  },
  {
    id: "coralmix",
    name: "CORAL MIX",
    color: "#e0e0e0",
  },
  {
    id: "11000k",
    name: "REEF 11000K",
    color: "#e0e0e0",
  },
  {
    id: "custom",
    name: "Andere Farbe 1",
    color: "#e0e0e0",
  },
  {
    id: "custompink",
    name: "Andere Farbe 2",
    color: "#e0e0e0",
  },
  {
    id: "customcyan",
    name: "Andere Farbe 3",
    color: "#e0e0e0",
  },
  {
    id: "customblue",
    name: "Andere Farbe 4",
    color: "#e0e0e0",
  },
  {
    id: "customred",
    name: "Andere Farbe 5",
    color: "#e0e0e0",
  },
  {
    id: "powermain",
    name: "powerBEAM HAUPTKANAL",
    color: "#e0e0e0",
  },
  {
    id: "powermoon",
    name: "powerBEAM MOON",
    color: "#e0e0e0",
  },
  {
    id: "powersunrise",
    name: "powerBEAM SUNRISE",
    color: "#e0e0e0",
  },
  {
    id: "spotmain",
    name: "spotBEAM #1 HAUPTLICHT",
    color: "#e0e0e0",
  },
  {
    id: "spotmoon",
    name: "spotBEAM #2 MOON",
    color: "#e0e0e0",
  },
  {
    id: "spotsunrise",
    name: "spotBEAM #3 SUNRISE",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_freshwater_day_tropic",
    name: "aquaLUMix FRESHWATER #1 DAY/TROPIC",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_freshwater_sky_day",
    name: "aquaLUMix FRESHWATER #2 SKY/DAY",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_freshwater_blue_mix",
    name: "aquaLUMix FRESHWATER #3 BLUE MIX",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_freshwater_sunset_red",
    name: "aquaLUMix FRESHWATER #4 SUNSET/RED",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_amazon_grow_tropic_day",
    name: "aquaLUMix AMAZON-GROW #1 TROPIC/DAY",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_amazon_grow_sky_grow",
    name: "aquaLUMix AMAZON-GROW #2 SKY/GROW",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_amazon_grow_blue_mix",
    name: "aquaLUMix AMAZON-GROW #3 BLUE MIX",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_amazon_grow_sunset_red",
    name: "aquaLUMix AMAZON-GROW #4 SUNSET/RED",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_african_sun_sky",
    name: "aquaLUMix AFRICAN-SUN #1 SKY",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_african_sun_reef_polar",
    name: "aquaLUMix AFRICAN-SUN #2 REEF/POLAR",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_african_sun_blue_mix",
    name: "aquaLUMix AFRICAN-SUN #3 BLUE MIX",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_african_sun_sunset_mix",
    name: "aquaLUMix AFRICAN-SUN #4 SUNSET MIX",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_seawater_marine_reef",
    name: "aquaLUMix SEAWATER #1 MARINE/REEF",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_seawater_reef",
    name: "aquaLUMix SEAWATER #2 REEF",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_seawater_blue",
    name: "aquaLUMix SEAWATER #3 BLUE",
    color: "#e0e0e0",
  },
  {
    id: "aqualumix_seawater_coral_mix",
    name: "aquaLUMix SEAWATER #4 CORAL MIX",
    color: "#e0e0e0",
  },
];

/** Deterministic display translations of original catalogue descriptors only. */
export const englishCatalogueNames: Readonly<Record<string, string>> = {
  '625nm': 'Dawn Glow', '4500k': 'Warm Daylight', '5500k': 'Neutral Daylight',
  '7500k': 'Cool Daylight', '13000k': 'Cold Daylight', '465nm': 'Moonlight',
  'growx5': 'Plant Light', 'pump': 'Mini Pump', 'co': 'CO₂ Valve',
  'custom': 'Other Colour 1', 'custompink': 'Other Colour 2', 'customcyan': 'Other Colour 3',
  'customblue': 'Other Colour 4', 'customred': 'Other Colour 5',
  'powermain': 'powerBEAM Main Channel', 'spotmain': 'spotBEAM #1 Main Light',
};
export interface ChannelPreset {id:string; name:string; originalName:string; color:string; replace_me_with?:string[]}
// One published catalogue. IDs, colours, order and expansion arrays are inherited verbatim.
export const presets: ChannelPreset[] = originalCatalogue.map(entry => ({
  ...entry, originalName:entry.name, name:englishCatalogueNames[entry.id] ?? entry.name.trim(),
}));

/** Manufacturer/model spelling, IDs and expansion stay exact; original German descriptors are display-only. */
export function presetName(preset: ChannelPreset, language: 'en'|'de'):string {
 return language==='de'?preset.originalName.trim():preset.name;
}
