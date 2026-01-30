/**
 * Gas Files & Shards System v1.0.0
 *
 * Provides user-configurable backend system for K'UHUL Pi Kernel.
 *
 * Features:
 * - Gas files: User-addable execution units
 * - Shards: Backend connectors (Google, Supabase, custom)
 * - Deterministic execution
 * - Proof-compatible
 *
 * The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK
 */

(function(global) {
  'use strict';

  const GAS_SHARDS_VERSION = '1.0.0';

  // ============================================
  // SHARD TYPES
  // ============================================

  const SHARD_TYPE = {
    GOOGLE: 'google',
    SUPABASE: 'supabase',
    CUSTOM: 'custom',
    LOCAL: 'local'
  };

  const SHARD_STATUS = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    ERROR: 'error'
  };

  // ============================================
  // GAS FILE TYPES
  // ============================================

  const GAS_TYPE = {
    BUILTIN: 'builtin',
    USER: 'user',
    REMOTE: 'remote'
  };

  // ============================================
  // SHARD REGISTRY
  // ============================================

  class ShardRegistry {
    constructor() {
      this.shards = new Map();
      this.listeners = new Map();
    }

    /**
     * Register a shard
     */
    register(id, config) {
      const shard = {
        id,
        type: config.type || SHARD_TYPE.CUSTOM,
        status: SHARD_STATUS.DISCONNECTED,
        config: config,
        connector: null,
        lastSync: null,
        error: null
      };

      this.shards.set(id, shard);
      this.emit('shard:registered', { id, shard });

      return shard;
    }

    /**
     * Unregister a shard
     */
    unregister(id) {
      const shard = this.shards.get(id);
      if (shard) {
        if (shard.connector && typeof shard.connector.disconnect === 'function') {
          shard.connector.disconnect();
        }
        this.shards.delete(id);
        this.emit('shard:unregistered', { id });
      }
    }

    /**
     * Get shard by ID
     */
    get(id) {
      return this.shards.get(id);
    }

    /**
     * Get all shards
     */
    getAll() {
      return Array.from(this.shards.values());
    }

    /**
     * Get shards by type
     */
    getByType(type) {
      return this.getAll().filter(s => s.type === type);
    }

    /**
     * Connect shard
     */
    async connect(id, credentials = {}) {
      const shard = this.shards.get(id);
      if (!shard) {
        throw new Error(`Shard ${id} not found`);
      }

      shard.status = SHARD_STATUS.CONNECTING;
      this.emit('shard:connecting', { id });

      try {
        const connector = await this.createConnector(shard, credentials);
        shard.connector = connector;
        shard.status = SHARD_STATUS.CONNECTED;
        shard.lastSync = Date.now();
        shard.error = null;

        this.emit('shard:connected', { id, shard });
        return shard;

      } catch (err) {
        shard.status = SHARD_STATUS.ERROR;
        shard.error = err.message;
        this.emit('shard:error', { id, error: err.message });
        throw err;
      }
    }

    /**
     * Disconnect shard
     */
    async disconnect(id) {
      const shard = this.shards.get(id);
      if (!shard) return;

      if (shard.connector && typeof shard.connector.disconnect === 'function') {
        await shard.connector.disconnect();
      }

      shard.connector = null;
      shard.status = SHARD_STATUS.DISCONNECTED;
      this.emit('shard:disconnected', { id });
    }

    /**
     * Create connector based on shard type
     */
    async createConnector(shard, credentials) {
      switch (shard.type) {
        case SHARD_TYPE.GOOGLE:
          return new GoogleShardConnector(shard.config, credentials);

        case SHARD_TYPE.SUPABASE:
          return new SupabaseShardConnector(shard.config, credentials);

        case SHARD_TYPE.LOCAL:
          return new LocalShardConnector(shard.config);

        case SHARD_TYPE.CUSTOM:
          if (shard.config.connectorClass) {
            return new shard.config.connectorClass(shard.config, credentials);
          }
          return new CustomShardConnector(shard.config, credentials);

        default:
          throw new Error(`Unknown shard type: ${shard.type}`);
      }
    }

    /**
     * Event handling
     */
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }

    off(event, callback) {
      const listeners = this.listeners.get(event);
      if (listeners) {
        const idx = listeners.indexOf(callback);
        if (idx !== -1) listeners.splice(idx, 1);
      }
    }

    emit(event, data) {
      const listeners = this.listeners.get(event) || [];
      for (const cb of listeners) {
        try { cb(data); } catch (e) { console.error('[ShardRegistry] Event error:', e); }
      }
    }

    /**
     * Export configuration
     */
    exportConfig() {
      const config = {};
      for (const [id, shard] of this.shards) {
        config[id] = {
          id: shard.id,
          type: shard.type,
          status: shard.status,
          config: { ...shard.config, credentials: undefined },
          lastSync: shard.lastSync
        };
      }
      return config;
    }

    /**
     * Import configuration
     */
    importConfig(config) {
      for (const [id, shardConfig] of Object.entries(config)) {
        this.register(id, shardConfig);
      }
    }
  }

  // ============================================
  // SHARD CONNECTORS
  // ============================================

  /**
   * Base shard connector
   */
  class BaseShardConnector {
    constructor(config, credentials = {}) {
      this.config = config;
      this.credentials = credentials;
      this.connected = false;
    }

    async connect() {
      throw new Error('connect() not implemented');
    }

    async disconnect() {
      this.connected = false;
    }

    async read(key) {
      throw new Error('read() not implemented');
    }

    async write(key, value) {
      throw new Error('write() not implemented');
    }

    async list(prefix = '') {
      throw new Error('list() not implemented');
    }

    async delete(key) {
      throw new Error('delete() not implemented');
    }

    async sync(localData) {
      throw new Error('sync() not implemented');
    }
  }

  /**
   * Google Drive/Sheets shard connector
   */
  class GoogleShardConnector extends BaseShardConnector {
    constructor(config, credentials) {
      super(config, credentials);
      this.accessToken = null;
      this.folderId = config.folderId || null;
    }

    async connect() {
      if (!this.credentials.accessToken) {
        throw new Error('Google access token required');
      }
      this.accessToken = this.credentials.accessToken;
      this.connected = true;
      return this;
    }

    async disconnect() {
      this.accessToken = null;
      this.connected = false;
    }

    async read(key) {
      if (!this.connected) throw new Error('Not connected');

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(key)}' and '${this.folderId}' in parents`,
        {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
        }
      );

      const data = await response.json();
      if (data.files && data.files.length > 0) {
        const fileId = data.files[0].id;
        const contentResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          {
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
          }
        );
        return await contentResponse.text();
      }
      return null;
    }

    async write(key, value) {
      if (!this.connected) throw new Error('Not connected');

      const metadata = {
        name: key,
        parents: this.folderId ? [this.folderId] : []
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([value], { type: 'application/octet-stream' }));

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.accessToken}` },
          body: form
        }
      );

      return await response.json();
    }

    async list(prefix = '') {
      if (!this.connected) throw new Error('Not connected');

      const query = this.folderId
        ? `'${this.folderId}' in parents`
        : `name contains '${prefix}'`;

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
        {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
        }
      );

      const data = await response.json();
      return data.files || [];
    }

    async sync(localData) {
      // Sync local data to Google Drive
      const results = [];
      for (const [key, value] of Object.entries(localData)) {
        try {
          await this.write(key, JSON.stringify(value));
          results.push({ key, status: 'synced' });
        } catch (err) {
          results.push({ key, status: 'error', error: err.message });
        }
      }
      return results;
    }
  }

  /**
   * Supabase shard connector
   */
  class SupabaseShardConnector extends BaseShardConnector {
    constructor(config, credentials) {
      super(config, credentials);
      this.url = config.url;
      this.table = config.table || 'kuhul_data';
      this.apiKey = null;
    }

    async connect() {
      if (!this.credentials.apiKey) {
        throw new Error('Supabase API key required');
      }
      this.apiKey = this.credentials.apiKey;
      this.connected = true;
      return this;
    }

    async disconnect() {
      this.apiKey = null;
      this.connected = false;
    }

    async read(key) {
      if (!this.connected) throw new Error('Not connected');

      const response = await fetch(
        `${this.url}/rest/v1/${this.table}?key=eq.${encodeURIComponent(key)}&select=value`,
        {
          headers: {
            'apikey': this.apiKey,
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      const data = await response.json();
      return data.length > 0 ? data[0].value : null;
    }

    async write(key, value) {
      if (!this.connected) throw new Error('Not connected');

      const response = await fetch(
        `${this.url}/rest/v1/${this.table}`,
        {
          method: 'POST',
          headers: {
            'apikey': this.apiKey,
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
        }
      );

      return response.ok;
    }

    async list(prefix = '') {
      if (!this.connected) throw new Error('Not connected');

      const query = prefix ? `key=like.${encodeURIComponent(prefix)}*` : '';
      const response = await fetch(
        `${this.url}/rest/v1/${this.table}?${query}&select=key`,
        {
          headers: {
            'apikey': this.apiKey,
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      const data = await response.json();
      return data.map(row => row.key);
    }

    async delete(key) {
      if (!this.connected) throw new Error('Not connected');

      const response = await fetch(
        `${this.url}/rest/v1/${this.table}?key=eq.${encodeURIComponent(key)}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': this.apiKey,
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.ok;
    }

    async sync(localData) {
      const results = [];
      for (const [key, value] of Object.entries(localData)) {
        try {
          await this.write(key, value);
          results.push({ key, status: 'synced' });
        } catch (err) {
          results.push({ key, status: 'error', error: err.message });
        }
      }
      return results;
    }
  }

  /**
   * Local storage shard connector
   */
  class LocalShardConnector extends BaseShardConnector {
    constructor(config) {
      super(config, {});
      this.prefix = config.prefix || 'kuhul_';
      this.storage = config.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    }

    async connect() {
      if (!this.storage) {
        throw new Error('Storage not available');
      }
      this.connected = true;
      return this;
    }

    async read(key) {
      if (!this.connected) throw new Error('Not connected');
      const value = this.storage.getItem(this.prefix + key);
      return value ? JSON.parse(value) : null;
    }

    async write(key, value) {
      if (!this.connected) throw new Error('Not connected');
      this.storage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    }

    async list(prefix = '') {
      if (!this.connected) throw new Error('Not connected');
      const keys = [];
      const fullPrefix = this.prefix + prefix;
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key.startsWith(fullPrefix)) {
          keys.push(key.substring(this.prefix.length));
        }
      }
      return keys;
    }

    async delete(key) {
      if (!this.connected) throw new Error('Not connected');
      this.storage.removeItem(this.prefix + key);
      return true;
    }

    async sync(localData) {
      for (const [key, value] of Object.entries(localData)) {
        await this.write(key, value);
      }
      return Object.keys(localData).map(k => ({ key: k, status: 'synced' }));
    }
  }

  /**
   * Custom shard connector (placeholder for user implementations)
   */
  class CustomShardConnector extends BaseShardConnector {
    constructor(config, credentials) {
      super(config, credentials);
      this.endpoint = config.endpoint;
    }

    async connect() {
      if (!this.endpoint) {
        throw new Error('Custom endpoint required');
      }

      const response = await fetch(`${this.endpoint}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.credentials)
      });

      if (!response.ok) {
        throw new Error('Connection failed');
      }

      this.connected = true;
      return this;
    }

    async read(key) {
      if (!this.connected) throw new Error('Not connected');
      const response = await fetch(`${this.endpoint}/read/${encodeURIComponent(key)}`);
      return response.ok ? await response.json() : null;
    }

    async write(key, value) {
      if (!this.connected) throw new Error('Not connected');
      const response = await fetch(`${this.endpoint}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      return response.ok;
    }

    async list(prefix = '') {
      if (!this.connected) throw new Error('Not connected');
      const response = await fetch(`${this.endpoint}/list?prefix=${encodeURIComponent(prefix)}`);
      return response.ok ? await response.json() : [];
    }

    async delete(key) {
      if (!this.connected) throw new Error('Not connected');
      const response = await fetch(`${this.endpoint}/delete/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      return response.ok;
    }

    async sync(localData) {
      if (!this.connected) throw new Error('Not connected');
      const response = await fetch(`${this.endpoint}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localData)
      });
      return response.ok ? await response.json() : [];
    }
  }

  // ============================================
  // GAS FILE REGISTRY
  // ============================================

  class GasRegistry {
    constructor() {
      this.gasFiles = new Map();
      this.builtins = new Map();
      this.userGas = new Map();
    }

    /**
     * Register builtin gas file
     */
    registerBuiltin(id, gasFile) {
      const gas = {
        id,
        type: GAS_TYPE.BUILTIN,
        source: gasFile.source || null,
        exports: gasFile.exports || {},
        loaded: true,
        error: null
      };

      this.builtins.set(id, gas);
      this.gasFiles.set(id, gas);
      return gas;
    }

    /**
     * Register user gas file
     */
    registerUser(id, config) {
      const gas = {
        id,
        type: GAS_TYPE.USER,
        source: config.source || null,
        url: config.url || null,
        exports: {},
        loaded: false,
        error: null
      };

      this.userGas.set(id, gas);
      this.gasFiles.set(id, gas);
      return gas;
    }

    /**
     * Load gas file
     */
    async load(id) {
      const gas = this.gasFiles.get(id);
      if (!gas) {
        throw new Error(`Gas file ${id} not found`);
      }

      if (gas.loaded) {
        return gas;
      }

      try {
        if (gas.url) {
          const response = await fetch(gas.url);
          gas.source = await response.text();
        }

        if (gas.source) {
          // Parse and evaluate gas file in sandbox
          gas.exports = await this.evaluateGas(gas.source);
          gas.loaded = true;
        }

        return gas;

      } catch (err) {
        gas.error = err.message;
        throw err;
      }
    }

    /**
     * Evaluate gas file in sandbox
     */
    async evaluateGas(source) {
      // Create sandboxed context
      const sandbox = {
        console: console,
        Math: Math,
        Date: Date,
        JSON: JSON,
        exports: {}
      };

      // Wrap in function to capture exports
      const wrapped = `
        (function(exports, console, Math, Date, JSON) {
          ${source}
          return exports;
        })(sandbox.exports, sandbox.console, sandbox.Math, sandbox.Date, sandbox.JSON)
      `;

      try {
        const result = eval(wrapped);
        return result || sandbox.exports;
      } catch (err) {
        console.error('[GasRegistry] Eval error:', err);
        throw err;
      }
    }

    /**
     * Get gas file
     */
    get(id) {
      return this.gasFiles.get(id);
    }

    /**
     * Get all gas files
     */
    getAll() {
      return Array.from(this.gasFiles.values());
    }

    /**
     * Get gas exports
     */
    getExports(id) {
      const gas = this.gasFiles.get(id);
      return gas ? gas.exports : null;
    }

    /**
     * Execute gas function
     */
    async execute(id, functionName, args = []) {
      const gas = await this.load(id);
      const fn = gas.exports[functionName];

      if (typeof fn !== 'function') {
        throw new Error(`Function ${functionName} not found in gas ${id}`);
      }

      return await fn(...args);
    }

    /**
     * Unload gas file
     */
    unload(id) {
      const gas = this.gasFiles.get(id);
      if (gas) {
        gas.loaded = false;
        gas.exports = {};
      }
    }

    /**
     * List builtin gas files
     */
    listBuiltins() {
      return Array.from(this.builtins.keys());
    }

    /**
     * List user gas files
     */
    listUser() {
      return Array.from(this.userGas.keys());
    }
  }

  // ============================================
  // BUILTIN GAS FILES
  // ============================================

  const BUILTIN_GAS = {
    'math': {
      exports: {
        add: (a, b) => a + b,
        sub: (a, b) => a - b,
        mul: (a, b) => a * b,
        div: (a, b) => b !== 0 ? a / b : 0,
        mod: (a, b) => a % b,
        pow: Math.pow,
        sqrt: Math.sqrt,
        abs: Math.abs,
        floor: Math.floor,
        ceil: Math.ceil,
        round: Math.round,
        min: Math.min,
        max: Math.max,
        random: () => Math.random(), // Note: Not deterministic
        pi: () => Math.PI,
        e: () => Math.E
      }
    },
    'hash': {
      exports: {
        fnv1a32: (str) => {
          let h = 2166136261;
          for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
          }
          return h;
        },
        h32: (str) => {
          const h = BUILTIN_GAS.hash.exports.fnv1a32(str);
          return 'h:' + h.toString(16).padStart(8, '0');
        }
      }
    },
    'string': {
      exports: {
        length: (s) => s.length,
        upper: (s) => s.toUpperCase(),
        lower: (s) => s.toLowerCase(),
        trim: (s) => s.trim(),
        split: (s, sep) => s.split(sep),
        join: (arr, sep) => arr.join(sep),
        replace: (s, from, to) => s.replace(from, to),
        slice: (s, start, end) => s.slice(start, end),
        includes: (s, sub) => s.includes(sub),
        startsWith: (s, prefix) => s.startsWith(prefix),
        endsWith: (s, suffix) => s.endsWith(suffix)
      }
    },
    'array': {
      exports: {
        length: (arr) => arr.length,
        first: (arr) => arr[0],
        last: (arr) => arr[arr.length - 1],
        get: (arr, i) => arr[i],
        slice: (arr, start, end) => arr.slice(start, end),
        concat: (a, b) => a.concat(b),
        reverse: (arr) => [...arr].reverse(),
        sort: (arr) => [...arr].sort(),
        filter: (arr, pred) => arr.filter(pred),
        map: (arr, fn) => arr.map(fn),
        reduce: (arr, fn, init) => arr.reduce(fn, init),
        find: (arr, pred) => arr.find(pred),
        findIndex: (arr, pred) => arr.findIndex(pred),
        includes: (arr, val) => arr.includes(val),
        unique: (arr) => [...new Set(arr)]
      }
    },
    'json': {
      exports: {
        parse: (s) => JSON.parse(s),
        stringify: (obj) => JSON.stringify(obj),
        prettyPrint: (obj) => JSON.stringify(obj, null, 2),
        clone: (obj) => JSON.parse(JSON.stringify(obj)),
        get: (obj, path) => {
          const parts = path.split('.');
          let current = obj;
          for (const part of parts) {
            if (current == null) return undefined;
            current = current[part];
          }
          return current;
        },
        set: (obj, path, value) => {
          const parts = path.split('.');
          const last = parts.pop();
          let current = obj;
          for (const part of parts) {
            if (current[part] == null) current[part] = {};
            current = current[part];
          }
          current[last] = value;
          return obj;
        }
      }
    }
  };

  // ============================================
  // PUBLIC API
  // ============================================

  const GasShards = {
    version: GAS_SHARDS_VERSION,

    // Types
    SHARD_TYPE,
    SHARD_STATUS,
    GAS_TYPE,

    // Registries
    ShardRegistry,
    GasRegistry,

    // Connectors
    BaseShardConnector,
    GoogleShardConnector,
    SupabaseShardConnector,
    LocalShardConnector,
    CustomShardConnector,

    // Builtins
    BUILTIN_GAS,

    /**
     * Create a new shard registry
     */
    createShardRegistry: function() {
      return new ShardRegistry();
    },

    /**
     * Create a new gas registry with builtins
     */
    createGasRegistry: function(includeBuiltins = true) {
      const registry = new GasRegistry();

      if (includeBuiltins) {
        for (const [id, gas] of Object.entries(BUILTIN_GAS)) {
          registry.registerBuiltin(id, gas);
        }
      }

      return registry;
    },

    /**
     * Quick shard setup from config
     */
    setupShards: async function(config) {
      const registry = new ShardRegistry();

      for (const [id, shardConfig] of Object.entries(config)) {
        registry.register(id, shardConfig);

        if (shardConfig.autoConnect && shardConfig.credentials) {
          try {
            await registry.connect(id, shardConfig.credentials);
          } catch (err) {
            console.warn(`[GasShards] Failed to connect shard ${id}:`, err);
          }
        }
      }

      return registry;
    },

    /**
     * Quick gas setup from config
     */
    setupGas: async function(config) {
      const registry = this.createGasRegistry(config.includeBuiltins !== false);

      if (config.user) {
        for (const [id, gasConfig] of Object.entries(config.user)) {
          registry.registerUser(id, gasConfig);

          if (gasConfig.autoLoad) {
            try {
              await registry.load(id);
            } catch (err) {
              console.warn(`[GasShards] Failed to load gas ${id}:`, err);
            }
          }
        }
      }

      return registry;
    }
  };

  // Export
  global.GasShards = GasShards;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GasShards;
  }

  console.log('[GasShards] Gas Files & Shards System v' + GAS_SHARDS_VERSION + ' loaded');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
