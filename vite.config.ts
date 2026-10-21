/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern frontend adapted from the SunRiser project and its workflows.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Frontend adaptation (2026); see LICENSING.md and LICENSE.
 * Third-party material retains its own terms.
 */
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { sequentialStartup } from "./src/startup-build.js";
export default defineConfig({
  plugins: [svelte(), sequentialStartup()],
  base: "./",
  build: {
    target: "es2022",
    modulePreload: false,
    cssCodeSplit: false,
    assetsDir: "a",
    sourcemap: false,
  },
});
