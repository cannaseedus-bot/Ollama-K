/**
 * KHL (Kernel Hyper Language) Parser v1.0.0
 *
 * Parses K'UHUL source files (.khl) with C@@L ATOMIC BLOCKS syntax.
 *
 * Syntax Keywords (Mayan calendar-inspired):
 * - Pop   : Definition/Declaration (begin manifest)
 * - Wo    : Assignment/Binding (variables, constants)
 * - Sek   : Control flow/Vectors (if, loop, dispatch)
 * - Xul   : Block/Function definition (C@@L BLOCKS)
 * - Ch'en : Output/Return (emit, return, yield)
 *
 * Special Markers:
 * - ⟁Pop⟁   : Start of declaration block
 * - ⟁Wo⟁    : Variable/constant assignment
 * - ⟁Sek⟁   : Control vector (atomic control flow)
 * - ⟁Xul⟁   : Block definition start
 * - ⟁Ch'en⟁ : Return/emit from block
 *
 * The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK
 */

(function(global) {
  'use strict';

  // ============================================
  // PARSER CONSTANTS
  // ============================================

  const KHL_VERSION = '1.0.0';

  // Token types
  const TOKEN = {
    POP: 'POP',           // ⟁Pop⟁ - declaration
    WO: 'WO',             // ⟁Wo⟁ - assignment
    SEK: 'SEK',           // ⟁Sek⟁ - control vector
    XUL: 'XUL',           // ⟁Xul⟁ - block definition
    CHEN: 'CHEN',         // ⟁Ch'en⟁ - return/emit
    IDENTIFIER: 'IDENT',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    JSON: 'JSON',
    COMMENT: 'COMMENT',
    BLOCK_COMMENT: 'BLOCK_COMMENT',
    COLON: 'COLON',
    NEWLINE: 'NEWLINE',
    EOF: 'EOF',
    AT: 'AT',             // @ prefix for atoms
    ATOMIC_BLOCK: 'ATOMIC_BLOCK',  // ⟁ ATOMIC_BLOCK_* ⟁
    COOL_BLOCK: 'COOL_BLOCK',      // C@@L BLOCK
    COOL_VECTOR: 'COOL_VECTOR',    // C@@L ATOMIC_VECTOR
    COOL_VARIABLE: 'COOL_VARIABLE' // C@@L ATOMIC_VARIABLE
  };

  // Mayan keyword patterns
  const MAYAN_PATTERNS = {
    pop: /⟁Pop⟁/g,
    wo: /⟁Wo⟁/g,
    sek: /⟁Sek⟁/g,
    xul: /⟁Xul⟁/g,
    chen: /⟁Ch'en⟁/g
  };

  // ============================================
  // LEXER
  // ============================================

  class KHLLexer {
    constructor(source) {
      this.source = source;
      this.pos = 0;
      this.line = 1;
      this.col = 1;
      this.tokens = [];
    }

    /**
     * Tokenize the entire source
     */
    tokenize() {
      while (this.pos < this.source.length) {
        this.skipWhitespace();
        if (this.pos >= this.source.length) break;

        const token = this.nextToken();
        if (token) {
          this.tokens.push(token);
        }
      }

      this.tokens.push(this.makeToken(TOKEN.EOF, ''));
      return this.tokens;
    }

    /**
     * Get next token
     */
    nextToken() {
      const ch = this.peek();

      // Mayan glyph markers
      if (ch === '⟁') {
        return this.readMayanMarker();
      }

      // Comments
      if (ch === '/' && this.peek(1) === '*') {
        return this.readBlockComment();
      }
      if (ch === '/' && this.peek(1) === '/') {
        return this.readLineComment();
      }
      if (ch === '#') {
        return this.readLineComment();
      }

      // Strings
      if (ch === '"') {
        return this.readString();
      }

      // JSON blocks (detect by context)
      if (ch === '{') {
        return this.readJSONBlock();
      }
      if (ch === '[') {
        return this.readJSONArray();
      }

      // Numbers
      if (this.isDigit(ch) || (ch === '-' && this.isDigit(this.peek(1)))) {
        return this.readNumber();
      }

      // @ prefix for atoms
      if (ch === '@') {
        return this.readAtom();
      }

      // C@@L markers
      if (ch === 'C' && this.matchAhead('C@@L')) {
        return this.readCoolMarker();
      }

      // Identifiers
      if (this.isAlpha(ch) || ch === '_') {
        return this.readIdentifier();
      }

      // Colon
      if (ch === ':') {
        this.advance();
        return this.makeToken(TOKEN.COLON, ':');
      }

      // Newline
      if (ch === '\n') {
        this.advance();
        this.line++;
        this.col = 1;
        return this.makeToken(TOKEN.NEWLINE, '\n');
      }

      // Unknown - skip
      this.advance();
      return null;
    }

    /**
     * Read Mayan glyph marker (⟁Pop⟁, ⟁Wo⟁, etc.)
     */
    readMayanMarker() {
      const start = this.pos;

      // Read until closing ⟁
      this.advance(); // skip opening ⟁

      let content = '';
      while (this.pos < this.source.length && this.peek() !== '⟁') {
        content += this.advance();
      }

      if (this.peek() === '⟁') {
        this.advance(); // skip closing ⟁
      }

      const marker = '⟁' + content + '⟁';

      // Determine token type
      if (content === 'Pop') return this.makeToken(TOKEN.POP, marker);
      if (content === 'Wo') return this.makeToken(TOKEN.WO, marker);
      if (content === 'Sek') return this.makeToken(TOKEN.SEK, marker);
      if (content === 'Xul') return this.makeToken(TOKEN.XUL, marker);
      if (content === "Ch'en") return this.makeToken(TOKEN.CHEN, marker);

      // Check for ATOMIC_BLOCK markers
      if (content.startsWith(' ATOMIC_BLOCK')) {
        const blockName = content.replace(' ATOMIC_BLOCK_', '').replace(' ', '');
        return this.makeToken(TOKEN.ATOMIC_BLOCK, { marker, name: blockName });
      }

      return this.makeToken(TOKEN.IDENTIFIER, marker);
    }

    /**
     * Read C@@L marker
     */
    readCoolMarker() {
      const start = this.pos;
      let content = '';

      // Read C@@L keyword
      content += this.advance(); // C
      content += this.advance(); // @
      content += this.advance(); // @
      content += this.advance(); // L

      this.skipInlineWhitespace();

      // Check what follows
      if (this.matchAhead('ATOMIC_VECTOR')) {
        while (this.pos < this.source.length && !this.isNewline(this.peek())) {
          content += this.advance();
        }
        return this.makeToken(TOKEN.COOL_VECTOR, content.trim());
      }

      if (this.matchAhead('ATOMIC_VARIABLE')) {
        while (this.pos < this.source.length && !this.isNewline(this.peek())) {
          content += this.advance();
        }
        return this.makeToken(TOKEN.COOL_VARIABLE, content.trim());
      }

      if (this.matchAhead('BLOCK')) {
        while (this.pos < this.source.length && !this.isNewline(this.peek())) {
          content += this.advance();
        }
        return this.makeToken(TOKEN.COOL_BLOCK, content.trim());
      }

      return this.makeToken(TOKEN.IDENTIFIER, content);
    }

    /**
     * Read atom (@identifier)
     */
    readAtom() {
      let content = this.advance(); // @

      while (this.pos < this.source.length &&
             (this.isAlphaNum(this.peek()) || this.peek() === '_')) {
        content += this.advance();
      }

      return this.makeToken(TOKEN.AT, content);
    }

    /**
     * Read string literal
     */
    readString() {
      this.advance(); // skip opening quote
      let content = '';

      while (this.pos < this.source.length && this.peek() !== '"') {
        if (this.peek() === '\\') {
          this.advance();
          content += this.readEscapeChar();
        } else {
          content += this.advance();
        }
      }

      this.advance(); // skip closing quote
      return this.makeToken(TOKEN.STRING, content);
    }

    /**
     * Read JSON block { ... }
     */
    readJSONBlock() {
      const start = this.pos;
      let depth = 0;
      let content = '';

      while (this.pos < this.source.length) {
        const ch = this.peek();

        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            content += this.advance();
            break;
          }
        }

        if (ch === '\n') {
          this.line++;
          this.col = 1;
        }

        content += this.advance();
      }

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(content);
        return this.makeToken(TOKEN.JSON, parsed);
      } catch (e) {
        return this.makeToken(TOKEN.STRING, content);
      }
    }

    /**
     * Read JSON array [ ... ]
     */
    readJSONArray() {
      const start = this.pos;
      let depth = 0;
      let content = '';

      while (this.pos < this.source.length) {
        const ch = this.peek();

        if (ch === '[') depth++;
        else if (ch === ']') {
          depth--;
          if (depth === 0) {
            content += this.advance();
            break;
          }
        }

        if (ch === '\n') {
          this.line++;
          this.col = 1;
        }

        content += this.advance();
      }

      try {
        const parsed = JSON.parse(content);
        return this.makeToken(TOKEN.JSON, parsed);
      } catch (e) {
        return this.makeToken(TOKEN.STRING, content);
      }
    }

    /**
     * Read number
     */
    readNumber() {
      let content = '';

      if (this.peek() === '-') {
        content += this.advance();
      }

      while (this.isDigit(this.peek())) {
        content += this.advance();
      }

      if (this.peek() === '.' && this.isDigit(this.peek(1))) {
        content += this.advance();
        while (this.isDigit(this.peek())) {
          content += this.advance();
        }
      }

      return this.makeToken(TOKEN.NUMBER, parseFloat(content));
    }

    /**
     * Read identifier
     */
    readIdentifier() {
      let content = '';

      while (this.pos < this.source.length &&
             (this.isAlphaNum(this.peek()) || this.peek() === '_' || this.peek() === '.')) {
        content += this.advance();
      }

      return this.makeToken(TOKEN.IDENTIFIER, content);
    }

    /**
     * Read block comment
     */
    readBlockComment() {
      this.advance(); // /
      this.advance(); // *

      let content = '';
      while (this.pos < this.source.length) {
        if (this.peek() === '*' && this.peek(1) === '/') {
          this.advance();
          this.advance();
          break;
        }

        if (this.peek() === '\n') {
          this.line++;
          this.col = 1;
        }

        content += this.advance();
      }

      return this.makeToken(TOKEN.BLOCK_COMMENT, content.trim());
    }

    /**
     * Read line comment
     */
    readLineComment() {
      if (this.peek() === '#') {
        this.advance();
      } else {
        this.advance(); // /
        this.advance(); // /
      }

      let content = '';
      while (this.pos < this.source.length && !this.isNewline(this.peek())) {
        content += this.advance();
      }

      return this.makeToken(TOKEN.COMMENT, content.trim());
    }

    /**
     * Read escape character
     */
    readEscapeChar() {
      const ch = this.advance();
      switch (ch) {
        case 'n': return '\n';
        case 't': return '\t';
        case 'r': return '\r';
        case '"': return '"';
        case '\\': return '\\';
        default: return ch;
      }
    }

    // Utility methods
    peek(offset = 0) {
      return this.source[this.pos + offset] || '';
    }

    advance() {
      const ch = this.source[this.pos] || '';
      this.pos++;
      this.col++;
      return ch;
    }

    matchAhead(str) {
      return this.source.substring(this.pos, this.pos + str.length) === str;
    }

    skipWhitespace() {
      while (this.pos < this.source.length) {
        const ch = this.peek();
        if (ch === ' ' || ch === '\t' || ch === '\r') {
          this.advance();
        } else {
          break;
        }
      }
    }

    skipInlineWhitespace() {
      while (this.pos < this.source.length) {
        const ch = this.peek();
        if (ch === ' ' || ch === '\t') {
          this.advance();
        } else {
          break;
        }
      }
    }

    isDigit(ch) {
      return ch >= '0' && ch <= '9';
    }

    isAlpha(ch) {
      return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
    }

    isAlphaNum(ch) {
      return this.isAlpha(ch) || this.isDigit(ch);
    }

    isNewline(ch) {
      return ch === '\n' || ch === '\r';
    }

    makeToken(type, value) {
      return {
        type,
        value,
        line: this.line,
        col: this.col
      };
    }
  }

  // ============================================
  // PARSER
  // ============================================

  class KHLParser {
    constructor(tokens) {
      this.tokens = tokens.filter(t =>
        t.type !== TOKEN.COMMENT &&
        t.type !== TOKEN.NEWLINE
      );
      this.pos = 0;
    }

    /**
     * Parse tokens into AST
     */
    parse() {
      const ast = {
        type: 'KHLProgram',
        version: KHL_VERSION,
        manifest: null,
        atomicBlocks: {},
        coolBlocks: {},
        coolVectors: {},
        coolVariables: {},
        declarations: [],
        assignments: [],
        blocks: []
      };

      while (!this.isAtEnd()) {
        const node = this.parseTopLevel();
        if (node) {
          this.addNodeToAST(ast, node);
        }
      }

      return ast;
    }

    /**
     * Parse top-level construct
     */
    parseTopLevel() {
      const token = this.peek();

      switch (token.type) {
        case TOKEN.POP:
          return this.parseDeclaration();

        case TOKEN.WO:
          return this.parseAssignment();

        case TOKEN.SEK:
          return this.parseControlVector();

        case TOKEN.XUL:
          return this.parseBlockDefinition();

        case TOKEN.CHEN:
          return this.parseReturnStatement();

        case TOKEN.ATOMIC_BLOCK:
          return this.parseAtomicBlock();

        case TOKEN.COOL_BLOCK:
          return this.parseCoolBlock();

        case TOKEN.COOL_VECTOR:
          return this.parseCoolVector();

        case TOKEN.COOL_VARIABLE:
          return this.parseCoolVariable();

        case TOKEN.BLOCK_COMMENT:
          this.advance();
          return null;

        case TOKEN.EOF:
          return null;

        default:
          this.advance();
          return null;
      }
    }

    /**
     * Parse ⟁Pop⟁ declaration (manifest, config)
     */
    parseDeclaration() {
      this.advance(); // skip ⟁Pop⟁

      const name = this.expect(TOKEN.IDENTIFIER, 'Expected identifier after ⟁Pop⟁');

      // Check for JSON value
      let value = null;
      if (this.check(TOKEN.JSON)) {
        value = this.advance().value;
      }

      return {
        type: 'Declaration',
        name: name.value,
        value: value
      };
    }

    /**
     * Parse ⟁Wo⟁ assignment
     */
    parseAssignment() {
      this.advance(); // skip ⟁Wo⟁

      const name = this.expect(TOKEN.IDENTIFIER, 'Expected identifier after ⟁Wo⟁');

      // Parse value
      let value = null;
      if (this.check(TOKEN.JSON)) {
        value = this.advance().value;
      } else if (this.check(TOKEN.STRING)) {
        value = this.advance().value;
      } else if (this.check(TOKEN.NUMBER)) {
        value = this.advance().value;
      }

      return {
        type: 'Assignment',
        name: name.value,
        value: value
      };
    }

    /**
     * Parse ⟁Sek⟁ control vector
     */
    parseControlVector() {
      this.advance(); // skip ⟁Sek⟁

      const vectorType = this.expect(TOKEN.IDENTIFIER, 'Expected vector type');

      const params = {};

      // Parse parameters until next marker or EOF
      while (!this.isAtEnd() && !this.isMarker()) {
        if (this.check(TOKEN.AT)) {
          const param = this.parseAtomParam();
          params[param.name] = param.value;
        } else {
          this.advance();
        }
      }

      return {
        type: 'ControlVector',
        vectorType: vectorType.value,
        params: params
      };
    }

    /**
     * Parse ⟁Xul⟁ block definition
     */
    parseBlockDefinition() {
      this.advance(); // skip ⟁Xul⟁

      const blockName = this.expect(TOKEN.IDENTIFIER, 'Expected block name');

      const block = {
        type: 'BlockDefinition',
        name: blockName.value,
        params: {},
        body: []
      };

      // Parse block content until ⟁Ch'en⟁ or next ⟁Xul⟁
      while (!this.isAtEnd() && !this.check(TOKEN.CHEN) && !this.check(TOKEN.XUL)) {
        if (this.check(TOKEN.AT)) {
          const param = this.parseAtomParam();
          block.params[param.name] = param.value;
        } else if (this.check(TOKEN.COOL_BLOCK)) {
          const coolBlock = this.parseCoolBlock();
          block.body.push(coolBlock);
        } else {
          this.advance();
        }
      }

      return block;
    }

    /**
     * Parse ⟁Ch'en⟁ return statement
     */
    parseReturnStatement() {
      this.advance(); // skip ⟁Ch'en⟁

      let value = null;
      if (this.check(TOKEN.JSON)) {
        value = this.advance().value;
      } else if (this.check(TOKEN.AT)) {
        value = this.parseAtomParam();
      }

      return {
        type: 'ReturnStatement',
        value: value
      };
    }

    /**
     * Parse ⟁ ATOMIC_BLOCK_* ⟁
     */
    parseAtomicBlock() {
      const token = this.advance();
      const blockName = token.value.name;

      const block = {
        type: 'AtomicBlock',
        name: blockName,
        content: {}
      };

      // Parse content until next ATOMIC_BLOCK or major marker
      while (!this.isAtEnd() &&
             !this.check(TOKEN.ATOMIC_BLOCK) &&
             !this.check(TOKEN.POP) &&
             !this.check(TOKEN.XUL)) {
        if (this.check(TOKEN.AT)) {
          const param = this.parseAtomParam();
          block.content[param.name] = param.value;
        } else if (this.check(TOKEN.JSON)) {
          // Inline JSON content
          const json = this.advance().value;
          Object.assign(block.content, json);
        } else {
          this.advance();
        }
      }

      return block;
    }

    /**
     * Parse C@@L BLOCK
     */
    parseCoolBlock() {
      const token = this.advance();
      const match = token.value.match(/C@@L\s+BLOCK\s+(\w+)/);
      const blockName = match ? match[1] : 'unknown';

      const block = {
        type: 'CoolBlock',
        name: blockName,
        handler: null,
        params: {},
        body: []
      };

      // Parse block content
      while (!this.isAtEnd() &&
             !this.check(TOKEN.COOL_BLOCK) &&
             !this.check(TOKEN.XUL) &&
             !this.check(TOKEN.CHEN)) {
        if (this.check(TOKEN.AT)) {
          const param = this.parseAtomParam();
          block.params[param.name] = param.value;

          // Special handling for @handler
          if (param.name === 'handler') {
            block.handler = param.value;
          }
        } else if (this.check(TOKEN.JSON)) {
          const json = this.advance().value;
          block.body.push(json);
        } else {
          this.advance();
        }
      }

      return block;
    }

    /**
     * Parse C@@L ATOMIC_VECTOR
     */
    parseCoolVector() {
      const token = this.advance();
      const match = token.value.match(/C@@L\s+ATOMIC_VECTOR\s+(@\w+)/);
      const vectorName = match ? match[1] : '@unknown';

      const vector = {
        type: 'CoolVector',
        name: vectorName,
        params: {}
      };

      // Parse vector params
      while (!this.isAtEnd() &&
             !this.check(TOKEN.COOL_VECTOR) &&
             !this.check(TOKEN.COOL_VARIABLE) &&
             !this.check(TOKEN.COOL_BLOCK)) {
        if (this.check(TOKEN.AT)) {
          const param = this.parseAtomParam();
          vector.params[param.name] = param.value;
        } else {
          this.advance();
        }
      }

      return vector;
    }

    /**
     * Parse C@@L ATOMIC_VARIABLE
     */
    parseCoolVariable() {
      const token = this.advance();
      const match = token.value.match(/C@@L\s+ATOMIC_VARIABLE\s+(@\w+)/);
      const varName = match ? match[1] : '@unknown';

      const variable = {
        type: 'CoolVariable',
        name: varName,
        defaultValue: null,
        scope: 'global'
      };

      // Parse variable definition
      while (!this.isAtEnd() &&
             !this.check(TOKEN.COOL_VECTOR) &&
             !this.check(TOKEN.COOL_VARIABLE) &&
             !this.check(TOKEN.COOL_BLOCK)) {
        if (this.check(TOKEN.AT)) {
          const param = this.parseAtomParam();
          if (param.name === 'default') {
            variable.defaultValue = param.value;
          } else if (param.name === 'scope') {
            variable.scope = param.value;
          } else {
            variable[param.name] = param.value;
          }
        } else {
          this.advance();
        }
      }

      return variable;
    }

    /**
     * Parse @param: value
     */
    parseAtomParam() {
      const atom = this.advance(); // @name
      const name = atom.value.substring(1); // remove @

      let value = null;

      // Check for colon
      if (this.check(TOKEN.COLON)) {
        this.advance();
      }

      // Parse value
      if (this.check(TOKEN.JSON)) {
        value = this.advance().value;
      } else if (this.check(TOKEN.STRING)) {
        value = this.advance().value;
      } else if (this.check(TOKEN.NUMBER)) {
        value = this.advance().value;
      } else if (this.check(TOKEN.IDENTIFIER)) {
        value = this.advance().value;
      } else if (this.check(TOKEN.AT)) {
        // Reference to another atom
        value = this.advance().value;
      }

      return { name, value };
    }

    /**
     * Add node to AST based on type
     */
    addNodeToAST(ast, node) {
      switch (node.type) {
        case 'Declaration':
          if (node.name === 'manifest_ast') {
            ast.manifest = node.value;
          }
          ast.declarations.push(node);
          break;

        case 'Assignment':
          ast.assignments.push(node);
          break;

        case 'AtomicBlock':
          ast.atomicBlocks[node.name] = node;
          break;

        case 'CoolBlock':
          ast.coolBlocks[node.name] = node;
          break;

        case 'CoolVector':
          ast.coolVectors[node.name] = node;
          break;

        case 'CoolVariable':
          ast.coolVariables[node.name] = node;
          break;

        case 'BlockDefinition':
          ast.blocks.push(node);
          break;

        default:
          ast.blocks.push(node);
      }
    }

    // Utility methods
    peek() {
      return this.tokens[this.pos] || { type: TOKEN.EOF };
    }

    advance() {
      if (!this.isAtEnd()) this.pos++;
      return this.tokens[this.pos - 1];
    }

    check(type) {
      return this.peek().type === type;
    }

    expect(type, message) {
      if (this.check(type)) {
        return this.advance();
      }
      throw new Error(`${message} at line ${this.peek().line}`);
    }

    isAtEnd() {
      return this.peek().type === TOKEN.EOF;
    }

    isMarker() {
      const t = this.peek().type;
      return t === TOKEN.POP || t === TOKEN.WO || t === TOKEN.SEK ||
             t === TOKEN.XUL || t === TOKEN.CHEN || t === TOKEN.ATOMIC_BLOCK;
    }
  }

  // ============================================
  // KHL COMPILER
  // ============================================

  class KHLCompiler {
    constructor() {
      this.ast = null;
      this.manifest = null;
      this.handlers = {};
      this.variables = {};
      this.vectors = {};
    }

    /**
     * Compile KHL source to runtime structures
     */
    compile(source) {
      // Lexer pass
      const lexer = new KHLLexer(source);
      const tokens = lexer.tokenize();

      // Parser pass
      const parser = new KHLParser(tokens);
      this.ast = parser.parse();

      // Extract manifest
      this.manifest = this.ast.manifest || this.extractManifest(source);

      // Build handler map
      this.buildHandlers();

      // Build variable map
      this.buildVariables();

      // Build vector map
      this.buildVectors();

      return {
        ast: this.ast,
        manifest: this.manifest,
        handlers: this.handlers,
        variables: this.variables,
        vectors: this.vectors,
        version: KHL_VERSION
      };
    }

    /**
     * Extract manifest_ast JSON directly from source
     */
    extractManifest(source) {
      const match = source.match(/⟁Wo⟁\s+manifest_ast\s+(\{[\s\S]*?\n  \})\s*\n/);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch (e) {
          console.warn('[KHL] Failed to parse manifest_ast:', e);
        }
      }
      return null;
    }

    /**
     * Build handler map from C@@L BLOCKS
     */
    buildHandlers() {
      for (const [name, block] of Object.entries(this.ast.coolBlocks)) {
        const handler = block.handler || block.params.handler;
        if (handler) {
          this.handlers[handler] = {
            name: name,
            block: block,
            params: block.params,
            execute: this.createExecutor(block)
          };
        }
      }
    }

    /**
     * Build variable map
     */
    buildVariables() {
      for (const [name, variable] of Object.entries(this.ast.coolVariables)) {
        this.variables[name] = {
          name: name,
          value: variable.defaultValue,
          scope: variable.scope,
          definition: variable
        };
      }
    }

    /**
     * Build vector map
     */
    buildVectors() {
      for (const [name, vector] of Object.entries(this.ast.coolVectors)) {
        this.vectors[name] = {
          name: name,
          params: vector.params,
          execute: this.createVectorExecutor(vector)
        };
      }
    }

    /**
     * Create executor function for C@@L BLOCK
     */
    createExecutor(block) {
      return async (context) => {
        // Execute block with context
        return {
          block: block.name,
          handler: block.handler,
          params: block.params,
          context: context,
          result: null
        };
      };
    }

    /**
     * Create executor function for C@@L VECTOR
     */
    createVectorExecutor(vector) {
      const vectorName = vector.name;

      switch (vectorName) {
        case '@if_then_else':
          return (condition, thenBranch, elseBranch) => {
            return condition ? thenBranch : elseBranch;
          };

        case '@loop':
          return (collection, callback) => {
            return collection.map(callback);
          };

        case '@dispatch':
          return (target, action, payload) => {
            return { target, action, payload };
          };

        case '@microagent':
          return (agentSpec) => {
            return { agent: agentSpec, status: 'spawned' };
          };

        default:
          return (...args) => ({ vector: vectorName, args });
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  const KHLParser_API = {
    version: KHL_VERSION,

    /**
     * Parse KHL source to tokens
     */
    tokenize: function(source) {
      const lexer = new KHLLexer(source);
      return lexer.tokenize();
    },

    /**
     * Parse KHL source to AST
     */
    parse: function(source) {
      const lexer = new KHLLexer(source);
      const tokens = lexer.tokenize();
      const parser = new KHLParser(tokens);
      return parser.parse();
    },

    /**
     * Compile KHL source to runtime structures
     */
    compile: function(source) {
      const compiler = new KHLCompiler();
      return compiler.compile(source);
    },

    /**
     * Extract manifest from KHL source
     */
    extractManifest: function(source) {
      const match = source.match(/⟁Wo⟁\s+manifest_ast\s+(\{[\s\S]*?\n  \})\s*\n/);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch (e) {
          return null;
        }
      }
      return null;
    },

    // Expose classes for advanced usage
    Lexer: KHLLexer,
    Parser: KHLParser,
    Compiler: KHLCompiler,
    TOKEN: TOKEN
  };

  // ============================================
  // EXPORTS
  // ============================================

  global.KHLParser = KHLParser_API;

  // CommonJS export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KHLParser_API;
  }

  console.log('[KHLParser] Kernel Hyper Language Parser v' + KHL_VERSION + ' loaded');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
