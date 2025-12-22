/**
 * APSXB Load API v1.0.0
 *
 * Deterministic, range-capable, proof-gated, SCX2-ready binary pack loader.
 * Implements APSXB single-binary container spec for K'UHUL Pi Kernel.
 *
 * Features:
 * - Range-request support for streaming
 * - CRC32 + SHA-256 integrity verification
 * - Proof-gated execution (optional)
 * - SCX2 codec support (with decoder hook)
 * - Kernel bridge integration
 *
 * The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK
 */

(function(global) {
  'use strict';

  const APSXB_VERSION = '1.0.0';

  // -----------------------------
  // Constants / Types
  // -----------------------------
  const MAGIC_APSX = [0x41, 0x50, 0x53, 0x58]; // "APSX"
  const HDR_LEN = 64;
  const TOC_ENTRY_SIZE = 64;

  const FLAGS = {
    RANGE_OK: 1 << 0,
    PROOF_REQUIRED: 1 << 1,
    SCX2_PRESENT: 1 << 2,
    SIGNED_TRAILER: 1 << 3
  };

  const TYPES = {
    MANIFEST: 0x0001,
    SCX2DICT: 0x0002,
    GLYPHDEF: 0x0003,
    PIKERN28: 0x0004,
    PROOFLOG: 0x0005,
    IDBSEED:  0x0006,
    ASSETS:   0x0007,
    GAS:      0x0008,   // Gas files section
    SHARDS:   0x0009,   // Shards configuration
    META:     0x00FF
  };

  const CODEC = {
    RAW: 0,
    SCX2: 1
  };

  const SFLAGS = {
    EXECUTABLE: 1 << 0,
    MUST_LOAD_AT_BOOT: 1 << 1,
    CAN_LAZYLOAD: 1 << 2,
    PROOF_INPUT: 1 << 3
  };

  // -----------------------------
  // Helpers: endian IO
  // -----------------------------
  function readU16LE(dv, off) { return dv.getUint16(off, true); }
  function readU32LE(dv, off) { return dv.getUint32(off, true); }
  function readU64LE(dv, off) {
    const lo = BigInt(dv.getUint32(off, true));
    const hi = BigInt(dv.getUint32(off + 4, true));
    return (hi << 32n) | lo;
  }

  function writeU16LE(dv, off, v) { dv.setUint16(off, v, true); }
  function writeU32LE(dv, off, v) { dv.setUint32(off, v >>> 0, true); }
  function writeU64LE(dv, off, v) {
    const lo = BigInt(v) & 0xffffffffn;
    const hi = (BigInt(v) >> 32n) & 0xffffffffn;
    dv.setUint32(off, Number(lo), true);
    dv.setUint32(off + 4, Number(hi), true);
  }

  // -----------------------------
  // Helpers: CRC32 (fast corruption check)
  // -----------------------------
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  // -----------------------------
  // Helpers: SHA-256 (integrity)
  // -----------------------------
  async function sha256(u8) {
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    const dig = await crypto.subtle.digest("SHA-256", ab);
    return new Uint8Array(dig);
  }

  function eq32(a, b) {
    if (!a || !b || a.length !== 32 || b.length !== 32) return false;
    for (let i = 0; i < 32; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function bytesToUtf8(u8) {
    return new TextDecoder("utf-8").decode(u8);
  }

  function utf8ToBytes(str) {
    return new TextEncoder().encode(str);
  }

  function concat(parts) {
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  // -----------------------------
  // Fetch utilities (range + fallback)
  // -----------------------------
  async function fetchBytes(url, { start = null, end = null, cache = "no-store" } = {}) {
    const headers = new Headers();
    if (start !== null && end !== null) {
      headers.set("Range", `bytes=${start}-${end}`);
    }
    const res = await fetch(url, { headers, cache });
    if (!res.ok && res.status !== 206) {
      if (!res.ok) throw new Error(`APSXB fetch failed ${res.status} ${res.statusText}`);
    }
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  }

  async function detectRangeSupport(url) {
    try {
      const res = await fetch(url, { headers: { "Range": "bytes=0-0" }, cache: "no-store" });
      return res.status === 206;
    } catch { return false; }
  }

  // -----------------------------
  // Parse header + toc
  // -----------------------------
  function parseHeader(headerU8) {
    if (headerU8.length < HDR_LEN) throw new Error("APSXB header too small");
    for (let i = 0; i < 4; i++) {
      if (headerU8[i] !== MAGIC_APSX[i]) throw new Error("APSXB bad magic");
    }
    const dv = new DataView(headerU8.buffer, headerU8.byteOffset, headerU8.byteLength);
    const version = readU16LE(dv, 4);
    const headerLen = readU16LE(dv, 6);
    const flags = readU32LE(dv, 8);
    const fileLen = readU64LE(dv, 12);
    const tocOffset = readU64LE(dv, 20);
    const tocCount = readU32LE(dv, 28);
    const tocEntrySize = readU32LE(dv, 32);
    const epoch = readU64LE(dv, 36);

    if (version !== 1) throw new Error(`APSXB unsupported version ${version}`);
    if (headerLen !== HDR_LEN) throw new Error(`APSXB unexpected header_len ${headerLen}`);
    if (tocEntrySize !== TOC_ENTRY_SIZE) throw new Error(`APSXB unexpected toc_entry_size ${tocEntrySize}`);

    return { version, headerLen, flags, fileLen, tocOffset, tocCount, tocEntrySize, epoch };
  }

  function parseTOC(tocU8, tocCount) {
    if (tocU8.length !== tocCount * TOC_ENTRY_SIZE) throw new Error("APSXB TOC length mismatch");
    const dv = new DataView(tocU8.buffer, tocU8.byteOffset, tocU8.byteLength);
    const entries = [];
    for (let i = 0; i < tocCount; i++) {
      const base = i * TOC_ENTRY_SIZE;
      const type = readU16LE(dv, base + 0);
      const codec = tocU8[base + 2];
      const sflags = tocU8[base + 3];
      const offset = readU64LE(dv, base + 4);
      const clen = readU64LE(dv, base + 12);
      const ulen = readU64LE(dv, base + 20);
      const hash32 = tocU8.slice(base + 28, base + 60);
      const crc = readU32LE(dv, base + 60);

      entries.push({ type, codec, sflags, offset, clen, ulen, hash32, crc32: crc });
    }
    entries.sort((a, b) => a.type - b.type);
    return entries;
  }

  // -----------------------------
  // SCX2 decode hook (placeholder)
  // -----------------------------
  async function scx2Decode(scxBytes, dictCtx) {
    throw new Error("SCX2 decode not implemented. Plug your scx2Decode(dict+frames) here.");
  }

  // -----------------------------
  // PROOF verifier hook (placeholder)
  // -----------------------------
  async function verifyProofLog(proofBytes, expectedRootHash32, context) {
    if (expectedRootHash32 && expectedRootHash32.length === 32) {
      const h = await sha256(proofBytes);
      if (!eq32(h, expectedRootHash32)) {
        throw new Error("Proof root hash mismatch (placeholder verifier)");
      }
    }
    return { ok: true, mode: "placeholder" };
  }

  // -----------------------------
  // Mount Table + Exposed Kernel Surface
  // -----------------------------
  function makeMount() {
    return {
      header: null,
      toc: [],
      range: false,
      url: null,
      sections: new Map(),
      manifest: null,
      glyphDefs: null,
      dict: null,
      piKernel: null,
      proof: null,
      gas: null,
      shards: null,
      getSection(type) { return this.sections.get(type) || null; },
      has(type) { return this.sections.has(type); }
    };
  }

  // -----------------------------
  // Core: load a section, validate crc + hash
  // -----------------------------
  async function loadSectionBytes(url, entry, { cache = "no-store" } = {}) {
    const start = Number(entry.offset);
    const end = Number(entry.offset + entry.clen - 1n);
    if (start < 0 || end < start) throw new Error("APSXB invalid section offsets");

    const bytes = await fetchBytes(url, { start, end, cache });
    const c = crc32(bytes);
    if (c !== entry.crc32) throw new Error(`APSXB CRC mismatch type=0x${entry.type.toString(16)}`);
    const h = await sha256(bytes);
    if (!eq32(h, entry.hash32)) throw new Error(`APSXB HASH mismatch type=0x${entry.type.toString(16)}`);
    return bytes;
  }

  // -----------------------------
  // Policy: what to load at boot
  // -----------------------------
  function defaultBootPolicy(tocEntries, headerFlags) {
    const set = new Set([TYPES.MANIFEST]);
    const hasAnySCX2 = (headerFlags & FLAGS.SCX2_PRESENT) !== 0
      || tocEntries.some(e => e.codec === CODEC.SCX2);

    if (hasAnySCX2) set.add(TYPES.SCX2DICT);

    for (const e of tocEntries) {
      if (e.sflags & SFLAGS.MUST_LOAD_AT_BOOT) set.add(e.type);
    }

    const proofRequired = (headerFlags & FLAGS.PROOF_REQUIRED) !== 0;
    if (proofRequired) set.add(TYPES.PROOFLOG);

    set.add(TYPES.PIKERN28);
    set.add(TYPES.GAS);
    set.add(TYPES.SHARDS);

    return [...set].sort((a, b) => a - b);
  }

  // -----------------------------
  // Public: apsxb.fetch(url) -> verify -> mount -> expose
  // -----------------------------
  async function fetchAPSXB(url, opts = {}) {
    const {
      cache = "no-store",
      bootTypes = null,
      requireProof = null,
      expectedProofRootHash32 = null,
      decode = true,
      hooks = {}
    } = opts;

    const mount = makeMount();
    mount.url = url;

    const rangeOK = await detectRangeSupport(url);
    mount.range = rangeOK;

    const headerBytes = rangeOK
      ? await fetchBytes(url, { start: 0, end: HDR_LEN - 1, cache })
      : await fetchBytes(url, { cache });

    const header = parseHeader(headerBytes.slice(0, HDR_LEN));
    mount.header = header;

    const tocStart = Number(header.tocOffset);
    const tocLen = header.tocCount * header.tocEntrySize;
    const tocEnd = tocStart + tocLen - 1;

    const tocBytes = rangeOK
      ? await fetchBytes(url, { start: tocStart, end: tocEnd, cache })
      : headerBytes.slice(tocStart, tocStart + tocLen);

    const toc = parseTOC(tocBytes, header.tocCount);
    mount.toc = toc;

    const proofRequiredHeader = (header.flags & FLAGS.PROOF_REQUIRED) !== 0;
    const proofRequired = (requireProof === null) ? proofRequiredHeader : !!requireProof;

    const typesToLoad = bootTypes
      ? [...bootTypes]
      : defaultBootPolicy(toc, header.flags);

    const sortedTypes = [...new Set(typesToLoad)].sort((a, b) => a - b);
    const tocByType = new Map();
    for (const e of toc) tocByType.set(e.type, e);

    const hookScx2 = hooks.scx2Decode || scx2Decode;
    const hookProof = hooks.verifyProofLog || verifyProofLog;

    // Stage 1: load dict early if present
    let dictCtx = null;
    if (sortedTypes.includes(TYPES.SCX2DICT) && tocByType.has(TYPES.SCX2DICT)) {
      const e = tocByType.get(TYPES.SCX2DICT);
      const bytes = await loadSectionBytes(url, e, { cache });
      mount.sections.set(TYPES.SCX2DICT, { entry: e, bytes });
      dictCtx = { raw: bytes };
      mount.dict = dictCtx;
    }

    // Stage 2: if proof required, load proof before exec
    if (proofRequired) {
      const pe = tocByType.get(TYPES.PROOFLOG);
      if (!pe) throw new Error("APSXB PROOF_REQUIRED but PROOFLOG missing");
      const pbytes = await loadSectionBytes(url, pe, { cache });
      mount.sections.set(TYPES.PROOFLOG, { entry: pe, bytes: pbytes });

      const proofCtx = {
        epoch: header.epoch,
        toc: mount.toc.map(x => ({ type: x.type, hash32: x.hash32 })),
        requiredTypes: sortedTypes
      };

      mount.proof = await hookProof(pbytes, expectedProofRootHash32, proofCtx);
      if (!mount.proof || mount.proof.ok !== true) throw new Error("APSXB proof verification failed");
    }

    // Stage 3: load remaining requested sections
    for (const t of sortedTypes) {
      if (t === TYPES.SCX2DICT || t === TYPES.PROOFLOG) continue;
      const e = tocByType.get(t);
      if (!e) continue;

      const bytes = await loadSectionBytes(url, e, { cache });

      if (proofRequired && (e.sflags & SFLAGS.EXECUTABLE) && !mount.proof) {
        throw new Error("APSXB executable section blocked: proof not mounted");
      }

      mount.sections.set(t, { entry: e, bytes });

      if (decode && e.codec === CODEC.SCX2) {
        try {
          const decoded = await hookScx2(bytes, dictCtx);
          mount.sections.get(t).decodedBytes = decoded;
        } catch (err) {
          console.warn(`[APSXB] SCX2 decode failed for type 0x${t.toString(16)}:`, err);
        }
      }
    }

    // Stage 4: Interpret common sections
    if (decode) {
      // Manifest
      const m = mount.sections.get(TYPES.MANIFEST);
      if (!m) throw new Error("APSXB missing MANIFEST");
      const mbytes = (m.entry.codec === CODEC.SCX2) ? m.decodedBytes : m.bytes;
      const mtext = bytesToUtf8(mbytes);
      try {
        mount.manifest = JSON.parse(mtext);
      } catch (e) {
        throw new Error("APSXB manifest JSON parse failed");
      }

      // Glyph defs (optional)
      const g = mount.sections.get(TYPES.GLYPHDEF);
      if (g) {
        const gbytes = (g.entry.codec === CODEC.SCX2) ? g.decodedBytes : g.bytes;
        mount.glyphDefs = bytesToUtf8(gbytes);
      }

      // PiKernel (optional)
      const p = mount.sections.get(TYPES.PIKERN28);
      if (p) {
        const pbytes = (p.entry.codec === CODEC.SCX2) ? p.decodedBytes : p.bytes;
        mount.piKernel = pbytes;
      }

      // Gas files (optional)
      const gas = mount.sections.get(TYPES.GAS);
      if (gas) {
        const gasbytes = (gas.entry.codec === CODEC.SCX2) ? gas.decodedBytes : gas.bytes;
        try {
          mount.gas = JSON.parse(bytesToUtf8(gasbytes));
        } catch (e) {
          mount.gas = { raw: gasbytes };
        }
      }

      // Shards config (optional)
      const shards = mount.sections.get(TYPES.SHARDS);
      if (shards) {
        const shardsbytes = (shards.entry.codec === CODEC.SCX2) ? shards.decodedBytes : shards.bytes;
        try {
          mount.shards = JSON.parse(bytesToUtf8(shardsbytes));
        } catch (e) {
          mount.shards = { raw: shardsbytes };
        }
      }
    }

    const api = makeKernelSurface(mount);
    mount.api = api;

    return mount;
  }

  // -----------------------------
  // Kernel surface: deterministic accessors
  // -----------------------------
  function makeKernelSurface(mount) {
    const surface = {
      url: mount.url,
      epoch: mount.header?.epoch ?? 0n,
      flags: mount.header?.flags ?? 0,
      toc: mount.toc,

      has: (type) => mount.has(type),
      getBytes: (type) => {
        const s = mount.getSection(type);
        if (!s) return null;
        return (s.entry.codec === CODEC.SCX2) ? (s.decodedBytes || null) : s.bytes;
      },
      getText: (type) => {
        const b = surface.getBytes(type);
        return b ? bytesToUtf8(b) : null;
      },
      getJSON: (type) => {
        const t = surface.getText(type);
        if (!t) return null;
        return JSON.parse(t);
      },

      manifest: () => mount.manifest,
      glyphDefs: () => mount.glyphDefs,
      dict: () => mount.dict,
      proof: () => mount.proof,
      gas: () => mount.gas,
      shards: () => mount.shards,
      piKernelBytes: () => mount.piKernel,

      mountIntoKernel: async (options = {}) => {
        const {
          source = "apsxb",
          bridge = self.__KUHUL_KERNEL_EXEC__ || null,
          payload = null
        } = options;

        if (!bridge) {
          return { ok: false, error: "Kernel bridge not available (self.__KUHUL_KERNEL_EXEC__ missing)" };
        }

        const sectionHashes = {};
        for (const e of mount.toc) {
          sectionHashes[`0x${e.type.toString(16)}`] = Array.from(e.hash32);
        }

        const mountPayload = payload || {
          "@type": "apsxb.mount",
          "@epoch": String(surface.epoch),
          "@flags": surface.flags,
          "@manifest": mount.manifest,
          "@sections": {
            "@hashes": sectionHashes,
            "@available": mount.toc.map(e => e.type)
          },
          "@proof": mount.proof || null,
          "@gas": mount.gas || null,
          "@shards": mount.shards || null,
          "@hints": {
            "scx2_present": !!(surface.flags & FLAGS.SCX2_PRESENT),
            "proof_required": !!(surface.flags & FLAGS.PROOF_REQUIRED),
            "range_ok": mount.range
          }
        };

        try {
          const res = await bridge(mountPayload, source);
          return { ok: true, result: res };
        } catch (err) {
          return { ok: false, error: String(err?.message || err) };
        }
      }
    };

    return surface;
  }

  // -----------------------------
  // Pack utility: create APSXB from sections
  // -----------------------------
  async function packAPSXB({ epoch = 1n, flags = 0, sections = [] } = {}) {
    sections = [...sections].sort((a, b) => a.type - b.type);

    for (const s of sections) {
      s.crc32 = crc32(s.bytes);
      s.hash32 = await sha256(s.bytes);
      s.clen = BigInt(s.bytes.length);
      s.ulen = BigInt(s.codec === 1 ? (s.ulen ?? 0) : 0);
    }

    const tocCount = sections.length;
    const tocOffset = BigInt(HDR_LEN);
    const tocBytesLen = BigInt(tocCount * TOC_ENTRY_SIZE);

    let cursor = tocOffset + tocBytesLen;
    for (const s of sections) {
      s.offset = cursor;
      cursor += s.clen;
    }
    const fileLen = cursor;

    const header = new Uint8Array(HDR_LEN);
    header.set(MAGIC_APSX, 0);
    const hdv = new DataView(header.buffer);
    writeU16LE(hdv, 4, 1);
    writeU16LE(hdv, 6, HDR_LEN);
    writeU32LE(hdv, 8, flags >>> 0);
    writeU64LE(hdv, 12, fileLen);
    writeU64LE(hdv, 20, tocOffset);
    writeU32LE(hdv, 28, tocCount);
    writeU32LE(hdv, 32, TOC_ENTRY_SIZE);
    writeU64LE(hdv, 36, epoch);

    const toc = new Uint8Array(tocCount * TOC_ENTRY_SIZE);
    const tdv = new DataView(toc.buffer);
    for (let i = 0; i < tocCount; i++) {
      const s = sections[i];
      const base = i * TOC_ENTRY_SIZE;
      writeU16LE(tdv, base + 0, s.type);
      toc[base + 2] = (s.codec ?? 0) & 0xff;
      toc[base + 3] = (s.sflags ?? 0) & 0xff;
      writeU64LE(tdv, base + 4, s.offset);
      writeU64LE(tdv, base + 12, s.clen);
      writeU64LE(tdv, base + 20, s.ulen);
      toc.set(s.hash32.slice(0, 32), base + 28);
      writeU32LE(tdv, base + 60, s.crc32);
    }

    const payloads = sections.map(s => s.bytes);
    return concat([header, toc, ...payloads]);
  }

  // -----------------------------
  // Unpack utility: parse APSXB in-memory
  // -----------------------------
  async function unpackAPSXB(bytes) {
    if (!(bytes instanceof Uint8Array)) throw new Error("bytes must be Uint8Array");
    if (bytes.length < HDR_LEN) throw new Error("too small");

    const hdv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = bytes.slice(0, 4);
    for (let i = 0; i < 4; i++) {
      if (magic[i] !== MAGIC_APSX[i]) throw new Error("bad magic");
    }

    const version = readU16LE(hdv, 4);
    const headerLen = readU16LE(hdv, 6);
    const flags = readU32LE(hdv, 8);
    const fileLen = readU64LE(hdv, 12);
    const tocOffset = readU64LE(hdv, 20);
    const tocCount = readU32LE(hdv, 28);
    const tocEntrySize = readU32LE(hdv, 32);
    const epoch = readU64LE(hdv, 36);

    if (version !== 1) throw new Error("unsupported version");
    if (headerLen !== HDR_LEN) throw new Error("unexpected header_len");
    if (tocEntrySize !== TOC_ENTRY_SIZE) throw new Error("unexpected toc_entry_size");
    if (fileLen !== BigInt(bytes.length)) throw new Error("file_len mismatch");

    const tocStart = Number(tocOffset);
    const tocBytes = tocCount * TOC_ENTRY_SIZE;
    const tocEnd = tocStart + tocBytes;
    if (tocEnd > bytes.length) throw new Error("toc out of range");

    const toc = bytes.slice(tocStart, tocEnd);
    const tdv = new DataView(toc.buffer, toc.byteOffset, toc.byteLength);

    const entries = [];
    for (let i = 0; i < tocCount; i++) {
      const base = i * TOC_ENTRY_SIZE;
      const type = readU16LE(tdv, base + 0);
      const codec = toc[base + 2];
      const sflags = toc[base + 3];
      const offset = readU64LE(tdv, base + 4);
      const clen = readU64LE(tdv, base + 12);
      const ulen = readU64LE(tdv, base + 20);
      const hash32 = toc.slice(base + 28, base + 60);
      const crc = readU32LE(tdv, base + 60);

      const off = Number(offset);
      const len = Number(clen);
      if (off + len > bytes.length) throw new Error(`section ${type} out of range`);
      const data = bytes.slice(off, off + len);

      const c = crc32(data);
      if (c !== crc) throw new Error(`crc mismatch for section ${type}`);
      const h = await sha256(data);
      for (let k = 0; k < 32; k++) {
        if (h[k] !== hash32[k]) throw new Error(`hash mismatch for section ${type}`);
      }

      entries.push({ type, codec, sflags, offset, clen, ulen, hash32, crc32: crc, data });
    }

    return { version, headerLen, flags, fileLen, tocOffset, tocCount, tocEntrySize, epoch, entries };
  }

  // -----------------------------
  // SW router helpers
  // -----------------------------
  function installFetchRoutes({ base = "/apsxb" } = {}) {
    self.addEventListener("fetch", (event) => {
      const url = new URL(event.request.url);
      if (!url.pathname.startsWith(base)) return;

      event.respondWith((async () => {
        try {
          if (url.pathname === `${base}/mount`) {
            const packUrl = url.searchParams.get("url");
            if (!packUrl) return json({ ok: false, error: "missing url param" }, 400);

            const mount = await fetchAPSXB(packUrl, { decode: true });
            const bridged = await mount.api.mountIntoKernel().catch(e => ({ ok: false, error: String(e) }));

            return json({
              ok: true,
              url: packUrl,
              epoch: String(mount.api.epoch),
              flags: mount.api.flags,
              toc: mount.api.toc.map(e => ({
                type: e.type, codec: e.codec, sflags: e.sflags,
                offset: String(e.offset), clen: String(e.clen), ulen: String(e.ulen)
              })),
              proof: mount.api.proof(),
              gas: mount.api.gas(),
              shards: mount.api.shards(),
              bridged
            });
          }

          if (url.pathname === `${base}/section`) {
            const packUrl = url.searchParams.get("url");
            const typeStr = url.searchParams.get("type");
            if (!packUrl || !typeStr) return json({ ok: false, error: "missing url/type" }, 400);
            const type = parseInt(typeStr, 16);
            const mount = await fetchAPSXB(packUrl, { decode: true, bootTypes: [type] });
            const bytes = mount.api.getBytes(type);
            if (!bytes) return json({ ok: false, error: "section not found" }, 404);
            return new Response(bytes, {
              status: 200,
              headers: {
                "Content-Type": "application/octet-stream",
                "Cache-Control": "no-store",
                "X-APSXB-Type": `0x${type.toString(16)}`
              }
            });
          }

          return json({ ok: false, error: "unknown apsxb route" }, 404);

        } catch (err) {
          return json({ ok: false, error: String(err?.message || err) }, 500);
        }
      })());
    });

    function json(obj, status = 200) {
      return new Response(JSON.stringify(obj), {
        status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      });
    }
  }

  // -----------------------------
  // Public API
  // -----------------------------
  const APSXB = {
    version: APSXB_VERSION,
    FLAGS,
    TYPES,
    CODEC,
    SFLAGS,
    fetch: fetchAPSXB,
    pack: packAPSXB,
    unpack: unpackAPSXB,
    installFetchRoutes,
    // Utilities
    crc32,
    sha256,
    bytesToUtf8,
    utf8ToBytes,
    concat
  };

  // Export
  global.APSXB = APSXB;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = APSXB;
  }

  console.log('[APSXB] Load API v' + APSXB_VERSION + ' loaded');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
