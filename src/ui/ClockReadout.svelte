<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {t,renderText,language,dateText} from '../i18n';
  let {text}:{text:string}=$props();
  const iso=$derived(/^\d{4}-\d{2}-\d{2}T/.test(text));
</script>
{#if iso}<span class="date">{dateText(text.slice(0,10),$language)}</span><span class="time"><span class="visually-hidden">T</span>{text.slice(11)}</span>{:else}{$renderText(text)}{/if}
<style>
 .date { display:block; font:400 13px var(--sr-font); color:var(--sr-muted); margin:4px 0 8px; letter-spacing:0; }
 .time { display:block; white-space:nowrap; font:500 26px var(--sr-mono); letter-spacing:-.6px; }
 @media(max-width:760px) { .time { font-size:20px; } }
</style>
