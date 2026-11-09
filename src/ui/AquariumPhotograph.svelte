<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {t,renderText,language,source as message} from '../i18n';
  import {onMount,tick} from 'svelte';
  import {theme,type Theme} from '../theme';
  let {ready}:{ready:boolean}=$props();
  let mounted=$state(false),started=$state(false),source=$state(false),failed=$state(false),decoded=$state(false),variant=$state<'mobile'|'desktop'|'retina'>('desktop');
  let image=$state<HTMLImageElement>();
  // One photograph per colour theme; only the selected theme's variant is requested.
  const photographs:Record<Theme,Record<'mobile'|'desktop'|'retina',readonly [string,string,number,number]>>={aquascape:{desktop:['p/aquascape-c-1600-f4d1fb0c.avif','p/aquascape-c-1600-871dc1eb.webp',1600,236],retina:['p/aquascape-c-3040-2da30d41.avif','p/aquascape-c-3040-b140f4b1.webp',3040,448],mobile:['p/aquascape-c-800-f7c9cf14.avif','p/aquascape-c-800-833afa56.webp',800,302]},reef:{desktop:['p/reef-1600-d2bb82ba.avif','p/reef-1600-c5d26255.webp',1600,236],retina:['p/reef-3040-ba210ec7.avif','p/reef-3040-5e53bb57.webp',3040,448],mobile:['p/reef-800-b572c34f.avif','p/reef-800-6299d473.webp',800,302]},planted:{desktop:['p/planted-1600-bd305472.avif','p/planted-1600-d4548467.webp',1600,236],retina:['p/planted-3040-a6d116ee.avif','p/planted-3040-85bd60f9.webp',3040,448],mobile:['p/planted-800-3bc60c0f.avif','p/planted-800-c5a7128e.webp',800,302]},sun:{desktop:['p/sun-1600-fb7046c2.avif','p/sun-1600-413c656d.webp',1600,236],retina:['p/sun-3040-afeaa6b7.avif','p/sun-3040-99cb8aa9.webp',3040,448],mobile:['p/sun-800-993b88c7.avif','p/sun-800-c575cb92.webp',800,302]}};
  const hidden=typeof location!=='undefined'&&new URLSearchParams(location.search).get('imagery')==='off';
  onMount(()=>{mounted=true;return()=>{mounted=false;}});
  const captions={aquascape:message("aquariumphotograph.referenceAquascapeIndependentOfYourController_d65a3"),planted:message("aquariumphotograph.referenceAquascapeIndependentOfYourController_d65a3"),reef:message("aquariumphotograph.referenceReefAquarium"),sun:message("aquariumphotograph.referenceCichlidAquarium")};
  const credits={aquascape:message("aquariumphotograph.photoCreditCCBYSA30_e6493"),planted:message("aquariumphotograph.photoCreditCCBYSA30_e6493"),reef:message("aquariumphotograph.photoCreditPexels"),sun:message("aquariumphotograph.photoCreditPexels")};
  let shown=$state<Theme>($theme),swaps=0;
  // Settles when an image finishes or fails; capped like the controller hold so a stall cannot block.
  const settled=(img?:HTMLImageElement)=>!img||img.complete?Promise.resolve():new Promise<void>(resolve=>{img.addEventListener('load',()=>resolve(),{once:true});img.addEventListener('error',()=>resolve(),{once:true});setTimeout(resolve,15000);});
  // SR10 Wi-Fi admits one connection: a theme change waits for a photograph still downloading, then
  // replaces it through the same deferred, idle-only start. Only the latest choice is requested.
  $effect(()=>{if($theme!==shown)void swap(++swaps);});
  async function swap(ticket:number){
    await settled(image);
    if(ticket!==swaps||!mounted)return;
    shown=$theme;started=false;source=false;decoded=false;failed=false;
  }
  $effect(()=>{if(mounted&&ready&&!started&&!hidden){started=true;void queue();}});
  async function queue(){
    variant=innerWidth<=700?'mobile':devicePixelRatio>1?'retina':'desktop';
    if(document.readyState!=='complete')await new Promise<void>(resolve=>window.addEventListener('load',()=>resolve(),{once:true}));
    await document.fonts.ready;await tick();
    if(mounted)source=true;
  }
  // Results of a replaced image are ignored.
  async function loaded(event:Event){const img=event.currentTarget as HTMLImageElement;try{await img.decode();if(mounted&&img===image)decoded=true;}catch{if(img===image)failed=true;}}
</script>
{#if !hidden&&!failed}<figure class="aquarium-window" class:photo-ready={decoded} aria-label={$t("aquariumphotograph.decorativeReferenceAquariumPhotograph_1c538")}>
 {#if source}<picture><source srcset={photographs[shown][variant][0]} type="image/avif"/><img bind:this={image} src={photographs[shown][variant][1]} width={photographs[shown][variant][2]} height={photographs[shown][variant][3]} alt="" decoding="async" fetchpriority="low" onload={loaded} onerror={event=>{if(event.currentTarget===image)failed=true;}}/></picture>{/if}
</figure>{/if}
<div class="photo-boundary"><span>{$renderText(captions[shown])}{failed?$t("aquariumphotograph.imageUnavailable_d7596"):''}</span><a href={shown==='aquascape'?'notices.html#photography':`notices.html#photography-${shown}`}>{$renderText(credits[shown])}</a></div>
<style>
.aquarium-window{margin:0;height:200px;background:var(--lv-surface);overflow:hidden}.aquarium-window img{display:block;width:100%;height:100%;object-fit:cover;object-position:center bottom}.aquarium-window picture{display:block;width:100%;height:100%}.photo-boundary{display:flex;justify-content:space-between;align-items:center;gap:14px;background:var(--lv-caption-bg);color:var(--lv-caption-ink);border:1px solid var(--lv-frame);border-top:0;padding:6px 24px;font-size:11px}.photo-boundary a{color:var(--lv-caption-ink);min-height:28px;display:flex;align-items:center;font-size:11px}.photo-boundary a:focus-visible{outline:3px solid var(--lv-accent);outline-offset:2px}@media(max-width:700px){.aquarium-window{height:132px}.photo-boundary{display:block;padding:7px 15px;font-size:11px}.photo-boundary a{font-size:11px;margin-top:3px}}@media(max-width:360px){.aquarium-window{height:120px}}
</style>
