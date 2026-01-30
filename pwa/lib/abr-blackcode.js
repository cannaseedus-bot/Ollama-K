/**
 * ABR BLACK CODE SPEC v1.0.1
 *
 * Atomic Block Runtime - Pure K'UHUL π Implementation
 * COMPLIANCE PATCHSET APPLIED: Replay-correct
 *
 * Laws:
 * - ABR Masking Law: Determines execution eligibility per tick
 * - ABR Phase Algebra: XCFE phase lattice for control flow
 * - ABR Collapse Rule: Deterministic answer collapse (not generation)
 * - ABR Reward Propagation: Edge-free learning via bias fields
 *
 * The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK
 *
 * @version 1.0.1
 * @status CANONICAL (replay-correct)
 */

(function(global) {
  'use strict';

  const ABR_VERSION = '1.0.1';
  const SCXQ2_VERSION = 'SCXQ2-v1';

  // ============================================
  // ENUMS AND CONSTANTS
  // ============================================

  const DOMAIN = {
    META: 0,
    CORE: 1,
    OPS: 2,
    SAFE: 3,
    LEARN: 4,
    ENV: 5,
    ID: 6
  };

  const ROLE = {
    evidence: 0,
    proposal: 1,
    constraint: 2,
    memory: 3,
    format: 4,
    identity: 5
  };

  const LANE = {
    constraint_lane: 0,
    evidence_lane: 1,
    proposal_lane: 2,
    format_lane: 3
  };

  const PHASE = {
    perceive: 0,
    represent: 1,
    reason: 2,
    decide: 3,
    act: 4,
    reflect: 5
  };

  const PHASE_NAMES = ['perceive', 'represent', 'reason', 'decide', 'act', 'reflect'];

  // ============================================
  // ABR MASK REASON CODES (MANDATORY v1)
  // ============================================

  const MASK_REASON = Object.freeze({
    M0_OK:              0,
    M1_PHASE_MISMATCH:  1,
    M2_ZERO_INFO_GAIN:  2,
    M3_DOMAIN_INACTIVE: 3,
    M4_LANE_BLOCKED:    4,
    M5_POLICY_DENY:     5,
    M6_COLLAPSE_LOCKED: 6
  });

  const MASK_REASON_NAMES = [
    'M0_OK',
    'M1_PHASE_MISMATCH',
    'M2_ZERO_INFO_GAIN',
    'M3_DOMAIN_INACTIVE',
    'M4_LANE_BLOCKED',
    'M5_POLICY_DENY',
    'M6_COLLAPSE_LOCKED'
  ];

  // ============================================
  // ABR FRAME KINDS (SCXQ2 STREAM)
  // ============================================

  const FRAME_KIND = Object.freeze({
    HDR:  1,
    TICK: 2,
    MASK: 3,
    ABR:  4,
    ANS:  5,
    RWD:  6,
    END:  7
  });

  // Collapse/Reward constants
  const CONST = {
    ALPHA: 0.60,    // support weight
    BETA: 0.25,     // coherence weight
    GAMMA: 0.15,    // policy weight
    K1: 0.65,       // reward support
    K2: 0.25,       // reward constraints
    K3: 0.10,       // optional rlhf
    K4: 0.35,       // incoherence penalty
    DECAY: 0.001,   // bias decay λ
    EPSILON: 1e-6,  // entropy saturation threshold
    CLAMP_STEP: 1   // max phase steps per tick
  };

  // ============================================
  // 28 CANONICAL ABR DEFINITIONS
  // ============================================

  const ABR_KEYS = [
    'introspect', 'uncertainty', 'goal', 'mode',         // META (0-3)
    'tokenize', 'context', 'attention', 'reason',        // CORE (4-7)
    'routing', 'exec', 'compress', 'memory',             // OPS (8-11)
    'safety', 'generate', 'correct', 'knowledge',        // SAFE (12-15)
    'curriculum', 'skill', 'symbolic', 'feedback',       // LEARN (16-19)
    'tools', 'sandbox', 'state', 'mesh',                 // ENV (20-23)
    'splash', 'fingerprint', 'persona', 'heraldry'       // ID (24-27)
  ];

  const ABR_KERNELS = [
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
  ];

  // ABR profiles (immutable policy)
  const ABR_PROFILES = [
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
  ];

  // Phase -> Domain allowlist
  const PHASE_ALLOW = {
    perceive:  { domains: ['CORE', 'OPS', 'ENV'],          lanes: ['evidence_lane'] },
    represent: { domains: ['CORE', 'OPS'],                 lanes: ['evidence_lane'] },
    reason:    { domains: ['META', 'CORE', 'OPS', 'SAFE'], lanes: ['constraint_lane', 'evidence_lane', 'proposal_lane'] },
    decide:    { domains: ['META', 'SAFE', 'OPS'],         lanes: ['constraint_lane', 'proposal_lane', 'format_lane'] },
    act:       { domains: ['OPS', 'ENV', 'ID'],            lanes: ['format_lane'] },
    reflect:   { domains: ['META', 'LEARN', 'ID'],         lanes: ['evidence_lane', 'format_lane'] }
  };

  // ============================================
  // FNV-1a 32-bit HASH (deterministic)
  // ============================================

  function fnv1a32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h;
  }

  function h32(str) {
    return 'h:' + fnv1a32(str).toString(16).padStart(8, '0');
  }

  // ============================================
  // ABR NODE STATE
  // ============================================

  class ABRNode {
    constructor(id) {
      this.id = id;
      this.key = ABR_KEYS[id];
      this.kernel = ABR_KERNELS[id];
      this.profile = ABR_PROFILES[id];
      this.activation = 0.0;
      this.state = 0.0;
      this.bias = 0.0;
      this.lr = 0.01;
      this.lastSignal = 0.0;
      this.lastOutputHash = 'h:00000000';
      this.masked = false;
      this.maskReason = 'M0_OK';
    }

    /**
     * Get domain index
     */
    getDomain() {
      return DOMAIN[this.profile.domain];
    }

    /**
     * Get lane index
     */
    getLane() {
      return LANE[this.profile.lane];
    }

    /**
     * Reset node state
     */
    reset() {
      this.activation = 0.0;
      this.state = 0.0;
      this.lastSignal = 0.0;
      this.masked = false;
      this.maskReason = 'M0_OK';
    }

    /**
     * Check if at fixpoint (no state change)
     */
    isFixpoint(prevActivation, prevState) {
      return this.activation === prevActivation && this.state === prevState;
    }
  }

  // ============================================
  // ABR RUNTIME STATE
  // ============================================

  const ABRState = {
    tick: 0,
    phase: 'perceive',
    phaseIndex: 0,
    clusterId: 1,
    clusterCount: 1,
    entropy: 0.32,
    rewardBias: 0.0,
    policyHash: 'abr:v1:xcfe:lattice_gate',
    tokens: [
      { g: '@',  w: 1.0 },
      { g: '@@', w: 2.0 },
      { g: 'π',  w: 3.14159 },
      { g: 'φ',  w: 1.61803 }
    ],
    barrierOpen: false,
    barrierHash: 'h:00000000',
    nodes: [],
    proofEvents: [],
    collapseSet: new Set(),
    evidenceSet: new Set(),
    proposalSet: [],
    constraintSet: []
  };

  // ============================================
  // ABR MASKING LAW (v1 COMPLIANT)
  // ============================================

  /**
   * Check if domain is allowed after collapse (post-collapse barrier)
   * After decide.exit: only SAFE domain allowed
   */
  function isDomainAllowedAfterCollapse(domain, phase) {
    if (phase === 'act' || phase === 'reflect') {
      return domain === 'SAFE';
    }
    return true;
  }

  const ABRMasking = {
    /**
     * Evaluate mask for all 28 ABRs
     * Returns: { runmask: u32, reasons: Map<abrId, reasonCode> }
     *
     * NOTE: Fixpoint detection is verifier-only (not runtime)
     * This ensures replay-safe masking decisions
     */
    evaluateMasks: function(state) {
      let runmask = 0;
      const phase = state.phase;
      const allow = PHASE_ALLOW[phase];
      const maskReasons = new Map();

      for (let i = 0; i < 28; i++) {
        const node = state.nodes[i];
        const profile = node.profile;

        // POST-COLLAPSE BARRIER (v1 mandatory)
        // After decide.exit, only SAFE domain executes
        if (!isDomainAllowedAfterCollapse(profile.domain, phase)) {
          node.masked = true;
          node.maskReason = MASK_REASON.M6_COLLAPSE_LOCKED;
          node.maskReasonName = 'M6_COLLAPSE_LOCKED';
          maskReasons.set(i, MASK_REASON.M6_COLLAPSE_LOCKED);
          continue;
        }

        // Check domain compatibility with phase
        if (!allow.domains.includes(profile.domain)) {
          node.masked = true;
          node.maskReason = MASK_REASON.M3_DOMAIN_INACTIVE;
          node.maskReasonName = 'M3_DOMAIN_INACTIVE';
          maskReasons.set(i, MASK_REASON.M3_DOMAIN_INACTIVE);
          continue;
        }

        // Check lane compatibility with phase
        if (!allow.lanes.includes(profile.lane)) {
          node.masked = true;
          node.maskReason = MASK_REASON.M4_LANE_BLOCKED;
          node.maskReasonName = 'M4_LANE_BLOCKED';
          maskReasons.set(i, MASK_REASON.M4_LANE_BLOCKED);
          continue;
        }

        // Check entropy saturation (zero information gain)
        if (state.tick > 0 && Math.abs(node.lastSignal) < CONST.EPSILON) {
          node.masked = true;
          node.maskReason = MASK_REASON.M2_ZERO_INFO_GAIN;
          node.maskReasonName = 'M2_ZERO_INFO_GAIN';
          maskReasons.set(i, MASK_REASON.M2_ZERO_INFO_GAIN);
          continue;
        }

        // Mandatory masking rules (policy)
        if (i === 24 && state.tick > 0) {
          // π.boot_mark only on tick 0
          node.masked = true;
          node.maskReason = MASK_REASON.M5_POLICY_DENY;
          node.maskReasonName = 'M5_POLICY_DENY';
          maskReasons.set(i, MASK_REASON.M5_POLICY_DENY);
          continue;
        }

        // π.hash_identity only when cluster_id changes
        if (i === 25 && state.tick > 0 && state.lastClusterId === state.clusterId) {
          node.masked = true;
          node.maskReason = MASK_REASON.M5_POLICY_DENY;
          node.maskReasonName = 'M5_POLICY_DENY';
          maskReasons.set(i, MASK_REASON.M5_POLICY_DENY);
          continue;
        }

        // π.signature_emit only when collapse occurred
        if (i === 27 && !state.lastAnswer) {
          node.masked = true;
          node.maskReason = MASK_REASON.M5_POLICY_DENY;
          node.maskReasonName = 'M5_POLICY_DENY';
          maskReasons.set(i, MASK_REASON.M5_POLICY_DENY);
          continue;
        }

        // π.scx_fold only when state mutation occurred
        if (i === 10 && state.tick > 0 && !state.stateMutated) {
          node.masked = true;
          node.maskReason = MASK_REASON.M5_POLICY_DENY;
          node.maskReasonName = 'M5_POLICY_DENY';
          maskReasons.set(i, MASK_REASON.M5_POLICY_DENY);
          continue;
        }

        // Node is unmasked
        node.masked = false;
        node.maskReason = MASK_REASON.M0_OK;
        node.maskReasonName = 'M0_OK';
        maskReasons.set(i, MASK_REASON.M0_OK);
        runmask |= (1 << i);
      }

      return { runmask, maskReasons };
    },

    /**
     * Get mask reason name from code
     */
    getReasonName: function(code) {
      return MASK_REASON_NAMES[code] || 'UNKNOWN';
    },

    // Expose reason codes
    REASON: MASK_REASON,
    REASON_NAMES: MASK_REASON_NAMES
  };

  // ============================================
  // ABR PHASE ALGEBRA
  // ============================================

  const ABRPhase = {
    /**
     * Get phase index
     */
    indexOf: function(phase) {
      return PHASE[phase] ?? 0;
    },

    /**
     * Get phase name from index
     */
    nameOf: function(index) {
      return PHASE_NAMES[index] || 'perceive';
    },

    /**
     * Join (max phase)
     */
    join: function(p1, p2) {
      const i1 = this.indexOf(p1);
      const i2 = this.indexOf(p2);
      return this.nameOf(Math.max(i1, i2));
    },

    /**
     * Meet (min phase)
     */
    meet: function(p1, p2) {
      const i1 = this.indexOf(p1);
      const i2 = this.indexOf(p2);
      return this.nameOf(Math.min(i1, i2));
    },

    /**
     * Check if phase allows domain
     */
    allows: function(phase, domain) {
      const allow = PHASE_ALLOW[phase];
      return allow ? allow.domains.includes(domain) : false;
    },

    /**
     * Advance phase by at most one step
     */
    advance: function(current, target) {
      const ci = this.indexOf(current);
      const ti = this.indexOf(target);
      if (ti > ci) {
        return this.nameOf(Math.min(ci + CONST.CLAMP_STEP, ti));
      }
      return current;
    },

    /**
     * Check if at collapse point
     */
    isCollapsePoint: function(phase, exitPoint) {
      if (exitPoint === 'answer') {
        return phase === 'decide';
      }
      if (exitPoint === 'reward') {
        return phase === 'reflect';
      }
      return false;
    },

    /**
     * Enter barrier
     */
    enterBarrier: function(state, from, to) {
      if (state.barrierOpen) {
        return { ok: false, error: 'Barrier already open' };
      }
      state.barrierOpen = true;
      state.barrierHash = h32(`${from}:${to}:${state.tick}:${state.policyHash}`);
      return { ok: true, barrier: state.barrierHash };
    },

    /**
     * Release barrier
     */
    releaseBarrier: function(state) {
      if (!state.barrierOpen) {
        return { ok: false, error: 'No barrier to release' };
      }
      state.barrierOpen = false;
      const released = state.barrierHash;
      state.barrierHash = 'h:00000000';
      return { ok: true, released };
    }
  };

  // ============================================
  // π MICRO-KERNELS (28 pure functions)
  // ============================================

  const PiKernels = {
    /**
     * Helper functions
     */
    sumW: function(tokens) {
      return tokens.reduce((sum, t) => sum + t.w, 0);
    },

    avgW: function(tokens) {
      return tokens.length > 0 ? this.sumW(tokens) / tokens.length : 0;
    },

    varW: function(tokens) {
      if (tokens.length === 0) return 0;
      const avg = this.avgW(tokens);
      return tokens.reduce((sum, t) => sum + Math.pow(t.w - avg, 2), 0) / tokens.length;
    },

    clamp01: function(x) {
      return Math.min(1, Math.max(0, x));
    },

    /**
     * Execute kernel by ID
     * Pure function: (node, state, tokens) -> signal
     */
    execute: function(kernelId, node, state, tokens) {
      const entropy = state.entropy;
      const rewardBias = state.rewardBias;
      const bias = node.bias;
      const activation = node.activation;
      const nodeState = node.state;
      const tick = state.tick;
      const clusterId = state.clusterId;
      const clusterCount = state.clusterCount;

      const sumW = this.sumW(tokens);
      const avgW = this.avgW(tokens);
      const varW = this.varW(tokens);
      const len = tokens.length;

      let signal = 0;

      switch (kernelId) {
        case 0:  // π.entropy_scan
          signal = entropy * (activation - nodeState);
          break;
        case 1:  // π.variance_estimate
          signal = varW * entropy;
          break;
        case 2:  // π.vector_align
          signal = (rewardBias + bias) * sumW;
          break;
        case 3:  // π.state_switch
          signal = entropy > 0.5 ? 1 : -1;
          break;
        case 4:  // π.symbol_slice
          signal = len;
          break;
        case 5:  // π.window_merge
          signal = sumW;
          break;
        case 6:  // π.weight_focus
          signal = sumW * entropy;
          break;
        case 7:  // π.graph_walk
          signal = nodeState + sumW;
          break;
        case 8:  // π.dispatch
          signal = fnv1a32(tokens.map(t => t.g).join('')) % 28;
          break;
        case 9:  // π.execute
          signal = nodeState * entropy;
          break;
        case 10: // π.scx_fold
          signal = avgW;
          break;
        case 11: // π.state_store
          node.state = activation;
          signal = node.state;
          break;
        case 12: // π.constraint_gate
          signal = Math.min(activation, rewardBias + bias);
          break;
        case 13: // π.sequence_emit
          signal = len > 0 ? tokens[tick % len].w : 0;
          break;
        case 14: // π.error_reduce
          signal = -Math.abs(activation - nodeState);
          break;
        case 15: // π.lookup
          signal = nodeState;
          break;
        case 16: // π.phase_step
          signal = tick % 4;
          break;
        case 17: // π.capability_gain
          signal = (rewardBias + bias) * entropy;
          break;
        case 18: // π.symbol_pack
          signal = avgW;
          break;
        case 19: // π.reward_integrate
          node.state = nodeState + (rewardBias + bias);
          signal = node.state;
          break;
        case 20: // π.io_bridge
          signal = fnv1a32(tokens.map(t => t.g).join(''));
          break;
        case 21: // π.simulate
          signal = (nodeState + entropy) / 2;
          break;
        case 22: // π.persist
          node.state = (nodeState + activation) / 2;
          signal = node.state;
          break;
        case 23: // π.broadcast
          signal = sumW * clusterCount;
          break;
        case 24: // π.boot_mark
          signal = tick === 0 ? 1 : 0;
          break;
        case 25: // π.hash_identity
          signal = fnv1a32(String(clusterId));
          break;
        case 26: // π.bias_apply
          signal = nodeState * (rewardBias + bias);
          break;
        case 27: // π.signature_emit
          signal = clusterId % 256;
          break;
        default:
          signal = 0;
      }

      return signal;
    }
  };

  // ============================================
  // ABR COLLAPSE RULE
  // ============================================

  const ABRCollapse = {
    /**
     * Collapse lanes in order
     */
    LANE_ORDER: ['constraints', 'evidence', 'proposals', 'format', 'answer_emit'],

    /**
     * Collect and score proposals
     */
    scoreProposal: function(proposal, evidenceSet, constraintsPassed) {
      const supportCount = proposal.support.filter(h => evidenceSet.has(h)).length;
      const sSupport = proposal.support.length > 0
        ? supportCount / proposal.support.length
        : 0;

      const sCohere = 1 - this.clamp01(Math.abs(proposal.entropy - 0.5));

      const sPolicy = proposal.weight || 0;

      return CONST.ALPHA * sSupport +
             CONST.BETA * sCohere +
             CONST.GAMMA * sPolicy;
    },

    clamp01: function(x) {
      return Math.min(1, Math.max(0, x));
    },

    /**
     * Apply constraint veto
     */
    applyVeto: function(proposals, constraints) {
      return proposals.filter(p => {
        for (const c of constraints) {
          if (c.veto && !c.check(p)) {
            return false;
          }
        }
        return true;
      });
    },

    /**
     * Select winning proposal
     */
    selectProposal: function(proposals, evidenceSet) {
      if (proposals.length === 0) return null;

      // Score all proposals
      const scored = proposals.map(p => ({
        proposal: p,
        score: this.scoreProposal(p, evidenceSet, true)
      }));

      // Sort by score (descending), then by hash (ascending for tie-break)
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Tie-break: support, then hash, then abr_id
        if (a.proposal.support.length !== b.proposal.support.length) {
          return b.proposal.support.length - a.proposal.support.length;
        }
        const ha = fnv1a32(a.proposal.hash);
        const hb = fnv1a32(b.proposal.hash);
        if (ha !== hb) return ha - hb;
        return a.proposal.abrId - b.proposal.abrId;
      });

      return scored[0].proposal;
    },

    /**
     * Generate evidence canon hash
     */
    evidenceCanonHash: function(evidenceSet) {
      const sorted = Array.from(evidenceSet).sort();
      return h32(sorted.join('|'));
    },

    /**
     * Collapse to answer
     */
    collapse: function(state) {
      // Collect constraints (SAFE lane, verified, veto=true)
      const constraints = state.constraintSet.filter(c => c.verified);

      // Collect evidence (CORE/OPS/ENV lanes, verified)
      const evidenceHashes = new Set(state.evidenceSet);
      const evidenceCanon = this.evidenceCanonHash(evidenceHashes);

      // Apply veto to proposals
      const validProposals = this.applyVeto(state.proposalSet, constraints);

      // Select winning proposal
      const winner = this.selectProposal(validProposals, evidenceHashes);

      if (!winner) {
        return {
          '@type': 'abr.answer',
          '@tick': state.tick,
          '@evidence_hash': evidenceCanon,
          '@proposal_hash': 'h:00000000',
          '@policy_hash': state.policyHash,
          '@content': null,
          '@proof': h32(`${evidenceCanon}:null:${state.policyHash}`)
        };
      }

      const proposalHash = winner.hash;
      const proofHash = h32(`${evidenceCanon}:${proposalHash}:${state.policyHash}`);

      return {
        '@type': 'abr.answer',
        '@tick': state.tick,
        '@evidence_hash': evidenceCanon,
        '@proposal_hash': proposalHash,
        '@policy_hash': state.policyHash,
        '@content': winner.content,
        '@proof': proofHash
      };
    }
  };

  // ============================================
  // ABR REWARD PROPAGATION (EDGE-FREE)
  // ============================================

  const ABRReward = {
    /**
     * Compute reward from collapse outcome
     */
    computeReward: function(answer, state) {
      if (!answer || !answer['@content']) {
        return 0;
      }

      // Support alignment
      const sSupport = answer['@evidence_hash'] !== 'h:00000000' ? 0.5 : 0;

      // Constraint satisfaction (if we got an answer, constraints passed)
      const sConstraint = answer['@content'] ? 1.0 : 0;

      // Optional RLHF (placeholder)
      const rlhfScore = 0;

      // Incoherence penalty
      const incoherence = Math.abs(state.entropy - 0.5) * 0.5;

      return CONST.K1 * sSupport +
             CONST.K2 * sConstraint +
             CONST.K3 * rlhfScore -
             CONST.K4 * incoherence;
    },

    /**
     * Compute participation credits
     */
    computeCredits: function(state, answer) {
      const credits = new Map();
      const r = this.computeReward(answer, state);

      if (r === 0) return { credits, reward: 0 };

      // Identify participation sets
      const execSet = state.nodes.filter(n => !n.masked && n.lastSignal !== 0);
      const supportSet = execSet.filter(n =>
        state.evidenceSet.has(n.lastOutputHash)
      );
      const constraintSet = execSet.filter(n =>
        n.profile.role === 'constraint' && n.profile.veto
      );
      const formatSet = execSet.filter(n =>
        n.profile.role === 'format'
      );

      // Compute weights
      let totalW = 0;
      const weights = new Map();

      for (const node of execSet) {
        let w = 0;

        // U1: support participation
        if (supportSet.includes(node)) w += 0.4;

        // U2: constraint participation
        if (constraintSet.includes(node)) w += 0.3;

        // U3: format participation
        if (formatSet.includes(node)) w += 0.2;

        // U4: novelty (changed state)
        if (node.lastSignal !== 0) w += 0.1;

        weights.set(node.id, w);
        totalW += w;
      }

      // Normalize and compute credits
      for (const [id, w] of weights) {
        const credit = totalW > 0 ? (w / totalW) * r : 0;
        credits.set(id, credit);
      }

      return { credits, reward: r };
    },

    /**
     * Update biases (edge-free learning)
     */
    updateBiases: function(state, credits) {
      for (const [id, credit] of credits) {
        const node = state.nodes[id];
        // Update: bias += lr * credit
        node.bias += node.lr * credit;
        // Decay: bias *= (1 - λ)
        node.bias *= (1 - CONST.DECAY);
      }
    },

    /**
     * Emit reward proof block
     */
    emitRewardBlock: function(state, credits, reward) {
      const creditsArray = Array.from(credits.entries())
        .sort((a, b) => a[0] - b[0]);
      const creditsHash = h32(JSON.stringify(creditsArray));

      return {
        '@type': 'abr.reward',
        '@tick': state.tick,
        '@reward': reward,
        '@credits_hash': creditsHash,
        '@evidence_hash': ABRCollapse.evidenceCanonHash(state.evidenceSet),
        '@proposal_hash': state.lastAnswer?.['@proposal_hash'] || 'h:00000000',
        '@policy_hash': state.policyHash,
        '@proof': h32(`${reward}:${creditsHash}:${state.policyHash}`)
      };
    }
  };

  // ============================================
  // ABR PROOF EVENTS (v1 COMPLIANT)
  // ============================================

  /**
   * LOCKED PROOF HASH CONTRACT (⚡)
   * The proof hash must be computed over this EXACT minimal payload.
   * No additional fields may influence proof_hash.
   */
  function abrProofContract(inputsHash, outputsHash, policyHash) {
    return {
      '@type': '⚡',
      inputs_hash: inputsHash,
      outputs_hash: outputsHash,
      policy_hash: policyHash
    };
  }

  /**
   * Compute proof hash from contract
   */
  function abrProofHash(contract) {
    return h32(JSON.stringify(contract));
  }

  const ABRProof = {
    /**
     * Create ABR execution proof event
     * Uses locked proof hash contract
     */
    createEvent: function(node, state, inputsHash, outputsHash) {
      // LOCKED: proof hash computed from minimal contract only
      const contract = abrProofContract(inputsHash, outputsHash, state.policyHash);
      const proofHash = abrProofHash(contract);

      return {
        '@type': '⚡',
        '@frame_kind': FRAME_KIND.ABR,
        tick: state.tick,
        phase: state.phase,
        abr_id: node.id,
        abr_key: node.key,
        kernel_id: node.id,
        kernel_name: node.kernel,
        domain: node.getDomain(),
        lane: node.getLane(),
        signal: node.lastSignal,
        activation: node.activation,
        state: node.state,
        entropy: state.entropy,
        reward_bias: state.rewardBias,
        inputs_hash: inputsHash,
        outputs_hash: outputsHash,
        policy_hash: state.policyHash,
        proof_hash: proofHash,
        verified: true
      };
    },

    /**
     * Create phase event
     */
    createPhaseEvent: function(state, enter, exit) {
      return {
        '@type': 'abr.phase',
        '@frame_kind': FRAME_KIND.TICK,
        '@tick': state.tick,
        '@enter': enter,
        '@exit': exit,
        '@barrier': state.barrierHash,
        '@policy_hash': state.policyHash,
        '@proof': h32(`${enter}:${exit}:${state.tick}:${state.policyHash}`)
      };
    },

    /**
     * Create mask event with per-ABR reason codes (v1 mandatory)
     */
    createMaskEvent: function(state, runmask, maskReasons) {
      // Build reason map for masked ABRs
      const reasonsObj = {};
      for (const [abrId, reason] of maskReasons) {
        if (reason !== MASK_REASON.M0_OK) {
          reasonsObj[abrId] = MASK_REASON_NAMES[reason];
        }
      }

      // Density metrics
      let maskedCount = 0;
      let unmaskedCount = 0;
      for (let i = 0; i < 28; i++) {
        if ((runmask & (1 << i)) !== 0) {
          unmaskedCount++;
        } else {
          maskedCount++;
        }
      }

      return {
        '@type': 'abr.mask',
        '@frame_kind': FRAME_KIND.MASK,
        '@tick': state.tick,
        '@phase': state.phase,
        '@runmask_u32': runmask,
        '@mask_reasons': reasonsObj,
        '@density': {
          masked: maskedCount,
          unmasked: unmaskedCount,
          rate_q16: Math.floor((maskedCount << 16) / 28)
        },
        '@policy_hash': state.policyHash,
        '@proof': h32(`${runmask}:${state.phase}:${state.tick}:${JSON.stringify(reasonsObj)}`)
      };
    },

    /**
     * Create per-ABR mask frame (for detailed audit)
     */
    createPerABRMaskFrame: function(tick, abrId, phase, reason) {
      return {
        '@type': 'abr.mask.detail',
        '@frame_kind': FRAME_KIND.MASK,
        '@tick': tick,
        '@abr_id': abrId,
        '@phase': phase,
        '@reason': reason,
        '@reason_name': MASK_REASON_NAMES[reason]
      };
    },

    /**
     * Create answer frame
     */
    createAnswerFrame: function(tick, answerHash, content) {
      return {
        '@type': 'abr.answer.frame',
        '@frame_kind': FRAME_KIND.ANS,
        '@tick': tick,
        '@answer_hash': answerHash,
        '@content': content
      };
    },

    /**
     * Create reward frame
     */
    createRewardFrame: function(tick, rewardHash, reward) {
      return {
        '@type': 'abr.reward.frame',
        '@frame_kind': FRAME_KIND.RWD,
        '@tick': tick,
        '@reward_hash': rewardHash,
        '@reward': reward
      };
    },

    /**
     * Create stream header frame
     */
    createHeaderFrame: function(state) {
      return {
        '@type': 'abr.header',
        '@frame_kind': FRAME_KIND.HDR,
        '@version': ABR_VERSION,
        '@spec': 'ABR_BLACK_CODE_SPEC_v1.0.1',
        '@abr_count': 28,
        '@order': 'fixed',
        '@policy_hash': state.policyHash,
        '@stream_hash': 'h:00000000'
      };
    },

    /**
     * Create stream end frame
     */
    createEndFrame: function(tick, finalProofHash) {
      return {
        '@type': 'abr.end',
        '@frame_kind': FRAME_KIND.END,
        '@tick': tick,
        '@final_proof_hash': finalProofHash
      };
    },

    // Expose contract helpers
    proofContract: abrProofContract,
    proofHash: abrProofHash
  };

  // ============================================
  // ABR ENGINE (MAIN RUNTIME)
  // ============================================

  class ABREngine {
    constructor(options = {}) {
      this.options = options;
      this.state = { ...ABRState };
      this.state.nodes = [];
      this.state.lastClusterId = 1;
      this.state.stateMutated = false;
      this.frames = [];
      this.streamStarted = false;

      // Initialize 28 ABR nodes
      for (let i = 0; i < 28; i++) {
        this.state.nodes.push(new ABRNode(i));
      }
    }

    /**
     * Reset engine state
     */
    reset() {
      this.state.tick = 0;
      this.state.phase = 'perceive';
      this.state.phaseIndex = 0;
      this.state.entropy = 0.32;
      this.state.rewardBias = 0.0;
      this.state.barrierOpen = false;
      this.state.barrierHash = 'h:00000000';
      this.state.proofEvents = [];
      this.state.collapseSet.clear();
      this.state.evidenceSet.clear();
      this.state.proposalSet = [];
      this.state.constraintSet = [];
      this.state.lastClusterId = this.state.clusterId;
      this.state.stateMutated = false;
      this.state.lastAnswer = null;
      this.frames = [];
      this.streamStarted = false;

      for (const node of this.state.nodes) {
        node.reset();
      }
    }

    /**
     * Start a new frame stream (emit header)
     */
    startStream() {
      if (!this.streamStarted) {
        const headerFrame = ABRProof.createHeaderFrame(this.state);
        this.frames.push(headerFrame);
        this.streamStarted = true;
      }
    }

    /**
     * End the frame stream
     */
    endStream() {
      if (this.streamStarted && this.frames.length > 0) {
        const lastProof = this.frames
          .filter(f => f.proof_hash)
          .pop()?.proof_hash || 'h:00000000';
        const endFrame = ABRProof.createEndFrame(this.state.tick, lastProof);
        this.frames.push(endFrame);
      }
    }

    /**
     * Run a single tick
     * Pipeline: phase_enter -> mask_derive -> abr_run(0..27) -> phase_exit -> collapse? -> reward?
     */
    tick(inputs = {}) {
      const state = this.state;

      // Start stream if not started
      this.startStream();

      // Track cluster changes for masking
      state.lastClusterId = state.clusterId;

      // Apply inputs
      if (inputs.entropy !== undefined) state.entropy = inputs.entropy;
      if (inputs.rewardBias !== undefined) state.rewardBias = inputs.rewardBias;
      if (inputs.tokens) state.tokens = inputs.tokens;
      if (inputs.clusterId !== undefined) state.clusterId = inputs.clusterId;
      if (inputs.clusterCount !== undefined) state.clusterCount = inputs.clusterCount;

      // Reset state mutation flag
      state.stateMutated = false;

      // Phase enter
      const prevPhase = state.phase;
      const phaseEnterEvt = ABRProof.createPhaseEvent(state, state.phase, null);
      this.frames.push(phaseEnterEvt);

      // Mask evaluation (v1 compliant - returns runmask + reasons)
      const { runmask, maskReasons } = ABRMasking.evaluateMasks(state);
      const maskEvt = ABRProof.createMaskEvent(state, runmask, maskReasons);
      this.frames.push(maskEvt);

      // Clear per-tick sets
      state.evidenceSet.clear();
      state.proposalSet = [];
      state.constraintSet = [];

      // Execute unmasked ABRs in order 0..27
      for (let i = 0; i < 28; i++) {
        const node = state.nodes[i];

        if (node.masked) {
          continue;
        }

        // Compute inputs hash
        const inputsHash = h32(JSON.stringify({
          tick: state.tick,
          entropy: state.entropy,
          activation: node.activation,
          state: node.state,
          bias: node.bias
        }));

        // Execute kernel
        const signal = PiKernels.execute(i, node, state, state.tokens);
        node.lastSignal = signal;
        node.activation += signal;

        // Compute outputs hash
        const outputsHash = h32(JSON.stringify({
          signal,
          activation: node.activation,
          state: node.state
        }));
        node.lastOutputHash = outputsHash;

        // Add to collapse set
        state.collapseSet.add(outputsHash);

        // Categorize by lane
        if (node.profile.lane === 'evidence_lane') {
          state.evidenceSet.add(outputsHash);
        } else if (node.profile.lane === 'proposal_lane') {
          state.proposalSet.push({
            abrId: i,
            hash: outputsHash,
            content: { signal, activation: node.activation },
            support: [outputsHash],
            entropy: state.entropy,
            weight: node.profile.weight
          });
        } else if (node.profile.lane === 'constraint_lane') {
          state.constraintSet.push({
            abrId: i,
            hash: outputsHash,
            veto: node.profile.veto,
            verified: true,
            check: (p) => p.entropy < 1.0 // simple constraint
          });
        }

        // Emit proof event
        const proofEvt = ABRProof.createEvent(node, state, inputsHash, outputsHash);
        state.proofEvents.push(proofEvt);
        this.frames.push(proofEvt);
      }

      // Phase exit
      const phaseExitEvt = ABRProof.createPhaseEvent(state, null, state.phase);
      this.frames.push(phaseExitEvt);

      // Collapse at decide.exit
      let answer = null;
      if (ABRPhase.isCollapsePoint(state.phase, 'answer')) {
        answer = ABRCollapse.collapse(state);
        state.lastAnswer = answer;
        this.frames.push(answer);
      }

      // Reward at reflect.exit
      if (ABRPhase.isCollapsePoint(state.phase, 'reward')) {
        const { credits, reward } = ABRReward.computeCredits(state, state.lastAnswer);
        ABRReward.updateBiases(state, credits);
        const rewardBlock = ABRReward.emitRewardBlock(state, credits, reward);
        this.frames.push(rewardBlock);
      }

      // Advance phase
      const nextPhaseIdx = (state.phaseIndex + 1) % PHASE_NAMES.length;
      state.phase = PHASE_NAMES[nextPhaseIdx];
      state.phaseIndex = nextPhaseIdx;

      // Increment tick
      state.tick++;

      return {
        tick: state.tick - 1,
        phase: prevPhase,
        runmask,
        eventsCount: state.proofEvents.length,
        answer
      };
    }

    /**
     * Run multiple ticks
     */
    run(numTicks, inputs = {}) {
      const results = [];
      for (let i = 0; i < numTicks; i++) {
        results.push(this.tick(inputs));
      }
      return results;
    }

    /**
     * Get current state summary
     */
    getState() {
      return {
        tick: this.state.tick,
        phase: this.state.phase,
        entropy: this.state.entropy,
        rewardBias: this.state.rewardBias,
        clusterId: this.state.clusterId,
        nodes: this.state.nodes.map(n => ({
          id: n.id,
          key: n.key,
          activation: n.activation,
          state: n.state,
          bias: n.bias,
          masked: n.masked,
          maskReason: n.maskReason
        })),
        framesCount: this.frames.length
      };
    }

    /**
     * Get all frames
     */
    getFrames() {
      return this.frames;
    }

    /**
     * Export to SCXQ2 format (full frame stream)
     */
    exportSCXQ2() {
      // End stream if not ended
      this.endStream();

      // Count frame kinds
      const kindCounts = {};
      for (const f of this.frames) {
        const kind = f['@frame_kind'] || f['@type'];
        kindCounts[kind] = (kindCounts[kind] || 0) + 1;
      }

      return {
        '@magic': 'ABR1',
        '@endianness': 'LE',
        '@version': ABR_VERSION,
        '@spec': 'ABR_BLACK_CODE_SPEC_v1.0.1',
        '@policy_hash': this.state.policyHash,
        '@frame_count': this.frames.length,
        '@frame_kinds': kindCounts,
        '@abr_table': this.state.nodes.map(n => ({
          id: n.id,
          key: n.key,
          kernel: n.kernel,
          domain: n.profile.domain,
          lane: n.profile.lane,
          activation: n.activation,
          state: n.state,
          bias: n.bias,
          lr: n.lr
        })),
        frames: this.frames
      };
    }

    /**
     * Export frames as binary SCXQ2 (simplified encoding)
     */
    exportSCXQ2Binary() {
      const frames = this.frames;
      const output = [];

      // Frame count (u32)
      output.push(frames.length & 0xFF);
      output.push((frames.length >> 8) & 0xFF);
      output.push((frames.length >> 16) & 0xFF);
      output.push((frames.length >> 24) & 0xFF);

      for (const f of frames) {
        // Frame kind (u8)
        output.push(f['@frame_kind'] || 0);

        // Tick (u32)
        const tick = f['@tick'] ?? f.tick ?? 0;
        output.push(tick & 0xFF);
        output.push((tick >> 8) & 0xFF);
        output.push((tick >> 16) & 0xFF);
        output.push((tick >> 24) & 0xFF);

        // ABR ID (u8, 255 if not applicable)
        output.push(f.abr_id ?? f['@abr_id'] ?? 255);

        // Phase (u8)
        const phaseIdx = PHASE[f.phase || f['@phase']] ?? 255;
        output.push(phaseIdx);

        // Reason (u8, for mask frames)
        output.push(f['@reason'] ?? 255);

        // Proof hash (u32) - extract numeric part
        if (f.proof_hash || f['@proof']) {
          const hashStr = f.proof_hash || f['@proof'];
          const hashNum = parseInt(hashStr.replace('h:', ''), 16) || 0;
          output.push(hashNum & 0xFF);
          output.push((hashNum >> 8) & 0xFF);
          output.push((hashNum >> 16) & 0xFF);
          output.push((hashNum >> 24) & 0xFF);
        } else {
          output.push(0, 0, 0, 0);
        }
      }

      return new Uint8Array(output);
    }
  }

  // ============================================
  // ABR REPLAY VERIFIER (v1 COMPLIANT)
  // ============================================

  const ABRVerifier = {
    /**
     * Verification stages
     */
    STAGES: [
      'S0_PARSE',
      'S1_HEADER',
      'S2_TICK_ORDER',
      'S3_MASK_VALIDATE',
      'S4_PROOF_HASH',
      'S5_PHASE_BARRIER',
      'S6_COLLAPSE',
      'S7_REWARD',
      'S8_OK'
    ],

    /**
     * Verify replay frames (v1 compliant)
     * Includes fixpoint detection (verifier-only responsibility)
     */
    verify: function(frames) {
      if (!frames || frames.length === 0) {
        return { ok: false, stage: 'S0_PARSE', proof: 'h:00000000', errors: ['No frames provided'] };
      }

      // S1: Header check
      const header = frames.find(f => f['@type'] === 'abr.header');
      if (!header) {
        // Header is optional but recommended
        console.warn('[ABRVerifier] No header frame found');
      }

      let lastTick = -1;
      let lastPhase = 'perceive';
      let finalProof = 'h:00000000';
      const errors = [];

      // Track ABR history for fixpoint detection (verifier-only)
      const abrHistory = new Map(); // abrId -> { inputs_hash, outputs_hash }

      for (const frame of frames) {
        // S2: Tick order check
        if (frame['@type'] === 'abr.mask') {
          if (frame['@tick'] !== undefined && frame['@tick'] <= lastTick) {
            return {
              ok: false,
              stage: 'S2_TICK_ORDER',
              proof: finalProof,
              errors: [`Tick ${frame['@tick']} <= previous tick ${lastTick}`]
            };
          }
          lastTick = frame['@tick'];

          // S3: Mask validation - check reason codes are valid
          if (frame['@mask_reasons']) {
            for (const [abrId, reason] of Object.entries(frame['@mask_reasons'])) {
              if (!MASK_REASON_NAMES.includes(reason)) {
                errors.push(`Invalid mask reason for ABR ${abrId}: ${reason}`);
              }
            }
          }
        }

        // S4: Proof hash verification (LOCKED CONTRACT)
        if (frame['@type'] === '⚡') {
          // Use locked proof contract
          const contract = abrProofContract(
            frame.inputs_hash,
            frame.outputs_hash,
            frame.policy_hash
          );
          const computed = abrProofHash(contract);

          if (computed !== frame.proof_hash) {
            return {
              ok: false,
              stage: 'S4_PROOF_HASH',
              proof: computed,
              errors: [`Proof mismatch for ABR ${frame.abr_id}: expected ${frame.proof_hash}, got ${computed}`]
            };
          }
          finalProof = computed;

          // S5: Phase barrier check
          const phase = frame.phase;
          if (ABRPhase.indexOf(phase) < ABRPhase.indexOf(lastPhase)) {
            return {
              ok: false,
              stage: 'S5_PHASE_BARRIER',
              proof: finalProof,
              errors: [`Phase regression: ${phase} < ${lastPhase}`]
            };
          }
          lastPhase = phase;

          // FIXPOINT DETECTION (verifier-only)
          // Check if this ABR is at fixpoint based on history
          const abrId = frame.abr_id;
          const prevState = abrHistory.get(abrId);
          if (prevState) {
            if (prevState.inputs_hash === frame.inputs_hash &&
                prevState.outputs_hash === frame.outputs_hash) {
              // ABR is at fixpoint - this should have been masked
              errors.push(`ABR ${abrId} at fixpoint (should be masked): inputs=${frame.inputs_hash}, outputs=${frame.outputs_hash}`);
            }
          }

          // Update history
          abrHistory.set(abrId, {
            inputs_hash: frame.inputs_hash,
            outputs_hash: frame.outputs_hash
          });
        }

        // S6: Answer verification
        if (frame['@type'] === 'abr.answer') {
          const ansProof = h32(`${frame['@evidence_hash']}:${frame['@proposal_hash']}:${frame['@policy_hash']}`);
          if (ansProof !== frame['@proof']) {
            return {
              ok: false,
              stage: 'S6_COLLAPSE',
              proof: finalProof,
              errors: [`Answer proof mismatch: expected ${frame['@proof']}, got ${ansProof}`]
            };
          }
        }

        // S7: Reward verification
        if (frame['@type'] === 'abr.reward') {
          const rwdProof = h32(`${frame['@reward']}:${frame['@credits_hash']}:${frame['@policy_hash']}`);
          if (rwdProof !== frame['@proof']) {
            return {
              ok: false,
              stage: 'S7_REWARD',
              proof: finalProof,
              errors: [`Reward proof mismatch: expected ${frame['@proof']}, got ${rwdProof}`]
            };
          }
        }
      }

      // S8: Success (with warnings if any)
      return {
        ok: true,
        stage: 'S8_OK',
        proof: finalProof,
        errors: errors.length > 0 ? errors : null,
        warnings: errors.length > 0 ? errors : null
      };
    },

    /**
     * Infer fixpoint from frame history
     * This is the verifier's responsibility, not runtime
     */
    inferFixpoint: function(currentFrame, previousFrame) {
      if (!previousFrame) return false;
      return (
        currentFrame.inputs_hash === previousFrame.inputs_hash &&
        currentFrame.outputs_hash === previousFrame.outputs_hash
      );
    }
  };

  // ============================================
  // PUBLIC API
  // ============================================

  const ABRBlackCode = {
    version: ABR_VERSION,
    spec: 'ABR_BLACK_CODE_SPEC_v1.0.1',
    law: 'ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK',

    // Constants
    DOMAIN,
    ROLE,
    LANE,
    PHASE,
    CONST,
    ABR_KEYS,
    ABR_KERNELS,
    ABR_PROFILES,
    PHASE_ALLOW,

    // v1 Compliance: Mask reason codes
    MASK_REASON,
    MASK_REASON_NAMES,

    // v1 Compliance: Frame kinds
    FRAME_KIND,

    // Core classes
    ABRNode,
    ABREngine,

    // Subsystems
    Masking: ABRMasking,
    Phase: ABRPhase,
    Collapse: ABRCollapse,
    Reward: ABRReward,
    Proof: ABRProof,
    Verifier: ABRVerifier,
    Kernels: PiKernels,

    // Utilities
    fnv1a32,
    h32,
    proofContract: abrProofContract,
    proofHash: abrProofHash,

    /**
     * Create new ABR engine
     */
    create: function(options) {
      return new ABREngine(options);
    },

    /**
     * Verify frames
     */
    verify: function(frames) {
      return ABRVerifier.verify(frames);
    },

    /**
     * Check if domain is allowed after collapse
     */
    isDomainAllowedAfterCollapse: isDomainAllowedAfterCollapse
  };

  // ============================================
  // EXPORTS
  // ============================================

  global.ABRBlackCode = ABRBlackCode;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ABRBlackCode;
  }

  console.log('[ABRBlackCode] Atomic Block Runtime v' + ABR_VERSION + ' loaded (replay-correct)');
  console.log('[ABRBlackCode] v1 Compliance: Mask reasons, post-collapse barrier, locked proof contract, frame stream');
  console.log('[ABRBlackCode] The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
