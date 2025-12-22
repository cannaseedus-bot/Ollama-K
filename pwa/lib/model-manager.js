/**
 * K'uhul Model Manager
 *
 * Manages model installation, listing, and removal for the built-in Ollama runtime.
 * KUHUL already includes Ollama - users don't need to install it separately.
 *
 * Pi-GOAT provides the virtual runtimes (JS, Python, Java, K'uhul)
 * Ollama provides the model inference runtime
 */

(function(global) {
  'use strict';

  // ============================================
  // Default/Recommended Models
  // ============================================

  const RECOMMENDED_MODELS = [
    {
      name: 'deepseek-r1',
      displayName: 'DeepSeek R1',
      description: 'Advanced reasoning model with chain-of-thought',
      size: '7B',
      category: 'reasoning',
      tags: ['reasoning', 'code', 'analysis']
    },
    {
      name: 'deepseek-r1:14b',
      displayName: 'DeepSeek R1 14B',
      description: 'Larger reasoning model for complex tasks',
      size: '14B',
      category: 'reasoning',
      tags: ['reasoning', 'code', 'analysis']
    },
    {
      name: 'janus',
      displayName: 'Janus',
      description: 'Multimodal model for text and image understanding',
      size: '7B',
      category: 'multimodal',
      tags: ['vision', 'multimodal', 'image']
    },
    {
      name: 'qwen2.5-coder',
      displayName: 'Qwen 2.5 Coder',
      description: 'Code-specialized model from Alibaba',
      size: '7B',
      category: 'code',
      tags: ['code', 'programming', 'development']
    },
    {
      name: 'qwen2.5-coder:14b',
      displayName: 'Qwen 2.5 Coder 14B',
      description: 'Larger code model for complex programming',
      size: '14B',
      category: 'code',
      tags: ['code', 'programming', 'development']
    },
    {
      name: 'llama3.2',
      displayName: 'Llama 3.2',
      description: 'Meta\'s latest open model',
      size: '3B',
      category: 'general',
      tags: ['chat', 'general', 'fast']
    },
    {
      name: 'llama3.2:7b',
      displayName: 'Llama 3.2 7B',
      description: 'Balanced performance and speed',
      size: '7B',
      category: 'general',
      tags: ['chat', 'general']
    },
    {
      name: 'codellama',
      displayName: 'Code Llama',
      description: 'Code-specialized Llama model',
      size: '7B',
      category: 'code',
      tags: ['code', 'programming']
    },
    {
      name: 'mistral',
      displayName: 'Mistral 7B',
      description: 'Efficient and capable general model',
      size: '7B',
      category: 'general',
      tags: ['chat', 'general', 'efficient']
    },
    {
      name: 'mixtral',
      displayName: 'Mixtral 8x7B',
      description: 'Mixture of experts model',
      size: '8x7B',
      category: 'general',
      tags: ['chat', 'general', 'moe']
    },
    {
      name: 'phi3',
      displayName: 'Phi-3',
      description: 'Microsoft\'s small but capable model',
      size: '3.8B',
      category: 'general',
      tags: ['chat', 'fast', 'efficient']
    },
    {
      name: 'gemma2',
      displayName: 'Gemma 2',
      description: 'Google\'s open model',
      size: '9B',
      category: 'general',
      tags: ['chat', 'general']
    },
    {
      name: 'starcoder2',
      displayName: 'StarCoder 2',
      description: 'Code generation model',
      size: '7B',
      category: 'code',
      tags: ['code', 'programming']
    }
  ];

  // ============================================
  // Model Manager
  // ============================================

  const ModelManager = {
    _baseUrl: null,
    _installedModels: [],
    _pullProgress: {},

    /**
     * Initialize with base URL
     * @param {string} baseUrl - Ollama API base URL
     */
    init: function(baseUrl) {
      this._baseUrl = baseUrl || 'http://localhost:11434';
      console.log('[ModelManager] Initialized with base URL:', this._baseUrl);
    },

    /**
     * Get list of installed models
     * @returns {Promise<Array>}
     */
    getInstalledModels: async function() {
      try {
        const response = await fetch(`${this._baseUrl}/api/tags`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        this._installedModels = data.models || [];
        return this._installedModels;
      } catch (error) {
        console.error('[ModelManager] Failed to get models:', error);
        return [];
      }
    },

    /**
     * Check if a model is installed
     * @param {string} name - Model name
     * @returns {boolean}
     */
    isInstalled: function(name) {
      const baseName = name.split(':')[0];
      return this._installedModels.some(m => {
        const modelBase = m.name.split(':')[0];
        return modelBase === baseName || m.name === name;
      });
    },

    /**
     * Pull/install a model
     * @param {string} name - Model name
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>}
     */
    pullModel: async function(name, onProgress) {
      console.log('[ModelManager] Pulling model:', name);
      this._pullProgress[name] = { status: 'starting', progress: 0 };

      try {
        const response = await fetch(`${this._baseUrl}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, stream: true })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split('\n').filter(Boolean);

          for (const line of lines) {
            try {
              const progress = JSON.parse(line);
              this._pullProgress[name] = progress;

              if (onProgress) {
                onProgress(progress);
              }

              if (progress.status === 'success') {
                console.log('[ModelManager] Model pulled successfully:', name);
                await this.getInstalledModels(); // Refresh list
                return { success: true, model: name };
              }
            } catch (e) {
              // Skip non-JSON lines
            }
          }
        }

        return { success: true, model: name };

      } catch (error) {
        console.error('[ModelManager] Pull failed:', error);
        this._pullProgress[name] = { status: 'error', error: error.message };
        return { success: false, error: error.message };
      }
    },

    /**
     * Delete a model
     * @param {string} name - Model name
     * @returns {Promise<Object>}
     */
    deleteModel: async function(name) {
      console.log('[ModelManager] Deleting model:', name);

      try {
        const response = await fetch(`${this._baseUrl}/api/delete`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        await this.getInstalledModels(); // Refresh list
        return { success: true };

      } catch (error) {
        console.error('[ModelManager] Delete failed:', error);
        return { success: false, error: error.message };
      }
    },

    /**
     * Get model info
     * @param {string} name - Model name
     * @returns {Promise<Object>}
     */
    getModelInfo: async function(name) {
      try {
        const response = await fetch(`${this._baseUrl}/api/show`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();

      } catch (error) {
        console.error('[ModelManager] Get info failed:', error);
        return null;
      }
    },

    /**
     * Get recommended models with install status
     * @returns {Promise<Array>}
     */
    getRecommendedModels: async function() {
      await this.getInstalledModels();

      return RECOMMENDED_MODELS.map(model => ({
        ...model,
        installed: this.isInstalled(model.name)
      }));
    },

    /**
     * Get pull progress for a model
     * @param {string} name - Model name
     * @returns {Object}
     */
    getPullProgress: function(name) {
      return this._pullProgress[name] || null;
    },

    /**
     * Format size for display
     * @param {number} bytes
     * @returns {string}
     */
    formatSize: function(bytes) {
      if (!bytes) return '--';
      const units = ['B', 'KB', 'MB', 'GB'];
      let i = 0;
      while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
      }
      return `${bytes.toFixed(1)} ${units[i]}`;
    },

    /**
     * Get all models (installed + recommended)
     * @returns {Promise<Object>}
     */
    getAllModels: async function() {
      const installed = await this.getInstalledModels();
      const recommended = await this.getRecommendedModels();

      // Find installed models not in recommended list
      const installedNames = new Set(installed.map(m => m.name.split(':')[0]));
      const recommendedNames = new Set(RECOMMENDED_MODELS.map(m => m.name.split(':')[0]));

      const otherInstalled = installed.filter(m => {
        const baseName = m.name.split(':')[0];
        return !recommendedNames.has(baseName);
      }).map(m => ({
        name: m.name,
        displayName: m.name,
        description: 'Installed model',
        size: this.formatSize(m.size),
        category: 'installed',
        installed: true,
        details: m
      }));

      return {
        installed: installed,
        recommended: recommended,
        other: otherInstalled
      };
    }
  };

  // ============================================
  // Export
  // ============================================

  global.ModelManager = ModelManager;
  global.RECOMMENDED_MODELS = RECOMMENDED_MODELS;

  // CommonJS/Node.js export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModelManager, RECOMMENDED_MODELS };
  }

  console.log('[ModelManager] Model Manager loaded - Pi-GOAT runtime ready');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
