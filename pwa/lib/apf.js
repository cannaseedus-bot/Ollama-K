/**
 * APF (Atomic Prompt Fold) Language v1.0.0
 *
 * Implements Atomic Prompt Language for K'UHUL Pi Kernel.
 *
 * Principles:
 * - Prompts are Atomic Blocks
 * - Every prompt is deterministic
 * - Folds are tokenizers
 * - Language = Code
 *
 * The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK
 */

(function(global) {
  'use strict';

  const APF_VERSION = '1.0.0';

  // ============================================
  // COGNITIVE ALPHABET (28 symbols)
  // ============================================

  const COGNITIVE_ALPHABET = Object.freeze({
    // Layer 1 - Meta (M)
    'M.I': { symbol: 'M.I', name: 'introspect',   domain: 'META', kernel: 0,  glyph: 'META_INTROSPECT' },
    'M.U': { symbol: 'M.U', name: 'uncertainty',  domain: 'META', kernel: 1,  glyph: 'META_UNCERTAINTY' },
    'M.G': { symbol: 'M.G', name: 'goal',         domain: 'META', kernel: 2,  glyph: 'META_GOAL' },
    'M.M': { symbol: 'M.M', name: 'mode',         domain: 'META', kernel: 3,  glyph: 'META_MODE' },

    // Layer 2 - Transform (T)
    'T.T': { symbol: 'T.T', name: 'tokenize',     domain: 'CORE', kernel: 4,  glyph: 'CORE_TOKENIZE' },
    'T.C': { symbol: 'T.C', name: 'context',      domain: 'CORE', kernel: 5,  glyph: 'CORE_CONTEXT' },
    'T.A': { symbol: 'T.A', name: 'attention',    domain: 'CORE', kernel: 6,  glyph: 'CORE_ATTENTION' },
    'T.R': { symbol: 'T.R', name: 'reason',       domain: 'CORE', kernel: 7,  glyph: 'CORE_REASON' },

    // Layer 3 - Operations (O)
    'O.R': { symbol: 'O.R', name: 'routing',      domain: 'OPS',  kernel: 8,  glyph: 'OPS_ROUTING' },
    'O.X': { symbol: 'O.X', name: 'exec',         domain: 'OPS',  kernel: 9,  glyph: 'OPS_EXEC' },
    'O.C': { symbol: 'O.C', name: 'compress',     domain: 'OPS',  kernel: 10, glyph: 'OPS_COMPRESS' },
    'O.M': { symbol: 'O.M', name: 'memory',       domain: 'OPS',  kernel: 11, glyph: 'OPS_MEMORY' },

    // Layer 4 - Guard (G)
    'G.S': { symbol: 'G.S', name: 'safety',       domain: 'SAFE', kernel: 12, glyph: 'SAFE_SAFETY' },
    'G.G': { symbol: 'G.G', name: 'generate',     domain: 'SAFE', kernel: 13, glyph: 'SAFE_GENERATE' },
    'G.C': { symbol: 'G.C', name: 'correct',      domain: 'SAFE', kernel: 14, glyph: 'SAFE_CORRECT' },
    'G.K': { symbol: 'G.K', name: 'knowledge',    domain: 'CORE', kernel: 15, glyph: 'CORE_KNOWLEDGE' },

    // Layer 5 - Learn (L)
    'L.P': { symbol: 'L.P', name: 'curriculum',   domain: 'LEARN', kernel: 16, glyph: 'LEARN_CURRICULUM' },
    'L.S': { symbol: 'L.S', name: 'skill',        domain: 'LEARN', kernel: 17, glyph: 'LEARN_SKILL' },
    'L.Y': { symbol: 'L.Y', name: 'symbolic',     domain: 'OPS',   kernel: 18, glyph: 'OPS_SYMBOLIC' },
    'L.F': { symbol: 'L.F', name: 'feedback',     domain: 'LEARN', kernel: 19, glyph: 'LEARN_FEEDBACK' },

    // Layer 6 - Environment (E)
    'E.T': { symbol: 'E.T', name: 'tools',        domain: 'ENV',  kernel: 20, glyph: 'ENV_TOOLS' },
    'E.S': { symbol: 'E.S', name: 'sandbox',      domain: 'ENV',  kernel: 21, glyph: 'ENV_SANDBOX' },
    'E.P': { symbol: 'E.P', name: 'state',        domain: 'ENV',  kernel: 22, glyph: 'ENV_STATE' },
    'E.M': { symbol: 'E.M', name: 'mesh',         domain: 'ENV',  kernel: 23, glyph: 'ENV_MESH' },

    // Layer 7 - Identity (I)
    'I.S': { symbol: 'I.S', name: 'splash',       domain: 'ID',   kernel: 24, glyph: 'ID_SPLASH' },
    'I.F': { symbol: 'I.F', name: 'fingerprint',  domain: 'ID',   kernel: 25, glyph: 'ID_FINGERPRINT' },
    'I.P': { symbol: 'I.P', name: 'persona',      domain: 'ID',   kernel: 26, glyph: 'ID_PERSONA' },
    'I.H': { symbol: 'I.H', name: 'heraldry',     domain: 'ID',   kernel: 27, glyph: 'ID_HERALDRY' }
  });

  // Symbol to kernel mapping
  const SYMBOL_TO_KERNEL = {};
  for (const [sym, def] of Object.entries(COGNITIVE_ALPHABET)) {
    SYMBOL_TO_KERNEL[sym] = def.kernel;
  }

  // ============================================
  // APF TOKEN TYPES
  // ============================================

  const TOKEN_TYPE = {
    SYMBOL: 'SYMBOL',       // M.I, T.A, etc.
    GLYPH: 'GLYPH',         // @ @@ @@@ @@@@
    PROOF: 'PROOF',         // ⚡
    ATOMIC: 'ATOMIC',       // ⚛
    COMPOSE: 'COMPOSE',     // ⟁
    FOLD: 'FOLD',           // Fold marker
    TEXT: 'TEXT',           // Raw text
    NUMBER: 'NUMBER',       // Numeric value
    WEIGHT: 'WEIGHT',       // Weight annotation
    INTENT: 'INTENT',       // Intent marker
    CONSTRAINT: 'CONSTRAINT' // Constraint definition
  };

  // ============================================
  // APF LEXER
  // ============================================

  class APFLexer {
    constructor(source) {
      this.source = source;
      this.pos = 0;
      this.tokens = [];
    }

    tokenize() {
      while (this.pos < this.source.length) {
        this.skipWhitespace();
        if (this.pos >= this.source.length) break;

        const token = this.nextToken();
        if (token) this.tokens.push(token);
      }
      return this.tokens;
    }

    nextToken() {
      const ch = this.peek();

      // Cognitive symbol (M.I, T.A, etc.)
      if (this.isUpperCase(ch) && this.peek(1) === '.') {
        return this.readCognitiveSymbol();
      }

      // Glyph tokens
      if (ch === '@') {
        return this.readGlyph();
      }

      // Special symbols
      if (ch === '⚡') {
        this.advance();
        return { type: TOKEN_TYPE.PROOF, value: '⚡' };
      }
      if (ch === '⚛') {
        this.advance();
        return { type: TOKEN_TYPE.ATOMIC, value: '⚛' };
      }
      if (ch === '⟁') {
        this.advance();
        return { type: TOKEN_TYPE.COMPOSE, value: '⟁' };
      }

      // Weight annotation [w:1.5]
      if (ch === '[') {
        return this.readWeight();
      }

      // Intent marker {intent}
      if (ch === '{') {
        return this.readIntent();
      }

      // Constraint <constraint>
      if (ch === '<') {
        return this.readConstraint();
      }

      // Number
      if (this.isDigit(ch) || (ch === '-' && this.isDigit(this.peek(1)))) {
        return this.readNumber();
      }

      // Text block
      if (ch === '"') {
        return this.readQuotedText();
      }

      // Unknown - skip
      this.advance();
      return null;
    }

    readCognitiveSymbol() {
      let symbol = this.advance(); // First letter
      symbol += this.advance();     // Dot
      symbol += this.advance();     // Second letter

      if (COGNITIVE_ALPHABET[symbol]) {
        return { type: TOKEN_TYPE.SYMBOL, value: symbol, def: COGNITIVE_ALPHABET[symbol] };
      }

      return { type: TOKEN_TYPE.TEXT, value: symbol };
    }

    readGlyph() {
      let glyph = '';
      while (this.peek() === '@') {
        glyph += this.advance();
      }
      return { type: TOKEN_TYPE.GLYPH, value: glyph, weight: glyph.length };
    }

    readWeight() {
      this.advance(); // [
      let content = '';
      while (this.pos < this.source.length && this.peek() !== ']') {
        content += this.advance();
      }
      this.advance(); // ]

      const match = content.match(/^w:(\d+\.?\d*)$/);
      if (match) {
        return { type: TOKEN_TYPE.WEIGHT, value: parseFloat(match[1]) };
      }
      return { type: TOKEN_TYPE.TEXT, value: `[${content}]` };
    }

    readIntent() {
      this.advance(); // {
      let content = '';
      let depth = 1;
      while (this.pos < this.source.length && depth > 0) {
        const c = this.peek();
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) break;
        }
        content += this.advance();
      }
      this.advance(); // }
      return { type: TOKEN_TYPE.INTENT, value: content.trim() };
    }

    readConstraint() {
      this.advance(); // <
      let content = '';
      while (this.pos < this.source.length && this.peek() !== '>') {
        content += this.advance();
      }
      this.advance(); // >
      return { type: TOKEN_TYPE.CONSTRAINT, value: content.trim() };
    }

    readNumber() {
      let num = '';
      if (this.peek() === '-') num += this.advance();
      while (this.isDigit(this.peek())) {
        num += this.advance();
      }
      if (this.peek() === '.') {
        num += this.advance();
        while (this.isDigit(this.peek())) {
          num += this.advance();
        }
      }
      return { type: TOKEN_TYPE.NUMBER, value: parseFloat(num) };
    }

    readQuotedText() {
      this.advance(); // "
      let content = '';
      while (this.pos < this.source.length && this.peek() !== '"') {
        if (this.peek() === '\\') {
          this.advance();
          content += this.readEscape();
        } else {
          content += this.advance();
        }
      }
      this.advance(); // "
      return { type: TOKEN_TYPE.TEXT, value: content };
    }

    readEscape() {
      const ch = this.advance();
      switch (ch) {
        case 'n': return '\n';
        case 't': return '\t';
        case '"': return '"';
        case '\\': return '\\';
        default: return ch;
      }
    }

    peek(offset = 0) {
      return this.source[this.pos + offset] || '';
    }

    advance() {
      return this.source[this.pos++] || '';
    }

    skipWhitespace() {
      while (this.pos < this.source.length) {
        const ch = this.peek();
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
          this.advance();
        } else {
          break;
        }
      }
    }

    isDigit(ch) {
      return ch >= '0' && ch <= '9';
    }

    isUpperCase(ch) {
      return ch >= 'A' && ch <= 'Z';
    }
  }

  // ============================================
  // APF PARSER
  // ============================================

  class APFParser {
    constructor(tokens) {
      this.tokens = tokens;
      this.pos = 0;
    }

    parse() {
      const ast = {
        type: 'APFProgram',
        version: APF_VERSION,
        blocks: [],
        intents: [],
        constraints: [],
        symbols: [],
        weights: new Map()
      };

      while (this.pos < this.tokens.length) {
        const node = this.parseNode();
        if (node) {
          if (node.type === 'intent') {
            ast.intents.push(node);
          } else if (node.type === 'constraint') {
            ast.constraints.push(node);
          } else if (node.type === 'symbol') {
            ast.symbols.push(node);
          } else {
            ast.blocks.push(node);
          }
        }
      }

      return ast;
    }

    parseNode() {
      const token = this.peek();
      if (!token) return null;

      switch (token.type) {
        case TOKEN_TYPE.SYMBOL:
          return this.parseSymbolBlock();
        case TOKEN_TYPE.GLYPH:
          return this.parseGlyphBlock();
        case TOKEN_TYPE.PROOF:
          return this.parseProofBlock();
        case TOKEN_TYPE.ATOMIC:
          return this.parseAtomicBlock();
        case TOKEN_TYPE.COMPOSE:
          return this.parseComposeBlock();
        case TOKEN_TYPE.INTENT:
          this.advance();
          return { type: 'intent', value: token.value };
        case TOKEN_TYPE.CONSTRAINT:
          this.advance();
          return { type: 'constraint', value: token.value };
        default:
          this.advance();
          return null;
      }
    }

    parseSymbolBlock() {
      const symbolToken = this.advance();
      const block = {
        type: 'symbol',
        symbol: symbolToken.value,
        kernel: symbolToken.def.kernel,
        domain: symbolToken.def.domain,
        name: symbolToken.def.name,
        weight: 1.0,
        children: []
      };

      // Check for weight annotation
      if (this.peek()?.type === TOKEN_TYPE.WEIGHT) {
        block.weight = this.advance().value;
      }

      // Check for nested content
      if (this.peek()?.type === TOKEN_TYPE.COMPOSE) {
        this.advance();
        while (this.pos < this.tokens.length) {
          const child = this.parseNode();
          if (child) block.children.push(child);
          if (this.peek()?.type === TOKEN_TYPE.COMPOSE) {
            this.advance();
            break;
          }
        }
      }

      return block;
    }

    parseGlyphBlock() {
      const glyphToken = this.advance();
      return {
        type: 'glyph',
        value: glyphToken.value,
        weight: glyphToken.weight
      };
    }

    parseProofBlock() {
      this.advance(); // ⚡
      return {
        type: 'proof',
        requires: [],
        binds: []
      };
    }

    parseAtomicBlock() {
      this.advance(); // ⚛
      const block = {
        type: 'atomic',
        elements: []
      };

      while (this.pos < this.tokens.length) {
        const token = this.peek();
        if (token?.type === TOKEN_TYPE.SYMBOL) {
          block.elements.push(this.advance().value);
        } else {
          break;
        }
      }

      return block;
    }

    parseComposeBlock() {
      this.advance(); // ⟁
      const block = {
        type: 'compose',
        children: []
      };

      while (this.pos < this.tokens.length) {
        const token = this.peek();
        if (token?.type === TOKEN_TYPE.COMPOSE) {
          this.advance();
          break;
        }
        const child = this.parseNode();
        if (child) block.children.push(child);
      }

      return block;
    }

    peek() {
      return this.tokens[this.pos];
    }

    advance() {
      return this.tokens[this.pos++];
    }
  }

  // ============================================
  // APF COMPILER
  // ============================================

  class APFCompiler {
    constructor() {
      this.ast = null;
    }

    compile(source) {
      // Lexer pass
      const lexer = new APFLexer(source);
      const tokens = lexer.tokenize();

      // Parser pass
      const parser = new APFParser(tokens);
      this.ast = parser.parse();

      // Generate execution plan
      const plan = this.generatePlan();

      return {
        ast: this.ast,
        plan: plan,
        tokens: tokens,
        version: APF_VERSION
      };
    }

    generatePlan() {
      const plan = {
        kernelOrder: [],
        weights: new Map(),
        constraints: [],
        intents: []
      };

      // Extract kernel execution order from symbols
      for (const symbol of this.ast.symbols) {
        if (symbol.kernel !== undefined) {
          plan.kernelOrder.push({
            kernel: symbol.kernel,
            symbol: symbol.symbol,
            weight: symbol.weight
          });
          plan.weights.set(symbol.symbol, symbol.weight);
        }
      }

      // Add constraints
      plan.constraints = this.ast.constraints.map(c => c.value);

      // Add intents
      plan.intents = this.ast.intents.map(i => i.value);

      return plan;
    }

    toXJSON() {
      if (!this.ast) return null;

      return {
        '@type': 'apf.program',
        '@version': APF_VERSION,
        '@symbols': this.ast.symbols.map(s => ({
          '@sym': s.symbol,
          '@kernel': s.kernel,
          '@weight': s.weight
        })),
        '@intents': this.ast.intents.map(i => i.value),
        '@constraints': this.ast.constraints.map(c => c.value),
        '@blocks': this.ast.blocks.length
      };
    }
  }

  // ============================================
  // APF EXECUTOR
  // ============================================

  class APFExecutor {
    constructor(abrEngine) {
      this.abr = abrEngine;
    }

    execute(compiledAPF, context = {}) {
      const results = [];
      const plan = compiledAPF.plan;

      // Set tokens from weights
      const tokens = [];
      for (const [symbol, weight] of plan.weights) {
        tokens.push({ glyph: symbol, w: weight });
      }

      if (tokens.length > 0) {
        this.abr.setTokens(tokens);
      }

      // Execute kernels in order
      for (const kernelDef of plan.kernelOrder) {
        const events = this.abr.step();
        results.push({
          kernel: kernelDef.kernel,
          symbol: kernelDef.symbol,
          weight: kernelDef.weight,
          events: events
        });
      }

      return {
        ok: true,
        results: results,
        state: this.abr.getState()
      };
    }
  }

  // ============================================
  // APF TO FOLD CONVERSION
  // ============================================

  /**
   * Convert APF AST to atomic fold format (JSON)
   */
  function astToFold(ast, options = {}) {
    const fold = {
      '@fold': options.foldId || 'APF.PROGRAM.V1',
      '@role': options.role || 'TASK',
      '@intent': deriveIntent(ast),
      '@scope': options.scope || 'LOCAL',
      '@symbols': ast.symbols.map(s => s.symbol),
      '@constraints': ast.constraints.map(c => c.value),
      '@input': options.input || {},
      '@output': {
        type: options.outputType || 'structured_text',
        format: options.outputFormat || 'plain',
        max_tokens: options.maxTokens || 256
      }
    };

    if (options.epoch !== undefined) {
      fold['@epoch'] = options.epoch;
    }

    return fold;
  }

  /**
   * Derive intent from AST based on primary symbols
   */
  function deriveIntent(ast) {
    if (ast.symbols.length === 0) return 'EXECUTE';

    const primary = ast.symbols[0];
    const symbol = primary.symbol;

    // Map cognitive symbols to intents
    if (symbol === 'T.R') return 'REASON';
    if (symbol === 'G.G') return 'GENERATE';
    if (symbol === 'G.C') return 'VERIFY';
    if (symbol === 'O.C') return 'TRANSFORM';
    if (symbol === 'M.I') return 'EXPLAIN';
    if (symbol === 'G.K') return 'SUMMARIZE';
    if (symbol === 'O.X') return 'EXECUTE';

    return 'EXECUTE';
  }

  /**
   * Convert fold to shortform glyph notation
   */
  function foldToShortform(fold) {
    const parts = [];

    // Intent prefix
    const intentMap = {
      'EXPLAIN': 'EXP', 'REASON': 'RSN', 'DECIDE': 'DEC',
      'GENERATE': 'GEN', 'TRANSFORM': 'XFM', 'VERIFY': 'VRF',
      'SUMMARIZE': 'SUM', 'SIMULATE': 'SIM', 'EXECUTE': 'EXE'
    };

    if (fold['@intent']) {
      parts.push(`⟁${fold['@fold']?.split('.')[0] || 'APF'}.${intentMap[fold['@intent'].toUpperCase()] || 'EXE'}`);
    }

    // Output shortform
    if (fold['@output']?.max_tokens) {
      if (fold['@output'].max_tokens <= 100) parts.push('⟁OUT.SHORT');
      else if (fold['@output'].max_tokens <= 500) parts.push('⟁OUT.MED');
      else parts.push('⟁OUT.LONG');
    }

    // Constraints
    if (fold['@constraints']?.includes('SAFE_OUTPUT') || fold['@constraints']?.includes('SAFE')) {
      parts.push('⟁SAFE.ON');
    }

    // Symbols as context
    if (fold['@symbols']?.length > 0) {
      const syms = fold['@symbols'].slice(0, 4).join('.');
      parts.push(`⟁CTX.${syms}`);
    }

    return parts.join(' ');
  }

  /**
   * Parse shortform glyph notation back to fold
   */
  function shortformToFold(shortform) {
    const fold = {
      '@fold': 'APF.SHORTFORM.V1',
      '@role': 'TASK',
      '@intent': 'EXECUTE',
      '@scope': 'LOCAL',
      '@symbols': [],
      '@constraints': [],
      '@output': { type: 'structured_text', format: 'plain', max_tokens: 256 }
    };

    const parts = shortform.split(/\s+/).filter(p => p.startsWith('⟁'));

    for (const part of parts) {
      const cmd = part.slice(1); // Remove ⟁
      const [prefix, suffix] = cmd.split('.');

      if (['APF', 'LLM', 'SYS'].includes(prefix)) {
        fold['@fold'] = `${prefix}.${suffix}.V1`;
        const intentMap = {
          'EXP': 'EXPLAIN', 'RSN': 'REASON', 'DEC': 'DECIDE',
          'GEN': 'GENERATE', 'XFM': 'TRANSFORM', 'VRF': 'VERIFY',
          'SUM': 'SUMMARIZE', 'SIM': 'SIMULATE', 'EXE': 'EXECUTE'
        };
        if (intentMap[suffix]) fold['@intent'] = intentMap[suffix];
      } else if (prefix === 'OUT') {
        const tokenMap = { 'SHORT': 100, 'MED': 500, 'LONG': 2000, 'MAX': 8000 };
        fold['@output'].max_tokens = tokenMap[suffix] || 256;
      } else if (prefix === 'SAFE') {
        if (suffix === 'ON') fold['@constraints'].push('SAFE_OUTPUT');
      } else if (prefix === 'CTX') {
        fold['@symbols'] = suffix.split('.').filter(s => COGNITIVE_ALPHABET[s]);
      }
    }

    return fold;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  const APF = {
    version: APF_VERSION,
    COGNITIVE_ALPHABET,
    SYMBOL_TO_KERNEL,
    TOKEN_TYPE,

    Lexer: APFLexer,
    Parser: APFParser,
    Compiler: APFCompiler,
    Executor: APFExecutor,

    /**
     * Parse APF source to tokens
     */
    tokenize: function(source) {
      const lexer = new APFLexer(source);
      return lexer.tokenize();
    },

    /**
     * Parse APF source to AST
     */
    parse: function(source) {
      const lexer = new APFLexer(source);
      const tokens = lexer.tokenize();
      const parser = new APFParser(tokens);
      return parser.parse();
    },

    /**
     * Compile APF source
     */
    compile: function(source) {
      const compiler = new APFCompiler();
      return compiler.compile(source);
    },

    /**
     * Create executor with ABR engine
     */
    createExecutor: function(abrEngine) {
      return new APFExecutor(abrEngine);
    },

    /**
     * Quick execution helper
     */
    run: function(source, abrEngine) {
      const compiled = this.compile(source);
      const executor = new APFExecutor(abrEngine);
      return executor.execute(compiled);
    },

    /**
     * Get symbol definition
     */
    getSymbol: function(symbol) {
      return COGNITIVE_ALPHABET[symbol] || null;
    },

    /**
     * Get all symbols in a domain
     */
    getSymbolsByDomain: function(domain) {
      return Object.values(COGNITIVE_ALPHABET).filter(s => s.domain === domain);
    },

    // ============================================
    // FOLD CONVERSION API
    // ============================================

    /**
     * Convert compiled APF to atomic fold format
     */
    toFold: function(compiled, options = {}) {
      return astToFold(compiled.ast, options);
    },

    /**
     * Convert fold to shortform glyph notation
     * e.g. "⟁LLM.RSN ⟁OUT.SHORT ⟁SAFE.ON ⟁CTX.T.R.M.I"
     */
    foldToShortform: function(fold) {
      return foldToShortform(fold);
    },

    /**
     * Parse shortform glyph notation to fold
     */
    shortformToFold: function(shortform) {
      return shortformToFold(shortform);
    },

    /**
     * Compile APF source directly to fold
     */
    compileToFold: function(source, options = {}) {
      const compiled = this.compile(source);
      return this.toFold(compiled, options);
    },

    // ============================================
    // APSX BINARY ENCODING API
    // ============================================

    /**
     * Encode APF to APSX binary format
     * Requires APSX library to be loaded
     */
    toAPSX: async function(source, options = {}) {
      if (typeof APSX === 'undefined') {
        throw new Error('APSX library not loaded. Import lib/apsx.js first.');
      }
      const fold = typeof source === 'string' ? this.compileToFold(source, options) : source;
      return APSX.pack(fold);
    },

    /**
     * Decode APSX binary to fold
     */
    fromAPSX: async function(bytes, options = {}) {
      if (typeof APSX === 'undefined') {
        throw new Error('APSX library not loaded. Import lib/apsx.js first.');
      }
      return APSX.unpack(bytes, options);
    },

    /**
     * Validate APSX binary
     */
    validateAPSX: async function(bytes) {
      if (typeof APSX === 'undefined') {
        throw new Error('APSX library not loaded. Import lib/apsx.js first.');
      }
      return APSX.validate(bytes);
    },

    /**
     * Get APSX statistics
     */
    statsAPSX: async function(bytes) {
      if (typeof APSX === 'undefined') {
        throw new Error('APSX library not loaded. Import lib/apsx.js first.');
      }
      return APSX.stats(bytes);
    },

    // ============================================
    // COMPRESSION HELPERS
    // ============================================

    /**
     * Compute compression ratio: JSON size vs APSX size
     */
    compressionRatio: async function(source, options = {}) {
      const fold = typeof source === 'string' ? this.compileToFold(source, options) : source;
      const jsonSize = new TextEncoder().encode(JSON.stringify(fold)).length;
      const apsxBytes = await this.toAPSX(fold);
      const apsxSize = apsxBytes.length;

      return {
        jsonSize,
        apsxSize,
        ratio: jsonSize / apsxSize,
        savings: ((jsonSize - apsxSize) / jsonSize * 100).toFixed(1) + '%'
      };
    }
  };

  // Export
  global.APF = APF;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = APF;
  }

  console.log('[APF] Atomic Prompt Fold v' + APF_VERSION + ' loaded');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
