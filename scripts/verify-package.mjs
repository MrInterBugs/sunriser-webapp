/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern frontend adapted from the SunRiser project and its workflows.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Frontend adaptation (2026); see LICENSING.md and LICENSE.
 * Third-party material retains its own terms.
 */
// Independent CDB reader: verify hash-table lookups as well as record payloads.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decode } from "@msgpack/msgpack";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const vendor = JSON.parse(readFileSync(join(root, "scripts/vendor.json")));

function hash(key) {
  let value = 5381;
  for (const byte of key) value = (((value * 33) >>> 0) ^ byte) >>> 0;
  return value;
}

export function readCdb(bytes) {
  assert(bytes.length >= 2048, "Truncated CDB");
  let end = bytes.length;
  for (let i = 0; i < 256; i++) {
    const start = bytes.readUInt32LE(i * 8), count = bytes.readUInt32LE(i * 8 + 4);
    assert(start >= 2048 && start + count * 8 <= bytes.length, "Invalid CDB table");
    end = Math.min(end, start);
  }
  const result = [];
  const names = new Set();
  let offset = 2048;
  while (offset < end) {
    assert(offset + 8 <= end, "Truncated CDB record");
    const keyLength = bytes.readUInt32LE(offset), valueLength = bytes.readUInt32LE(offset + 4);
    const next = offset + 8 + keyLength + valueLength;
    assert(next <= end, "Truncated CDB value");
    const key = bytes.subarray(offset + 8, offset + 8 + keyLength);
    const name = key.toString("utf8");
    assert(!names.has(name), `Duplicate record: ${name}`);
    names.add(name);
    const h = hash(key), bucket = (h & 255) * 8;
    const start = bytes.readUInt32LE(bucket), count = bytes.readUInt32LE(bucket + 4);
    assert(count > 0, `Missing hash table: ${name}`);
    let found = false;
    for (let probe = 0; probe < count; probe++) {
      const slot = start + (((h >>> 8) % count + probe) % count) * 8;
      const position = bytes.readUInt32LE(slot + 4);
      if (!position) break;
      if (bytes.readUInt32LE(slot) === h && position === offset) { found = true; break; }
    }
    assert(found, `Record unreachable through CDB lookup: ${name}`);
    result.push({ key: name, value: bytes.subarray(offset + 8 + keyLength, next) });
    offset = next;
  }
  assert.equal(offset, end);
  return result;
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
}

export function verifyPackage(bytes, directory = root) {
  const input = readFileSync(join(directory, "NEW.BEE"));
  assert.equal(sha(input), vendor.sha256, "Root NEW.BEE SHA-256 mismatch");
  const reference = readCdb(input).filter(r => !r.key.startsWith("web#"));
  const records = readCdb(bytes);
  assert.deepEqual(records.filter(r => !r.key.startsWith("web#")), reference,
    "Original firmware/configuration records changed");

  const assets = new Map();
  for (const { key, value } of records.filter(r => r.key.startsWith("web#"))) {
    const split = key.lastIndexOf("#"), name = key.slice(4, split), field = key.slice(split + 1);
    assert(name.isWellFormed() && /^[\x20-\x7e]+$/.test(name) && !name.includes("#")
      && !name.split("/").some(part => part === ".." || part === "") && name.length <= 47,
    `Invalid asset path: ${name}`);
    if (!assets.has(name)) assets.set(name, {});
    // Firmware web content uses MessagePack STR for arbitrary compressed bytes.
    assets.get(name)[field] = decode(value, { rawStrings: true });
  }
  const dist = join(directory, "dist");
  assert.deepEqual([...assets.keys()].sort(),
    walk(dist).map(path => relative(dist, path).split("\\").join("/")).sort(),
    "Packaged asset inventory differs from dist");
  assert(assets.has("index.html") && assets.has("notices.html"), "Missing entry or notices");
  for (const [name, fields] of assets) {
    assert.deepEqual(Object.keys(fields).sort(), ["bytes", "content", "deleted", "gzip"]);
    assert.equal(fields.deleted, false);
    assert.equal(typeof fields.gzip, "boolean");
    const stored = Buffer.from(fields.content);
    const decoded = fields.gzip ? gunzipSync(stored) : stored;
    assert.equal(decoded.length, fields.bytes, `Wrong length: ${name}`);
    assert.deepEqual(decoded, readFileSync(join(dist, name)), `Wrong asset bytes: ${name}`);
  }
  return { firmwareVersion: vendor.version, preservedRecords: reference.length, assets: assets.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bytes = readFileSync(join(root, "build/NEW.BEE"));
  const result = verifyPackage(bytes);
  const report = JSON.parse(readFileSync(join(root, "build/package.json")));
  assert.equal(report.vendor_package_sha256, vendor.sha256);
  assert.equal(sha(bytes), report.package_sha256);
  assert.equal(readFileSync(join(root, "build/SHA256SUMS"), "utf8"), `${sha(bytes)}  NEW.BEE\n`);
  console.log(`Verified v${result.firmwareVersion}: ${result.preservedRecords} unchanged vendor records; ${result.assets} exact web assets.`);
}
