// SPDX-License-Identifier: GPL-3.0-or-later
// Retained UI messages keep their identity until rendering. No controller effects.
import type {MessageKey} from './locales/en.js';
export type Locale = 'en' | 'de';
export type Catalogue = Readonly<Record<MessageKey, string>>;
// Rendering requires the language's catalogue to be registered first
// (catalogues.ts loads it on demand; see main.ts).
const catalogues: Partial<Record<Locale, Catalogue>> = {};
export function registerCatalogue(locale: Locale, catalogue: Catalogue) { catalogues[locale] = catalogue; }
export const catalogueLoaded = (locale: Locale) => !!catalogues[locale];
export type MessageValue = string | number | boolean | null | undefined | Message;
export type MessageValues = Readonly<Record<string, MessageValue>>;
const messageIdentity=Symbol();
export interface Message {
  readonly [messageIdentity]: true;
  readonly kind: 'message';
  readonly key: MessageKey;
  readonly values: MessageValues;
}
export type UiText = string | Message;
export function source(key: MessageKey, values: MessageValues = {}): Message {
  return Object.freeze({
    [messageIdentity]: true as const, kind: 'message', key, values: Object.freeze({...values}),
    [Symbol.toPrimitive](): never { throw new TypeError('Render a message with its locale before converting to text'); },
  });
}
export function isMessage(value: unknown): value is Message {
  return !!value && typeof value === 'object' && messageIdentity in value;
}
export function renderMessage(value: unknown, locale: 'en' | 'de'): string {
  if (!isMessage(value)) return String(value ?? '');
  const catalogue = catalogues[locale];
  if (!catalogue) throw new Error(`Catalogue not loaded: ${locale}`);
  const template = catalogue[value.key];
  return template.replace(/\{(v\d+)\}/g, (_, slot: string) => {
    if (!Object.hasOwn(value.values, slot)) throw new Error(`Missing message parameter: ${value.key}/${slot}`);
    const child = value.values[slot];
    return isMessage(child) ? renderMessage(child, locale) : String(child);
  });
}
export class MessageError extends Error {
  // Diagnostic text only: English when loaded, otherwise the message key.
  constructor(readonly uiMessage: Message) { super(catalogues.en ? renderMessage(uiMessage, 'en') : uiMessage.key); }
}
/** Error.message is for diagnostics; UI consumers keep the structured reason. */
export function errorText(error: unknown, prefix = false): Message {
  let text: Message;
  if (error instanceof MessageError) text = error.uiMessage;
  else if (isMessage(error)) text = error;
  else if (error instanceof Error && /^(AbortError|TimeoutError)$/.test(error.name)) text = source('common.requestTimeout');
  else if (error instanceof TypeError && /Failed to fetch|NetworkError|Load failed/.test(error.message)) text = source('common.connectionFailure');
  else text = source('common.unexpectedError');
  return prefix ? source('common.errorPrefix', {v0: text}) : text;
}
export const sourceCount = (count: number, unit: 'key' | 'byte') => source(
  unit === 'key' ? (count === 1 ? 'common.keyOne' : 'common.keyMany') : (count === 1 ? 'common.byteOne' : 'common.byteMany'), {v0: count},
);
