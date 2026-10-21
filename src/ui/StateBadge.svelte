<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {t,renderText,language} from '../i18n';
  import type {Snippet} from 'svelte';
  let {children, tone='neutral'}: {children:Snippet; tone?:'neutral'|'draft'|'active'|'error'}=$props();
</script>
<span class="badge" class:draft={tone==='draft'} class:active={tone==='active'} class:error={tone==='error'}>{@render children()}</span>
<style>
  .badge { max-width:100%; overflow-wrap:anywhere; display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border:1px solid var(--sr-line); border-radius:5px; color:var(--sr-muted); background:var(--sr-surface); font-size:12px; font-weight:600; line-height:1.5; }
  .draft { color:var(--sr-amber); background:var(--sr-amber-bg); border-color:var(--sr-control-line); }
  .active { color:var(--sr-active); background:var(--sr-soft); border-color:var(--sr-control-line); }
  .error { color:var(--sr-error); background:var(--sr-error-bg); border-color:var(--sr-control-line); }
</style>
