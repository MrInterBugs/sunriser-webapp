<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {source,t,renderText,language} from '../i18n';
 import {configurationState} from '../configuration-state';
 import ConfigurationNotice from './ConfigurationNotice.svelte';
 import ActionButton from './ActionButton.svelte';
 import StateBadge from './StateBadge.svelte';
 let {snapshotRevision, dirty, busy, feedback="", disabled=false, label, scope, detail=source("draftbar.defaultDetail")}: {snapshotRevision?:number;dirty:boolean;busy:boolean;feedback?:string;disabled?:boolean;label:string;scope:string;detail?:string}=$props();
 const reconciled=$derived(snapshotRevision===undefined||(!$configurationState.recovery&&snapshotRevision===$configurationState.revision));
</script>
<div class="draft-bar" class:dirty>
 <div><ConfigurationNotice revision={snapshotRevision}/><StateBadge tone={dirty?'draft':'neutral'}>{scope? (dirty?$t("draftbar.unsavedV0Changes_6bbf0",{v0: scope}):$t("draftbar.noUnsavedV0Changes_0d84e",{v0: scope})): $t(dirty?'common.unsavedChanges':'common.noUnsavedChanges')}</StateBadge><p class:error={!!feedback&&!busy}>{busy?$t("draftbar.operationPendingControlsAreTemporarilyUnavailable_c40c3"):$renderText(feedback||detail)}</p></div>
 <ActionButton type="submit" disabled={busy||disabled||!reconciled}>{$renderText(label)}</ActionButton>
</div>
<style>
 .draft-bar { position:sticky; top:0; z-index:3; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; background:var(--sr-canvas); border:0; border-radius:var(--sr-radius); padding:12px 0; margin:0 0 16px; }
 .draft-bar.dirty { background:var(--sr-surface); }
 .draft-bar:has(.error) { position:static; }
 .draft-bar p.error { color:var(--sr-error); }
 .draft-bar p { font-size:13px; color:var(--sr-muted); margin:6px 0 0; }
 @media(max-width:760px) { .draft-bar { top:0; padding:12px 0; gap:12px; } .draft-bar :global(button) { max-width:135px; } .draft-bar p { font-size:12px; } }
 @media(max-width:480px) { .draft-bar { grid-template-columns:minmax(0,1fr); } .draft-bar :global(button) { justify-self:start; max-width:100%; } }
 @media(max-height:500px) { .draft-bar { position:static; } }
</style>
