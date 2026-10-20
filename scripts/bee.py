# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Aedan Lawrence (original contributions).
# Part of the modern frontend adapted from the SunRiser project and its workflows.
# Upstream: https://github.com/LEDaquaristik/sunriser
# Frontend adaptation (2026); see LICENSING.md and LICENSE.
# Third-party material retains its own terms.

"""SunRiser CDB/MessagePack packing primitives.

Only website values are encoded; vendor non-web record bytes are never decoded
or re-encoded.
"""

import struct, zlib

def cdb_hash(k):
    h = 5381
    for c in k:
        h = ((h << 5) + h ^ c) & 0xffffffff
    return h

def records(d):
    end = min(struct.unpack_from('<I', d, i * 8)[0] for i in range(256))
    off = 0x800
    while off < end:
        kl, vl = struct.unpack_from('<II', d, off)
        yield off, d[off+8:off+8+kl], d[off+8+kl:off+8+kl+vl]
        off += 8 + kl + vl

def mp_encode(v):
    if v is None: return b'\xc0'
    if v is False: return b'\xc2'
    if v is True: return b'\xc3'
    if isinstance(v, int):
        if 0 <= v <= 0x7f: return bytes([v])
        if -32 <= v < 0: return struct.pack('b', v)
        if v >= 0:
            for t, f, lim in ((0xcc, '>B', 0xff), (0xcd, '>H', 0xffff), (0xce, '>I', 0xffffffff), (0xcf, '>Q', 1 << 64)):
                if v <= lim: return bytes([t]) + struct.pack(f, v)
        for t, f, lim in ((0xd0, '>b', 1 << 7), (0xd1, '>h', 1 << 15), (0xd2, '>i', 1 << 31), (0xd3, '>q', 1 << 63)):
            if v >= -lim: return bytes([t]) + struct.pack(f, v)
    if isinstance(v, str): v = v.encode('utf-8')
    if isinstance(v, bytes):
        n = len(v)
        if n <= 31: return bytes([0xa0 | n]) + v
        if n <= 0xff: return b'\xd9' + struct.pack('>B', n) + v
        if n <= 0xffff: return b'\xda' + struct.pack('>H', n) + v
        return b'\xdb' + struct.pack('>I', n) + v
    if isinstance(v, list):
        n = len(v); h = bytes([0x90 | n]) if n <= 15 else (b'\xdc' + struct.pack('>H', n) if n <= 0xffff else b'\xdd' + struct.pack('>I', n))
        return h + b''.join(mp_encode(x) for x in v)
    if isinstance(v, dict):
        n = len(v); h = bytes([0x80 | n]) if n <= 15 else (b'\xde' + struct.pack('>H', n) if n <= 0xffff else b'\xdf' + struct.pack('>I', n))
        return h + b''.join(mp_encode(k) + mp_encode(x) for k, x in v.items())
    raise TypeError(type(v))

def gzip_bytes(data):
    c = zlib.compressobj(9, zlib.DEFLATED, -15, 9, zlib.Z_DEFAULT_STRATEGY)
    body = c.compress(data) + c.flush()
    return b'\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff' + body + struct.pack('<II', zlib.crc32(data), len(data) & 0xffffffff)

def cdb_make(pairs):
    out = bytearray(0x800)
    entries = []
    for k, v in pairs:
        entries.append((cdb_hash(k), len(out)))
        out += struct.pack('<II', len(k), len(v)) + k + v
    buckets = [[] for _ in range(256)]
    for h, p in entries: buckets[h & 0xff].append((h, p))
    header = bytearray()
    for b in buckets:
        n = len(b) * 2
        table = [(0, 0)] * n
        for h, p in b:
            i = (h >> 8) % n
            while table[i][1]: i = (i + 1) % n
            table[i] = (h, p)
        header += struct.pack('<II', len(out), n)
        for h, p in table: out += struct.pack('<II', h, p)
    out[:0x800] = header
    return bytes(out)
