/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern frontend adapted from the SunRiser project and its workflows.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Frontend adaptation (2026); see LICENSING.md and LICENSE.
 * Third-party material retains its own terms.
 */
import { mount } from "svelte";
import App from "./App.svelte";
import "./style.css";
import "./ui/tokens.css";
import "./ui/font.css";
import "./ui/living.css";
mount(App, { target: document.getElementById("app")! });
