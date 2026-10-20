/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2026 Aedan Lawrence (original contributions).
 * Part of the modern frontend adapted from the SunRiser project and its workflows.
 * Upstream: https://github.com/LEDaquaristik/sunriser
 * Frontend adaptation (2026); see LICENSING.md and LICENSE.
 * Third-party material retains its own terms.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdtempSync, cpSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { readCdb, root, verifyPackage } from "../scripts/verify-package.mjs";

const bytes = readFileSync(join(root, "build/NEW.BEE"));

for (const invalid of ["missing", "wrong hash"]) {
  test(`packager refuses ${invalid} vendor input before writing output`, () => {
    const temporary = mkdtempSync(join(tmpdir(), "sunriser-vendor-check-"));
    try {
      cpSync(join(root, "scripts"), join(temporary, "scripts"), { recursive: true });
      if (invalid === "wrong hash") writeFileSync(join(temporary, "NEW.BEE"), "unapproved firmware");
      const run = spawnSync("python3", [join(temporary, "scripts/package.py")], { encoding: "utf8" });
      assert.equal(run.status, 1);
      assert.match(run.stderr, invalid === "missing" ? /Missing root NEW.BEE/ : /SHA-256 mismatch/);
      assert.equal(existsSync(join(temporary, "build/NEW.BEE")), false);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
}

test("package retains the original firmware and exact built website", () => {
  assert.equal(verifyPackage(bytes).firmwareVersion, "1.007");
});

test("modified firmware is rejected even with a structurally valid CDB", () => {
  const corrupted = Buffer.from(bytes);
  const firmware = readCdb(corrupted).find(r => r.key === "___firmware10");
  firmware.value[128] ^= 1;
  assert.throws(() => verifyPackage(corrupted), /firmware\/configuration records changed/);
});

test("a missing hash-table entry is rejected", () => {
  const corrupted = Buffer.from(bytes);
  let changed = false;
  for (let bucket = 0; bucket < 256 && !changed; bucket++) {
    const start = corrupted.readUInt32LE(bucket * 8), count = corrupted.readUInt32LE(bucket * 8 + 4);
    for (let slot = start; slot < start + count * 8; slot += 8) {
      if (corrupted.readUInt32LE(slot + 4)) {
        corrupted.writeUInt32LE(0, slot + 4);
        changed = true;
        break;
      }
    }
  }
  assert(changed);
  assert.throws(() => verifyPackage(corrupted), /unreachable/);
});

test("changed image content is rejected", () => {
  const corrupted = Buffer.from(bytes);
  const image = readCdb(corrupted).find(r => r.key.endsWith(".avif#content"));
  image.value[image.value.length - 1] ^= 1;
  assert.throws(() => verifyPackage(corrupted), /Wrong asset bytes/);
});
