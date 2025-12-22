/**
 * KHL (Kernel Hyper Language) Runtime v1.0.0
 *
 * Executes parsed KHL AST with C@@L ATOMIC BLOCKS.
 * Integrates with ABR Engine for atomic execution.
 *
 * The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK
 */

(function(global) {
  'use strict';

  const KHL_RUNTIME_VERSION = '1.0.0';

  // ============================================
  // RUNTIME STATE
  // ============================================

  const RuntimeState = {
    // Global variables
    variables: new Map(),

    // Atomic block handlers
    handlers: new Map(),

    // Vector executors
    vectors: new Map(),

    // ABR Engine reference
    abrEngine: null,

    // Manifest
    manifest: null,

    // Boot state
    booted: false,
    bootSteps: [],
    errors: [],

    // MX2DB runtime storage
    mx2db: {
      n_grams: new Map(),
      supagrams: new Map(),
      rlhf_traces: new Map(),
      agent_state: new Map(),
      training_history: new Map(),
      tapes: new Map(),
      feed_entries: new Map()
    },

    // ASX-RAM
    asxRam: new Map(),

    // DOM state
    domState: null
  };

  // ============================================
  // C@@L ATOMIC VECTORS (CONTROL FLOW)
  // ============================================

  const AtomicVectors = {
    /**
     * @if_then_else - Conditional execution
     */
    '@if_then_else': function(condition, thenBranch, elseBranch, context) {
      const result = this.evaluate(condition, context);
      if (result) {
        return this.execute(thenBranch, context);
      } else if (elseBranch) {
        return this.execute(elseBranch, context);
      }
      return null;
    },

    /**
     * @loop - Iterative execution
     */
    '@loop': function(collection, callback, context) {
      const items = this.evaluate(collection, context);
      const results = [];

      if (Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          const itemContext = { ...context, item: items[i], index: i };
          results.push(this.execute(callback, itemContext));
        }
      } else if (typeof items === 'number') {
        for (let i = 0; i < items; i++) {
          const itemContext = { ...context, index: i };
          results.push(this.execute(callback, itemContext));
        }
      }

      return results;
    },

    /**
     * @dispatch - Route to handler
     */
    '@dispatch': function(target, action, payload, context) {
      const handler = RuntimeState.handlers.get(target);
      if (handler) {
        return handler.execute({ action, payload, ...context });
      }

      // Fallback: emit dispatch event
      return {
        '@dispatch': true,
        target,
        action,
        payload
      };
    },

    /**
     * @microagent - Spawn micro-agent
     */
    '@microagent': function(agentSpec, context) {
      const agent = {
        id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        spec: agentSpec,
        status: 'spawned',
        createdAt: Date.now(),
        context: context
      };

      RuntimeState.mx2db.agent_state.set(agent.id, agent);

      return agent;
    }
  };

  // ============================================
  // C@@L ATOMIC VARIABLES (STATE CONTAINERS)
  // ============================================

  const AtomicVariables = {
    // System state variables
    '@kernel_state': {
      get: () => ({
        booted: RuntimeState.booted,
        bootSteps: RuntimeState.bootSteps,
        errors: RuntimeState.errors,
        manifest: RuntimeState.manifest?.n || 'unknown'
      }),
      set: (value) => {
        if (value.booted !== undefined) RuntimeState.booted = value.booted;
        if (value.errors) RuntimeState.errors = value.errors;
      }
    },

    '@agent_state': {
      get: () => Object.fromEntries(RuntimeState.mx2db.agent_state),
      set: (value) => {
        if (value.id) {
          RuntimeState.mx2db.agent_state.set(value.id, value);
        }
      }
    },

    '@tape_state': {
      get: () => ({
        tapes: Object.fromEntries(RuntimeState.mx2db.tapes),
        active: RuntimeState.asxRam.get('os.active_tape')
      }),
      set: (value) => {
        if (value.active) {
          RuntimeState.asxRam.set('os.active_tape', value.active);
        }
      }
    },

    '@page_state': {
      get: () => ({
        route: RuntimeState.asxRam.get('page.route') || '/',
        params: RuntimeState.asxRam.get('page.params') || {}
      }),
      set: (value) => {
        RuntimeState.asxRam.set('page.route', value.route);
        RuntimeState.asxRam.set('page.params', value.params);
      }
    },

    '@gram_state': {
      get: () => ({
        n_grams: Object.fromEntries(RuntimeState.mx2db.n_grams),
        supagrams: Object.fromEntries(RuntimeState.mx2db.supagrams)
      }),
      set: () => { /* Read-only from gram engine */ }
    },

    '@output_buffer': {
      _buffer: [],
      get: function() { return this._buffer; },
      set: function(value) {
        if (Array.isArray(value)) {
          this._buffer = value;
        } else {
          this._buffer.push(value);
        }
      },
      clear: function() { this._buffer = []; }
    },

    '@error_buffer': {
      _errors: [],
      get: function() { return this._errors; },
      set: function(value) {
        this._errors.push({
          error: value,
          timestamp: Date.now()
        });
      },
      clear: function() { this._errors = []; }
    }
  };

  // ============================================
  // KHL RUNTIME ENGINE
  // ============================================

  class KHLRuntime {
    constructor(options = {}) {
      this.options = options;
      this.abrEngine = options.abrEngine || null;
      this.compiledProgram = null;
      this.executionStack = [];
      this.callDepth = 0;
      this.maxCallDepth = options.maxCallDepth || 100;
    }

    /**
     * Load and compile KHL source
     */
    async load(source) {
      if (!global.KHLParser) {
        throw new Error('KHLParser not loaded');
      }

      this.compiledProgram = global.KHLParser.compile(source);
      RuntimeState.manifest = this.compiledProgram.manifest;

      // Register handlers from compiled program
      this.registerHandlers();

      // Register variables
      this.registerVariables();

      console.log('[KHLRuntime] Program loaded:', {
        blocks: Object.keys(this.compiledProgram.handlers).length,
        variables: Object.keys(this.compiledProgram.variables).length,
        vectors: Object.keys(this.compiledProgram.vectors).length
      });

      return this.compiledProgram;
    }

    /**
     * Register C@@L BLOCK handlers
     */
    registerHandlers() {
      const handlers = this.compiledProgram.handlers;

      for (const [name, handler] of Object.entries(handlers)) {
        RuntimeState.handlers.set(name, {
          name: handler.name,
          block: handler.block,
          params: handler.params,
          execute: this.createBlockExecutor(handler)
        });
      }
    }

    /**
     * Register C@@L ATOMIC_VARIABLE definitions
     */
    registerVariables() {
      const variables = this.compiledProgram.variables;

      for (const [name, variable] of Object.entries(variables)) {
        if (!AtomicVariables[name]) {
          // Create new variable container
          AtomicVariables[name] = {
            _value: variable.value,
            scope: variable.scope,
            get: function() { return this._value; },
            set: function(value) { this._value = value; }
          };
        }

        RuntimeState.variables.set(name, variable.value);
      }
    }

    /**
     * Create executor for a C@@L BLOCK
     */
    createBlockExecutor(handler) {
      const runtime = this;

      return async (context) => {
        // Track call depth
        runtime.callDepth++;
        if (runtime.callDepth > runtime.maxCallDepth) {
          runtime.callDepth--;
          throw new Error('Maximum call depth exceeded');
        }

        try {
          // Build execution context
          const execContext = {
            ...context,
            handler: handler.name,
            params: handler.params,
            runtime: runtime
          };

          // Execute block body
          let result = null;

          // If ABR engine is available, run through ABR pipeline
          if (runtime.abrEngine) {
            const events = runtime.abrEngine.step();
            execContext.abrEvents = events;
            execContext.abrAnswer = runtime.abrEngine.lastAnswer;
          }

          // Execute handler-specific logic
          result = await runtime.executeHandler(handler, execContext);

          return result;

        } finally {
          runtime.callDepth--;
        }
      };
    }

    /**
     * Execute a handler with context
     */
    async executeHandler(handler, context) {
      const handlerName = handler.name;

      // Built-in handlers
      switch (handlerName) {
        // Kernel handlers
        case 'kernel_boot':
          return this.handleKernelBoot(context);

        case 'tape_boot':
          return this.handleTapeBoot(context);

        case 'basher_run':
          return this.handleBasherRun(context);

        // CMS handlers
        case 'cms_rlhf_list':
          return this.handleCmsRlhfList(context);

        case 'cms_rlhf_get':
          return this.handleCmsRlhfGet(context);

        case 'cms_rlhf_post':
          return this.handleCmsRlhfPost(context);

        case 'cms_page_get':
          return this.handleCmsPageGet(context);

        case 'cms_component_get':
          return this.handleCmsComponentGet(context);

        // GRAM handlers
        case 'gram_observe':
          return this.handleGramObserve(context);

        case 'gram_analyze_patterns':
          return this.handleGramAnalyze(context);

        case 'gram_suggest_next':
          return this.handleGramSuggest(context);

        // OMNIBRAIN handlers
        case 'omnibrain_loop':
          return this.handleOmnibrainLoop(context);

        case 'omnibrain_recursion':
          return this.handleOmnibrainRecursion(context);

        // Default: return handler params
        default:
          return {
            ok: true,
            handler: handlerName,
            params: handler.params,
            context: context
          };
      }
    }

    /**
     * Kernel boot handler
     */
    async handleKernelBoot(context) {
      RuntimeState.bootSteps.push('kernel_boot_start');

      // Initialize ABR if available
      if (this.abrEngine) {
        this.abrEngine.reset();
        RuntimeState.bootSteps.push('abr_engine_reset');
      }

      // Load manifest
      if (RuntimeState.manifest) {
        RuntimeState.asxRam.set('os.boot.count',
          (RuntimeState.asxRam.get('os.boot.count') || 0) + 1);
        RuntimeState.asxRam.set('os.state', 'booting');
        RuntimeState.asxRam.set('os.kernel', 'sw.khl Ω.∞.Ω');

        RuntimeState.bootSteps.push('manifest_loaded');
      }

      // Initialize tapes
      if (RuntimeState.manifest?.tapes) {
        for (const [id, tape] of Object.entries(RuntimeState.manifest.tapes)) {
          RuntimeState.mx2db.tapes.set(id, tape);
        }
        RuntimeState.bootSteps.push('tapes_registered');
      }

      RuntimeState.booted = true;
      RuntimeState.asxRam.set('os.state', 'active');
      RuntimeState.bootSteps.push('kernel_boot_complete');

      return {
        ok: true,
        status: 'booted',
        bootSteps: RuntimeState.bootSteps,
        manifest: RuntimeState.manifest?.n
      };
    }

    /**
     * Tape boot handler
     */
    async handleTapeBoot(context) {
      const tapeId = context.params?.tape_id || context.tape_id;

      if (!tapeId) {
        return { ok: false, error: 'No tape_id provided' };
      }

      const tape = RuntimeState.mx2db.tapes.get(tapeId);

      if (!tape) {
        return { ok: false, error: 'Tape not found', tape_id: tapeId };
      }

      RuntimeState.asxRam.set('os.active_tape', tapeId);
      RuntimeState.asxRam.set('tapes.active_id', tapeId);

      return {
        ok: true,
        message: `Tape ${tapeId} booted`,
        tape: tape
      };
    }

    /**
     * Basher run handler
     */
    async handleBasherRun(context) {
      const command = context.command || context.params?.command;

      if (!command) {
        return { ok: false, error: 'No command provided' };
      }

      const parts = command.trim().split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      // Execute basher command
      switch (cmd) {
        case 'tapes.list':
          return {
            ok: true,
            tapes: Array.from(RuntimeState.mx2db.tapes.entries()).map(([id, t]) => ({
              id,
              label: t.label,
              role: t.role
            }))
          };

        case 'tapes.boot':
          return this.handleTapeBoot({ tape_id: args[0] });

        case 'folds.tree':
          return {
            ok: true,
            folds: RuntimeState.manifest?.kuhul_folds || {}
          };

        case 'mesh.status':
          return {
            ok: true,
            routes: Object.keys(RuntimeState.manifest?.rest_mesh?.routes || {})
          };

        case 'ram.get':
          return {
            ok: true,
            key: args[0],
            value: RuntimeState.asxRam.get(args[0])
          };

        case 'ram.set':
          RuntimeState.asxRam.set(args[0], args.slice(1).join(' '));
          return { ok: true, key: args[0] };

        case 'ram.list':
          return {
            ok: true,
            keys: Array.from(RuntimeState.asxRam.keys()),
            count: RuntimeState.asxRam.size
          };

        case 'health':
          return {
            ok: true,
            kernel: 'sw.khl Ω.∞.Ω',
            law: RuntimeState.manifest?.atomic_law,
            booted: RuntimeState.booted,
            ram_keys: RuntimeState.asxRam.size,
            tapes: RuntimeState.mx2db.tapes.size
          };

        case 'abr.step':
          if (this.abrEngine) {
            const events = this.abrEngine.step();
            return {
              ok: true,
              tick: this.abrEngine.tick,
              phase: this.abrEngine.phase,
              events: events.length
            };
          }
          return { ok: false, error: 'ABR Engine not available' };

        case 'abr.status':
          if (this.abrEngine) {
            return {
              ok: true,
              tick: this.abrEngine.tick,
              phase: this.abrEngine.phase,
              entropy: this.abrEngine.entropy,
              lastAnswer: this.abrEngine.lastAnswer,
              lastReward: this.abrEngine.lastReward
            };
          }
          return { ok: false, error: 'ABR Engine not available' };

        default:
          return { ok: false, error: `Unknown command: ${cmd}` };
      }
    }

    /**
     * CMS RLHF list handler
     */
    async handleCmsRlhfList(context) {
      const label = context.query?.label || null;
      const limit = parseInt(context.query?.limit) || 50;
      const offset = parseInt(context.query?.offset) || 0;

      let cases = Array.from(RuntimeState.mx2db.rlhf_traces.values());

      if (label) {
        cases = cases.filter(c => c.label === label);
      }

      const paginated = cases.slice(offset, offset + limit);

      return {
        ok: true,
        mode: 'list',
        items: paginated,
        total: cases.length
      };
    }

    /**
     * CMS RLHF get handler
     */
    async handleCmsRlhfGet(context) {
      const caseId = context.query?.id || context.params?.id;
      const rlhfCase = RuntimeState.mx2db.rlhf_traces.get(caseId);

      if (rlhfCase) {
        return { ok: true, mode: 'get', item: rlhfCase };
      }

      return { ok: false, error: 'Case not found', case_id: caseId };
    }

    /**
     * CMS RLHF post handler
     */
    async handleCmsRlhfPost(context) {
      const body = context.body || {};

      const newCase = {
        case_id: `rlhf_${Date.now()}`,
        title: body.title || 'Untitled',
        label: body.label || 'General',
        author: body.author || 'anonymous',
        body: body.body || '',
        snippet: (body.body || '').substring(0, 150),
        created_at: Date.now(),
        updated_at: Date.now(),
        comment_count: 0,
        score: 0,
        metadata: body.metadata || {}
      };

      RuntimeState.mx2db.rlhf_traces.set(newCase.case_id, newCase);

      return {
        ok: true,
        mode: 'post',
        case_id: newCase.case_id,
        message: 'RLHF case created'
      };
    }

    /**
     * CMS page get handler
     */
    async handleCmsPageGet(context) {
      const pageId = context.query?.id || context.params?.slug;
      const pages = RuntimeState.manifest?.site_content?.pages || {};

      const page = pages[pageId];

      if (page) {
        return {
          ok: true,
          mode: 'page',
          '@id': page['@id'],
          '@type': page['@type'],
          content: page['@content'],
          route: page['@route']
        };
      }

      return { ok: false, error: 'Page not found', page_id: pageId };
    }

    /**
     * CMS component get handler
     */
    async handleCmsComponentGet(context) {
      const componentId = context.query?.id || context.params?.component_id;
      const components = RuntimeState.manifest?.site_content?.components || {};

      const component = components[componentId];

      if (component) {
        return {
          ok: true,
          mode: 'component',
          '@id': component['@id'],
          '@type': component['@type'],
          content: component['@content'],
          route: component['@route']
        };
      }

      return { ok: false, error: 'Component not found', component_id: componentId };
    }

    /**
     * GRAM observe handler
     */
    async handleGramObserve(context) {
      const sequence = context.body?.sequence || [];
      const windowSize = context.body?.window_size || 3;

      // Generate n-grams from sequence
      for (let i = 0; i <= sequence.length - windowSize; i++) {
        const gram = sequence.slice(i, i + windowSize).join('|');
        const count = RuntimeState.mx2db.n_grams.get(gram) || 0;
        RuntimeState.mx2db.n_grams.set(gram, count + 1);
      }

      return {
        ok: true,
        observed: sequence.length,
        n_grams_count: RuntimeState.mx2db.n_grams.size
      };
    }

    /**
     * GRAM analyze patterns handler
     */
    async handleGramAnalyze(context) {
      const grams = Array.from(RuntimeState.mx2db.n_grams.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      return {
        ok: true,
        mode: 'analyze',
        top_patterns: grams.map(([gram, count]) => ({
          gram,
          count,
          frequency: count / RuntimeState.mx2db.n_grams.size
        })),
        total_patterns: RuntimeState.mx2db.n_grams.size
      };
    }

    /**
     * GRAM suggest next handler
     */
    async handleGramSuggest(context) {
      const prefix = context.body?.prefix || [];
      const suggestions = [];

      // Find matching n-grams
      RuntimeState.mx2db.n_grams.forEach((count, gram) => {
        const parts = gram.split('|');
        const prefixStr = prefix.join('|');

        if (gram.startsWith(prefixStr) && parts.length > prefix.length) {
          suggestions.push({
            next: parts[prefix.length],
            confidence: count / RuntimeState.mx2db.n_grams.size,
            count
          });
        }
      });

      // Sort by confidence
      suggestions.sort((a, b) => b.confidence - a.confidence);

      return {
        ok: true,
        mode: 'suggest',
        prefix,
        suggestions: suggestions.slice(0, 5)
      };
    }

    /**
     * OMNIBRAIN loop handler
     */
    async handleOmnibrainLoop(context) {
      const input = context.body?.input || '';
      const maxIterations = context.body?.max_iterations || 3;

      let current = input;
      const iterations = [];

      for (let i = 0; i < maxIterations; i++) {
        // XJSON → KUHUL → AST → Better XJSON
        const iteration = {
          step: i + 1,
          input: current,
          xjson_parse: { parsed: true, tokens: current.split(' ').length },
          kuhul_transform: { transformed: true },
          ast_optimize: { optimized: true },
          output: `[optimized_${i + 1}] ${current}`
        };

        iterations.push(iteration);
        current = iteration.output;

        // Check convergence
        if (i > 0 && iterations[i - 1].output === iteration.output) {
          break;
        }
      }

      return {
        ok: true,
        mode: 'omnibrain_loop',
        input,
        output: current,
        iterations: iterations.length,
        details: iterations
      };
    }

    /**
     * OMNIBRAIN recursion handler
     */
    async handleOmnibrainRecursion(context) {
      const xjson = context.body?.xjson || {};
      const depth = context.body?.depth || 0;
      const maxDepth = context.body?.max_depth || 3;

      if (depth >= maxDepth) {
        return {
          ok: true,
          mode: 'recursion_complete',
          depth,
          result: xjson
        };
      }

      // Recursive transformation
      const transformed = {
        '@recursive': true,
        '@depth': depth + 1,
        '@input': xjson,
        '@kuhul_transformed': true
      };

      return {
        ok: true,
        mode: 'recursion_step',
        depth: depth + 1,
        result: transformed
      };
    }

    /**
     * Execute a vector operation
     */
    executeVector(vectorName, ...args) {
      const context = args[args.length - 1];
      const vectorArgs = args.slice(0, -1);

      const vector = AtomicVectors[vectorName];
      if (vector) {
        return vector.apply(this, [...vectorArgs, context]);
      }

      throw new Error(`Unknown vector: ${vectorName}`);
    }

    /**
     * Get a variable value
     */
    getVariable(varName) {
      const variable = AtomicVariables[varName];
      if (variable && typeof variable.get === 'function') {
        return variable.get();
      }
      return RuntimeState.variables.get(varName);
    }

    /**
     * Set a variable value
     */
    setVariable(varName, value) {
      const variable = AtomicVariables[varName];
      if (variable && typeof variable.set === 'function') {
        variable.set(value);
      }
      RuntimeState.variables.set(varName, value);
    }

    /**
     * Evaluate an expression in context
     */
    evaluate(expr, context) {
      if (typeof expr === 'function') {
        return expr(context);
      }

      if (typeof expr === 'string' && expr.startsWith('@')) {
        return this.getVariable(expr);
      }

      return expr;
    }

    /**
     * Execute an action
     */
    async execute(action, context) {
      if (typeof action === 'function') {
        return await action(context);
      }

      if (typeof action === 'string') {
        const handler = RuntimeState.handlers.get(action);
        if (handler) {
          return await handler.execute(context);
        }
      }

      return action;
    }

    /**
     * Dispatch to a handler by name
     */
    async dispatch(handlerName, context) {
      const handler = RuntimeState.handlers.get(handlerName);
      if (handler) {
        return await handler.execute(context);
      }

      throw new Error(`Handler not found: ${handlerName}`);
    }

    /**
     * Get runtime state
     */
    getState() {
      return {
        booted: RuntimeState.booted,
        bootSteps: RuntimeState.bootSteps,
        errors: RuntimeState.errors,
        manifest: RuntimeState.manifest?.n,
        handlers: Array.from(RuntimeState.handlers.keys()),
        variables: Array.from(RuntimeState.variables.keys()),
        abrStatus: this.abrEngine ? {
          tick: this.abrEngine.tick,
          phase: this.abrEngine.phase
        } : null
      };
    }

    /**
     * Connect to ABR Engine
     */
    connectABR(abrEngine) {
      this.abrEngine = abrEngine;
      RuntimeState.abrEngine = abrEngine;
      console.log('[KHLRuntime] Connected to ABR Engine');
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  const KHLRuntime_API = {
    version: KHL_RUNTIME_VERSION,

    /**
     * Create new runtime instance
     */
    create: function(options) {
      return new KHLRuntime(options);
    },

    /**
     * Get runtime state
     */
    getState: function() {
      return RuntimeState;
    },

    /**
     * Execute a vector
     */
    vector: function(name, ...args) {
      const vector = AtomicVectors[name];
      if (vector) {
        return vector.apply(null, args);
      }
      throw new Error(`Unknown vector: ${name}`);
    },

    /**
     * Get/set variable
     */
    variable: function(name, value) {
      const variable = AtomicVariables[name];
      if (variable) {
        if (arguments.length > 1) {
          variable.set(value);
        }
        return variable.get();
      }
      return null;
    },

    /**
     * Register a handler
     */
    registerHandler: function(name, handler) {
      RuntimeState.handlers.set(name, {
        name,
        execute: handler
      });
    },

    // Expose internal classes
    Runtime: KHLRuntime,
    AtomicVectors,
    AtomicVariables,
    RuntimeState
  };

  // ============================================
  // EXPORTS
  // ============================================

  global.KHLRuntime = KHLRuntime_API;

  // CommonJS export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KHLRuntime_API;
  }

  console.log('[KHLRuntime] Kernel Hyper Language Runtime v' + KHL_RUNTIME_VERSION + ' loaded');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
