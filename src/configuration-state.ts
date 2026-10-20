/* SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence. See LICENSE and LICENSING.md.
 */
import { get, writable } from 'svelte/store';

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
