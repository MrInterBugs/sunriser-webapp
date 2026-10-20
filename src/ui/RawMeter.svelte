<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
  // Redundant visual reference only. Preserve exact device readback in the caller.
  let {value, stale=false}: {value:number; stale?:boolean}=$props();
</script>
<div class="raw-meter" class:stale aria-hidden="true" data-testid="raw-meter" data-value={value}>
  <span class="fill" style:width={`${Math.max(0,Math.min(1000,value))/10}%`}></span>
  <span class="ticks"></span>
  {#if value>1000}<span class="over">+</span>{/if}
</div>
<style>
  .raw-meter { position:relative; height:8px; width:100%; background:var(--sr-meter-track); border-radius:1px; margin:8px 0; }
  .fill { position:absolute; inset:0 auto 0 0; background:var(--sr-accent); }
  .ticks { position:absolute; inset:0; background:repeating-linear-gradient(90deg,transparent 0,transparent calc(25% - 1px),var(--sr-canvas) calc(25% - 1px),var(--sr-canvas) 25%); }
  .over { position:absolute; right:-12px; top:-7px; font:600 14px var(--sr-mono); color:var(--sr-ink); }
  .raw-meter.stale .fill { background:var(--sr-muted); }
</style>
