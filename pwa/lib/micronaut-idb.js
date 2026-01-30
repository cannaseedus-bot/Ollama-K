/**
 * MX2LM Micronaut IDB Schema v1.0 (FROZEN)
 *
 * PORTABILITY STANDARD — "Cognitive Ledger Format"
 *
 * This schema turns intelligence into:
 * - A ledger, not a model
 * - Events, not tensors
 * - Proofs, not probabilities
 * - SVG glyphs, not embeddings
 *
 * Invariants (non-negotiable):
 * 1. No hidden state
 * 2. No derived values stored
 * 3. Everything is replayable
 * 4. No external policy dependency
 * 5. SCXQ2-friendly (high repetition, small alphabets)
 *
 * Schema: MX2LM-IDB-1.0 (FROZEN)
 *
 * @version 1.0.0
 * @license MIT
 */

(function(global) {
  'use strict';

  const IDB_VERSION = 1;
  const DB_NAME = 'mx2lm_micronaut';
  const SCHEMA_VERSION = 'MX2LM-IDB-1.0';

  // ============================================
  // OBJECT STORE NAMES
  // ============================================

  const STORES = Object.freeze({
    META: 'meta',
    EVENTS: 'events',
    STATE: 'state',
    POLICY: 'policy',
    PROOFS: 'proofs'
  });

  // ============================================
  // MICRONAUT IDB CLASS
  // ============================================

  class MicronautIDB {
    constructor() {
      this.db = null;
      this.ready = false;
    }

    /**
     * Open/create the Micronaut database
     */
    async open() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, IDB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Create object stores
          if (!db.objectStoreNames.contains(STORES.META)) {
            db.createObjectStore(STORES.META, { keyPath: 'key' });
          }

          if (!db.objectStoreNames.contains(STORES.EVENTS)) {
            const eventsStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'eid' });
            eventsStore.createIndex('by_tick', 'tick', { unique: false });
            eventsStore.createIndex('by_glyph', 'g', { unique: false });
            eventsStore.createIndex('by_time', 't', { unique: false });
          }

          if (!db.objectStoreNames.contains(STORES.STATE)) {
            db.createObjectStore(STORES.STATE, { keyPath: 'key' });
          }

          if (!db.objectStoreNames.contains(STORES.POLICY)) {
            db.createObjectStore(STORES.POLICY, { keyPath: 'policy_id' });
          }

          if (!db.objectStoreNames.contains(STORES.PROOFS)) {
            const proofsStore = db.createObjectStore(STORES.PROOFS, { keyPath: 'proof_id' });
            proofsStore.createIndex('by_tick', 'tick', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.ready = true;
          resolve(this);
        };

        request.onerror = (event) => {
          reject(new Error('Failed to open MicronautIDB: ' + event.target.error));
        };
      });
    }

    /**
     * Initialize Micronaut with meta info
     */
    async initMicronaut(opts = {}) {
      const meta = {
        key: 'micronaut.meta',
        value: {
          schema: SCHEMA_VERSION,
          created: Date.now(),
          micronaut_id: opts.micronaut_id || this._generateId(),
          cluster_id: opts.cluster_id || 1,
          glyph_pack: opts.glyph_pack || 'MX2LM_GLYPHS_28_v1',
          pi_kernel_set: opts.pi_kernel_set || 'MX2LM_PI_28_v1',
          scx_dict: opts.scx_dict || 'SCXQ2_GLYPH_CORE_v1',
          epoch: opts.epoch || 0
        }
      };

      await this._put(STORES.META, meta);
      return meta.value;
    }

    /**
     * Get Micronaut meta info
     */
    async getMeta() {
      const meta = await this._get(STORES.META, 'micronaut.meta');
      return meta?.value || null;
    }

    /**
     * Validate Micronaut for portability
     */
    async validate() {
      const meta = await this.getMeta();
      if (!meta) {
        return { valid: false, error: 'No meta found' };
      }

      if (meta.schema !== SCHEMA_VERSION) {
        return { valid: false, error: `Schema mismatch: ${meta.schema} != ${SCHEMA_VERSION}` };
      }

      // Check all stores exist
      for (const store of Object.values(STORES)) {
        if (!this.db.objectStoreNames.contains(store)) {
          return { valid: false, error: `Missing store: ${store}` };
        }
      }

      return { valid: true, meta };
    }

    // ============================================
    // EVENTS (COGNITIVE LEDGER)
    // ============================================

    /**
     * Record a cognitive event
     */
    async recordEvent(event) {
      const eid = `e:${event.t || Date.now()}`;
      const record = {
        eid: eid,
        t: event.t || Date.now(),
        tick: event.tick,
        g: event.g,           // glyph symbol
        b: event.b || 1,      // basis level (1-4)
        w: event.w || 1.0,    // weight
        c: event.c || null,   // color (reward lane)
        o: event.o || 1.0,    // opacity (confidence)
        d: event.d || 0,      // delta (reward change)
        p: event.p || null    // proof ref
      };

      await this._put(STORES.EVENTS, record);
      return record;
    }

    /**
     * Get events by tick range
     */
    async getEventsByTick(minTick, maxTick) {
      return this._getByIndex(STORES.EVENTS, 'by_tick', IDBKeyRange.bound(minTick, maxTick));
    }

    /**
     * Get events by glyph
     */
    async getEventsByGlyph(glyph) {
      return this._getByIndex(STORES.EVENTS, 'by_glyph', glyph);
    }

    /**
     * Get all events
     */
    async getAllEvents() {
      return this._getAll(STORES.EVENTS);
    }

    // ============================================
    // STATE
    // ============================================

    /**
     * Update node state
     */
    async updateState(sym, activation, state, lastTick) {
      const record = {
        key: `node.${sym}`,
        value: {
          activation,
          state,
          last_tick: lastTick
        }
      };
      await this._put(STORES.STATE, record);
      return record;
    }

    /**
     * Get node state
     */
    async getState(sym) {
      const record = await this._get(STORES.STATE, `node.${sym}`);
      return record?.value || null;
    }

    /**
     * Get all node states
     */
    async getAllStates() {
      const records = await this._getAll(STORES.STATE);
      const states = {};
      for (const r of records) {
        if (r.key.startsWith('node.')) {
          states[r.key.replace('node.', '')] = r.value;
        }
      }
      return states;
    }

    // ============================================
    // POLICY
    // ============================================

    /**
     * Store epoch policy
     */
    async storePolicy(epoch, basisRules, branchGate) {
      const policyHash = await this._hashPolicy({ epoch, basisRules, branchGate });
      const record = {
        policy_id: `epoch-${epoch}`,
        epoch: epoch,
        basis_rules: basisRules || {
          1: 'observe',
          2: 'evaluate',
          3: 'adapt',
          4: 'commit'
        },
        branch_gate: branchGate || {
          requires_proof: true,
          proof_type: '⚡'
        },
        hash: `pol:${policyHash.slice(0, 6)}`
      };

      await this._put(STORES.POLICY, record);
      return record;
    }

    /**
     * Get policy by epoch
     */
    async getPolicy(epoch) {
      return this._get(STORES.POLICY, `epoch-${epoch}`);
    }

    /**
     * Get current epoch policy
     */
    async getCurrentPolicy() {
      const meta = await this.getMeta();
      if (!meta) return null;
      return this.getPolicy(meta.epoch);
    }

    // ============================================
    // PROOFS
    // ============================================

    /**
     * Store a proof
     */
    async storeProof(proof) {
      const record = {
        proof_id: proof.proof_id || `⚡:${proof.hash.slice(0, 6)}`,
        type: proof.type || 'xcfe.control',
        input: proof.input || [],
        result: proof.result || null,
        tick: proof.tick,
        epoch: proof.epoch,
        policy_hash: proof.policy_hash,
        hash: proof.hash
      };

      await this._put(STORES.PROOFS, record);
      return record;
    }

    /**
     * Get proof by ID
     */
    async getProof(proofId) {
      return this._get(STORES.PROOFS, proofId);
    }

    /**
     * Get proofs by tick
     */
    async getProofsByTick(tick) {
      return this._getByIndex(STORES.PROOFS, 'by_tick', tick);
    }

    // ============================================
    // EXPORT / IMPORT
    // ============================================

    /**
     * Export entire Micronaut to portable format
     */
    async export() {
      const [meta, events, states, policies, proofs] = await Promise.all([
        this._getAll(STORES.META),
        this._getAll(STORES.EVENTS),
        this._getAll(STORES.STATE),
        this._getAll(STORES.POLICY),
        this._getAll(STORES.PROOFS)
      ]);

      return {
        schema: SCHEMA_VERSION,
        exported_at: Date.now(),
        meta,
        events,
        states,
        policies,
        proofs
      };
    }

    /**
     * Import Micronaut from portable format
     */
    async import(data, opts = {}) {
      // Validate schema
      if (data.schema !== SCHEMA_VERSION && !opts.force) {
        throw new Error(`Schema mismatch: ${data.schema} != ${SCHEMA_VERSION}`);
      }

      // Clear existing if requested
      if (opts.clear) {
        await this._clearStore(STORES.META);
        await this._clearStore(STORES.EVENTS);
        await this._clearStore(STORES.STATE);
        await this._clearStore(STORES.POLICY);
        await this._clearStore(STORES.PROOFS);
      }

      // Import data
      for (const record of data.meta || []) {
        await this._put(STORES.META, record);
      }
      for (const record of data.events || []) {
        await this._put(STORES.EVENTS, record);
      }
      for (const record of data.states || []) {
        await this._put(STORES.STATE, record);
      }
      for (const record of data.policies || []) {
        await this._put(STORES.POLICY, record);
      }
      for (const record of data.proofs || []) {
        await this._put(STORES.PROOFS, record);
      }

      return { imported: true, schema: data.schema };
    }

    // ============================================
    // MERGE SEMANTICS
    // ============================================

    /**
     * Merge another Micronaut ledger
     * @param {Object} other - Exported Micronaut data
     * @param {string} mode - Merge mode: overlay|union|weighted|fork|strict
     * @param {number} weight - Trust weight for 'weighted' mode (0.0-1.0)
     */
    async merge(other, mode = 'union', weight = 0.5) {
      if (!['overlay', 'union', 'weighted', 'fork', 'strict'].includes(mode)) {
        throw new Error(`Invalid merge mode: ${mode}`);
      }

      const myEvents = await this.getAllEvents();
      const otherEvents = other.events || [];

      const myEventMap = new Map();
      for (const e of myEvents) {
        myEventMap.set(this._eventIdentity(e), e);
      }

      const conflicts = [];
      const toAdd = [];

      for (const otherEvent of otherEvents) {
        const identity = this._eventIdentity(otherEvent);
        const myEvent = myEventMap.get(identity);

        if (!myEvent) {
          // New event - add it
          toAdd.push(otherEvent);
        } else {
          // Conflict - resolve based on mode
          const conflict = this._classifyConflict(myEvent, otherEvent);
          if (conflict.type !== 'C0') {
            conflicts.push({ my: myEvent, other: otherEvent, conflict });
          }
        }
      }

      // Resolve conflicts
      const resolved = [];
      const forks = [];

      for (const { my, other: otherEv, conflict } of conflicts) {
        const resolution = await this._resolveConflict(my, otherEv, conflict, mode, weight);
        if (resolution.fork) {
          forks.push(resolution);
        } else if (resolution.event) {
          resolved.push(resolution.event);
        }
      }

      // Apply additions
      for (const event of toAdd) {
        await this._put(STORES.EVENTS, event);
      }

      // Apply resolutions
      for (const event of resolved) {
        await this._put(STORES.EVENTS, event);
      }

      // Store forks as special records
      for (const fork of forks) {
        await this._put(STORES.EVENTS, {
          eid: `fork:${Date.now()}`,
          type: 'fork',
          glyph: fork.glyph,
          epoch: fork.epoch,
          variants: fork.variants
        });
      }

      return {
        mode,
        added: toAdd.length,
        conflicts: conflicts.length,
        resolved: resolved.length,
        forks: forks.length
      };
    }

    _eventIdentity(event) {
      // Event identity excludes tick (temporal, not semantic)
      return `${event.g}:${event.b}:${event.epoch || 0}`;
    }

    _classifyConflict(a, b) {
      if (a.w === b.w && a.c === b.c && a.p === b.p && a.b === b.b) {
        return { type: 'C0' }; // Identical
      }
      if (a.w !== b.w) return { type: 'C1' }; // Weight differs
      if (a.c !== b.c) return { type: 'C2' }; // Color differs
      if (a.p !== b.p) return { type: 'C3' }; // Proof mismatch
      if (a.b !== b.b) return { type: 'C4' }; // Basis mismatch
      return { type: 'C5' }; // Epoch mismatch
    }

    async _resolveConflict(a, b, conflict, mode, weight) {
      switch (mode) {
        case 'overlay':
          return { event: a }; // Keep mine

        case 'strict':
          throw new Error(`Strict mode: conflict ${conflict.type} on ${a.g}`);

        case 'fork':
          return {
            fork: true,
            glyph: a.g,
            epoch: a.epoch || 0,
            variants: [
              { ledger: 'A', event_hash: a.eid },
              { ledger: 'B', event_hash: b.eid }
            ]
          };

        case 'union':
          // For union, proof supremacy applies
          if (conflict.type === 'C3') {
            if (a.p && !b.p) return { event: a };
            if (b.p && !a.p) return { event: b };
            return { fork: true, glyph: a.g, epoch: a.epoch || 0, variants: [{ ledger: 'A', event_hash: a.eid }, { ledger: 'B', event_hash: b.eid }] };
          }
          // Basis dominance
          if (conflict.type === 'C4') {
            return { event: a.b > b.b ? a : b };
          }
          // Default: average weights
          return {
            event: { ...a, w: (a.w + b.w) / 2 }
          };

        case 'weighted':
          return {
            event: {
              ...a,
              w: a.w * weight + b.w * (1 - weight)
            }
          };

        default:
          return { event: a };
      }
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    _generateId() {
      const bytes = new Uint8Array(6);
      crypto.getRandomValues(bytes);
      return 'μ-' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 6);
    }

    async _hashPolicy(policy) {
      const str = JSON.stringify(policy);
      const bytes = new TextEncoder().encode(str);
      const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
      const hashArr = [...new Uint8Array(hashBuf)];
      return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    _put(storeName, record) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(record);
        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
      });
    }

    _get(storeName, key) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    _getAll(storeName) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    _getByIndex(storeName, indexName, query) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(query);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    _clearStore(storeName) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  // ============================================
  // EXPORTS
  // ============================================

  const MicronautDB = {
    version: SCHEMA_VERSION,
    DB_NAME,
    IDB_VERSION,
    STORES,

    MicronautIDB,

    // Factory
    open: async function() {
      const db = new MicronautIDB();
      await db.open();
      return db;
    }
  };

  // Browser/Worker global
  if (typeof self !== 'undefined') {
    self.MicronautDB = MicronautDB;
    self.MicronautIDB = MicronautIDB;
  }

  // CommonJS
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MicronautDB;
  }

  // Global
  global.MicronautDB = MicronautDB;
  global.MicronautIDB = MicronautIDB;

  console.log('[MicronautDB] Schema ' + SCHEMA_VERSION + ' loaded');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
