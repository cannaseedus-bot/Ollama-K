/**
 * K'uhul XJSON Engine
 *
 * Handles XJSON schema validation, transformation, and execution
 * for model inference operations.
 *
 * XJSON = eXecutable JSON - the data format for K'uhul operations
 */

(function(global) {
  'use strict';

  /**
   * XJSON Schema Definitions
   */
  const XJSON_SCHEMAS = {
    infer: {
      required: ['@runner', '@model', '@prompt'],
      optional: ['@params', '@context', '@mode']
    },
    completion: {
      required: ['@model', '@runner', '@text'],
      optional: ['@tokens', '@metrics', '@scxq2']
    },
    error: {
      required: ['@runner', '@message', '@code'],
      optional: []
    }
  };

  /**
   * XJSON Module
   */
  const XJSON = {
    /**
     * Create an inference request
     * @param {Object} options - Inference options
     * @returns {Object} XJSON request object
     */
    createInferRequest: function(options) {
      const {
        runner = 'lam.o',
        model,
        prompt,
        params = {},
        context = [],
        mode = 'chat'
      } = options;

      if (!model || !prompt) {
        throw new Error('XJSON: model and prompt are required');
      }

      return {
        '@infer': {
          '@runner': runner,
          '@model': model,
          '@prompt': prompt,
          '@params': {
            temperature: params.temperature ?? 0.7,
            top_p: params.top_p ?? 0.9,
            ...params
          },
          '@context': context,
          '@mode': mode
        }
      };
    },

    /**
     * Create a completion response
     * @param {Object} options - Completion options
     * @returns {Object} XJSON response object
     */
    createCompletionResponse: function(options) {
      const {
        model,
        runner = 'lam.o',
        text,
        tokens = {},
        metrics = {},
        scxq2 = null
      } = options;

      const response = {
        '@completion': {
          '@model': model,
          '@runner': runner,
          '@text': text,
          '@tokens': {
            input: tokens.input ?? 0,
            output: tokens.output ?? 0
          },
          '@metrics': {
            latency_ms: metrics.latency_ms ?? 0,
            backend: metrics.backend ?? 'ollama',
            ...metrics
          }
        }
      };

      if (scxq2) {
        response['@completion']['@scxq2'] = scxq2;
      }

      return response;
    },

    /**
     * Create an error response
     * @param {Object} options - Error options
     * @returns {Object} XJSON error object
     */
    createErrorResponse: function(options) {
      const {
        runner = 'lam.o',
        message,
        code = 500
      } = options;

      return {
        '@error': {
          '@runner': runner,
          '@message': message,
          '@code': code
        }
      };
    },

    /**
     * Validate XJSON object against schema
     * @param {Object} xjson - XJSON object
     * @param {string} type - Schema type ('infer', 'completion', 'error')
     * @returns {Object} Validation result {valid: boolean, errors: string[]}
     */
    validate: function(xjson, type) {
      const errors = [];
      const schema = XJSON_SCHEMAS[type];

      if (!schema) {
        return { valid: false, errors: [`Unknown schema type: ${type}`] };
      }

      const keyPrefix = type === 'infer' ? '@infer' :
                        type === 'completion' ? '@completion' : '@error';

      const data = xjson[keyPrefix];

      if (!data) {
        return { valid: false, errors: [`Missing ${keyPrefix} key`] };
      }

      // Check required fields
      for (const field of schema.required) {
        if (data[field] === undefined) {
          errors.push(`Missing required field: ${field}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors
      };
    },

    /**
     * Check if object is XJSON inference request
     * @param {Object} obj - Object to check
     * @returns {boolean}
     */
    isInferRequest: function(obj) {
      return obj && typeof obj === 'object' && '@infer' in obj;
    },

    /**
     * Check if object is XJSON completion response
     * @param {Object} obj - Object to check
     * @returns {boolean}
     */
    isCompletion: function(obj) {
      return obj && typeof obj === 'object' && '@completion' in obj;
    },

    /**
     * Check if object is XJSON error response
     * @param {Object} obj - Object to check
     * @returns {boolean}
     */
    isError: function(obj) {
      return obj && typeof obj === 'object' && '@error' in obj;
    },

    /**
     * Extract text from completion
     * @param {Object} xjson - XJSON completion
     * @returns {string} Extracted text
     */
    extractText: function(xjson) {
      if (this.isCompletion(xjson)) {
        return xjson['@completion']['@text'] || '';
      }
      return '';
    },

    /**
     * Extract error message
     * @param {Object} xjson - XJSON error
     * @returns {string} Error message
     */
    extractError: function(xjson) {
      if (this.isError(xjson)) {
        return xjson['@error']['@message'] || 'Unknown error';
      }
      return '';
    },

    /**
     * Convert Ollama request to XJSON
     * @param {Object} ollamaRequest - Ollama API request
     * @returns {Object} XJSON request
     */
    fromOllamaRequest: function(ollamaRequest) {
      return {
        '@infer': {
          '@runner': 'lam.o',
          '@model': ollamaRequest.model || 'llama3',
          '@prompt': ollamaRequest.prompt || '',
          '@params': {
            temperature: ollamaRequest.options?.temperature ?? 0.7,
            top_p: ollamaRequest.options?.top_p ?? 0.9,
            ...ollamaRequest.options
          },
          '@context': ollamaRequest.context || [],
          '@mode': 'chat'
        }
      };
    },

    /**
     * Convert XJSON to Ollama request
     * @param {Object} xjson - XJSON request
     * @returns {Object} Ollama API request
     */
    toOllamaRequest: function(xjson) {
      const infer = xjson['@infer'] || {};
      const params = infer['@params'] || {};

      return {
        model: infer['@model'],
        prompt: infer['@prompt'],
        stream: false,
        context: infer['@context'] || [],
        options: {
          temperature: params.temperature,
          top_p: params.top_p,
          num_predict: params.max_tokens
        }
      };
    },

    /**
     * Convert Ollama response to XJSON
     * @param {Object} ollamaResponse - Ollama API response
     * @param {Object} request - Original XJSON request
     * @param {number} latencyMs - Request latency
     * @returns {Object} XJSON response
     */
    fromOllamaResponse: function(ollamaResponse, request, latencyMs) {
      const infer = request['@infer'] || {};

      return {
        '@completion': {
          '@model': infer['@model'] || ollamaResponse.model || 'unknown',
          '@runner': 'lam.o',
          '@text': ollamaResponse.response || ollamaResponse.message?.content || '',
          '@tokens': {
            input: ollamaResponse.prompt_eval_count || 0,
            output: ollamaResponse.eval_count || 0
          },
          '@metrics': {
            latency_ms: latencyMs,
            backend: 'ollama',
            total_duration: ollamaResponse.total_duration || 0,
            load_duration: ollamaResponse.load_duration || 0,
            eval_duration: ollamaResponse.eval_duration || 0,
            tokens_per_second: ollamaResponse.eval_count ?
              (ollamaResponse.eval_count / (ollamaResponse.eval_duration / 1e9)) : 0
          }
        }
      };
    },

    /**
     * Merge XJSON objects
     * @param {...Object} objects - XJSON objects to merge
     * @returns {Object} Merged XJSON
     */
    merge: function(...objects) {
      const result = {};

      for (const obj of objects) {
        for (const key of Object.keys(obj)) {
          if (key.startsWith('@')) {
            result[key] = { ...(result[key] || {}), ...obj[key] };
          } else {
            result[key] = obj[key];
          }
        }
      }

      return result;
    },

    /**
     * Pretty print XJSON
     * @param {Object} xjson - XJSON object
     * @returns {string} Formatted JSON string
     */
    format: function(xjson) {
      return JSON.stringify(xjson, null, 2);
    },

    /**
     * Parse XJSON string
     * @param {string} str - JSON string
     * @returns {Object} Parsed XJSON
     */
    parse: function(str) {
      try {
        return JSON.parse(str);
      } catch (e) {
        return this.createErrorResponse({
          message: `Parse error: ${e.message}`,
          code: 400
        });
      }
    }
  };

  // Export
  global.XJSON = XJSON;

  // CommonJS/Node.js export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { XJSON };
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
