<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {t} from '../i18n';
 import {savedChannels,channelUnused,showUnusedChannels} from '../channels';
 // `listed` is what the page shows now; the note counts unused channels left out.
 let {listed,count}:{listed:number[];count:number}=$props();
 const unused=$derived(Array.from({length:count},(_,i)=>i+1).filter(n=>channelUnused($savedChannels[n-1])));
 const hidden=$derived(unused.filter(n=>!listed.includes(n)).length);
</script>
{#if $showUnusedChannels&&unused.length}<p class="unused-channels"><span>{$t("unusedChannels.showing")}</span><button type="button" class="link" aria-label={$t("unusedChannels.hide")} onclick={()=>showUnusedChannels.set(false)}>{$t("unusedChannels.hideShort")}</button></p>
{:else if !$showUnusedChannels&&hidden}<p class="unused-channels"><span>{hidden===1?$t("unusedChannels.hiddenOne"):$t("unusedChannels.hiddenMany",{v0:hidden})}</span><button type="button" class="link" aria-label={$t("unusedChannels.show")} onclick={()=>showUnusedChannels.set(true)}>{$t("unusedChannels.showShort")}</button></p>{/if}
<style>
 /* A quiet footnote, not a panel: it sits under lists on light cards and dark pages alike. */
 .unused-channels{display:flex;align-items:center;flex-wrap:wrap;gap:0 10px;margin:4px 0;font-size:12px;line-height:1.5;color:inherit}
 .unused-channels button.link,.unused-channels button.link:hover:not(:disabled){min-height:44px;padding:0 2px;border:0;border-radius:0;background:transparent;color:inherit;font-size:12px;font-weight:600;text-decoration:underline;text-underline-offset:3px}
</style>
