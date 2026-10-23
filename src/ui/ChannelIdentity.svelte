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
  import {savedChannels,channelLabel,channelColor,channelUnused} from '../channels';
  import {configurationState} from '../configuration-state';
  let {number,fallback=''}:{number:number;fallback?:string}=$props();
  const channel=$derived($savedChannels[number-1]);
  const label=$derived(channelLabel(channel,$language)||($configurationState.revision===0?fallback:''));
  const color=$derived(channelColor(channel));
  const unused=$derived(channelUnused(channel));
</script>
<span class="channel-name">{#if label}<span class="saved-name">{#if color}<i aria-hidden="true" style:background={color}></i>{/if}<span class="label-text">{label}</span></span><span class="physical-channel">CH {String(number).padStart(2,'0')}</span>{:else}<span class="fallback-name">{$t("channelconfiguration.channel_879f0")} {number}</span>{/if}{#if unused}<span class="unused-tag">{$t("channelconfiguration.notUsed_72a86")}</span>{/if}</span>
<style>
 .channel-name{display:inline-block;min-width:0;max-width:100%;overflow-wrap:anywhere;line-height:1.35}
 span.channel-name > span.saved-name{display:flex;align-items:flex-start;font-size:inherit;font-weight:650;color:var(--sr-ink)}
 span.channel-name > span.physical-channel{display:block;font-size:10px;font-weight:500;letter-spacing:.07em;line-height:1.4;color:var(--sr-muted);margin-top:3px}
 .fallback-name{font-weight:600}
 span.channel-name > span.unused-tag{display:block;font-size:10px;font-weight:500;letter-spacing:.07em;line-height:1.4;color:var(--sr-muted);margin-top:3px;font-style:italic}
 .label-text{min-width:0}
 i{flex:none;display:block;box-sizing:border-box;width:8px;height:8px;border:1px solid var(--sr-control-line);border-radius:50%;margin:calc((1.35em - 8px) / 2) 6px 0 0}
</style>
