/* SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence. See LICENSING.md.
 */
import {decode} from '@msgpack/msgpack';
import {readConfig} from './api.js';
import {backupValueBytes,recoveryRequest} from './recovery.js';
import {key,sensorCatalogue,type Catalogue} from './sensors.js';
import {source} from './messages.js';

export interface SensorRemoval {
  rom: string;
  name: string;
  previousCatalogue: string;
  catalogue: Catalogue;
  patch: Record<string,unknown>;
}
/** Enumerate the exact ROM prefix, including saved fields unknown to this editor.
 * Only key names and the catalogue survive review; no private backup is retained.
 * Firmware stores nil tombstones, not file deletions. Put active first so a
 * partially interrupted write cannot leave cleared response fields enabled.
 */
export function sensorRemovalPlan(rom:string, bytes:Uint8Array):SensorRemoval {
  if(!/^[0-9a-fA-F]{16}$/.test(rom))throw Error(source('sensors.invalidSensorCatalogueEntry_77a80'));
  const values=backupValueBytes(bytes), encoded=values.get('sensors#web');
  const previousCatalogue=encoded?decode(encoded):undefined;
  const catalogue=sensorCatalogue(previousCatalogue);
  if(typeof previousCatalogue!=='string'||!Object.hasOwn(catalogue,rom))throw Error(source('sensors.removalChanged'));
  const name=catalogue[rom].name as string;
  const remaining=Object.fromEntries(Object.entries(catalogue).filter(([id])=>id!==rom));
  const patch:Record<string,unknown>={[key(rom,'active')]:null};
  for(const field of values.keys())if(field.startsWith(key(rom,'')))patch[field]=null;
  patch['sensors#web']=JSON.stringify(remaining);
  return {rom,name,previousCatalogue,catalogue:remaining,patch};
}
export async function reviewSensorRemoval(rom:string):Promise<SensorRemoval>{
  return sensorRemovalPlan(rom,await recoveryRequest('GET','/backup'));
}
/** No compare-and-swap exists in the firmware. Fail closed on an observed
 * catalogue change rather than replacing another client's registrations.
 */
export async function verifySensorRemoval(plan:SensorRemoval){
  const saved=await readConfig(['sensors#web']);
  if(saved['sensors#web']!==plan.previousCatalogue)throw Error(source('sensors.removalChanged'));
}
