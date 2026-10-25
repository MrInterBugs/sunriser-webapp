/* SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence. See LICENSE and LICENSING.md.
 */
import { get, writable } from 'svelte/store';

// A verified editor save ages read-only summaries without invalidating other
// editors' baselines or discarding their drafts.
export const configurationSaves=writable(0);
export function configurationSaved(){configurationSaves.update(value=>value+1);}

// A recovery write can replace many settings at once. Keep retained drafts, but
// do not let an editor's pre-recovery baseline masquerade as current configuration.
export const configurationState = writable({ revision: 0, recovery: '' as '' | 'acknowledged' | 'uncertain' });
export const configurationRevision = () => { const state=get(configurationState); return state.recovery ? -1 : state.revision; };
export function configurationCurrent(revision: number) {
  const state = get(configurationState);
  return !state.recovery && state.revision === revision;
}
export function configurationChanged(recovery: 'acknowledged' | 'uncertain') {
  configurationState.update(state => ({ revision: state.revision + 1, recovery }));
}
export function configurationVerified() {
  configurationState.update(state => ({ ...state, recovery: '' }));
}
// Reconnection is not proof of configuration freshness or a known replacement.
// Notify the shell, but preserve explicit saving of retained drafts. Recovery
// replacement revisions remain a separate, stronger reconciliation boundary.
export const configurationConnection = writable(0);
export function configurationReconnected() {
  configurationConnection.update(value => value + 1);
}
// A raw output command persists pwm#N#fixed for channels in fixed mode (C
// set_pwm_fixed_value), so read-only summaries showing those values age.
export const rawCommands = writable({ sequence: 0, channels: [] as number[] });
export function rawCommandSent(channels: number[]) {
  rawCommands.update(state => ({ sequence: state.sequence + 1, channels }));
}
