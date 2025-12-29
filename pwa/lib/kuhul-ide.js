/**
 * K'UHUL IDE v1.0.0
 *
 * Interactive Development Environment for K'UHUL programs.
 * Features:
 * - Syntax highlighting for Mayan glyphs and C@@L markers
 * - Real-time parsing and validation
 * - Pack explorer
 * - Execution visualization
 * - SCXQ2 fingerprint inspector
 *
 * The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK
 */

(function(global) {
  'use strict';

  const IDE_VERSION = '1.0.0';

  // ============================================
  // SYNTAX HIGHLIGHTING
  // ============================================

  const SyntaxHighlighter = {
    // Token patterns for highlighting
    patterns: {
      // Mayan glyph markers
      mayanGlyph: /⟁(Pop|Wo|Sek|Xul|Ch'en|Yax|K'ayab|Shen|then|else|Kumk'u)⟁/g,

      // C@@L markers
      coolBlock: /C@@L\s+BLOCK\s+\w+/g,
      coolVector: /C@@L\s+ATOMIC_VECTOR\s+@\w+/g,
      coolVariable: /C@@L\s+ATOMIC_VARIABLE\s+@\w+/g,

      // Atoms
      atom: /@\w+/g,

      // Strings
      string: /"(?:[^"\\]|\\.)*"/g,

      // Numbers
      number: /-?\d+\.?\d*/g,

      // Comments
      comment: /(#.*$|\/\/.*$|\/\*[\s\S]*?\*\/)/gm,

      // Keywords
      keyword: /\b(define_function|define_class|define_macro|return|if|for|while|in|from|to|new|true|false|null|map|go|channel|observable|subscribe|query|assert_fact|define_rule|matrix_multiply|transpose|softmax)\b/g,

      // JSON blocks
      jsonBlock: /\{[\s\S]*?\}/g,
      jsonArray: /\[[\s\S]*?\]/g
    },

    // CSS classes for each token type
    classes: {
      mayanGlyph: 'kuhul-glyph',
      coolBlock: 'kuhul-cool-block',
      coolVector: 'kuhul-cool-vector',
      coolVariable: 'kuhul-cool-var',
      atom: 'kuhul-atom',
      string: 'kuhul-string',
      number: 'kuhul-number',
      comment: 'kuhul-comment',
      keyword: 'kuhul-keyword',
      jsonBlock: 'kuhul-json',
      jsonArray: 'kuhul-json'
    },

    /**
     * Highlight K'UHUL source code
     */
    highlight: function(source) {
      let html = this.escapeHtml(source);

      // Apply highlighting in order (comments first to prevent conflicts)
      html = this.highlightPattern(html, 'comment');
      html = this.highlightPattern(html, 'string');
      html = this.highlightPattern(html, 'mayanGlyph');
      html = this.highlightPattern(html, 'coolBlock');
      html = this.highlightPattern(html, 'coolVector');
      html = this.highlightPattern(html, 'coolVariable');
      html = this.highlightPattern(html, 'atom');
      html = this.highlightPattern(html, 'number');
      html = this.highlightPattern(html, 'keyword');

      return html;
    },

    /**
     * Highlight a specific pattern
     */
    highlightPattern: function(html, patternName) {
      const pattern = this.patterns[patternName];
      const className = this.classes[patternName];

      return html.replace(pattern, (match) => {
        return `<span class="${className}">${match}</span>`;
      });
    },

    /**
     * Escape HTML special characters
     */
    escapeHtml: function(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    /**
     * Get CSS styles for syntax highlighting
     */
    getStyles: function() {
      return `
        .kuhul-editor {
          font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
          font-size: 14px;
          line-height: 1.5;
          background: #1a1a2e;
          color: #e0e0e0;
          padding: 16px;
          border-radius: 8px;
          overflow: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .kuhul-glyph {
          color: #ff6b6b;
          font-weight: bold;
          text-shadow: 0 0 8px rgba(255, 107, 107, 0.5);
        }

        .kuhul-cool-block {
          color: #4ecdc4;
          font-weight: bold;
        }

        .kuhul-cool-vector {
          color: #45b7d1;
        }

        .kuhul-cool-var {
          color: #96ceb4;
        }

        .kuhul-atom {
          color: #ffd93d;
        }

        .kuhul-string {
          color: #a8e6cf;
        }

        .kuhul-number {
          color: #ff9ff3;
        }

        .kuhul-comment {
          color: #6c757d;
          font-style: italic;
        }

        .kuhul-keyword {
          color: #c792ea;
        }

        .kuhul-json {
          color: #82aaff;
        }

        .kuhul-error {
          text-decoration: wavy underline red;
        }

        .kuhul-line-number {
          color: #4a4a5a;
          padding-right: 16px;
          user-select: none;
        }
      `;
    }
  };

  // ============================================
  // PACK EXPLORER
  // ============================================

  const PackExplorer = {
    packs: [
      {
        name: 'pack_lam_o',
        version: '1.0.0',
        description: 'Llama/Ollama model runner',
        handlers: [
          'lam_o.infer', 'lam_o.chat', 'lam_o.generate',
          'lam_o.embed', 'lam_o.list_models', 'lam_o.show_model'
        ],
        variables: ['@lam_o_endpoint', '@lam_o_default_model']
      },
      {
        name: 'pack_scxq2',
        version: '1.0.0',
        description: 'SCXQ2 fingerprinting and XCFE compression',
        handlers: [
          'scxq2.fingerprint', 'scxq2.verify',
          'scxq2.compress', 'scxq2.decompress'
        ],
        vectors: ['@fingerprint'],
        variables: ['@scxq2_version', '@xcfe_version']
      },
      {
        name: 'pack_asx_ram',
        version: '1.0.0',
        description: 'ASX-RAM memory system',
        handlers: [
          'asx_ram.get', 'asx_ram.set', 'asx_ram.delete',
          'asx_ram.list', 'asx_ram.clear'
        ]
      },
      {
        name: 'pack_mx2lm',
        version: '1.0.0',
        description: 'MX2LM multi-model orchestrator',
        handlers: [
          'mx2lm.route', 'mx2lm.pipeline',
          'mx2lm.broadcast', 'mx2lm.status'
        ],
        variables: ['@mx2lm_mode']
      },
      {
        name: 'pack_llama',
        version: '1.0.0',
        description: 'Llama model components in K\'UHUL',
        handlers: [
          'llama.tokenize', 'llama.decode',
          'llama.generate', 'llama.info'
        ]
      }
    ],

    /**
     * Render pack explorer
     */
    render: function() {
      let html = '<div class="pack-explorer">';
      html += '<h3>📦 Pack Explorer</h3>';

      for (const pack of this.packs) {
        html += `
          <div class="pack-item" data-pack="${pack.name}">
            <div class="pack-header">
              <span class="pack-name">${pack.name}</span>
              <span class="pack-version">v${pack.version}</span>
            </div>
            <div class="pack-desc">${pack.description}</div>
            <div class="pack-handlers">
              <strong>Handlers:</strong>
              ${pack.handlers ? pack.handlers.map(h => `<code>${h}</code>`).join(' ') : 'None'}
            </div>
            ${pack.vectors ? `
              <div class="pack-vectors">
                <strong>Vectors:</strong>
                ${pack.vectors.map(v => `<code>${v}</code>`).join(' ')}
              </div>
            ` : ''}
            ${pack.variables ? `
              <div class="pack-variables">
                <strong>Variables:</strong>
                ${pack.variables.map(v => `<code>${v}</code>`).join(' ')}
              </div>
            ` : ''}
          </div>
        `;
      }

      html += '</div>';
      return html;
    },

    /**
     * Get pack by name
     */
    getPack: function(name) {
      return this.packs.find(p => p.name === name);
    },

    /**
     * Get CSS styles for pack explorer
     */
    getStyles: function() {
      return `
        .pack-explorer {
          background: #16213e;
          border-radius: 8px;
          padding: 16px;
          max-height: 400px;
          overflow-y: auto;
        }

        .pack-explorer h3 {
          margin: 0 0 16px 0;
          color: #4ecdc4;
        }

        .pack-item {
          background: #1a1a2e;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
          border-left: 3px solid #4ecdc4;
        }

        .pack-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .pack-name {
          color: #ff6b6b;
          font-weight: bold;
        }

        .pack-version {
          color: #6c757d;
          font-size: 12px;
        }

        .pack-desc {
          color: #e0e0e0;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .pack-handlers, .pack-vectors, .pack-variables {
          font-size: 12px;
          margin-top: 4px;
        }

        .pack-handlers code, .pack-vectors code, .pack-variables code {
          background: #0f3460;
          color: #ffd93d;
          padding: 2px 6px;
          border-radius: 4px;
          margin: 2px;
          display: inline-block;
        }
      `;
    }
  };

  // ============================================
  // EXECUTION VISUALIZER
  // ============================================

  const ExecutionVisualizer = {
    phases: ['perceive', 'represent', 'reason', 'decide', 'act', 'reflect'],

    /**
     * Render execution visualization
     */
    render: function(state) {
      let html = '<div class="exec-viz">';
      html += '<h3>🔄 Execution State</h3>';

      // Phase indicator
      html += '<div class="phase-indicator">';
      for (let i = 0; i < this.phases.length; i++) {
        const phase = this.phases[i];
        const isActive = state && state.phase === i;
        html += `<span class="phase ${isActive ? 'active' : ''}">${phase}</span>`;
      }
      html += '</div>';

      // Runtime state
      if (state) {
        html += `
          <div class="state-info">
            <div><strong>Booted:</strong> ${state.booted ? '✅' : '❌'}</div>
            <div><strong>Handlers:</strong> ${state.handlers || 0}</div>
            <div><strong>Variables:</strong> ${state.variables || 0}</div>
            <div><strong>Errors:</strong> ${(state.errors || []).length}</div>
          </div>
        `;

        // Boot steps
        if (state.boot_steps && state.boot_steps.length > 0) {
          html += '<div class="boot-steps"><strong>Boot Steps:</strong><ul>';
          for (const step of state.boot_steps) {
            html += `<li>${step}</li>`;
          }
          html += '</ul></div>';
        }
      }

      html += '</div>';
      return html;
    },

    /**
     * Get CSS styles for execution visualizer
     */
    getStyles: function() {
      return `
        .exec-viz {
          background: #16213e;
          border-radius: 8px;
          padding: 16px;
        }

        .exec-viz h3 {
          margin: 0 0 16px 0;
          color: #45b7d1;
        }

        .phase-indicator {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .phase {
          background: #1a1a2e;
          color: #6c757d;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          transition: all 0.3s;
        }

        .phase.active {
          background: #4ecdc4;
          color: #16213e;
          font-weight: bold;
        }

        .state-info {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }

        .state-info > div {
          background: #1a1a2e;
          padding: 8px;
          border-radius: 4px;
          font-size: 13px;
        }

        .boot-steps ul {
          margin: 8px 0 0 20px;
          padding: 0;
          font-size: 12px;
          color: #a0a0a0;
        }
      `;
    }
  };

  // ============================================
  // SCXQ2 INSPECTOR
  // ============================================

  const SCXQ2Inspector = {
    /**
     * Render fingerprint inspector
     */
    render: function(data) {
      if (!data) {
        return '<div class="scxq2-inspector"><p>No data to inspect</p></div>';
      }

      let html = '<div class="scxq2-inspector">';
      html += '<h3>🔐 SCXQ2 Fingerprint</h3>';

      // Generate fingerprint
      const fingerprint = this.generateFingerprint(data);

      html += `
        <div class="fingerprint">
          <code>${fingerprint}</code>
        </div>
        <div class="fingerprint-parts">
          <span class="version">${fingerprint.split(':')[0]}</span>
          <span class="hash">${fingerprint.split(':')[1] || ''}</span>
        </div>
      `;

      // Show data preview
      html += `
        <div class="data-preview">
          <strong>Data:</strong>
          <pre>${JSON.stringify(data, null, 2).substring(0, 500)}${JSON.stringify(data).length > 500 ? '...' : ''}</pre>
        </div>
      `;

      html += '</div>';
      return html;
    },

    /**
     * Generate SCXQ2 fingerprint
     */
    generateFingerprint: function(data) {
      // Use the SCXQ2 module if available
      if (global.SCXQ2 && global.SCXQ2.generate) {
        return global.SCXQ2.generate(data);
      }

      // Fallback simple hash
      const str = JSON.stringify(data);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `SCXQ2-v1:${Math.abs(hash).toString(16).padStart(32, '0')}`;
    },

    /**
     * Get CSS styles for SCXQ2 inspector
     */
    getStyles: function() {
      return `
        .scxq2-inspector {
          background: #16213e;
          border-radius: 8px;
          padding: 16px;
        }

        .scxq2-inspector h3 {
          margin: 0 0 16px 0;
          color: #ffd93d;
        }

        .fingerprint {
          background: #1a1a2e;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 8px;
          overflow-x: auto;
        }

        .fingerprint code {
          color: #4ecdc4;
          font-family: monospace;
          font-size: 14px;
        }

        .fingerprint-parts {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 12px;
        }

        .fingerprint-parts .version {
          color: #ff6b6b;
        }

        .fingerprint-parts .hash {
          color: #a0a0a0;
          font-family: monospace;
        }

        .data-preview pre {
          background: #1a1a2e;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          color: #e0e0e0;
          overflow-x: auto;
          max-height: 200px;
        }
      `;
    }
  };

  // ============================================
  // K'UHUL IDE MAIN CLASS
  // ============================================

  class KuhulIDE {
    constructor(container, options = {}) {
      this.container = typeof container === 'string'
        ? document.querySelector(container)
        : container;
      this.options = options;
      this.source = '';
      this.ast = null;
      this.errors = [];
      this.state = null;

      this.init();
    }

    init() {
      // Inject styles
      this.injectStyles();

      // Render IDE
      this.render();

      // Set up event listeners
      this.setupEvents();
    }

    injectStyles() {
      const styleId = 'kuhul-ide-styles';
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .kuhul-ide {
          display: grid;
          grid-template-columns: 1fr 300px;
          grid-template-rows: auto 1fr auto;
          gap: 16px;
          height: 100%;
          min-height: 500px;
          background: #0f0f23;
          padding: 16px;
          border-radius: 12px;
        }

        .kuhul-ide-header {
          grid-column: 1 / -1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 16px;
          border-bottom: 1px solid #2a2a4a;
        }

        .kuhul-ide-title {
          color: #ff6b6b;
          font-size: 20px;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .kuhul-ide-title .glyph {
          font-size: 24px;
        }

        .kuhul-ide-actions {
          display: flex;
          gap: 8px;
        }

        .kuhul-ide-btn {
          background: #4ecdc4;
          color: #16213e;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        }

        .kuhul-ide-btn:hover {
          background: #45b7d1;
          transform: translateY(-1px);
        }

        .kuhul-ide-btn.secondary {
          background: #1a1a2e;
          color: #e0e0e0;
          border: 1px solid #4a4a5a;
        }

        .kuhul-ide-editor-container {
          position: relative;
        }

        .kuhul-ide-editor {
          width: 100%;
          height: 100%;
          min-height: 300px;
          background: #1a1a2e;
          color: #e0e0e0;
          border: 1px solid #2a2a4a;
          border-radius: 8px;
          padding: 16px;
          font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
          font-size: 14px;
          line-height: 1.5;
          resize: none;
          outline: none;
        }

        .kuhul-ide-editor:focus {
          border-color: #4ecdc4;
        }

        .kuhul-ide-sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
        }

        .kuhul-ide-output {
          grid-column: 1 / -1;
          background: #1a1a2e;
          border-radius: 8px;
          padding: 16px;
          max-height: 200px;
          overflow-y: auto;
        }

        .kuhul-ide-output h4 {
          margin: 0 0 8px 0;
          color: #4ecdc4;
        }

        .kuhul-ide-output pre {
          margin: 0;
          color: #e0e0e0;
          font-size: 13px;
          white-space: pre-wrap;
        }

        .kuhul-ide-error {
          color: #ff6b6b;
          background: rgba(255, 107, 107, 0.1);
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        ${SyntaxHighlighter.getStyles()}
        ${PackExplorer.getStyles()}
        ${ExecutionVisualizer.getStyles()}
        ${SCXQ2Inspector.getStyles()}
      `;
      document.head.appendChild(style);
    }

    render() {
      this.container.innerHTML = `
        <div class="kuhul-ide">
          <div class="kuhul-ide-header">
            <div class="kuhul-ide-title">
              <span class="glyph">⟁</span>
              K'UHUL IDE
              <span class="glyph">⟁</span>
            </div>
            <div class="kuhul-ide-actions">
              <button class="kuhul-ide-btn" id="kuhul-run">▶ Run</button>
              <button class="kuhul-ide-btn secondary" id="kuhul-parse">Parse</button>
              <button class="kuhul-ide-btn secondary" id="kuhul-clear">Clear</button>
            </div>
          </div>

          <div class="kuhul-ide-editor-container">
            <textarea class="kuhul-ide-editor" id="kuhul-source" placeholder="# Enter K'UHUL code here...
⟁Pop⟁ manifest_ast {
  &quot;n&quot;: &quot;my_program&quot;,
  &quot;v&quot;: &quot;1.0.0&quot;
}

⟁Wo⟁ message = &quot;Hello, K'UHUL!&quot;

C@@L BLOCK hello_handler
  @handler: hello
  @message: &quot;Greeting from K'UHUL&quot;

⟁Ch'en⟁ {&quot;ok&quot;: true}"></textarea>
          </div>

          <div class="kuhul-ide-sidebar">
            <div id="kuhul-exec-viz"></div>
            <div id="kuhul-pack-explorer"></div>
          </div>

          <div class="kuhul-ide-output">
            <h4>📤 Output</h4>
            <div id="kuhul-output-content">
              <pre>Ready. Press Run to execute.</pre>
            </div>
          </div>
        </div>
      `;

      // Render sidebar components
      document.getElementById('kuhul-exec-viz').innerHTML =
        ExecutionVisualizer.render(this.state);
      document.getElementById('kuhul-pack-explorer').innerHTML =
        PackExplorer.render();
    }

    setupEvents() {
      // Run button
      document.getElementById('kuhul-run').addEventListener('click', () => {
        this.run();
      });

      // Parse button
      document.getElementById('kuhul-parse').addEventListener('click', () => {
        this.parse();
      });

      // Clear button
      document.getElementById('kuhul-clear').addEventListener('click', () => {
        document.getElementById('kuhul-source').value = '';
        document.getElementById('kuhul-output-content').innerHTML =
          '<pre>Cleared.</pre>';
      });

      // Editor input
      document.getElementById('kuhul-source').addEventListener('input', (e) => {
        this.source = e.target.value;
      });

      // Keyboard shortcuts
      document.getElementById('kuhul-source').addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
          this.run();
        }
      });
    }

    parse() {
      this.source = document.getElementById('kuhul-source').value;

      try {
        // Use the KHLParser if available
        if (global.KHLParser) {
          this.ast = global.KHLParser.parse(this.source);
          this.errors = [];

          this.showOutput({
            type: 'parse',
            ast: this.ast,
            message: 'Parsed successfully'
          });
        } else {
          this.showOutput({
            type: 'error',
            message: 'KHLParser not available'
          });
        }
      } catch (error) {
        this.errors.push(error.message);
        this.showOutput({
          type: 'error',
          message: error.message
        });
      }
    }

    run() {
      this.source = document.getElementById('kuhul-source').value;

      try {
        // Use the KHLRuntime if available
        if (global.KHLParser && global.KHLRuntime) {
          // Parse
          this.ast = global.KHLParser.parse(this.source);

          // Create runtime
          const runtime = global.KHLRuntime.create();

          // Load source
          runtime.load(this.source);

          // Boot kernel
          runtime.dispatch('kernel_boot', {}).then(result => {
            this.state = runtime.getState();

            // Update visualization
            document.getElementById('kuhul-exec-viz').innerHTML =
              ExecutionVisualizer.render(this.state);

            this.showOutput({
              type: 'run',
              result: result,
              state: this.state.getState()
            });
          }).catch(err => {
            this.showOutput({
              type: 'error',
              message: err.message
            });
          });
        } else {
          // Fallback: just parse and show AST
          this.parse();
        }
      } catch (error) {
        this.showOutput({
          type: 'error',
          message: error.message
        });
      }
    }

    showOutput(output) {
      const container = document.getElementById('kuhul-output-content');

      if (output.type === 'error') {
        container.innerHTML = `
          <div class="kuhul-ide-error">
            ❌ Error: ${output.message}
          </div>
        `;
      } else {
        container.innerHTML = `
          <pre>${JSON.stringify(output, null, 2)}</pre>
        `;
      }
    }

    /**
     * Get highlighted HTML
     */
    getHighlightedSource() {
      return SyntaxHighlighter.highlight(this.source);
    }

    /**
     * Set source code
     */
    setSource(source) {
      this.source = source;
      const editor = document.getElementById('kuhul-source');
      if (editor) {
        editor.value = source;
      }
    }

    /**
     * Get source code
     */
    getSource() {
      return this.source;
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  const KuhulIDE_API = {
    version: IDE_VERSION,

    /**
     * Create a new IDE instance
     */
    create: function(container, options) {
      return new KuhulIDE(container, options);
    },

    // Expose components
    SyntaxHighlighter,
    PackExplorer,
    ExecutionVisualizer,
    SCXQ2Inspector,

    // IDE class
    IDE: KuhulIDE
  };

  // ============================================
  // EXPORTS
  // ============================================

  global.KuhulIDE = KuhulIDE_API;

  // CommonJS export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KuhulIDE_API;
  }

  console.log('[KuhulIDE] K\'UHUL IDE v' + IDE_VERSION + ' loaded');
  console.log('[KuhulIDE] The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
