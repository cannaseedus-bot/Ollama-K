/**
 * ABR BLACK CODE SPEC v1.0.0
 *
 * Atomic Block Runtime - Pure K'UHUL π Implementation
 *
 * Laws:
 * - ABR Masking Law: Determines execution eligibility per tick
 * - ABR Phase Algebra: XCFE phase lattice for control flow
 * - ABR Collapse Rule: Deterministic answer collapse (not generation)
 * - ABR Reward Propagation: Edge-free learning via bias fields
 *
 * The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK
 *
 * @version 1.0.0
 * @status CANONICAL
 */

(function(global) {
  'use strict';

  const ABR_VERSION = '1.0.0';
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
  // ABR MASKING LAW
  // ============================================

  const ABRMasking = {
    /**
     * Evaluate mask for all 28 ABRs
     * Returns a 28-bit runmask
     */
    evaluateMasks: function(state) {
      let runmask = 0;
      const phase = state.phase;
      const allow = PHASE_ALLOW[phase];

      for (let i = 0; i < 28; i++) {
        const node = state.nodes[i];
        const profile = node.profile;

        // Check phase compatibility
        if (!allow.domains.includes(profile.domain)) {
          node.masked = true;
          node.maskReason = 'M1_PHASE_INCOMPAT';
          continue;
        }

        if (!allow.lanes.includes(profile.lane)) {
          node.masked = true;
          node.maskReason = 'M1_PHASE_INCOMPAT';
          continue;
        }

        // Check entropy saturation
        if (Math.abs(node.lastSignal) < CONST.EPSILON) {
          node.masked = true;
          node.maskReason = 'M2_ENTROPY_SAT';
          continue;
        }

        // Check fixpoint (for non-first tick)
        if (state.tick > 0) {
          const prevAct = node.activation - node.lastSignal;
          if (node.isFixpoint(prevAct, node.state)) {
            node.masked = true;
            node.maskReason = 'M3_FIXPOINT';
            continue;
          }
        }

        // Check collapse preclusion
        if (state.collapseSet.has(node.lastOutputHash)) {
          node.masked = true;
          node.maskReason = 'M4_COLLAPSE_PRECLUDED';
          continue;
        }

        // Mandatory masking rules
        if (i === 24 && state.tick > 0) {
          // π.boot_mark only on tick 0
          node.masked = true;
          node.maskReason = 'M5_POLICY_DENY';
          continue;
        }

        // Node is unmasked
        node.masked = false;
        node.maskReason = 'M0_OK';
        runmask |= (1 << i);
      }

      return runmask;
    },

    /**
     * Get mask reason codes
     */
    REASON_CODES: [
      'M0_OK',
      'M1_PHASE_INCOMPAT',
      'M2_ENTROPY_SAT',
      'M3_FIXPOINT',
      'M4_COLLAPSE_PRECLUDED',
      'M5_POLICY_DENY',
      'M6_PROOF_PIN_FAIL'
    ]
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
  // ABR PROOF EVENTS
  // ============================================

  const ABRProof = {
    /**
     * Create ABR execution proof event
     */
    createEvent: function(node, state, inputsHash, outputsHash) {
      const proofPayload = JSON.stringify({
        '@type': '⚡',
        inputs_hash: inputsHash,
        outputs_hash: outputsHash,
        policy_hash: state.policyHash
      });

      return {
        '@type': '⚡',
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
        proof_hash: h32(proofPayload),
        verified: true
      };
    },

    /**
     * Create phase event
     */
    createPhaseEvent: function(state, enter, exit) {
      return {
        '@type': 'abr.phase',
        '@tick': state.tick,
        '@enter': enter,
        '@exit': exit,
        '@barrier': state.barrierHash,
        '@policy_hash': state.policyHash,
        '@proof': h32(`${enter}:${exit}:${state.tick}:${state.policyHash}`)
      };
    },

    /**
     * Create mask event
     */
    createMaskEvent: function(state, runmask) {
      return {
        '@type': 'abr.mask',
        '@tick': state.tick,
        '@phase': state.phase,
        '@runmask_u32': runmask,
        '@policy_hash': state.policyHash,
        '@proof': h32(`${runmask}:${state.phase}:${state.tick}`)
      };
    }
  };

  // ============================================
  // ABR ENGINE (MAIN RUNTIME)
  // ============================================

  class ABREngine {
    constructor(options = {}) {
      this.options = options;
      this.state = { ...ABRState };
      this.state.nodes = [];
      this.frames = [];

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
      this.frames = [];

      for (const node of this.state.nodes) {
        node.reset();
      }
    }

    /**
     * Run a single tick
     * Pipeline: phase_enter -> mask_derive -> abr_run(0..27) -> phase_exit -> collapse? -> reward?
     */
    tick(inputs = {}) {
      const state = this.state;

      // Apply inputs
      if (inputs.entropy !== undefined) state.entropy = inputs.entropy;
      if (inputs.rewardBias !== undefined) state.rewardBias = inputs.rewardBias;
      if (inputs.tokens) state.tokens = inputs.tokens;
      if (inputs.clusterId !== undefined) state.clusterId = inputs.clusterId;
      if (inputs.clusterCount !== undefined) state.clusterCount = inputs.clusterCount;

      // Phase enter
      const prevPhase = state.phase;
      const phaseEnterEvt = ABRProof.createPhaseEvent(state, state.phase, null);
      this.frames.push(phaseEnterEvt);

      // Mask evaluation
      const runmask = ABRMasking.evaluateMasks(state);
      const maskEvt = ABRProof.createMaskEvent(state, runmask);
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
     * Export to SCXQ2 format (simplified)
     */
    exportSCXQ2() {
      return {
        '@magic': 'ABR1',
        '@version': ABR_VERSION,
        '@spec': 'ABR_BLACK_CODE_SPEC_v1.0.0',
        '@policy_hash': this.state.policyHash,
        '@frames': this.frames.length,
        frames: this.frames
      };
    }
  }

  // ============================================
  // ABR REPLAY VERIFIER
  // ============================================

  const ABRVerifier = {
    /**
     * Verify replay frames
     */
    verify: function(frames) {
      if (!frames || frames.length === 0) {
        return { ok: false, stage: 'S0_PARSE', proof: 'h:00000000' };
      }

      let lastTick = -1;
      let lastPhase = 'perceive';
      let finalProof = 'h:00000000';

      for (const frame of frames) {
        // Tick order check
        if (frame['@type'] === 'abr.mask') {
          if (frame['@tick'] !== undefined && frame['@tick'] <= lastTick) {
            return { ok: false, stage: 'S2_TICK_ORDER', proof: finalProof };
          }
          lastTick = frame['@tick'];
        }

        // Proof hash verification
        if (frame['@type'] === '⚡') {
          const proofPayload = JSON.stringify({
            '@type': '⚡',
            inputs_hash: frame.inputs_hash,
            outputs_hash: frame.outputs_hash,
            policy_hash: frame.policy_hash
          });
          const computed = h32(proofPayload);
          if (computed !== frame.proof_hash) {
            return { ok: false, stage: 'S4_PROOF_HASH', proof: computed };
          }
          finalProof = computed;

          // Phase barrier check
          const phase = frame.phase;
          if (ABRPhase.indexOf(phase) < ABRPhase.indexOf(lastPhase)) {
            return { ok: false, stage: 'S5_PHASE_BARRIER', proof: finalProof };
          }
          lastPhase = phase;
        }

        // Answer verification
        if (frame['@type'] === 'abr.answer') {
          const ansProof = h32(`${frame['@evidence_hash']}:${frame['@proposal_hash']}:${frame['@policy_hash']}`);
          if (ansProof !== frame['@proof']) {
            return { ok: false, stage: 'S6_COLLAPSE', proof: finalProof };
          }
        }

        // Reward verification
        if (frame['@type'] === 'abr.reward') {
          const rwdProof = h32(`${frame['@reward']}:${frame['@credits_hash']}:${frame['@policy_hash']}`);
          if (rwdProof !== frame['@proof']) {
            return { ok: false, stage: 'S7_REWARD', proof: finalProof };
          }
        }
      }

      return { ok: true, stage: 'S8_OK', proof: finalProof };
    }
  };

  // ============================================
  // PUBLIC API
  // ============================================

  const ABRBlackCode = {
    version: ABR_VERSION,
    spec: 'ABR_BLACK_CODE_SPEC_v1.0.0',
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
    }
  };

  // ============================================
  // EXPORTS
  // ============================================

  global.ABRBlackCode = ABRBlackCode;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ABRBlackCode;
  }

  console.log('[ABRBlackCode] Atomic Block Runtime v' + ABR_VERSION + ' loaded');
  console.log('[ABRBlackCode] The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
