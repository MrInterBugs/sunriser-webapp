<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
 import { configurationState } from '../configuration-state';
 let { revision }: { revision: number | undefined } = $props();
 const previous = $derived(revision !== undefined && (revision !== $configurationState.revision || !!$configurationState.recovery));
</script>
{#if previous}<p class="configuration-notice" aria-live="polite">Previous saved configuration · drafts retained. {$configurationState.recovery ? 'Check device readback in Recovery, then reload this editor before saving.' : 'Reload this editor to reconcile before saving. Reload replaces its retained drafts.'}</p>{/if}
<style>
 .configuration-notice{font-size:12px;line-height:1.5;border-left:2px solid var(--sr-accent);padding:6px 12px;color:var(--sr-ink);margin:8px 0}
</style>
