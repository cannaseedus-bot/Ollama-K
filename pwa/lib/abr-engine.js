/**
 * ABR (Atomic Block Runtime) Engine v1.0.0
 *
 * Implements ABR_BLACK_CODE_SPEC v1.0.0 (FROZEN)
 *
 * Laws:
 * - Masking: Phase decides what may run
 * - Collapse: Collapse decides what is true
 * - Reward: Reward decides what changes
 * - Phase: Phase algebra governs execution flow
 *
 * This is NOT a node model. ABRs are atomic execution cells.
 * No edges, no messages, no callbacks - only ordered execution.
 */

(function(global) {
  'use strict';

  // ============================================
  // SPEC CONSTANTS (FROZEN)
  // ============================================

  const ABR_SPEC = {
    version: '1.0.0',
    status: 'FROZEN',
    determinism: true,
    randomness: 'forbidden',
    async: 'forbidden',
    abrCount: 28,
    laneCount: 4,
    phaseCount: 6
  };

  // ============================================
  // ENUMS (LOCKED)
  // ============================================

  const DOMAIN = {
    META: 0, CORE: 1, OPS: 2, SAFE: 3, LEARN: 4, ENV: 5, ID: 6
  };

  const ROLE = {
    evidence: 0, proposal: 1, constraint: 2, memory: 3, format: 4, identity: 5
  };

  const LANE = {
    constraint_lane: 0, evidence_lane: 1, proposal_lane: 2, format_lane: 3
  };

  const PHASE = {
    perceive: 0, represent: 1, reason: 2, decide: 3, act: 4, reflect: 5
  };

  const PHASE_ORDER = ['perceive', 'represent', 'reason', 'decide', 'act', 'reflect'];

  // ============================================
  // CONSTANTS (LOCKED)
  // ============================================

  const CONST = {
    alpha: 0.60,    // support weight
    beta: 0.25,     // coherence weight
    gamma: 0.15,    // policy weight
    k1: 0.65,       // reward support
    k2: 0.25,       // reward constraints
    k3: 0.10,       // optional rlhf
    k4: 0.35,       // incoherence penalty
    decay: 0.001,   // bias decay λ
    clampStep: 1,   // max phase steps per tick
    epsilon: 1e-6   // entropy saturation threshold
  };

  // ============================================
  // ABR KEYS (28 - LOCKED)
  // ============================================

  const ABR_KEYS = Object.freeze([
    'introspect', 'uncertainty', 'goal', 'mode',
    'tokenize', 'context', 'attention', 'reason',
    'routing', 'exec', 'compress', 'memory',
    'safety', 'generate', 'correct', 'knowledge',
    'curriculum', 'skill', 'symbolic', 'feedback',
    'tools', 'sandbox', 'state', 'mesh',
    'splash', 'fingerprint', 'persona', 'heraldry'
  ]);

  // ============================================
  // PI KERNELS (28 - LOCKED)
  // ============================================

  const PI_KERNELS = Object.freeze([
    'π.entropy_scan',        // 0
    'π.variance_estimate',   // 1
    'π.vector_align',        // 2
    'π.state_switch',        // 3
    'π.symbol_slice',        // 4
    'π.window_merge',        // 5
    'π.weight_focus',        // 6
    'π.graph_walk',          // 7
    'π.dispatch',            // 8
    'π.execute',             // 9
    'π.scx_fold',            // 10
    'π.state_store',         // 11
    'π.constraint_gate',     // 12
    'π.sequence_emit',       // 13
    'π.error_reduce',        // 14
    'π.lookup',              // 15
    'π.phase_step',          // 16
    'π.capability_gain',     // 17
    'π.symbol_pack',         // 18
    'π.reward_integrate',    // 19
    'π.io_bridge',           // 20
    'π.simulate',            // 21
    'π.persist',             // 22
    'π.broadcast',           // 23
    'π.boot_mark',           // 24
    'π.hash_identity',       // 25
    'π.bias_apply',          // 26
    'π.signature_emit'       // 27
  ]);

  // ============================================
  // ABR PROFILES (IMMUTABLE POLICY)
  // ============================================

  const ABR_PROFILES = Object.freeze([
    { role: 'evidence',   weight: 0.40, veto: false, lane: 'evidence_lane',   domain: 'META' },
    { role: 'evidence',   weight: 0.35, veto: false, lane: 'evidence_lane',   domain: 'META' },
    { role: 'proposal',   weight: 0.35, veto: false, lane: 'proposal_lane',   domain: 'META' },
    { role: 'format',     weight: 0.15, veto: false, lane: 'format_lane',     domain: 'META' },

    { role: 'evidence',   weight: 0.30, veto: false, lane: 'evidence_lane',   domain: 'CORE' },
    { role: 'evidence',   weight: 0.30, veto: false, lane: 'evidence_lane',   domain: 'CORE' },
    { role: 'evidence',   weight: 0.30, veto: false, lane: 'evidence_lane',   domain: 'CORE' },
    { role: 'proposal',   weight: 0.35, veto: false, lane: 'proposal_lane',   domain: 'CORE' },

    { role: 'proposal',   weight: 0.35, veto: false, lane: 'proposal_lane',   domain: 'OPS' },
    { role: 'proposal',   weight: 0.35, veto: false, lane: 'proposal_lane',   domain: 'OPS' },
    { role: 'format',     weight: 0.20, veto: false, lane: 'format_lane',     domain: 'OPS' },
    { role: 'memory',     weight: 0.25, veto: false, lane: 'evidence_lane',   domain: 'OPS' },

    { role: 'constraint', weight: 0.60, veto: true,  lane: 'constraint_lane', domain: 'SAFE' },
    { role: 'proposal',   weight: 0.35, veto: false, lane: 'proposal_lane',   domain: 'SAFE' },
    { role: 'constraint', weight: 0.50, veto: true,  lane: 'constraint_lane', domain: 'SAFE' },
    { role: 'evidence',   weight: 0.30, veto: false, lane: 'evidence_lane',   domain: 'CORE' },

    { role: 'format',     weight: 0.15, veto: false, lane: 'format_lane',     domain: 'LEARN' },
    { role: 'proposal',   weight: 0.25, veto: false, lane: 'proposal_lane',   domain: 'LEARN' },
    { role: 'format',     weight: 0.20, veto: false, lane: 'format_lane',     domain: 'OPS' },
    { role: 'memory',     weight: 0.35, veto: false, lane: 'evidence_lane',   domain: 'LEARN' },

    { role: 'evidence',   weight: 0.25, veto: false, lane: 'evidence_lane',   domain: 'ENV' },
    { role: 'proposal',   weight: 0.30, veto: false, lane: 'proposal_lane',   domain: 'ENV' },
    { role: 'memory',     weight: 0.35, veto: false, lane: 'evidence_lane',   domain: 'ENV' },
    { role: 'format',     weight: 0.10, veto: false, lane: 'format_lane',     domain: 'ENV' },

    { role: 'identity',   weight: 0.10, veto: false, lane: 'format_lane',     domain: 'ID' },
    { role: 'identity',   weight: 0.15, veto: false, lane: 'format_lane',     domain: 'ID' },
    { role: 'identity',   weight: 0.15, veto: false, lane: 'format_lane',     domain: 'ID' },
    { role: 'identity',   weight: 0.15, veto: false, lane: 'format_lane',     domain: 'ID' }
  ]);

  // ============================================
  // PHASE DOMAIN ALLOWLIST (LOCKED)
  // ============================================

  const PHASE_DOMAIN_ALLOW = {
    perceive:  ['CORE', 'OPS', 'ENV'],
    represent: ['CORE', 'OPS'],
    reason:    ['META', 'CORE', 'OPS', 'SAFE'],
    decide:    ['META', 'SAFE', 'OPS'],
    act:       ['OPS', 'ENV', 'ID'],
    reflect:   ['META', 'LEARN', 'ID']
  };

  const PHASE_LANE_ALLOW = {
    perceive:  ['evidence_lane'],
    represent: ['evidence_lane'],
    reason:    ['constraint_lane', 'evidence_lane', 'proposal_lane'],
    decide:    ['constraint_lane', 'proposal_lane', 'format_lane'],
    act:       ['format_lane'],
    reflect:   ['evidence_lane', 'format_lane']
  };

  // ============================================
  // DEFAULT TOKENS
  // ============================================

  const DEFAULT_TOKENS = Object.freeze([
    { glyph: '@',  w: 1.0 },
    { glyph: '@@', w: 2.0 },
    { glyph: 'π',  w: 3.14159 },
    { glyph: 'φ',  w: 1.61803 }
  ]);

  // ============================================
  // ABR ENGINE CLASS
  // ============================================

  class ABREngine {
    constructor(opts = {}) {
      // Cluster configuration
      this.clusterId = (opts.clusterId ?? 1) | 0;
      this.clusterCount = (opts.clusterCount ?? 1) | 0;

      // State
      this.tick = 0;
      this.phase = 'perceive';
      this.entropy = Number.isFinite(opts.entropy) ? +opts.entropy : 0.32;
      this.rewardBias = Number.isFinite(opts.rewardBias) ? +opts.rewardBias : 0.0;
      this.policyHash = opts.policyHash || 'abr:v1:xcfe:lattice_gate';

      // Tokens
      this.tokens = Array.isArray(opts.tokens) && opts.tokens.length
        ? opts.tokens.map(t => ({ glyph: String(t.glyph), w: +t.w }))
        : DEFAULT_TOKENS.map(t => ({ ...t }));

      // Barrier state
      this.barrierOpen = false;
      this.barrierHash = 'h:00000000';

      // Initialize 28 ABRs
      this.blocks = ABR_KEYS.map((key, i) => ({
        id: i,
        key: key,
        kernel: i,
        activation: 0.0,
        state: 0.0,
        bias: 0.0,
        lr: 0.01,
        profile: ABR_PROFILES[i]
      }));

      // Reward fields
      this.R = {
        global: 0.0,
        domain: {
          META: 0.0, CORE: 0.0, OPS: 0.0,
          SAFE: 0.0, LEARN: 0.0, ENV: 0.0, ID: 0.0
        }
      };

      // Event frames (proof log)
      this.frames = [];

      // Collapse state
      this.lastAnswer = null;
      this.lastReward = null;

      // Callbacks
      this.onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : null;
      this.onCollapse = typeof opts.onCollapse === 'function' ? opts.onCollapse : null;
      this.now = typeof opts.now === 'function' ? opts.now : () => Date.now();

      // Scratch (deterministic)
      this._scratch = {
        lastDispatchTarget: 0,
        lastEmitWeight: 0,
        lastSignature: 0
      };

      console.log('[ABREngine] Initialized v' + ABR_SPEC.version);
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    /**
     * Reset engine to initial state
     */
    reset() {
      this.tick = 0;
      this.phase = 'perceive';
      this.barrierOpen = false;
      this.frames = [];
      this.lastAnswer = null;
      this.lastReward = null;

      for (const block of this.blocks) {
        block.activation = 0.0;
        block.state = 0.0;
        block.bias = 0.0;
      }

      this.R.global = 0.0;
      for (const d in this.R.domain) {
        this.R.domain[d] = 0.0;
      }
    }

    /**
     * Run one tick with full ABR pipeline
     */
    step() {
      const nowMs = this.now();
      const events = [];

      // 1. Phase enter
      const phaseEnterEvt = this._emitPhaseEvent('enter');
      events.push(phaseEnterEvt);

      // 2. Derive mask
      const runmask = this._deriveMask();
      const maskEvt = this._emitMaskEvent(runmask);
      events.push(maskEvt);

      // 3. Execute unmasked ABRs in order 0..27
      for (let i = 0; i < 28; i++) {
        if (!runmask[i]) continue;

        const block = this.blocks[i];
        const { signal, blockAfter } = this._runKernel(block);

        // Apply update
        block.activation = blockAfter.activation;
        block.state = blockAfter.state;

        // Emit proof event
        const proofEvt = this._emitProofEvent(block, signal);
        events.push(proofEvt);
        this.frames.push(proofEvt);

        if (this.onEvent) this.onEvent(proofEvt);
      }

      // 4. Phase exit
      const phaseExitEvt = this._emitPhaseEvent('exit');
      events.push(phaseExitEvt);

      // 5. Collapse if at decide.exit
      if (this.phase === 'decide') {
        const answer = this._collapseAnswer(events);
        if (answer) {
          this.lastAnswer = answer;
          events.push(answer);
          if (this.onCollapse) this.onCollapse(answer);
        }
      }

      // 6. Reward commit if at reflect.exit
      if (this.phase === 'reflect') {
        const reward = this._commitReward(events);
        if (reward) {
          this.lastReward = reward;
          events.push(reward);
        }
      }

      // 7. Advance phase
      this._advancePhase();

      // 8. Increment tick
      this.tick++;

      return events;
    }

    /**
     * Update engine state
     */
    setState(patch) {
      if (Number.isFinite(patch.entropy)) this.entropy = +patch.entropy;
      if (Number.isFinite(patch.rewardBias)) this.rewardBias = +patch.rewardBias;
      if (Number.isFinite(patch.clusterCount)) this.clusterCount = patch.clusterCount | 0;
    }

    /**
     * Set tokens
     */
    setTokens(tokens) {
      if (!Array.isArray(tokens) || !tokens.length) return;
      this.tokens = tokens.map(t => ({ glyph: String(t.glyph), w: +t.w }));
    }

    /**
     * Get current mask as array
     */
    getMask() {
      return this._deriveMask();
    }

    /**
     * Get block by id or key
     */
    getBlock(idOrKey) {
      if (typeof idOrKey === 'number') {
        return this.blocks[idOrKey] || null;
      }
      return this.blocks.find(b => b.key === idOrKey) || null;
    }

    // ==========================================
    // MASKING LAW
    // ==========================================

    /**
     * Derive mask based on phase and ABR profiles
     * Returns boolean[28] where true = execute
     */
    _deriveMask() {
      const mask = new Array(28).fill(false);
      const allowedDomains = PHASE_DOMAIN_ALLOW[this.phase] || [];
      const allowedLanes = PHASE_LANE_ALLOW[this.phase] || [];

      for (let i = 0; i < 28; i++) {
        const profile = ABR_PROFILES[i];

        // Check domain allowed
        const domainAllowed = allowedDomains.includes(profile.domain);

        // Check lane allowed
        const laneAllowed = allowedLanes.includes(profile.lane);

        // Check masking conditions
        const block = this.blocks[i];

        // Entropy saturation check
        const deltaSignal = Math.abs(block.activation - block.state);
        const entropySaturated = deltaSignal < CONST.epsilon;

        // State fixpoint check
        const isFixpoint = block.activation === block.state &&
                          this.tick > 0 &&
                          this._prevActivation?.[i] === block.activation;

        // Mandatory masking rules
        if (i === 24 && this.tick > 0) continue; // π.boot_mark only at tick 0
        if (i === 27 && !this.lastAnswer) continue; // π.signature_emit only after collapse

        // Apply mask
        mask[i] = domainAllowed && laneAllowed && !entropySaturated && !isFixpoint;
      }

      // Store for fixpoint detection
      this._prevActivation = this.blocks.map(b => b.activation);

      return mask;
    }

    // ==========================================
    // PHASE ALGEBRA
    // ==========================================

    _advancePhase() {
      const idx = PHASE_ORDER.indexOf(this.phase);
      const nextIdx = (idx + CONST.clampStep) % PHASE_ORDER.length;
      this.phase = PHASE_ORDER[nextIdx];
    }

    // ==========================================
    // COLLAPSE RULE
    // ==========================================

    _collapseAnswer(events) {
      // Collect verified proof events from this tick
      const proofs = events.filter(e => e['@type'] === '⚡' && e.verified);
      if (!proofs.length) return null;

      // Separate by lane
      const constraints = proofs.filter(e => e.lane === 'constraint_lane');
      const evidence = proofs.filter(e => e.lane === 'evidence_lane');
      const proposals = proofs.filter(e => e.lane === 'proposal_lane');

      // Check constraint veto
      const vetoFailed = constraints.some(c => c.signal < 0);
      if (vetoFailed) return null;

      // Compute evidence hash
      const evidenceHashes = evidence.map(e => e.outputs_hash).sort();
      const H_E = this._hashHex(this._canon(evidenceHashes));

      // Score proposals
      let bestProposal = null;
      let bestScore = -Infinity;

      for (const p of proposals) {
        // Support score: how many evidence hashes this proposal references
        const supportCount = evidence.filter(e =>
          Math.abs(e.signal - p.signal) < 1.0
        ).length;
        const S_support = supportCount / Math.max(1, evidence.length);

        // Coherence score (entropy-based)
        const S_cohere = 1 - Math.min(1, Math.abs(this.entropy - 0.5));

        // Policy weight
        const S_policy = ABR_PROFILES[p.abr_id].weight;

        // Final score
        const score = CONST.alpha * S_support +
                     CONST.beta * S_cohere +
                     CONST.gamma * S_policy;

        if (score > bestScore) {
          bestScore = score;
          bestProposal = p;
        }
      }

      if (!bestProposal) return null;

      // Build answer block
      const answer = {
        '@type': 'abr.answer',
        '@tick': this.tick,
        '@evidence_hash': H_E,
        '@proposal_hash': bestProposal.outputs_hash,
        '@policy_hash': this.policyHash,
        '@content': {
          signal: bestProposal.signal,
          abr_key: bestProposal.abr_key,
          score: bestScore
        },
        '@proof': this._hashHex(this._canon({
          H_E,
          proposal: bestProposal.outputs_hash,
          policy: this.policyHash
        }))
      };

      return answer;
    }

    // ==========================================
    // REWARD PROPAGATION (EDGE-FREE)
    // ==========================================

    _commitReward(events) {
      if (!this.lastAnswer) return null;

      const proofs = events.filter(e => e['@type'] === '⚡' && e.verified);

      // Compute reward from collapse outcome
      const supportScore = 0.5; // Simplified
      const constraintScore = 1.0; // Passed veto

      const r = CONST.k1 * supportScore +
               CONST.k2 * constraintScore -
               CONST.k4 * Math.abs(this.entropy - 0.5);

      this.R.global = r;

      // Participation attribution
      const credits = [];
      let totalWeight = 0;

      for (const p of proofs) {
        const profile = ABR_PROFILES[p.abr_id];
        const novelty = (p.signal !== 0) ? 1 : 0;
        const w = profile.weight * (1 + novelty);
        totalWeight += w;
        credits.push({ abr_id: p.abr_id, weight: w });
      }

      // Update biases
      for (const c of credits) {
        const credit = (c.weight / Math.max(1, totalWeight)) * r;
        const block = this.blocks[c.abr_id];
        block.bias += block.lr * credit;
        block.bias *= (1 - CONST.decay);
      }

      // Build reward block
      const creditsHash = this._hashHex(this._canon(
        credits.map(c => [c.abr_id, c.weight]).sort((a, b) => a[0] - b[0])
      ));

      return {
        '@type': 'abr.reward',
        '@tick': this.tick,
        '@reward': r,
        '@credits_hash': creditsHash,
        '@evidence_hash': this.lastAnswer['@evidence_hash'],
        '@proposal_hash': this.lastAnswer['@proposal_hash'],
        '@policy_hash': this.policyHash,
        '@proof': this._hashHex(this._canon({ r, creditsHash, policy: this.policyHash }))
      };
    }

    // ==========================================
    // PI MICRO-KERNELS (28)
    // ==========================================

    _runKernel(block) {
      const n = { ...block };
      const t = this.tokens;
      const sumW = this._sumWeights(t);
      const avgW = t.length ? (sumW / t.length) : 0.0;
      const varW = this._varWeights(t);
      const effectiveBias = this.rewardBias + n.bias;

      let signal = 0.0;

      switch (n.kernel | 0) {
        // Layer 1 — Meta-Cognition
        case 0: // π.entropy_scan
          signal = this.entropy * (n.activation - n.state);
          n.activation += signal;
          break;

        case 1: // π.variance_estimate
          signal = varW * this.entropy;
          n.activation += signal;
          break;

        case 2: // π.vector_align
          signal = effectiveBias * sumW;
          n.activation += signal;
          break;

        case 3: // π.state_switch
          signal = (this.entropy > 0.5) ? 1.0 : -1.0;
          n.activation += signal;
          break;

        // Layer 2 — Core Transformer
        case 4: // π.symbol_slice
          signal = t.length;
          n.activation += signal;
          break;

        case 5: // π.window_merge
          signal = sumW;
          n.activation += signal;
          break;

        case 6: // π.weight_focus
          signal = sumW * this.entropy;
          n.activation += signal;
          break;

        case 7: // π.graph_walk
          signal = n.state + sumW;
          n.activation += signal;
          break;

        // Layer 3 — Operational
        case 8: // π.dispatch
          const h = this._hashU32(this._canon(t.map(x => x.glyph)));
          const target = (h % 28) | 0;
          this._scratch.lastDispatchTarget = target;
          signal = target;
          n.activation += signal;
          break;

        case 9: // π.execute
          signal = n.state * this.entropy;
          n.activation += signal;
          break;

        case 10: // π.scx_fold
          signal = avgW;
          n.activation += signal;
          break;

        case 11: // π.state_store
          n.state = n.activation;
          signal = n.state;
          break;

        // Layer 4 — Safety & Generative
        case 12: // π.constraint_gate
          signal = Math.min(n.activation, effectiveBias);
          n.activation += signal;
          break;

        case 13: // π.sequence_emit
          const idx = t.length ? (this.tick % t.length) : 0;
          const w = t.length ? t[idx].w : 0.0;
          this._scratch.lastEmitWeight = w;
          signal = w;
          n.activation += signal;
          break;

        case 14: // π.error_reduce
          signal = -Math.abs(n.activation - n.state);
          n.activation += signal;
          break;

        case 15: // π.lookup
          signal = n.state;
          n.activation += signal;
          break;

        // Layer 5 — Learning & Adaptation
        case 16: // π.phase_step
          signal = (this.tick % 4) | 0;
          n.activation += signal;
          break;

        case 17: // π.capability_gain
          signal = effectiveBias * this.entropy;
          n.activation += signal;
          break;

        case 18: // π.symbol_pack
          signal = avgW;
          n.activation += signal;
          break;

        case 19: // π.reward_integrate
          n.state = n.state + effectiveBias;
          signal = n.state;
          break;

        // Layer 6 — Execution-Environment
        case 20: // π.io_bridge
          signal = this._hashU32(this._canon(t.map(x => x.glyph))) >>> 0;
          n.activation += signal;
          break;

        case 21: // π.simulate
          signal = (n.state + this.entropy) / 2.0;
          n.activation += signal;
          break;

        case 22: // π.persist
          n.state = (n.state + n.activation) / 2.0;
          signal = n.state;
          break;

        case 23: // π.broadcast
          signal = sumW * (this.clusterCount | 0);
          n.activation += signal;
          break;

        // Layer 7 — Identity & Ritual
        case 24: // π.boot_mark
          signal = (this.tick === 0) ? 1.0 : 0.0;
          n.activation += signal;
          break;

        case 25: // π.hash_identity
          signal = this._hashU32(String(this.clusterId)) >>> 0;
          n.activation += signal;
          break;

        case 26: // π.bias_apply
          signal = n.state * effectiveBias;
          n.activation += signal;
          break;

        case 27: // π.signature_emit
          const sig = (this.clusterId % 256) | 0;
          this._scratch.lastSignature = sig;
          signal = sig;
          n.activation += signal;
          break;

        default:
          signal = 0.0;
      }

      // Clamp to finite
      n.activation = this._finite(n.activation);
      n.state = this._finite(n.state);
      signal = this._finite(signal);

      return { signal, blockAfter: n };
    }

    // ==========================================
    // PROOF EVENT EMISSION
    // ==========================================

    _emitProofEvent(block, signal) {
      const profile = ABR_PROFILES[block.id];

      const inputs = {
        v: ABR_SPEC.version,
        cluster_id: this.clusterId,
        tick: this.tick,
        abr_id: block.id,
        kernel_id: block.kernel,
        entropy: this._f32(this.entropy),
        reward_bias: this._f32(this.rewardBias + block.bias),
        tokens: this.tokens.map(t => [t.glyph, this._f32(t.w)])
      };

      const outputs = {
        signal: this._f32(signal),
        activation: this._f32(block.activation),
        state: this._f32(block.state)
      };

      const inputsHash = this._hashHex(this._canon(inputs));
      const outputsHash = this._hashHex(this._canon(outputs));
      const proofPayload = {
        '@type': '⚡',
        inputs_hash: inputsHash,
        outputs_hash: outputsHash,
        policy_hash: this.policyHash
      };
      const proofHash = this._hashHex(this._canon(proofPayload));

      return {
        '@type': '⚡',
        version: ABR_SPEC.version,
        tick: this.tick,
        phase: this.phase,
        abr_id: block.id,
        abr_key: block.key,
        kernel_id: block.kernel,
        kernel_name: PI_KERNELS[block.kernel],
        domain: profile.domain,
        lane: profile.lane,
        signal: this._f32(signal),
        activation: this._f32(block.activation),
        state: this._f32(block.state),
        entropy: this._f32(this.entropy),
        reward_bias: this._f32(this.rewardBias + block.bias),
        inputs_hash: inputsHash,
        outputs_hash: outputsHash,
        policy_hash: this.policyHash,
        proof_hash: proofHash,
        verified: true
      };
    }

    _emitPhaseEvent(mode) {
      return {
        '@type': 'abr.phase',
        '@tick': this.tick,
        '@enter': mode === 'enter' ? this.phase : null,
        '@exit': mode === 'exit' ? this.phase : null,
        '@barrier': this.barrierHash,
        '@policy_hash': this.policyHash,
        '@proof': this._hashHex(this._canon({
          tick: this.tick, phase: this.phase, mode, policy: this.policyHash
        }))
      };
    }

    _emitMaskEvent(runmask) {
      // Convert boolean array to u32 bitmask
      let u32 = 0;
      for (let i = 0; i < 28; i++) {
        if (runmask[i]) u32 |= (1 << i);
      }

      return {
        '@type': 'abr.mask',
        '@tick': this.tick,
        '@phase': this.phase,
        '@runmask_u32': u32,
        '@policy_hash': this.policyHash,
        '@proof': this._hashHex(this._canon({
          tick: this.tick, phase: this.phase, runmask: u32
        }))
      };
    }

    // ==========================================
    // MATH UTILITIES
    // ==========================================

    _finite(x) {
      x = +x;
      return Number.isFinite(x) ? x : 0.0;
    }

    _f32(x) {
      x = +x;
      if (!Number.isFinite(x)) return 0.0;
      return Math.round(x * 1e6) / 1e6;
    }

    _sumWeights(tokens) {
      let s = 0.0;
      for (let i = 0; i < tokens.length; i++) s += +tokens[i].w;
      return this._finite(s);
    }

    _varWeights(tokens) {
      const n = tokens.length;
      if (!n) return 0.0;
      const mean = this._sumWeights(tokens) / n;
      let v = 0.0;
      for (let i = 0; i < n; i++) {
        const d = (+tokens[i].w) - mean;
        v += d * d;
      }
      return this._finite(v / n);
    }

    // ==========================================
    // HASH UTILITIES
    // ==========================================

    _canon(obj) {
      return ABREngine._stableStringify(obj);
    }

    _hashU32(str) {
      const s = String(str);
      let h = 0x811c9dc5;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      return h >>> 0;
    }

    _hashHex(str) {
      const h = this._hashU32(str);
      return 'h:' + h.toString(16).padStart(8, '0');
    }

    static _stableStringify(value) {
      const seen = new Set();
      const walk = (v) => {
        if (v === null) return 'null';
        const t = typeof v;
        if (t === 'number') {
          if (!Number.isFinite(v)) return '0';
          return String(v);
        }
        if (t === 'boolean') return v ? 'true' : 'false';
        if (t === 'string') return JSON.stringify(v);
        if (Array.isArray(v)) {
          return '[' + v.map(walk).join(',') + ']';
        }
        if (t === 'object') {
          if (seen.has(v)) return '"[circular]"';
          seen.add(v);
          const keys = Object.keys(v).sort();
          const body = keys.map(k => JSON.stringify(k) + ':' + walk(v[k])).join(',');
          seen.delete(v);
          return '{' + body + '}';
        }
        return '""';
      };
      return walk(value);
    }
  }

  // ============================================
  // SCXQ2 BINARY ENCODER
  // ============================================

  const SCXQ2 = {
    MAGIC: 'ABR1',
    VERSION: 1,

    /**
     * Encode ABR state and frames to binary
     */
    encode: function(engine) {
      const sections = [];

      // HEAD section
      const head = new ArrayBuffer(16);
      const headView = new DataView(head);
      // Magic
      for (let i = 0; i < 4; i++) {
        headView.setUint8(i, this.MAGIC.charCodeAt(i));
      }
      headView.setUint16(4, this.VERSION, true);
      headView.setUint16(6, 0, true); // flags
      headView.setUint16(8, 6, true); // section count
      sections.push(head);

      // ABR TABLE section (28 * 32 bytes = 896 bytes)
      const abrTable = new ArrayBuffer(28 * 32);
      const abrView = new DataView(abrTable);

      for (let i = 0; i < 28; i++) {
        const block = engine.blocks[i];
        const profile = ABR_PROFILES[i];
        const offset = i * 32;

        abrView.setUint8(offset + 0, block.id);
        abrView.setUint8(offset + 1, block.kernel);
        abrView.setUint8(offset + 2, DOMAIN[profile.domain] || 0);
        abrView.setUint8(offset + 3, LANE[profile.lane] || 0);
        abrView.setUint8(offset + 4, ROLE[profile.role] || 0);
        abrView.setUint8(offset + 5, profile.veto ? 1 : 0);
        abrView.setUint16(offset + 6, 0, true); // reserved
        abrView.setFloat32(offset + 8, block.activation, true);
        abrView.setFloat32(offset + 12, block.state, true);
        abrView.setFloat32(offset + 16, block.bias, true);
        abrView.setFloat32(offset + 20, block.lr, true);
        abrView.setUint32(offset + 24, engine._hashU32(block.key), true);
      }
      sections.push(abrTable);

      // Combine all sections
      const totalLen = sections.reduce((s, b) => s + b.byteLength, 0);
      const result = new Uint8Array(totalLen);
      let offset = 0;
      for (const section of sections) {
        result.set(new Uint8Array(section), offset);
        offset += section.byteLength;
      }

      return result;
    },

    /**
     * Decode binary to ABR state
     */
    decode: function(buffer) {
      const view = new DataView(buffer.buffer || buffer);

      // Verify magic
      const magic = String.fromCharCode(
        view.getUint8(0), view.getUint8(1),
        view.getUint8(2), view.getUint8(3)
      );
      if (magic !== this.MAGIC) {
        throw new Error('Invalid ABR binary: bad magic');
      }

      const version = view.getUint16(4, true);
      const blocks = [];

      // Read ABR table (starts at offset 16)
      for (let i = 0; i < 28; i++) {
        const offset = 16 + (i * 32);
        blocks.push({
          id: view.getUint8(offset + 0),
          kernel: view.getUint8(offset + 1),
          domain: view.getUint8(offset + 2),
          lane: view.getUint8(offset + 3),
          role: view.getUint8(offset + 4),
          veto: view.getUint8(offset + 5) === 1,
          activation: view.getFloat32(offset + 8, true),
          state: view.getFloat32(offset + 12, true),
          bias: view.getFloat32(offset + 16, true),
          lr: view.getFloat32(offset + 20, true),
          keyHash: view.getUint32(offset + 24, true)
        });
      }

      return { version, blocks };
    }
  };

  // ============================================
  // EXPORTS
  // ============================================

  global.ABREngine = ABREngine;
  global.ABR_SPEC = ABR_SPEC;
  global.ABR_KEYS = ABR_KEYS;
  global.PI_KERNELS = PI_KERNELS;
  global.ABR_PROFILES = ABR_PROFILES;
  global.SCXQ2 = SCXQ2;

  // CommonJS export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ABREngine, ABR_SPEC, ABR_KEYS, PI_KERNELS, ABR_PROFILES, SCXQ2 };
  }

  console.log('[ABREngine] ABR Black Code Spec v' + ABR_SPEC.version + ' loaded');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
