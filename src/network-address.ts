// SPDX-License-Identifier: GPL-3.0-or-later
import type {DeviceState} from './api.js';
export type ReportedAddress={interface:'lan'|'wifi';address:string};
/** Address syntax/assignment only; this does not prove link status or reachability. */
export function assignedIPv4(value:unknown):value is string {
 if(typeof value!=='string'||!/^\d{1,3}(\.\d{1,3}){3}$/.test(value))return false;
 const octets=value.split('.').map(Number);
 return octets.every(n=>n<=255)&&octets[0]>0&&octets[0]<224&&octets[0]!==127;
}
/** Select only controller-reported state, never the browser's connection origin.
 * Freshness remains owned by the snapshot/readback state, independently of selection.
 * SR8 has no Wi-Fi field; ignore stray data when firmware reports no Wi-Fi support.
 */
export function preferredReportedAddress(state:Pick<DeviceState,'lan_ip'|'wifi_ip'>,wifiSupported:boolean):ReportedAddress|undefined {
 if(assignedIPv4(state.lan_ip))return {interface:'lan',address:state.lan_ip};
 if(wifiSupported&&assignedIPv4(state.wifi_ip))return {interface:'wifi',address:state.wifi_ip};
 return undefined;
}
