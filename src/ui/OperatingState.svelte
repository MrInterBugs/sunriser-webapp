<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
 import type {DeviceState} from '../api';
 let {snapshot,stale=false,loading=false}:{snapshot?:DeviceState;stale?:boolean;loading?:boolean}=$props();
 const service=$derived(typeof snapshot?.service_mode==='number'&&Number.isSafeInteger(snapshot.service_mode)&&snapshot.service_mode>=0
  ?snapshot.service_mode>0?(snapshot.blackout===true?'Blackout active':'Active'):'Off':loading?'Loading…':'Unavailable');
 const thunder=$derived(typeof snapshot?.thunder==='boolean'?(snapshot.thunder?'Active':'Off'):loading&&!snapshot?'Loading…':'Unavailable');
</script>
<section class="operating-state" aria-labelledby="operating-title" aria-describedby="operating-freshness">
 <div class="state-heading"><h2 id="operating-title">Operating state</h2><p id="operating-freshness" aria-live="polite">{!snapshot?(loading?'Loading controller readback…':'Controller readback unavailable'):stale?'Last readback · stale':loading?'Refreshing readback · showing last report':'Controller-reported state'}</p></div>
 <div class="state-grid">
  <div class="state-item" role="group" aria-label="Reported service mode"><div><h3>Service mode</h3><strong data-testid="service">{service}</strong>{#if snapshot?.blackout===true&&snapshot.service_mode===0}<small>Blackout reported on</small>{/if}</div><a href="#service">Service controls →</a></div>
  <div class="state-item" role="group" aria-label="Reported thunderstorms"><div><h3>Thunderstorms</h3><strong data-testid="thunder">{thunder}</strong></div><a href="#weather">Weather settings →</a></div>
 </div>
</section>
<style>
 .operating-state{margin-top:18px;border-block:1px solid var(--sr-line);padding:12px 0 4px;color:var(--sr-ink)}
 .state-heading{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}.state-heading h2{font-size:15px;margin:0;font-weight:600}.state-heading p{font-size:11px;color:var(--sr-muted);margin:0}
 .state-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:0 16px;margin-top:10px;border:1px solid var(--sr-line);border-radius:var(--sr-radius);background:var(--sr-surface)}.state-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px 0;min-width:0}.state-item+.state-item{border-left:1px solid var(--sr-line);padding-left:20px}.state-item h3{font-size:13px;font-weight:600;color:var(--sr-ink);margin:0 0 4px}.state-item strong{display:inline-block;font-size:20px;font-weight:650;line-height:1.3;color:var(--sr-accent)}.state-item small{display:block;color:var(--sr-muted);font-size:11px;margin-top:4px}.state-item a{font-size:12px;min-height:44px;display:flex;align-items:center;overflow-wrap:anywhere}
 @media(max-width:700px){.state-grid{grid-template-columns:1fr;gap:0;padding-inline:14px}.state-item+.state-item{border-left:0;border-top:1px solid var(--sr-line);padding-left:0}.state-heading p{font-size:11px}.state-item strong{font-size:19px}}
</style>
