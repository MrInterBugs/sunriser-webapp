<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
 import {type UiText} from '../messages.js';

 import {t} from '../i18n';
 let {id,label,accept,disabled=false,onchange}:{id:string;label: UiText;accept?:string;disabled?:boolean;onchange:(event:Event & {currentTarget:EventTarget & HTMLInputElement})=>unknown}=$props();
 let input:HTMLInputElement,name=$state('');
</script>
<div class="file-picker">
 <input {id} {accept} {disabled} bind:this={input} type="file" tabindex="-1" onchange={event=>{name=event.currentTarget.files?.[0]?.name??'';onchange(event);}} />
 <button type="button" class="secondary" {disabled} onclick={()=>input.click()} aria-controls={id} aria-label={$t("files.chooseNamed",{v0:label})}>{$t('files.choose')}</button>
 <span aria-live="polite">{name||$t('files.empty')}</span>
</div>
<style>
 .file-picker{position:relative;display:flex;align-items:center;flex-wrap:wrap;gap:10px;min-width:0;margin:8px 0}.file-picker span{font-size:13px;overflow-wrap:anywhere;min-width:0}.file-picker input{position:absolute;left:0;top:0;width:1px;height:1px;min-width:0;min-height:0;padding:0;margin:0;border:0;clip-path:inset(50%);overflow:hidden}.file-picker:focus-within{outline:2px solid var(--sr-focus);outline-offset:3px}
</style>
