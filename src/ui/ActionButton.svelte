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
  import type { Snippet } from 'svelte';
  let {children, onclick, disabled=false, type='button', secondary=false, label}: {
    children: Snippet; onclick?: () => void; disabled?: boolean;
    type?: 'button' | 'submit'; secondary?: boolean; label?: string;
  } = $props();
</script>
<button {type} {onclick} {disabled} aria-label={label?$renderText(label):undefined} class:secondary>{@render children()}</button>
<style>
  button { min-height:44px; padding:10px 16px; border:1px solid var(--sr-teal); border-radius:var(--sr-radius); background:var(--sr-teal); color:var(--sr-action-ink); font:600 14px/1.4 var(--sr-font); cursor:pointer; white-space:normal; overflow-wrap:anywhere; hyphens:auto; transition:none; }
  button:hover:not(:disabled) { background:var(--sr-teal-hover); }
  button.secondary { background:var(--sr-surface); color:var(--sr-teal); border-color:var(--sr-control-line); }
  button.secondary:hover:not(:disabled) { background:var(--sr-soft); color:var(--sr-teal-hover); }
  button:disabled { opacity:1; color:var(--sr-disabled); background:var(--sr-disabled-bg); border-color:var(--sr-line); cursor:default; }
  button:focus-visible { outline:3px solid var(--sr-focus); outline-offset:3px; }
</style>
