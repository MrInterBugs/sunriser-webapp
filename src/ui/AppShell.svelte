<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Aedan Lawrence (original contributions).
Part of the modern frontend adapted from the SunRiser project and its workflows.
Upstream: https://github.com/LEDaquaristik/sunriser
Frontend adaptation (2026); see LICENSING.md and LICENSE.
Third-party material retains its own terms.
-->
<script lang="ts">
 import {t,renderText,language,setLanguage,source} from '../i18n';
  import {tick, type Snippet} from 'svelte';
  let {children,route}:{children:Snippet; route:string}=$props();
  let menuOpen=$state(false), deviceOpen=$state(false);
  let opener:HTMLButtonElement|undefined;
  const lighting=[['index',source("app.overview_0efc2")],['channels',source("lightingdashboard.channels_18e03")],['service',source("lightingdashboard.service_329cb")],['schedules',source("schedules.schedules_26d9d")],['weather',source("weather.weather_284af")],['sensors',source("sensors.sensors_711bf")]];
  const device=[['settings',source("app.settings_c7f73")],['clock',source("help-content.clock_04f6b")],['network',source("help.network_53ebc")],['lighting-tools',source("lightingtools.lightingTools_601b5")],['diagnostics',source("diagnostics.diagnostics_3af22")],['recovery',source("help.recovery_ea924")],['help',source("appshell.help_c47ae")]];
  const administration=$derived(device.some(([id])=>id===route));
  function close(){ menuOpen=false; deviceOpen=false; }
  async function toggle(event:MouseEvent){
    opener=event.currentTarget as HTMLButtonElement;menuOpen=!menuOpen;
    if(menuOpen){
      await tick();
      if(!menuOpen)return;
      const links=Array.from(document.querySelectorAll<HTMLAnchorElement>('#main-navigation a')).filter(link=>link.getClientRects().length);
      (links.find(link=>link.getAttribute('aria-current')==='page')??links[0])?.focus();
    }
  }
  function escape(event:KeyboardEvent) { if(event.key==='Escape') {if(menuOpen){menuOpen=false;opener?.focus();} if(deviceOpen){deviceOpen=false;document.getElementById('device-menu-label')?.focus();}} }
</script>
<svelte:window onkeydown={escape} onresize={()=>{if(window.innerWidth>800)menuOpen=false;}}/>
<div class="app-shell">
  <a class="skip" href="#main-content" onclick={(e)=>{e.preventDefault();close();document.getElementById('main-content')?.focus();}}>{$t("appshell.skipToContent_0a447")}</a>
  <header class="app-header">
    <a class="wordmark" href="#index" aria-label={$t("appshell.sunriserOverview_ee5db")} onclick={close}>
      <svg width="40" height="40" viewBox="0 0 48 40" fill="none" aria-hidden="true"><path d="M8 23a16 16 0 0 1 32 0M3 25h42M10 31h28M18 37h12" stroke="var(--sr-accent)" stroke-width="1.7"/></svg>
      <span>SunRiser<small>{$t("appshell.aquariumLighting_fff93")}</small></span>
    </a>
    <button class="all-pages" aria-expanded={menuOpen} aria-controls="main-navigation" onclick={toggle}>{$t("appshell.allPages_921a7")}</button>
    <nav id="main-navigation" aria-label={$t("appshell.mainNavigation_efd19")} class:open={menuOpen}><label class="language-choice"><span class="language-label">Language / Sprache</span><select aria-label="Language / Sprache" value={$language} onchange={event=>setLanguage(event.currentTarget.value)}><option value="en" lang="en">English</option><option value="de" lang="de">Deutsch</option></select></label>
      <div class="lighting-links"><p class="group-label">{$t("appshell.lighting_6153d")}</p>{#each lighting as [id,label]}<a href={`#${id}`} aria-current={route===id?'page':undefined} onclick={close}>{$renderText(label)}</a>{/each}</div>
      <details class="device-menu" bind:open={deviceOpen}>
        <summary id="device-menu-label" class:selected={administration}>{$t("appshell.device_a5a74")}</summary>
        <div class="device-links">{#each device as [id,label]}<a href={`#${id}`} aria-current={route===id?'page':undefined} onclick={close}>{$renderText(label)}</a>{/each}</div>
      </details>
      <div class="mobile-device"><p class="group-label">{$t("appshell.device_a5a74")}</p>{#each device as [id,label]}<a href={`#${id}`} aria-current={route===id?'page':undefined} onclick={close}>{$renderText(label)}</a>{/each}</div>
    </nav>
  </header>
  {#if administration}<nav class="device-tabs" aria-label={$t("appshell.deviceNavigation_87a9f")} inert={menuOpen}>{#each device as [id,label]}<a href={`#${id}`} aria-current={route===id?'page':undefined}>{$renderText(label)}</a>{/each}</nav>{/if}
  <div class="workspace" inert={menuOpen}>{@render children()}<footer>SunRiser <span>·</span> {$t("appshell.aquariumLightingController_0ee46")} <span>·</span> <a href="#help">{$t("appshell.help_c47ae")}</a> <span>·</span> <a href="notices.html#photography">{$t("appshell.imageCredits_ed24c")}</a></footer></div>
  <nav class="mobile-dock" aria-label={$t("appshell.everydayLighting_e88e7")}>
    {#each [['index',source("app.overview_0efc2")],[source("lightingdashboard.channels_3536f"),source("lightingdashboard.channels_18e03")],['schedules',source("schedules.schedules_26d9d")]] as [id,label]}<a href={`#${id}`} aria-current={route===id?'page':undefined} onclick={close}>{$renderText(label)}</a>{/each}
    <button aria-expanded={menuOpen} aria-controls="main-navigation" onclick={toggle}>{$t("appshell.menu_57f5f")}</button>
  </nav>
</div>
<style>
  .app-shell{min-height:100dvh;background:var(--sr-canvas);color:var(--sr-ink)}
  .app-header{display:flex;flex-wrap:wrap;justify-content:flex-start;gap:36px;min-height:78px;padding:0 clamp(20px,3vw,48px);background:var(--sr-surface);border-bottom:1px solid var(--sr-line)}
  .wordmark{display:flex;gap:10px;align-items:center;color:var(--sr-ink);text-decoration:none;font-size:24px;font-weight:750;letter-spacing:-.8px;flex-shrink:0}
  .wordmark small{display:block;font-size:8px;letter-spacing:1.6px;text-transform:uppercase;font-weight:450;color:var(--sr-muted);margin-top:5px}
  nav{border:0;gap:0}#main-navigation,.lighting-links{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
  nav a{display:flex;align-items:center;min-height:48px;padding:12px 16px;color:var(--sr-muted);text-decoration:none;font-size:14px;font-weight:600;border:0;border-radius:4px}
  nav a:hover{background:var(--sr-soft);color:var(--sr-ink)}
  .lighting-links a{min-height:78px;border-bottom:3px solid transparent;border-radius:0}
  nav a[aria-current]{color:var(--sr-accent);background:var(--sr-soft)}
  .lighting-links a[aria-current]{border-color:var(--sr-accent);background:transparent}
  .device-menu{position:relative;margin-left:16px}summary{cursor:pointer;min-height:44px;padding:10px 16px;border:1px solid var(--sr-control-line);border-radius:var(--sr-radius);font-size:14px;list-style:none}summary::after{content:'⌄';margin-left:12px}summary.selected{color:var(--sr-accent)}
  .device-links{position:absolute;z-index:10;top:52px;right:0;min-width:190px;padding:8px;background:var(--sr-surface);border:1px solid var(--sr-control-line);border-radius:var(--sr-radius);box-shadow:0 12px 24px #0003}
  .device-tabs{flex-wrap:wrap;padding:8px clamp(20px,3vw,48px);gap:8px;background:var(--sr-surface);border-bottom:1px solid var(--sr-line)}
  .workspace{padding:14px clamp(20px,3vw,48px) 0;max-width:1600px;margin:auto;min-width:0}
  .language-choice{display:flex;align-items:center;gap:8px;margin:0 0 0 8px;font-size:13px;order:3}.language-label{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}.language-choice select{min-height:44px;max-width:120px;font:inherit;padding:8px 12px;color:var(--sr-ink);background:var(--sr-surface);border:1px solid var(--sr-control-line);border-radius:var(--sr-radius)}footer{font-size:12px;color:var(--sr-muted);padding:20px 0;margin-top:16px;border:0}footer span{margin:0 8px}
  .all-pages,.mobile-dock,.mobile-device,.group-label{display:none}
  .skip{position:fixed;z-index:30;top:8px;left:8px;padding:12px 20px;background:var(--sr-surface);transform:translateY(-160%)}.skip:focus{transform:none}
  a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--sr-focus);outline-offset:3px}
  @media(max-width:1100px){.app-header{gap:18px;padding:0 20px}nav a{padding:12px 10px}.device-menu{margin-left:8px}.wordmark{font-size:21px;gap:6px}}
  @media(max-width:800px){
    .app-header{justify-content:space-between;min-height:72px;padding:12px 16px}.wordmark{font-size:23px}
    .all-pages{display:block;min-height:44px;padding:8px 12px;background:var(--sr-surface);color:var(--sr-ink);border:1px solid var(--sr-control-line);font-size:14px}
    #main-navigation{display:none}#main-navigation.open{position:fixed;z-index:15;inset:72px 0 calc(55px + max(6px,env(safe-area-inset-bottom)));display:grid;grid-template-columns:1fr 1fr;align-items:start;gap:16px;padding:20px 16px;overflow:auto;scroll-padding-block:8px;background:var(--sr-canvas)}
    .language-choice{order:-1;grid-column:1/-1;margin:0;font-size:13px}.language-label{position:static;width:auto;height:auto;clip-path:none}.lighting-links,.mobile-device{display:block;min-width:0}.group-label{display:block;margin:0 10px 12px;color:var(--sr-muted);font-size:13px}.lighting-links a,nav a{min-height:48px;border:0;border-radius:4px;padding:12px 10px}.lighting-links a[aria-current]{background:var(--sr-soft)}
    .device-menu{display:none}.device-tabs{flex-wrap:wrap;padding:4px 12px;gap:0;justify-content:space-between}.device-tabs a{font-size:13px;padding:10px 8px}
    .workspace{padding:12px 16px 76px}.mobile-dock{display:grid;position:fixed;z-index:20;bottom:0;left:0;right:0;grid-template-columns:repeat(4,minmax(0,1fr));padding:6px 8px max(6px,env(safe-area-inset-bottom));background:var(--sr-surface);border-top:1px solid var(--sr-line)}
    .mobile-dock a,.mobile-dock button{justify-content:center;font:600 12px var(--sr-font);min-height:48px;padding:10px 4px;border:0;border-radius:4px;background:transparent;color:var(--sr-muted)}.mobile-dock a[aria-current],.mobile-dock button[aria-expanded=true]{color:var(--sr-accent);background:var(--sr-soft)}
  }
</style>
