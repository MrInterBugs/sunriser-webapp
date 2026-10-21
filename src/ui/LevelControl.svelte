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
  let {id, label, value=$bindable(), max, disabled=false, unit='raw'}: {
    id:string; label:string; value:number|undefined; max:number; disabled?:boolean; unit?:string;
  }=$props();
  const valid=$derived(value!==undefined && Number.isInteger(value) && value>=0 && value<=max);
</script>
<div class="level">
  <label class="sr-only" for={id}>{$renderText(label)}</label>
  <input class="slider" aria-label={$t("levelcontrol.v0Slider_96303",{v0: label})} type="range" min="0" {max} step="1" value={valid ? value : 0} oninput={(event)=>value=Number(event.currentTarget.value)} {disabled} />
  <div class="exact"><input {id} type="number" min="0" {max} step="1" bind:value {disabled} aria-invalid={!valid} aria-describedby={`${id}-unit`} /><span id={`${id}-unit`}>{$renderText(unit)}</span></div>
</div>
<style>
  .level { display:flex; align-items:center; gap:12px; min-width:0; }
  .slider { width:100%; min-width:48px; height:44px; padding:0; margin:0; border:0; accent-color:var(--sr-teal); background:transparent; cursor:pointer; }
  .slider { appearance:none; }
  .slider::-webkit-slider-runnable-track { height:4px; background:var(--sr-control-line); border-radius:2px; }
  .slider::-webkit-slider-thumb { appearance:none; height:22px; width:22px; margin-top:-9px; border:2px solid var(--sr-surface); border-radius:50%; background:var(--sr-ink); box-shadow:0 0 0 1px var(--sr-ink); }
  .slider::-moz-range-track { height:4px; background:var(--sr-control-line); border-radius:2px; }
  .slider::-moz-range-thumb { height:18px; width:18px; border:2px solid var(--sr-surface); border-radius:50%; background:var(--sr-ink); box-shadow:0 0 0 1px var(--sr-ink); }
  .slider:disabled { opacity:.5; cursor:default; }
  .exact { display:flex; align-items:center; border:1px solid var(--sr-control-line); border-radius:var(--sr-radius); background:var(--sr-input); flex:0 0 112px; overflow:visible; }
  .exact input { width:76px; min-height:44px; padding:8px; border:0; border-radius:var(--sr-radius); color:var(--sr-ink); background:transparent; font-size:15px; font-variant-numeric:tabular-nums; }
  .exact span { color:var(--sr-muted); font-size:12px; padding-right:8px; }
  .exact:has([aria-invalid='true']) { border-color:var(--sr-error); }
  .exact:has(:disabled) { background:var(--sr-soft); }
  input:focus-visible { outline:3px solid var(--sr-focus); outline-offset:3px; }
  .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
</style>
