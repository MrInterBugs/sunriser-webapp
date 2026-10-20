<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
  import {savedChannels,channelLabel,channelColor} from '../channels';
  let {number,fallback=''}:{number:number;fallback?:string}=$props();
  const channel=$derived($savedChannels[number-1]);
  const label=$derived(channelLabel(channel)||fallback);
  const color=$derived(channelColor(channel));
</script>
<span class="channel-name">Channel {number}{#if label}<span class="saved-name">{#if color}<i aria-hidden="true" style:background={color}></i>{/if}{label}</span>{/if}</span>
<style>
 .channel-name{display:inline-block;min-width:0;overflow-wrap:anywhere}
 .saved-name{display:block;font-size:12px;font-weight:500;line-height:1.4;color:var(--sr-muted);margin-top:4px}
 i{display:inline-block;width:8px;height:8px;border:1px solid var(--sr-control-line);border-radius:50%;margin-right:6px}
</style>
