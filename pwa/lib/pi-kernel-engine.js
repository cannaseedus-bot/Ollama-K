/**
 * PiKernelEngine v1 — Glyph → π-kernel interpreter
 *
 * CANONICAL STONE TABLET - FROZEN EXECUTION SEMANTICS
 *
 * - Reads glyph symbols by data-symbol and data-kernel
 * - Executes deterministic tick loop
 * - Supports basis rotation: @, @@, @@@, @@@@
 * - Weight mapping:
 *     opacity  -> scalar weight (default 1.0)
 *     color    -> vector (rgba) normalized
 * - Emits event deltas (no raw state transfer)
 * - Optional proof hashing: per-glyph proof + per-tick proof
 *
 * Schema: MX2LM-PI-KERNEL-v1.0 (FROZEN)
 *
 * @version 1.0.0
 * @license MIT
 */

(function(global) {
  'use strict';

  const PI_KERNEL_VERSION = '1.0.0';

  // ============================================
  // CANONICAL 28 SYMBOL ORDER (7x4)
  // ============================================

  const CANONICAL_ORDER = Object.freeze([
    // Layer 1 - Meta
    'M.I', 'M.U', 'M.G', 'M.M',
    // Layer 2 - Transform
    'T.T', 'T.C', 'T.A', 'T.R',
    // Layer 3 - Operations
    'O.R', 'O.X', 'O.C', 'O.M',
    // Layer 4 - Guard/Safety
    'G.S', 'G.G', 'G.C', 'G.K',
    // Layer 5 - Learning
    'L.P', 'L.S', 'L.Y', 'L.F',
    // Layer 6 - Environment
    'E.T', 'E.S', 'E.P', 'E.M',
    // Layer 7 - Identity
    'I.S', 'I.F', 'I.P', 'I.H'
  ]);

  // ============================================
  // KERNEL NAME MAP (symbol -> kernel)
  // ============================================

  const KERNEL_MAP = Object.freeze({
    'M.I': 'pi.entropy_scan',
    'M.U': 'pi.variance_estimate',
    'M.G': 'pi.vector_align',
    'M.M': 'pi.state_switch',
    'T.T': 'pi.symbol_slice',
    'T.C': 'pi.window_merge',
    'T.A': 'pi.weight_focus',
    'T.R': 'pi.graph_walk',
    'O.R': 'pi.dispatch',
    'O.X': 'pi.execute',
    'O.C': 'pi.scx_fold',
    'O.M': 'pi.state_store',
    'G.S': 'pi.constraint_gate',
    'G.G': 'pi.sequence_emit',
    'G.C': 'pi.error_reduce',
    'G.K': 'pi.lookup',
    'L.P': 'pi.phase_step',
    'L.S': 'pi.capability_gain',
    'L.Y': 'pi.symbol_pack',
    'L.F': 'pi.reward_integrate',
    'E.T': 'pi.io_bridge',
    'E.S': 'pi.simulate',
    'E.P': 'pi.persist',
    'E.M': 'pi.broadcast',
    'I.S': 'pi.boot_mark',
    'I.F': 'pi.hash_identity',
    'I.P': 'pi.bias_apply',
    'I.H': 'pi.signature_emit'
  });

  // ============================================
  // BASIS CONTRACTS (@ -> @@@@)
  // ============================================

  const BASIS_CONTRACTS = Object.freeze({
    '@':    { level: 1, mode: 'observe',  write_state: false, persist: false, emit_proof: false, epoch_lock: false },
    '@@':   { level: 2, mode: 'evaluate', write_state: false, persist: false, emit_proof: true,  epoch_lock: false },
    '@@@':  { level: 3, mode: 'adapt',    write_state: true,  persist: false, emit_proof: true,  epoch_lock: false },
    '@@@@': { level: 4, mode: 'commit',   write_state: true,  persist: true,  emit_proof: true,  epoch_lock: true  }
  });

  // ============================================
  // MATH HELPERS
  // ============================================

  function variance(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, x) => a + x, 0) / arr.length;
    return arr.reduce((a, x) => a + (x - mean) * (x - mean), 0) / arr.length;
  }

  function sum(arr) {
    return arr.reduce((a, x) => a + x, 0);
  }

  function avg(arr) {
    return arr.length > 0 ? sum(arr) / arr.length : 0;
  }

  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // ============================================
  // PI KERNEL ENGINE
  // ============================================

  class PiKernelEngine {
    constructor(opts = {}) {
      // Token stream (default demo tokens)
      this.tokens = opts.tokens || [
        { glyph: '@', w: 1.0 },
        { glyph: '@@', w: 2.0 },
        { glyph: 'π', w: 3.14159 },
        { glyph: 'φ', w: 1.61803 }
      ];

      // Global state
      this.state = {
        entropy: typeof opts.entropy === 'number' ? opts.entropy : 0.32,
        tick: 0n,
        cluster_count: opts.cluster_count ?? 1
      };

      // Cluster state
      this.cluster = {
        cluster_id: opts.cluster_id ?? 1,
        entropy: this.state.entropy,
        reward_bias: typeof opts.reward_bias === 'number' ? opts.reward_bias : 0.1,
        nodes: this._makeNodes28()
      };

      // Basis contracts
      this.bases = BASIS_CONTRACTS;

      // 28 kernels (pure signal functions)
      this.kernels = this._buildKernels();

      // Symbol index: symbol -> node index
      this.symbolIndex = this._buildSymbolIndex();

      // Event log (deltas only)
      this.events = [];

      // Proof generation
      this.proofsEnabled = opts.proofsEnabled ?? (typeof crypto !== 'undefined' && crypto.subtle);
    }

    _makeNodes28() {
      return CANONICAL_ORDER.map((sym, idx) => ({
        id: idx,
        sym: sym,
        activation: 0.0,
        state: 0.0,
        kernel: KERNEL_MAP[sym] || null
      }));
    }

    _buildSymbolIndex() {
      const map = new Map();
      for (const n of this.cluster.nodes) {
        map.set(n.sym, n.id);
      }
      return map;
    }

    _buildKernels() {
      return {
        // Layer 1 - Meta
        'pi.entropy_scan': (node, tokens, st, cl) =>
          st.entropy * (node.activation - node.state),

        'pi.variance_estimate': (node, tokens, st, cl) =>
          variance(tokens.map(t => t.w)) * st.entropy,

        'pi.vector_align': (node, tokens, st, cl) =>
          sum(tokens.map(t => t.w)) * cl.reward_bias,

        'pi.state_switch': (node, tokens, st, cl) =>
          st.entropy > 0.5 ? 1 : -1,

        // Layer 2 - Transform
        'pi.symbol_slice': (node, tokens, st, cl) =>
          tokens.length,

        'pi.window_merge': (node, tokens, st, cl) =>
          sum(tokens.map(t => t.w)),

        'pi.weight_focus': (node, tokens, st, cl) =>
          sum(tokens.map(t => t.w)) * st.entropy,

        'pi.graph_walk': (node, tokens, st, cl) =>
          node.state + sum(tokens.map(t => t.w)),

        // Layer 3 - Operations
        'pi.dispatch': (node, tokens, st, cl) =>
          fnv1a32(tokens.map(t => t.glyph).join('')) % 28,

        'pi.execute': (node, tokens, st, cl) =>
          node.state * st.entropy,

        'pi.scx_fold': (node, tokens, st, cl) =>
          avg(tokens.map(t => t.w)),

        'pi.state_store': (node, tokens, st, cl) =>
          node.state,

        // Layer 4 - Guard/Safety
        'pi.constraint_gate': (node, tokens, st, cl) =>
          Math.min(node.activation, cl.reward_bias),

        'pi.sequence_emit': (node, tokens, st, cl) =>
          tokens.length > 0 ? tokens[Number(st.tick % BigInt(tokens.length))].w : 0,

        'pi.error_reduce': (node, tokens, st, cl) =>
          -Math.abs(node.activation - node.state),

        'pi.lookup': (node, tokens, st, cl) =>
          node.state,

        // Layer 5 - Learning
        'pi.phase_step': (node, tokens, st, cl) =>
          Number(st.tick % 4n),

        'pi.capability_gain': (node, tokens, st, cl) =>
          cl.reward_bias * st.entropy,

        'pi.symbol_pack': (node, tokens, st, cl) =>
          avg(tokens.map(t => t.w)),

        'pi.reward_integrate': (node, tokens, st, cl) =>
          node.state + cl.reward_bias,

        // Layer 6 - Environment
        'pi.io_bridge': (node, tokens, st, cl) =>
          fnv1a32(tokens.map(t => t.glyph).join('')),

        'pi.simulate': (node, tokens, st, cl) =>
          (node.state + st.entropy) / 2,

        'pi.persist': (node, tokens, st, cl) =>
          (node.state + node.activation) / 2,

        'pi.broadcast': (node, tokens, st, cl) =>
          sum(tokens.map(t => t.w)) * (st.cluster_count || 1),

        // Layer 7 - Identity
        'pi.boot_mark': (node, tokens, st, cl) =>
          st.tick === 0n ? 1 : 0,

        'pi.hash_identity': (node, tokens, st, cl) =>
          cl.cluster_id & 0xffff,

        'pi.bias_apply': (node, tokens, st, cl) =>
          node.state * cl.reward_bias,

        'pi.signature_emit': (node, tokens, st, cl) =>
          cl.cluster_id % 256
      };
    }

    /**
     * Bind glyphs from SVG document
     */
    bindGlyphsFromSvg(svgRootOrString) {
      const svg = typeof svgRootOrString === 'string'
        ? new DOMParser().parseFromString(svgRootOrString, 'image/svg+xml').documentElement
        : svgRootOrString;

      const symbols = [...svg.querySelectorAll('symbol[id^="g-"]')];

      for (const symEl of symbols) {
        const symCode = symEl.getAttribute('data-symbol');
        const kernelName = symEl.getAttribute('data-kernel');
        if (!symCode || !kernelName) continue;

        const idx = this.symbolIndex.get(symCode);
        if (idx === undefined) continue;

        const node = this.cluster.nodes[idx];
        node.kernel = kernelName;
      }
    }

    /**
     * Set token stream
     */
    setTokens(tokens) {
      this.tokens = tokens;
    }

    /**
     * Execute one deterministic tick
     */
    async tick(useState = {}) {
      const t0 = this.state.tick;

      // Update cluster entropy snapshot
      this.cluster.entropy = this.state.entropy;

      const deltas = [];

      for (const node of this.cluster.nodes) {
        const kernelName = node.kernel;
        if (!kernelName || !this.kernels[kernelName]) continue;

        const ui = useState[node.sym] || {};
        const basis = ui.basis || '@';
        const basisLaw = this.bases[basis] || this.bases['@'];
        const wScalar = typeof ui.opacity === 'number' ? ui.opacity : 1.0;

        // Optional reward_bias override per node
        const prevReward = this.cluster.reward_bias;
        if (typeof ui.reward_bias === 'number') {
          this.cluster.reward_bias = ui.reward_bias;
        }

        // Compute signal
        const signalRaw = this.kernels[kernelName](node, this.tokens, this.state, this.cluster);
        const signal = signalRaw * wScalar;

        // Update activation (always transient)
        const prevAct = node.activation;
        node.activation = this._f32(node.activation + signal);

        // Basis-gated state writes
        const prevState = node.state;

        if (basisLaw.write_state) {
          if (kernelName === 'pi.state_store') {
            node.state = this._f32(node.activation);
          } else if (kernelName === 'pi.reward_integrate') {
            node.state = this._f32(node.state + this.cluster.reward_bias);
          } else if (kernelName === 'pi.persist') {
            node.state = this._f32((node.state + node.activation) / 2);
          }
        }

        // Restore reward bias
        this.cluster.reward_bias = prevReward;

        // Build delta event
        const ev = {
          tick: t0.toString(),
          sym: node.sym,
          kernel: kernelName,
          basis: basis,
          w: wScalar,
          act_before: prevAct,
          act_after: node.activation,
          state_before: prevState,
          state_after: node.state,
          signal: signal
        };

        // Add proof if enabled
        if (basisLaw.emit_proof && this.proofsEnabled) {
          ev.proof = await this._proofEvent(ev);
        }

        deltas.push(ev);
      }

      // Store event batch
      this.events.push({ tick: t0.toString(), deltas });

      // Advance time
      this.state.tick = t0 + 1n;

      // Tick proof
      let tickProof = null;
      if (this.proofsEnabled) {
        tickProof = await this._proofTick(deltas, t0);
      }

      return { tick: t0, deltas, tickProof };
    }

    /**
     * Get current state snapshot
     */
    getState() {
      return {
        tick: this.state.tick.toString(),
        entropy: this.state.entropy,
        cluster_id: this.cluster.cluster_id,
        nodes: this.cluster.nodes.map(n => ({
          id: n.id,
          sym: n.sym,
          activation: n.activation,
          state: n.state
        }))
      };
    }

    /**
     * Reset engine to initial state
     */
    reset() {
      this.state.tick = 0n;
      for (const node of this.cluster.nodes) {
        node.activation = 0.0;
        node.state = 0.0;
      }
      this.events = [];
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    _f32(x) {
      return Math.round(x * 1e6) / 1e6;
    }

    async _proofEvent(ev) {
      const s = JSON.stringify({
        tick: ev.tick,
        sym: ev.sym,
        kernel: ev.kernel,
        basis: ev.basis,
        w: ev.w,
        a0: ev.act_before,
        a1: ev.act_after,
        s0: ev.state_before,
        s1: ev.state_after,
        signal: ev.signal
      });
      return await this._sha256Hex(s);
    }

    async _proofTick(deltas, tick) {
      const ordered = [...deltas].sort((a, b) => a.sym.localeCompare(b.sym));
      const s = JSON.stringify({
        tick: tick.toString(),
        deltas: ordered.map(d => d.proof || null)
      });
      return await this._sha256Hex(s);
    }

    async _sha256Hex(str) {
      const bytes = new TextEncoder().encode(str);
      const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
      const hashArr = [...new Uint8Array(hashBuf)];
      return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  }

  // ============================================
  // SCXQ2 DICTIONARY GENERATOR
  // ============================================

  async function scxq2DictFromSvg(svgRootOrString) {
    const svg = typeof svgRootOrString === 'string'
      ? new DOMParser().parseFromString(svgRootOrString, 'image/svg+xml').documentElement
      : svgRootOrString;

    const symbols = [...svg.querySelectorAll('symbol[id^="g-"]')];

    const glyphs = [];
    for (const sym of symbols) {
      const id = sym.getAttribute('id') || '';
      const symCode = sym.getAttribute('data-symbol') || '';
      const kernel = sym.getAttribute('data-kernel') || '';
      const layer = sym.getAttribute('data-layer') || '';
      const domain = sym.getAttribute('data-domain') || '';

      // Primary fold path
      const path = sym.querySelector('path');
      const d = path?.getAttribute('d') || '';
      const fold = path?.getAttribute('data-fold') || '';

      const proofHash = await sha256Hex(JSON.stringify({
        id, sym: symCode, kernel, viewBox: sym.getAttribute('viewBox') || '', d
      }));

      glyphs.push({ id, sym: symCode, kernel, layer, domain, d, fold, proofHash });
    }

    // PATH dictionary
    const uniquePaths = new Map();
    for (const g of glyphs) {
      if (!uniquePaths.has(g.d)) uniquePaths.set(g.d, uniquePaths.size);
    }

    // TOKEN dictionary
    const tokenFreq = new Map();
    for (const g of glyphs) {
      const toks = tokenizePathD(g.d);
      for (const t of toks) tokenFreq.set(t, (tokenFreq.get(t) || 0) + 1);
    }

    const frequent = [...tokenFreq.entries()]
      .filter(([, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1]);

    const tokenDict = new Map();
    for (const [tok] of frequent) tokenDict.set(tok, tokenDict.size);

    const SCXQ2 = {
      scxq2: 'SCXQ2_DICT_v1',
      schema: 'MX2LM-SCXQ2-DICT-v1.0',
      generated_at: Date.now(),
      glyph_count: glyphs.length,
      dict: {
        paths: [...uniquePaths.entries()].map(([d, id]) => ({ id, d })),
        tokens: [...tokenDict.entries()].map(([tok, id]) => ({ id, tok }))
      },
      glyphs: glyphs.map(g => ({
        gid: g.id,
        sym: g.sym,
        kernel: g.kernel,
        layer: parseInt(g.layer) || 0,
        domain: g.domain,
        fold: g.fold,
        path_id: uniquePaths.get(g.d),
        proof: g.proofHash,
        tok_ids: tokenizePathD(g.d)
          .map(t => tokenDict.has(t) ? tokenDict.get(t) : null)
          .filter(v => v !== null)
      }))
    };

    return SCXQ2;
  }

  function tokenizePathD(d) {
    const raw = d.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (const chunk of raw) {
      const parts = chunk.match(/[A-Za-z]+|[-+]?\d*\.?\d+/g);
      if (parts) out.push(...parts);
      else out.push(chunk);
    }
    return out;
  }

  async function sha256Hex(str) {
    const bytes = new TextEncoder().encode(str);
    const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
    const hashArr = [...new Uint8Array(hashBuf)];
    return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ============================================
  // EXPORTS
  // ============================================

  const PiKernel = {
    version: PI_KERNEL_VERSION,
    CANONICAL_ORDER,
    KERNEL_MAP,
    BASIS_CONTRACTS,

    Engine: PiKernelEngine,
    scxq2DictFromSvg,
    tokenizePathD,
    sha256Hex,

    // Convenience factory
    create: function(opts) {
      return new PiKernelEngine(opts);
    }
  };

  // Browser/Worker global
  if (typeof self !== 'undefined') {
    self.PiKernel = PiKernel;
    self.PiKernelEngine = PiKernelEngine;
  }

  // CommonJS
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PiKernel;
  }

  // Global
  global.PiKernel = PiKernel;
  global.PiKernelEngine = PiKernelEngine;

  console.log('[PiKernel] v' + PI_KERNEL_VERSION + ' (28 kernels) loaded');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
