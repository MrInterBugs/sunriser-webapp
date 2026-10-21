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
  let { children }: { children: Snippet } = $props();
</script>
<div class="editor-page">{@render children()}</div>
<style>
  /* Opt-in editor surface. No selectors escape this component's subtree. */
  .editor-page { color:var(--sr-ink); font-size:15px; line-height:1.5; }
  .editor-page :global(h1) { font-size:var(--sr-title); font-weight:600; letter-spacing:-1.2px; margin:4px 0 8px; line-height:1.2; }
  .editor-page :global(h2), .editor-page :global(.section-title) { font-size:var(--sr-section); font-weight:650; line-height:1.4; margin:0 0 12px; }
  .editor-page :global(h3) { font-size:15px; margin:0 0 12px; }
  .editor-page :global(p) { font-size:13px; color:var(--sr-muted); margin:8px 0 12px; max-width:85ch; overflow-wrap:anywhere; }
  .editor-page :global(.heading > div) { min-width:0; }
  .editor-page :global(h1), .editor-page :global(h2), .editor-page :global(h3) { overflow-wrap:anywhere; hyphens:auto; }
  .editor-page :global(.heading) { margin:12px 0 20px; gap:16px; }
  .editor-page :global(.heading p) { margin:4px 0; }
  .editor-page :global(.panel) { border:0; border-radius:0; background:transparent; padding:16px 0; margin:16px 0 0; box-shadow:none; }
  .editor-page :global(.readback) { background:var(--sr-surface); border:1px solid var(--sr-line); border-radius:var(--sr-radius); border-left:2px solid var(--sr-accent); padding:20px; }
  .editor-page :global(form.panel) { border:0; padding:0; margin:8px 0 24px; }
  .editor-page :global(.settings) { max-width:none; }
  .editor-page :global(fieldset) { min-width:0; margin:0; border:0; padding:0; }
  .editor-page :global(legend) { padding:0; margin-bottom:16px; font-size:var(--sr-section); font-weight:650; overflow-wrap:anywhere; }
  .editor-page :global(fieldset fieldset) { margin:16px 0; }
  .editor-page :global(label:not(.check)) { display:block; font-size:14px; font-weight:600; margin:10px 0 6px; }
  .editor-page :global(input:not([type=checkbox])), .editor-page :global(select) { min-height:var(--sr-control); min-width:0; width:100%; max-width:100%; border:1px solid var(--sr-control-line); border-radius:6px; padding:10px 12px; background:var(--sr-input); color:var(--sr-ink); font:400 16px/1.4 var(--sr-font); }
  .editor-page :global(input[aria-invalid=true]) { border-color:var(--sr-error); }
  .editor-page :global(input[type=checkbox]) { width:20px; height:20px; flex:0 0 20px; margin:0; accent-color:var(--sr-teal); }
  .editor-page :global(.check) { display:flex; align-items:center; gap:10px; min-height:var(--sr-control); margin:0; font-size:14px; font-weight:500; padding:6px 0; }
  .editor-page :global(button) { min-height:var(--sr-control); max-width:100%; padding:10px 16px; font:600 14px/1.4 var(--sr-font); border-radius:var(--sr-radius); border:1px solid var(--sr-teal); background:var(--sr-teal); color:var(--sr-action-ink); white-space:normal; transition:none; }
  .editor-page :global(button:hover:not(:disabled)) { background:var(--sr-teal-hover); }
  .editor-page :global(button.secondary) { color:var(--sr-teal); background:var(--sr-surface); border-color:var(--sr-control-line); }
  .editor-page :global(button.secondary:hover:not(:disabled)) { background:var(--sr-soft); color:var(--sr-teal-hover); }
  .editor-page :global(button:disabled) { opacity:1; color:var(--sr-disabled); background:var(--sr-disabled-bg); border-color:var(--sr-line); }
  .editor-page :global(:is(button,input,select,a,summary):focus-visible) { outline:3px solid var(--sr-focus); outline-offset:3px; }
  .editor-page :global(:is(input,select,button)) { scroll-margin-block:140px 32px; }
  .editor-page :global(.form-actions) { display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin:16px 0; }
  .editor-page :global(.field-grid) { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 24px; align-items:start; }
  .editor-page :global(.field-grid.three-columns) { grid-template-columns:repeat(3,minmax(0,1fr)); }
  .editor-page :global(.field-grid > .wide) { grid-column:1/-1; }
  .editor-page :global(.field-help) { font-size:13px; margin:6px 0 12px; }
  .editor-page :global(.service-fields) { grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 24px; margin:16px 0; }
  .editor-page :global(.service-fields > *) { min-width:0; border-top:1px solid var(--sr-line); padding-top:12px; margin:0; }
  .editor-page :global(.service-fields legend) { font-size:15px; margin-bottom:12px; }
  .editor-page :global(.service-fields h3) { font-size:13px; margin-bottom:6px; }
  .editor-page :global(.sensor-months) { grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:0 16px; }
  .editor-page :global(.channels) { grid-template-columns:repeat(4,minmax(0,1fr)); gap:0 24px; }
  .editor-page :global(.channels li) { border:0; border-bottom:1px solid var(--sr-line); border-radius:0; background:transparent; padding:20px 0; gap:8px; }
  .editor-page :global(.channels span) { color:var(--sr-muted); font-size:13px; }
  .editor-page :global(.channels strong) { color:var(--sr-ink); font-size:22px; }
  .editor-page :global(.facts) { gap:24px; }
  .editor-page :global(dt) { color:var(--sr-muted); font-size:13px; }
  .editor-page :global(dd) { font-family:var(--sr-mono); color:var(--sr-ink); font-size:16px; font-variant-numeric:tabular-nums; }
  .editor-page :global(summary) { min-height:var(--sr-control); cursor:pointer; padding:10px 0; font-weight:600; }
  .editor-page :global(.reading-details) { font-size:12px; color:var(--sr-muted); margin:8px 0; }
  .editor-page :global(.reading-details summary) { font-size:12px; font-weight:500; }
  .editor-page :global(.notice) { border-left:2px solid var(--sr-accent); padding:12px 16px; background:var(--sr-soft); }
  .editor-page :global(.empty-state) { padding:24px; border:1px dashed var(--sr-control-line); border-radius:var(--sr-radius); margin:16px 0; }
  .editor-page :global(.danger-zone) { border-top:2px solid var(--sr-error); }
  .editor-page :global(button.danger) { background:var(--sr-surface); border-color:var(--sr-error); color:var(--sr-error); }
  .editor-page :global(button.danger:hover:not(:disabled)) { background:var(--sr-error-bg); color:var(--sr-error); }
  .editor-page :global(button.danger:disabled) { color:var(--sr-disabled); background:var(--sr-disabled-bg); border-color:var(--sr-line); }
  .editor-page :global(.reading-value) { font-size:44px; font-family:var(--sr-mono); font-weight:500; letter-spacing:-1.6px; line-height:1.3; color:var(--sr-ink); font-variant-numeric:tabular-nums; margin:8px 0; }
  .editor-page :global(.reading-status) { font-size:24px; font-family:inherit; letter-spacing:-.4px; }
  .editor-page :global(.readback + section) { margin-top:24px; }
  .editor-page :global(.identity) { margin-top:16px; overflow-wrap:anywhere; font-size:18px; font-weight:600; }
  .editor-page :global(.field-grid > h2) { margin:12px 0 0; padding-bottom:8px; border-bottom:1px solid var(--sr-line); }
  .editor-page :global(input[inputmode=numeric]),.editor-page :global(input[inputmode=decimal]) { font-variant-numeric:tabular-nums; }
  @media(max-width:760px) {
    .editor-page :global(:is(input,select,button)) { scroll-margin-block:220px 48px; }
    .editor-page :global(.heading) { flex-direction:row; flex-wrap:wrap; align-items:center; }
    .editor-page :global(.heading > div) { flex:1 1 220px; }
    .editor-page :global(.heading > button) { flex:0 1 auto; max-width:100%; }
    .editor-page :global(.field-grid), .editor-page :global(.service-fields) { grid-template-columns:minmax(0,1fr); }
    .editor-page :global(.field-grid.three-columns) { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .editor-page :global(.field-grid.three-columns > :first-child) { grid-column:1/-1; }
    .editor-page :global(.readback) { padding:16px; }
    .editor-page :global(.form-actions) { flex-direction:row; align-items:center; }
    .editor-page :global(.channels) { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .editor-page :global(.facts) { grid-template-columns:minmax(0,1fr); gap:16px; }
  }
</style>
