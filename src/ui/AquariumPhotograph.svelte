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
  import {onMount,tick} from 'svelte';
  let {ready}:{ready:boolean}=$props();
  let mounted=$state(false),started=false,source=$state(false),failed=$state(false),decoded=$state(false),variant=$state<'mobile'|'desktop'|'retina'>('desktop');
  let image=$state<HTMLImageElement>();
  const assets={desktop:['p/aquascape-c-1600-f4d1fb0c.avif','p/aquascape-c-1600-871dc1eb.webp',1600,236],retina:['p/aquascape-c-3040-2da30d41.avif','p/aquascape-c-3040-b140f4b1.webp',3040,448],mobile:['p/aquascape-c-800-f7c9cf14.avif','p/aquascape-c-800-833afa56.webp',800,302]} as const;
  const hidden=typeof location!=='undefined'&&new URLSearchParams(location.search).get('imagery')==='off';
  onMount(()=>{mounted=true;return()=>{mounted=false;}});
  $effect(()=>{if(mounted&&ready&&!started&&!hidden){started=true;void queue();}});
  async function queue(){
    variant=innerWidth<=700?'mobile':devicePixelRatio>1?'retina':'desktop';
    if(document.readyState!=='complete')await new Promise<void>(resolve=>window.addEventListener('load',()=>resolve(),{once:true}));
    await document.fonts.ready;await tick();
    if(mounted)source=true;
  }
  async function loaded(){try{await image?.decode();if(mounted)decoded=true;}catch{failed=true;}}
</script>
{#if !hidden&&!failed}<figure class="aquarium-window" class:photo-ready={decoded} aria-label={$t("aquariumphotograph.decorativeReferenceAquariumPhotograph_1c538")}>
 {#if source}<picture><source srcset={assets[variant][0]} type="image/avif"/><img bind:this={image} src={assets[variant][1]} width={assets[variant][2]} height={assets[variant][3]} alt="" decoding="async" fetchpriority="low" onload={loaded} onerror={()=>failed=true}/></picture>{/if}
</figure>{/if}
<div class="photo-boundary"><span>{$t("aquariumphotograph.referenceAquascapeIndependentOfYourController_d65a3")}{failed?$t("aquariumphotograph.imageUnavailable_d7596"):''}</span><a href="notices.html#photography">{$t("aquariumphotograph.photoCreditCCBYSA30_e6493")}</a></div>
<style>
.aquarium-window{margin:0;height:200px;background:#1b3a30;overflow:hidden}.aquarium-window img{display:block;width:100%;height:100%;object-fit:cover;object-position:center bottom}.aquarium-window picture{display:block;width:100%;height:100%}.photo-boundary{display:flex;justify-content:space-between;align-items:center;gap:14px;background:#203d2b;color:#d6dfc5;border:1px solid #718460;border-top:0;padding:6px 24px;font-size:11px}.photo-boundary a{color:#d6dfc5;min-height:28px;display:flex;align-items:center;font-size:11px}.photo-boundary a:focus-visible{outline:3px solid #e4c497;outline-offset:2px}@media(max-width:700px){.aquarium-window{height:132px}.photo-boundary{display:block;padding:7px 15px;font-size:11px}.photo-boundary a{font-size:11px;margin-top:3px}}@media(max-width:360px){.aquarium-window{height:120px}}
</style>
