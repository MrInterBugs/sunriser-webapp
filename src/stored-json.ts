// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Aedan Lawrence (original contributions). See LICENSE and LICENSING.md.
import {MessageError, source} from './messages.js';
/** Parse a JSON catalogue that the controller stores inside a MessagePack string. */
export function parseStoredJson(key: string, text: string): unknown {
  try { return JSON.parse(text); }
  catch { throw new MessageError(source('common.storedJsonInvalid', {v0: key})); }
}
