/**
 * MX2LM XJSON Schema Registry v1.0
 *
 * Central router for all XJSON/JSON schemas in the K'UHUL system.
 * Provides validation, lookup, and schema composition.
 *
 * @version 1.0.0
 * @license MIT
 */

(function(global) {
  'use strict';

  const XJSON_VERSION = '1.0.0';

  // ============================================
  // SCHEMA REGISTRY
  // ============================================

  const SCHEMAS = new Map();
  const VALIDATORS = new Map();

  // ============================================
  // CORE SCHEMA DEFINITIONS
  // ============================================

  /**
   * Register a schema
   */
  function registerSchema(id, schema) {
    SCHEMAS.set(id, schema);
    return schema;
  }

  /**
   * Get a schema by ID
   */
  function getSchema(id) {
    return SCHEMAS.get(id) || null;
  }

  /**
   * List all registered schemas
   */
  function listSchemas() {
    return [...SCHEMAS.keys()];
  }

  // ============================================
  // BUILT-IN SCHEMAS
  // ============================================

  // APF v1 - Atomic Prompt Fold
  registerSchema('apf.v1', {
    $id: 'https://kuhul.mx2lm/schemas/apf.v1.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Atomic Prompt Fold v1',
    description: 'Deterministic, glyph-addressable prompt grammar for LLM execution',
    type: 'object',
    required: ['@fold', '@intent', '@role'],
    properties: {
      '@fold': {
        type: 'string',
        pattern: '^[A-Z]+\\.[A-Z]+\\.V[0-9]+$',
        description: 'Fold identifier (e.g., LLM.REASON.V1)'
      },
      '@intent': {
        type: 'string',
        enum: ['EXPLAIN', 'REASON', 'DECIDE', 'GENERATE', 'TRANSFORM', 'VERIFY', 'SUMMARIZE', 'SIMULATE', 'EXECUTE'],
        description: 'Execution intent opcode'
      },
      '@role': {
        type: 'string',
        enum: ['SYSTEM', 'CONTROL', 'REASON', 'TASK', 'CONTEXT', 'DATA', 'OUTPUT', 'EVAL'],
        description: 'Execution domain role'
      },
      '@scope': {
        type: 'string',
        enum: ['LOCAL', 'SESSION', 'EPOCH', 'GLOBAL'],
        default: 'LOCAL',
        description: 'Visibility and memory scope'
      },
      '@symbols': {
        type: 'array',
        items: {
          type: 'string',
          pattern: '^[A-Z]\\.[A-Z]$'
        },
        description: 'Glyph symbol references'
      },
      '@constraints': {
        type: 'array',
        items: {
          type: 'string',
          enum: ['NO_HALLUCINATION', 'CONCISE', 'STRUCTURED_ONLY', 'SAFE_OUTPUT', 'DETERMINISTIC', 'NO_EXTERNAL_KNOWLEDGE']
        },
        description: 'Execution gate constraints'
      },
      '@input': {
        type: 'object',
        description: 'Input payload'
      },
      '@output': {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['structured_text', 'json', 'xml', 'bytes', 'code', 'svg']
          },
          format: {
            type: 'string',
            enum: ['plain', 'markdown', 'json_min', 'json_pretty', 'xml_pretty']
          },
          max_tokens: {
            type: 'integer',
            minimum: 1,
            maximum: 128000
          },
          schema: {
            type: 'object',
            description: 'Optional JSON Schema for output validation'
          }
        }
      },
      '@epoch': {
        type: 'integer',
        minimum: 0,
        description: 'Training/execution epoch'
      },
      '@policy_hash': {
        type: 'string',
        pattern: '^0x[a-f0-9]+$',
        description: 'Policy hash for replay verification'
      }
    }
  });

  // Stone Tablet Schema
  registerSchema('stone-tablet.v1', {
    $id: 'https://kuhul.mx2lm/schemas/stone-tablet.v1.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'MX2LM Stone Tablet',
    description: 'Canonical frozen specification for cognitive alphabet',
    type: 'object',
    required: ['@type', '@version', '@frozen', 'cognitive_alphabet', 'basis_contracts'],
    properties: {
      '@type': { const: 'mx2lm.stone_tablet' },
      '@version': { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' },
      '@frozen': { const: true },
      '@law': { type: 'string' },
      cognitive_alphabet: {
        type: 'object',
        required: ['schema', 'layout', 'total_symbols', 'layers'],
        properties: {
          schema: { type: 'string' },
          layout: { type: 'string', pattern: '^[0-9]+x[0-9]+$' },
          total_symbols: { type: 'integer', const: 28 },
          layers: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'name', 'prefix', 'symbols'],
              properties: {
                id: { type: 'integer', minimum: 1, maximum: 7 },
                name: { type: 'string' },
                prefix: { type: 'string', pattern: '^[A-Z]$' },
                symbols: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['sym', 'name', 'kernel', 'gid'],
                    properties: {
                      sym: { type: 'string', pattern: '^[A-Z]\\.[A-Z]$' },
                      name: { type: 'string' },
                      kernel: { type: 'string', pattern: '^pi\\.[a-z_]+$' },
                      gid: { type: 'string', pattern: '^g-[A-Z]{2}$' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      basis_contracts: {
        type: 'object',
        required: ['schema', 'levels'],
        properties: {
          schema: { type: 'string' },
          levels: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: {
              type: 'object',
              required: ['symbol', 'level', 'mode', 'write_state', 'persist', 'emit_proof', 'epoch_lock'],
              properties: {
                symbol: { type: 'string', pattern: '^@+$' },
                level: { type: 'integer', minimum: 1, maximum: 4 },
                mode: { type: 'string', enum: ['observe', 'evaluate', 'adapt', 'commit'] },
                write_state: { type: 'boolean' },
                persist: { type: 'boolean' },
                emit_proof: { type: 'boolean' },
                epoch_lock: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  });

  // Micronaut Event Schema
  registerSchema('micronaut.event.v1', {
    $id: 'https://kuhul.mx2lm/schemas/micronaut.event.v1.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Micronaut Cognitive Event',
    description: 'Single event in the cognitive ledger',
    type: 'object',
    required: ['eid', 't', 'tick', 'g', 'b'],
    properties: {
      eid: { type: 'string', pattern: '^e:[0-9]+$', description: 'Event ID' },
      t: { type: 'integer', description: 'Wallclock ms' },
      tick: { type: 'integer', description: 'Deterministic step' },
      g: { type: 'string', pattern: '^[A-Z]\\.[A-Z]$', description: 'Glyph symbol' },
      b: { type: 'integer', minimum: 1, maximum: 4, description: 'Basis level' },
      w: { type: 'number', minimum: 0, maximum: 1, description: 'Scalar weight' },
      c: { type: ['string', 'null'], pattern: '^#[0-9a-fA-F]{6}$', description: 'Color (reward lane)' },
      o: { type: 'number', minimum: 0, maximum: 1, description: 'Opacity (confidence)' },
      d: { type: 'number', description: 'Delta (reward change)' },
      p: { type: ['string', 'null'], pattern: '^⚡:[a-f0-9]+$', description: 'Proof reference' }
    }
  });

  // Micronaut Meta Schema
  registerSchema('micronaut.meta.v1', {
    $id: 'https://kuhul.mx2lm/schemas/micronaut.meta.v1.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Micronaut Meta',
    description: 'Micronaut identity and compatibility',
    type: 'object',
    required: ['schema', 'created', 'micronaut_id', 'cluster_id', 'glyph_pack', 'pi_kernel_set'],
    properties: {
      schema: { const: 'MX2LM-IDB-1.0' },
      created: { type: 'integer' },
      micronaut_id: { type: 'string', pattern: '^μ-[a-f0-9]{6}$' },
      cluster_id: { type: 'integer', minimum: 1 },
      glyph_pack: { type: 'string' },
      pi_kernel_set: { type: 'string' },
      scx_dict: { type: 'string' },
      epoch: { type: 'integer', minimum: 0 }
    }
  });

  // Glyph Symbol Schema
  registerSchema('glyph.symbol.v1', {
    $id: 'https://kuhul.mx2lm/schemas/glyph.symbol.v1.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Glyph Symbol',
    description: 'Single glyph in the cognitive alphabet',
    type: 'object',
    required: ['sym', 'name', 'kernel', 'domain', 'layer'],
    properties: {
      sym: { type: 'string', pattern: '^[A-Z]\\.[A-Z]$' },
      name: { type: 'string' },
      kernel: { type: 'string', pattern: '^pi\\.[a-z_]+$' },
      domain: { type: 'string', enum: ['META', 'CORE', 'OPS', 'SAFE', 'LEARN', 'ENV', 'ID'] },
      layer: { type: 'integer', minimum: 1, maximum: 7 },
      gid: { type: 'string', pattern: '^g-[A-Z]{2}$' }
    }
  });

  // APSX Binary Header Schema
  registerSchema('apsx.header.v1', {
    $id: 'https://kuhul.mx2lm/schemas/apsx.header.v1.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'APSX Binary Header',
    description: 'Header structure for APSX-1 binary encoding',
    type: 'object',
    required: ['magic', 'version', 'flags', 'header_len', 'body_len'],
    properties: {
      magic: { const: 'APSX' },
      version: { type: 'integer', const: 1 },
      flags: {
        type: 'object',
        properties: {
          has_dict: { type: 'boolean' },
          has_symbol_lane: { type: 'boolean' },
          has_raw_lane: { type: 'boolean' },
          has_schema_hash: { type: 'boolean' },
          has_proof_chain: { type: 'boolean' },
          epoch_in_hash: { type: 'boolean' }
        }
      },
      header_len: { type: 'integer', minimum: 0 },
      body_len: { type: 'integer', minimum: 0 }
    }
  });

  // SCXQ2 Dictionary Schema
  registerSchema('scxq2.dict.v1', {
    $id: 'https://kuhul.mx2lm/schemas/scxq2.dict.v1.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'SCXQ2 Dictionary',
    description: 'Compression dictionary for SCXQ2 encoding',
    type: 'object',
    required: ['scxq2', 'schema', 'glyph_count', 'dict', 'glyphs'],
    properties: {
      scxq2: { const: 'SCXQ2_DICT_v1' },
      schema: { type: 'string' },
      generated_at: { type: 'integer' },
      glyph_count: { type: 'integer', minimum: 1 },
      dict: {
        type: 'object',
        required: ['paths', 'tokens'],
        properties: {
          paths: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'd'],
              properties: {
                id: { type: 'integer' },
                d: { type: 'string' }
              }
            }
          },
          tokens: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'tok'],
              properties: {
                id: { type: 'integer' },
                tok: { type: 'string' }
              }
            }
          }
        }
      },
      glyphs: {
        type: 'array',
        items: {
          type: 'object',
          required: ['gid', 'sym', 'kernel', 'path_id', 'proof'],
          properties: {
            gid: { type: 'string' },
            sym: { type: 'string' },
            kernel: { type: 'string' },
            layer: { type: 'integer' },
            domain: { type: 'string' },
            fold: { type: 'string' },
            path_id: { type: 'integer' },
            proof: { type: 'string' },
            tok_ids: { type: 'array', items: { type: 'integer' } }
          }
        }
      }
    }
  });

  // Merge Request Schema
  registerSchema('micronaut.merge.v1', {
    $id: 'https://kuhul.mx2lm/schemas/micronaut.merge.v1.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Micronaut Merge Request',
    description: 'Merge operation specification',
    type: 'object',
    required: ['mode', 'source', 'target'],
    properties: {
      mode: {
        type: 'string',
        enum: ['overlay', 'union', 'weighted', 'fork', 'strict']
      },
      source: { type: 'string', description: 'Source micronaut ID' },
      target: { type: 'string', description: 'Target micronaut ID' },
      weight: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
      preserve_proofs: { type: 'boolean', default: true }
    }
  });

  // Policy Schema
  registerSchema('micronaut.policy.v1', {
    $id: 'https://kuhul.mx2lm/schemas/micronaut.policy.v1.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Micronaut Policy',
    description: 'Epoch-pinned execution law',
    type: 'object',
    required: ['policy_id', 'epoch', 'basis_rules', 'branch_gate', 'hash'],
    properties: {
      policy_id: { type: 'string', pattern: '^epoch-[0-9]+$' },
      epoch: { type: 'integer', minimum: 0 },
      basis_rules: {
        type: 'object',
        patternProperties: {
          '^[1-4]$': { type: 'string', enum: ['observe', 'evaluate', 'adapt', 'commit'] }
        }
      },
      branch_gate: {
        type: 'object',
        properties: {
          requires_proof: { type: 'boolean' },
          proof_type: { type: 'string' }
        }
      },
      hash: { type: 'string', pattern: '^pol:[a-f0-9]+$' }
    }
  });

  // Proof Schema
  registerSchema('micronaut.proof.v1', {
    $id: 'https://kuhul.mx2lm/schemas/micronaut.proof.v1.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Micronaut Proof',
    description: '⚡ verification artifact',
    type: 'object',
    required: ['proof_id', 'type', 'tick', 'epoch', 'policy_hash', 'hash'],
    properties: {
      proof_id: { type: 'string', pattern: '^⚡:[a-f0-9]+$' },
      type: { type: 'string' },
      input: { type: 'array', items: { type: 'string' } },
      result: { type: ['string', 'null'] },
      tick: { type: 'integer' },
      epoch: { type: 'integer' },
      policy_hash: { type: 'string' },
      hash: { type: 'string' }
    }
  });

  // Manifest Boot Schema
  registerSchema('manifest.boot.v1', {
    $id: 'https://kuhul.mx2lm/schemas/manifest.boot.v1.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'K\'UHUL Boot Manifest',
    description: 'Minimal boot manifest for Pi Kernel',
    type: 'object',
    required: ['@version', '@law', '@codex', '@boot', '@identity', '@pi', '@pi_kernels'],
    properties: {
      '@version': {
        type: 'object',
        required: ['epoch', 'policy_hash', 'compat'],
        properties: {
          epoch: { type: 'integer' },
          policy_hash: { type: 'string' },
          compat: { type: 'string' }
        }
      },
      '@law': {
        type: 'object',
        required: ['axioms'],
        properties: {
          axioms: { type: 'array', items: { type: 'string' } }
        }
      },
      '@pi_kernels': {
        type: 'object',
        required: ['layout', 'kernels'],
        properties: {
          layout: { type: 'string', pattern: '^[0-9]+x[0-9]+$' },
          kernels: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  });

  // ============================================
  // VALIDATION
  // ============================================

  /**
   * Simple JSON Schema validator
   */
  function validate(schemaId, data) {
    const schema = SCHEMAS.get(schemaId);
    if (!schema) {
      return { valid: false, error: `Schema not found: ${schemaId}` };
    }

    const errors = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Check properties
    if (schema.properties) {
      for (const [key, spec] of Object.entries(schema.properties)) {
        if (key in data) {
          const fieldErrors = validateField(key, data[key], spec);
          errors.push(...fieldErrors);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  function validateField(name, value, spec) {
    const errors = [];

    // Type check
    if (spec.type) {
      const types = Array.isArray(spec.type) ? spec.type : [spec.type];
      const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
      if (!types.includes(actualType)) {
        errors.push(`${name}: expected ${spec.type}, got ${actualType}`);
      }
    }

    // Const check
    if (spec.const !== undefined && value !== spec.const) {
      errors.push(`${name}: expected const ${spec.const}`);
    }

    // Enum check
    if (spec.enum && !spec.enum.includes(value)) {
      errors.push(`${name}: must be one of [${spec.enum.join(', ')}]`);
    }

    // Pattern check
    if (spec.pattern && typeof value === 'string') {
      if (!new RegExp(spec.pattern).test(value)) {
        errors.push(`${name}: does not match pattern ${spec.pattern}`);
      }
    }

    // Minimum/maximum
    if (typeof value === 'number') {
      if (spec.minimum !== undefined && value < spec.minimum) {
        errors.push(`${name}: must be >= ${spec.minimum}`);
      }
      if (spec.maximum !== undefined && value > spec.maximum) {
        errors.push(`${name}: must be <= ${spec.maximum}`);
      }
    }

    return errors;
  }

  // ============================================
  // SCHEMA COMPOSITION
  // ============================================

  /**
   * Compose multiple schemas into one
   */
  function compose(schemaIds, options = {}) {
    const composed = {
      $id: options.id || `composed:${schemaIds.join('+')}`,
      allOf: schemaIds.map(id => ({ $ref: SCHEMAS.get(id)?.$id || id }))
    };
    return composed;
  }

  /**
   * Extend a schema with additional properties
   */
  function extend(baseSchemaId, extensions) {
    const base = SCHEMAS.get(baseSchemaId);
    if (!base) return null;

    return {
      ...base,
      $id: extensions.$id || `${base.$id}.extended`,
      properties: {
        ...base.properties,
        ...extensions.properties
      },
      required: [
        ...(base.required || []),
        ...(extensions.required || [])
      ]
    };
  }

  // ============================================
  // ROUTE DETECTION
  // ============================================

  /**
   * Detect schema from data
   */
  function detectSchema(data) {
    if (!data || typeof data !== 'object') return null;

    // APF detection
    if (data['@fold'] && data['@intent']) return 'apf.v1';

    // Stone Tablet detection
    if (data['@type'] === 'mx2lm.stone_tablet') return 'stone-tablet.v1';

    // Micronaut event detection
    if (data.eid && data.g && data.tick !== undefined) return 'micronaut.event.v1';

    // Micronaut meta detection
    if (data.schema === 'MX2LM-IDB-1.0' && data.micronaut_id) return 'micronaut.meta.v1';

    // Policy detection
    if (data.policy_id && data.basis_rules) return 'micronaut.policy.v1';

    // Proof detection
    if (data.proof_id && data.policy_hash) return 'micronaut.proof.v1';

    // SCXQ2 dict detection
    if (data.scxq2 === 'SCXQ2_DICT_v1') return 'scxq2.dict.v1';

    // Manifest boot detection
    if (data['@version'] && data['@law'] && data['@pi_kernels']) return 'manifest.boot.v1';

    return null;
  }

  /**
   * Auto-validate data by detecting schema
   */
  function autoValidate(data) {
    const schemaId = detectSchema(data);
    if (!schemaId) {
      return { valid: false, error: 'Could not detect schema' };
    }
    return { schemaId, ...validate(schemaId, data) };
  }

  // ============================================
  // EXPORTS
  // ============================================

  const XJSONSchemas = {
    version: XJSON_VERSION,

    // Registry
    register: registerSchema,
    get: getSchema,
    list: listSchemas,
    SCHEMAS,

    // Validation
    validate,
    validateField,
    autoValidate,
    detectSchema,

    // Composition
    compose,
    extend,

    // Schema IDs (convenience)
    IDS: {
      APF: 'apf.v1',
      STONE_TABLET: 'stone-tablet.v1',
      MICRONAUT_EVENT: 'micronaut.event.v1',
      MICRONAUT_META: 'micronaut.meta.v1',
      MICRONAUT_POLICY: 'micronaut.policy.v1',
      MICRONAUT_PROOF: 'micronaut.proof.v1',
      MICRONAUT_MERGE: 'micronaut.merge.v1',
      GLYPH_SYMBOL: 'glyph.symbol.v1',
      APSX_HEADER: 'apsx.header.v1',
      SCXQ2_DICT: 'scxq2.dict.v1',
      MANIFEST_BOOT: 'manifest.boot.v1'
    }
  };

  // Browser/Worker global
  if (typeof self !== 'undefined') {
    self.XJSONSchemas = XJSONSchemas;
  }

  // CommonJS
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = XJSONSchemas;
  }

  // Global
  global.XJSONSchemas = XJSONSchemas;

  console.log('[XJSONSchemas] v' + XJSON_VERSION + ' loaded (' + SCHEMAS.size + ' schemas)');

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
