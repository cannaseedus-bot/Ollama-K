/**
 * APSX-1: APF-SCXQ2 Binary Encoding v1
 *
 * Compiler-grade binary encoding for Atomic Prompt Folds.
 * Turns APF into a deterministic byte stream with:
 * - Typed fieldmap (no JSON parsing at decode time)
 * - String/glyph dictionary
 * - Symbol lane + raw lane (SCXQ2 dual-lane)
 * - Policy hash and optional proof hooks
 *
 * @version 1.0.0
 * @license MIT
 */

// ============================================================================
// CONSTANTS & MAGIC NUMBERS
// ============================================================================

const APSX_MAGIC = new Uint8Array([0x41, 0x50, 0x53, 0x58]); // "APSX"
const DICT_MAGIC = new Uint8Array([0x44, 0x49, 0x43, 0x54]); // "DICT"
const LANE_MAGIC = new Uint8Array([0x4C, 0x41, 0x4E, 0x45]); // "LANE"
const FOOT_MAGIC = new Uint8Array([0x46, 0x54, 0x52, 0x30]); // "FTR0"

const APSX_VERSION = 0x0001;
const DICT_VERSION = 0x0001;

// ============================================================================
// FLAGS (u16 bitfield)
// ============================================================================

const FLAGS = {
  HAS_DICT:         0x0001,  // bit0
  HAS_SYMBOL_LANE:  0x0002,  // bit1
  HAS_RAW_LANE:     0x0004,  // bit2
  HAS_SCHEMA_HASH:  0x0008,  // bit3
  HAS_PROOF_CHAIN:  0x0010,  // bit4
  EPOCH_IN_HASH:    0x0020,  // bit5: epoch included in policy hash
};

// ============================================================================
// WIRE TYPES (u8)
// ============================================================================

const WIRE = {
  ENUM8:       0x01,
  VARU:        0x02,
  BYTES:       0x03,
  STR_REF:     0x04,
  BYTES_REF:   0x05,
  VEC_U16_REF: 0x06,
  OBJ:         0x07,
  RAW_JSON:    0x08,  // escape hatch, discouraged
};

// ============================================================================
// APF FIELD IDs (varu)
// ============================================================================

const FIELD = {
  FOLD_ID:     1,
  INTENT:      2,
  ROLE:        3,
  SCOPE:       4,
  SYMBOLS:     5,
  CONSTRAINTS: 6,
  INPUT:       7,
  OUTPUT_SPEC: 8,
  POLICY_HASH: 9,
  EPOCH:       10,
  SCHEMA_HASH: 11,
  META:        12,
};

// OutputSpec nested field IDs
const OUTPUT_FIELD = {
  TYPE:            1,
  FORMAT:          2,
  MAX_TOKENS:      3,
  JSON_SCHEMA_REF: 4,
};

// ============================================================================
// CANONICAL ENUM TABLES
// ============================================================================

const INTENT_ENUM = {
  EXPLAIN:   0,
  REASON:    1,
  DECIDE:    2,
  GENERATE:  3,
  TRANSFORM: 4,
  VERIFY:    5,
  SUMMARIZE: 6,
  SIMULATE:  7,
  EXECUTE:   8,
};

const INTENT_REVERSE = Object.fromEntries(
  Object.entries(INTENT_ENUM).map(([k, v]) => [v, k])
);

const ROLE_ENUM = {
  SYSTEM:  0,
  CONTROL: 1,
  REASON:  2,
  TASK:    3,
  CONTEXT: 4,
  DATA:    5,
  OUTPUT:  6,
  EVAL:    7,
};

const ROLE_REVERSE = Object.fromEntries(
  Object.entries(ROLE_ENUM).map(([k, v]) => [v, k])
);

const SCOPE_ENUM = {
  LOCAL:   0,
  SESSION: 1,
  EPOCH:   2,
  GLOBAL:  3,
};

const SCOPE_REVERSE = Object.fromEntries(
  Object.entries(SCOPE_ENUM).map(([k, v]) => [v, k])
);

const OUTPUT_TYPE_ENUM = {
  STRUCTURED_TEXT: 0,
  JSON:            1,
  XML:             2,
  BYTES:           3,
  CODE:            4,
  SVG:             5,
};

const OUTPUT_TYPE_REVERSE = Object.fromEntries(
  Object.entries(OUTPUT_TYPE_ENUM).map(([k, v]) => [v, k.toLowerCase()])
);

const OUTPUT_FORMAT_ENUM = {
  PLAIN:       0,
  MARKDOWN:    1,
  JSON_MIN:    2,
  JSON_PRETTY: 3,
  XML_PRETTY:  4,
};

const OUTPUT_FORMAT_REVERSE = Object.fromEntries(
  Object.entries(OUTPUT_FORMAT_ENUM).map(([k, v]) => [v, k.toLowerCase()])
);

// ============================================================================
// SYMBOL LANE OPCODES (u8)
// ============================================================================

const SYM_OP = {
  PUSH_STRREF:   0x10,
  PUSH_U16REF:   0x11,
  SET_FIELD:     0x12,
  EMIT_ENUM8:    0x13,
  EMIT_VARU:     0x14,
  EMIT_VECREF:   0x15,
  BEGIN_OBJ:     0x16,
  END_OBJ:       0x17,
  BIND_POLICY:   0x18,
  END:           0x19,
};

// ============================================================================
// ULEB128 VARINT ENCODING
// ============================================================================

/**
 * Encode unsigned integer as ULEB128 (minimal encoding)
 */
function encodeVarU(value) {
  if (value < 0) throw new Error('encodeVarU: negative value');
  const bytes = [];
  do {
    let byte = value & 0x7F;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return new Uint8Array(bytes);
}

/**
 * Decode ULEB128 from buffer at offset
 * Returns { value, bytesRead }
 */
function decodeVarU(buffer, offset = 0) {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  while (true) {
    if (offset + bytesRead >= buffer.length) {
      throw new Error('decodeVarU: unexpected end of buffer');
    }
    const byte = buffer[offset + bytesRead];
    bytesRead++;
    value |= (byte & 0x7F) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) throw new Error('decodeVarU: varint too long');
  }

  return { value, bytesRead };
}

/**
 * Encode signed integer as zigzag + ULEB128
 */
function encodeVarI(value) {
  const zigzag = (value << 1) ^ (value >> 31);
  return encodeVarU(zigzag >>> 0);
}

/**
 * Decode zigzag + ULEB128 signed integer
 */
function decodeVarI(buffer, offset = 0) {
  const { value: zigzag, bytesRead } = decodeVarU(buffer, offset);
  const value = (zigzag >>> 1) ^ -(zigzag & 1);
  return { value, bytesRead };
}

// ============================================================================
// BUFFER UTILITIES
// ============================================================================

class ByteWriter {
  constructor(initialSize = 1024) {
    this.buffer = new Uint8Array(initialSize);
    this.offset = 0;
  }

  ensureCapacity(needed) {
    if (this.offset + needed > this.buffer.length) {
      const newSize = Math.max(this.buffer.length * 2, this.offset + needed);
      const newBuffer = new Uint8Array(newSize);
      newBuffer.set(this.buffer);
      this.buffer = newBuffer;
    }
  }

  writeU8(value) {
    this.ensureCapacity(1);
    this.buffer[this.offset++] = value & 0xFF;
  }

  writeU16(value) {
    this.ensureCapacity(2);
    this.buffer[this.offset++] = value & 0xFF;
    this.buffer[this.offset++] = (value >> 8) & 0xFF;
  }

  writeU32(value) {
    this.ensureCapacity(4);
    this.buffer[this.offset++] = value & 0xFF;
    this.buffer[this.offset++] = (value >> 8) & 0xFF;
    this.buffer[this.offset++] = (value >> 16) & 0xFF;
    this.buffer[this.offset++] = (value >> 24) & 0xFF;
  }

  writeVarU(value) {
    const encoded = encodeVarU(value);
    this.writeBytes(encoded);
  }

  writeVarI(value) {
    const encoded = encodeVarI(value);
    this.writeBytes(encoded);
  }

  writeBytes(bytes) {
    this.ensureCapacity(bytes.length);
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.length;
  }

  writeString(str) {
    const encoded = new TextEncoder().encode(str);
    this.writeVarU(encoded.length);
    this.writeBytes(encoded);
  }

  toUint8Array() {
    return this.buffer.slice(0, this.offset);
  }
}

class ByteReader {
  constructor(buffer) {
    this.buffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.offset = 0;
  }

  remaining() {
    return this.buffer.length - this.offset;
  }

  readU8() {
    if (this.offset >= this.buffer.length) throw new Error('ByteReader: EOF');
    return this.buffer[this.offset++];
  }

  readU16() {
    if (this.offset + 2 > this.buffer.length) throw new Error('ByteReader: EOF');
    const value = this.buffer[this.offset] | (this.buffer[this.offset + 1] << 8);
    this.offset += 2;
    return value;
  }

  readU32() {
    if (this.offset + 4 > this.buffer.length) throw new Error('ByteReader: EOF');
    const value = this.buffer[this.offset] |
                  (this.buffer[this.offset + 1] << 8) |
                  (this.buffer[this.offset + 2] << 16) |
                  (this.buffer[this.offset + 3] << 24);
    this.offset += 4;
    return value >>> 0;
  }

  readVarU() {
    const { value, bytesRead } = decodeVarU(this.buffer, this.offset);
    this.offset += bytesRead;
    return value;
  }

  readVarI() {
    const { value, bytesRead } = decodeVarI(this.buffer, this.offset);
    this.offset += bytesRead;
    return value;
  }

  readBytes(length) {
    if (this.offset + length > this.buffer.length) throw new Error('ByteReader: EOF');
    const bytes = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return bytes;
  }

  readString() {
    const length = this.readVarU();
    const bytes = this.readBytes(length);
    return new TextDecoder().decode(bytes);
  }

  peekBytes(length) {
    if (this.offset + length > this.buffer.length) throw new Error('ByteReader: EOF');
    return this.buffer.slice(this.offset, this.offset + length);
  }

  skip(length) {
    this.offset += length;
  }
}

// ============================================================================
// DICTIONARY BUILDER
// ============================================================================

class DictBuilder {
  constructor() {
    this.strings = new Map();  // string -> index
    this.stringList = [];      // index -> string
    this.bytes = new Map();    // hex -> index
    this.bytesList = [];       // index -> Uint8Array
  }

  addString(str) {
    if (this.strings.has(str)) {
      return this.strings.get(str);
    }
    const index = this.stringList.length;
    this.strings.set(str, index);
    this.stringList.push(str);
    return index;
  }

  addBytes(bytes) {
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    if (this.bytes.has(hex)) {
      return this.bytes.get(hex);
    }
    const index = this.bytesList.length;
    this.bytes.set(hex, index);
    this.bytesList.push(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    return index;
  }

  getStringRef(str) {
    return this.strings.get(str);
  }

  encode() {
    const writer = new ByteWriter();

    // Magic + version
    writer.writeBytes(DICT_MAGIC);
    writer.writeU16(DICT_VERSION);

    // Counts
    writer.writeVarU(this.stringList.length);
    writer.writeVarU(this.bytesList.length);

    // STR_TABLE
    for (const str of this.stringList) {
      const encoded = new TextEncoder().encode(str);
      writer.writeVarU(encoded.length);
      writer.writeBytes(encoded);
    }

    // BYTES_TABLE
    for (const bytes of this.bytesList) {
      writer.writeVarU(bytes.length);
      writer.writeBytes(bytes);
    }

    return writer.toUint8Array();
  }

  static decode(reader) {
    const dict = new DictBuilder();

    // Magic
    const magic = reader.readBytes(4);
    if (!arraysEqual(magic, DICT_MAGIC)) {
      throw new Error('Invalid DICT magic');
    }

    // Version
    const version = reader.readU16();
    if (version !== DICT_VERSION) {
      throw new Error(`Unsupported DICT version: ${version}`);
    }

    // Counts
    const strCount = reader.readVarU();
    const bytesCount = reader.readVarU();

    // STR_TABLE
    for (let i = 0; i < strCount; i++) {
      const len = reader.readVarU();
      const bytes = reader.readBytes(len);
      const str = new TextDecoder().decode(bytes);
      dict.stringList.push(str);
      dict.strings.set(str, i);
    }

    // BYTES_TABLE
    for (let i = 0; i < bytesCount; i++) {
      const len = reader.readVarU();
      const bytes = reader.readBytes(len);
      dict.bytesList.push(bytes);
      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      dict.bytes.set(hex, i);
    }

    return dict;
  }
}

// ============================================================================
// SYMBOL LANE ENCODER/DECODER
// ============================================================================

class SymbolLaneEncoder {
  constructor(dict) {
    this.dict = dict;
    this.writer = new ByteWriter();
  }

  pushStrRef(str) {
    const ref = this.dict.addString(str);
    this.writer.writeU8(SYM_OP.PUSH_STRREF);
    this.writer.writeVarU(ref);
  }

  pushU16Ref(ref) {
    this.writer.writeU8(SYM_OP.PUSH_U16REF);
    this.writer.writeVarU(ref);
  }

  setField(fieldId) {
    this.writer.writeU8(SYM_OP.SET_FIELD);
    this.writer.writeVarU(fieldId);
  }

  emitEnum8(value) {
    this.writer.writeU8(SYM_OP.EMIT_ENUM8);
    this.writer.writeU8(value);
  }

  emitVarU(value) {
    this.writer.writeU8(SYM_OP.EMIT_VARU);
    this.writer.writeVarU(value);
  }

  emitVecRef(refs) {
    this.writer.writeU8(SYM_OP.EMIT_VECREF);
    this.writer.writeVarU(refs.length);
    for (const ref of refs) {
      this.writer.writeVarU(ref);
    }
  }

  beginObj(fieldId) {
    this.writer.writeU8(SYM_OP.BEGIN_OBJ);
    this.writer.writeVarU(fieldId);
  }

  endObj() {
    this.writer.writeU8(SYM_OP.END_OBJ);
  }

  bindPolicy(hash) {
    this.writer.writeU8(SYM_OP.BIND_POLICY);
    this.writer.writeBytes(hash);
  }

  end() {
    this.writer.writeU8(SYM_OP.END);
  }

  toUint8Array() {
    return this.writer.toUint8Array();
  }
}

class SymbolLaneDecoder {
  constructor(bytes, dict) {
    this.reader = new ByteReader(bytes);
    this.dict = dict;
    this.stack = [];
    this.currentField = null;
  }

  decode() {
    const result = {};

    while (this.reader.remaining() > 0) {
      const op = this.reader.readU8();

      switch (op) {
        case SYM_OP.PUSH_STRREF: {
          const ref = this.reader.readVarU();
          this.stack.push({ type: 'str', value: this.dict.stringList[ref] });
          break;
        }
        case SYM_OP.PUSH_U16REF: {
          const ref = this.reader.readVarU();
          this.stack.push({ type: 'u16ref', value: ref });
          break;
        }
        case SYM_OP.SET_FIELD: {
          this.currentField = this.reader.readVarU();
          break;
        }
        case SYM_OP.EMIT_ENUM8: {
          const value = this.reader.readU8();
          this.stack.push({ type: 'enum8', value });
          break;
        }
        case SYM_OP.EMIT_VARU: {
          const value = this.reader.readVarU();
          this.stack.push({ type: 'varu', value });
          break;
        }
        case SYM_OP.EMIT_VECREF: {
          const count = this.reader.readVarU();
          const refs = [];
          for (let i = 0; i < count; i++) {
            refs.push(this.reader.readVarU());
          }
          this.stack.push({ type: 'vecref', value: refs });
          break;
        }
        case SYM_OP.BEGIN_OBJ: {
          const fieldId = this.reader.readVarU();
          this.stack.push({ type: 'begin_obj', fieldId });
          break;
        }
        case SYM_OP.END_OBJ: {
          this.stack.push({ type: 'end_obj' });
          break;
        }
        case SYM_OP.BIND_POLICY: {
          const hash = this.reader.readBytes(32);
          this.stack.push({ type: 'policy', value: hash });
          break;
        }
        case SYM_OP.END:
          return this.stack;
        default:
          throw new Error(`Unknown symbol opcode: 0x${op.toString(16)}`);
      }
    }

    return this.stack;
  }
}

// ============================================================================
// TLV FIELD ENCODER/DECODER
// ============================================================================

class TLVEncoder {
  constructor(dict) {
    this.dict = dict;
    this.writer = new ByteWriter();
  }

  writeField(fieldId, wireType, data) {
    this.writer.writeVarU(fieldId);
    this.writer.writeU8(wireType);
    this.writer.writeVarU(data.length);
    this.writer.writeBytes(data);
  }

  writeEnum8(fieldId, value) {
    this.writeField(fieldId, WIRE.ENUM8, new Uint8Array([value]));
  }

  writeVarU(fieldId, value) {
    this.writeField(fieldId, WIRE.VARU, encodeVarU(value));
  }

  writeStrRef(fieldId, str) {
    const ref = this.dict.addString(str);
    this.writeField(fieldId, WIRE.STR_REF, encodeVarU(ref));
  }

  writeBytesRef(fieldId, bytes) {
    const ref = this.dict.addBytes(bytes);
    this.writeField(fieldId, WIRE.BYTES_REF, encodeVarU(ref));
  }

  writeBytes(fieldId, bytes) {
    this.writeField(fieldId, WIRE.BYTES, bytes);
  }

  writeVecU16Ref(fieldId, strings) {
    const writer = new ByteWriter();
    writer.writeVarU(strings.length);
    for (const str of strings) {
      const ref = this.dict.addString(str);
      writer.writeVarU(ref);
    }
    this.writeField(fieldId, WIRE.VEC_U16_REF, writer.toUint8Array());
  }

  writeObj(fieldId, objBytes) {
    this.writeField(fieldId, WIRE.OBJ, objBytes);
  }

  writeRawJSON(fieldId, json) {
    const encoded = new TextEncoder().encode(JSON.stringify(json));
    this.writeField(fieldId, WIRE.RAW_JSON, encoded);
  }

  toUint8Array() {
    return this.writer.toUint8Array();
  }
}

class TLVDecoder {
  constructor(bytes, dict) {
    this.reader = new ByteReader(bytes);
    this.dict = dict;
  }

  decode() {
    const fields = [];

    while (this.reader.remaining() > 0) {
      const fieldId = this.reader.readVarU();
      const wireType = this.reader.readU8();
      const length = this.reader.readVarU();
      const data = this.reader.readBytes(length);

      fields.push({
        fieldId,
        wireType,
        data,
        value: this.decodeValue(wireType, data),
      });
    }

    return fields;
  }

  decodeValue(wireType, data) {
    const reader = new ByteReader(data);

    switch (wireType) {
      case WIRE.ENUM8:
        return reader.readU8();
      case WIRE.VARU:
        return reader.readVarU();
      case WIRE.BYTES:
        return data;
      case WIRE.STR_REF: {
        const ref = reader.readVarU();
        return this.dict.stringList[ref];
      }
      case WIRE.BYTES_REF: {
        const ref = reader.readVarU();
        return this.dict.bytesList[ref];
      }
      case WIRE.VEC_U16_REF: {
        const count = reader.readVarU();
        const result = [];
        for (let i = 0; i < count; i++) {
          const ref = reader.readVarU();
          result.push(this.dict.stringList[ref]);
        }
        return result;
      }
      case WIRE.OBJ:
        return new TLVDecoder(data, this.dict).decode();
      case WIRE.RAW_JSON:
        return JSON.parse(new TextDecoder().decode(data));
      default:
        return data;
    }
  }
}

// ============================================================================
// HASHING (SHA-256)
// ============================================================================

async function sha256(data) {
  const buffer = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return new Uint8Array(hashBuffer);
}

async function computeCanonicalHash(apf) {
  // Canonical hash over field model, not serialized bytes
  const parts = [
    apf['@fold'] || '',
    String(INTENT_ENUM[apf['@intent']?.toUpperCase()] ?? 0),
    String(ROLE_ENUM[apf['@role']?.toUpperCase()] ?? 0),
    String(SCOPE_ENUM[apf['@scope']?.toUpperCase()] ?? 0),
    (apf['@symbols'] || []).sort().join(','),
    (apf['@constraints'] || []).sort().join(','),
  ];

  if (apf['@output']) {
    parts.push(String(OUTPUT_TYPE_ENUM[apf['@output'].type?.toUpperCase().replace(/ /g, '_')] ?? 0));
    parts.push(String(OUTPUT_FORMAT_ENUM[apf['@output'].format?.toUpperCase()] ?? 0));
    parts.push(String(apf['@output'].max_tokens ?? 0));
  }

  return sha256(parts.join('|'));
}

// ============================================================================
// APSX ENCODER
// ============================================================================

async function encodeAPSX(apf, options = {}) {
  const dict = new DictBuilder();
  const tlv = new TLVEncoder(dict);
  const symLane = new SymbolLaneEncoder(dict);
  const rawLane = new ByteWriter();

  let flags = FLAGS.HAS_DICT | FLAGS.HAS_SYMBOL_LANE;

  // Field 1: fold_id
  if (apf['@fold']) {
    tlv.writeStrRef(FIELD.FOLD_ID, apf['@fold']);
    symLane.setField(FIELD.FOLD_ID);
    symLane.pushStrRef(apf['@fold']);
  }

  // Field 2: intent
  if (apf['@intent']) {
    const intentVal = INTENT_ENUM[apf['@intent'].toUpperCase()] ?? 0;
    tlv.writeEnum8(FIELD.INTENT, intentVal);
    symLane.setField(FIELD.INTENT);
    symLane.emitEnum8(intentVal);
  }

  // Field 3: role
  if (apf['@role']) {
    const roleVal = ROLE_ENUM[apf['@role'].toUpperCase()] ?? 0;
    tlv.writeEnum8(FIELD.ROLE, roleVal);
    symLane.setField(FIELD.ROLE);
    symLane.emitEnum8(roleVal);
  }

  // Field 4: scope
  if (apf['@scope']) {
    const scopeVal = SCOPE_ENUM[apf['@scope'].toUpperCase()] ?? 0;
    tlv.writeEnum8(FIELD.SCOPE, scopeVal);
    symLane.setField(FIELD.SCOPE);
    symLane.emitEnum8(scopeVal);
  }

  // Field 5: symbols
  if (apf['@symbols'] && apf['@symbols'].length > 0) {
    tlv.writeVecU16Ref(FIELD.SYMBOLS, apf['@symbols']);
    symLane.setField(FIELD.SYMBOLS);
    const refs = apf['@symbols'].map(s => dict.addString(s));
    symLane.emitVecRef(refs);
  }

  // Field 6: constraints
  if (apf['@constraints'] && apf['@constraints'].length > 0) {
    tlv.writeVecU16Ref(FIELD.CONSTRAINTS, apf['@constraints']);
    symLane.setField(FIELD.CONSTRAINTS);
    const refs = apf['@constraints'].map(c => dict.addString(c));
    symLane.emitVecRef(refs);
  }

  // Field 7: input (raw JSON - goes to raw lane)
  if (apf['@input']) {
    const inputJson = JSON.stringify(apf['@input']);
    const inputBytes = new TextEncoder().encode(inputJson);

    // Add large payloads to raw lane
    if (inputBytes.length > 64) {
      flags |= FLAGS.HAS_RAW_LANE;
      const rawRef = dict.addBytes(inputBytes);
      tlv.writeBytesRef(FIELD.INPUT, inputBytes);
      rawLane.writeBytes(inputBytes);
    } else {
      tlv.writeRawJSON(FIELD.INPUT, apf['@input']);
    }
  }

  // Field 8: output_spec (nested object)
  if (apf['@output']) {
    const outputTlv = new TLVEncoder(dict);

    if (apf['@output'].type) {
      const typeKey = apf['@output'].type.toUpperCase().replace(/ /g, '_');
      const typeVal = OUTPUT_TYPE_ENUM[typeKey] ?? 0;
      outputTlv.writeEnum8(OUTPUT_FIELD.TYPE, typeVal);
    }

    if (apf['@output'].format) {
      const formatVal = OUTPUT_FORMAT_ENUM[apf['@output'].format.toUpperCase()] ?? 0;
      outputTlv.writeEnum8(OUTPUT_FIELD.FORMAT, formatVal);
    }

    if (apf['@output'].max_tokens) {
      outputTlv.writeVarU(OUTPUT_FIELD.MAX_TOKENS, apf['@output'].max_tokens);
    }

    tlv.writeObj(FIELD.OUTPUT_SPEC, outputTlv.toUint8Array());

    symLane.beginObj(FIELD.OUTPUT_SPEC);
    if (apf['@output'].type) {
      const typeKey = apf['@output'].type.toUpperCase().replace(/ /g, '_');
      symLane.emitEnum8(OUTPUT_TYPE_ENUM[typeKey] ?? 0);
    }
    if (apf['@output'].max_tokens) {
      symLane.emitVarU(apf['@output'].max_tokens);
    }
    symLane.endObj();
  }

  // Field 10: epoch
  if (apf['@epoch'] !== undefined) {
    tlv.writeVarU(FIELD.EPOCH, apf['@epoch']);
    symLane.setField(FIELD.EPOCH);
    symLane.emitVarU(apf['@epoch']);
    flags |= FLAGS.EPOCH_IN_HASH;
  }

  // Compute policy hash
  const policyHash = await computeCanonicalHash(apf);
  tlv.writeBytes(FIELD.POLICY_HASH, policyHash);
  symLane.bindPolicy(policyHash);

  symLane.end();

  // Build body
  const dictBytes = dict.encode();
  const bodyBytes = tlv.toUint8Array();
  const symLaneBytes = symLane.toUint8Array();
  const rawLaneBytes = rawLane.toUint8Array();

  // Build lanes block
  const lanesWriter = new ByteWriter();
  lanesWriter.writeBytes(LANE_MAGIC);
  lanesWriter.writeVarU(symLaneBytes.length);
  lanesWriter.writeBytes(symLaneBytes);
  lanesWriter.writeVarU(rawLaneBytes.length);
  lanesWriter.writeBytes(rawLaneBytes);
  const lanesBytes = lanesWriter.toUint8Array();

  // Calculate header length (fixed)
  const headerLen = 4 + 2 + 2 + 4 + 4; // magic + version + flags + headerLen + bodyLen

  // Body includes dict + tlv + lanes
  const fullBodyLen = dictBytes.length + bodyBytes.length + lanesBytes.length;

  // Build header
  const headerWriter = new ByteWriter();
  headerWriter.writeBytes(APSX_MAGIC);
  headerWriter.writeU16(APSX_VERSION);
  headerWriter.writeU16(flags);
  headerWriter.writeU32(headerLen);
  headerWriter.writeU32(fullBodyLen);

  // Assemble pre-footer
  const preFooter = new ByteWriter();
  preFooter.writeBytes(headerWriter.toUint8Array());
  preFooter.writeBytes(dictBytes);
  preFooter.writeBytes(bodyBytes);
  preFooter.writeBytes(lanesBytes);
  const preFooterBytes = preFooter.toUint8Array();

  // Build footer
  const canonHash = await computeCanonicalHash(apf);
  const byteHash = await sha256(preFooterBytes);

  const footerWriter = new ByteWriter();
  footerWriter.writeBytes(FOOT_MAGIC);
  footerWriter.writeBytes(canonHash);
  footerWriter.writeBytes(byteHash);
  footerWriter.writeBytes(policyHash);
  footerWriter.writeVarU(0); // no proof chain

  // Final assembly
  const finalWriter = new ByteWriter();
  finalWriter.writeBytes(preFooterBytes);
  finalWriter.writeBytes(footerWriter.toUint8Array());

  return finalWriter.toUint8Array();
}

// ============================================================================
// APSX DECODER
// ============================================================================

async function decodeAPSX(bytes, options = {}) {
  const reader = new ByteReader(bytes);

  // Magic
  const magic = reader.readBytes(4);
  if (!arraysEqual(magic, APSX_MAGIC)) {
    throw new Error('Invalid APSX magic');
  }

  // Version
  const version = reader.readU16();
  if (version !== APSX_VERSION) {
    throw new Error(`Unsupported APSX version: ${version}`);
  }

  // Flags
  const flags = reader.readU16();

  // Header/body lengths
  const headerLen = reader.readU32();
  const bodyLen = reader.readU32();

  // Decode dictionary if present
  let dict = new DictBuilder();
  if (flags & FLAGS.HAS_DICT) {
    dict = DictBuilder.decode(reader);
  }

  // Find where body TLV starts (after dict)
  const bodyStart = reader.offset;

  // We need to parse the body - find TLV fields
  // The body contains: TLV fields + LANES block
  // We need to detect where LANES starts by looking for LANE_MAGIC

  const bodyEndOffset = bodyStart + bodyLen - dict.encode().length;

  // Read all remaining body bytes to find structure
  const remainingBody = reader.readBytes(bodyLen - (reader.offset - bodyStart - dict.encode().length + dict.encode().length));

  // Actually let's re-read more carefully
  reader.offset = bodyStart;

  // Read TLV bytes until we hit LANE magic or run out
  const tlvBytes = [];
  let lanesBytes = null;

  // Scan for LANE magic
  const bodyBytes = bytes.slice(reader.offset, reader.offset + bodyLen - dict.encode().length);
  let laneOffset = -1;
  for (let i = 0; i < bodyBytes.length - 4; i++) {
    if (bodyBytes[i] === 0x4C && bodyBytes[i+1] === 0x41 &&
        bodyBytes[i+2] === 0x4E && bodyBytes[i+3] === 0x45) {
      laneOffset = i;
      break;
    }
  }

  let tlvData, laneData;
  if (laneOffset >= 0) {
    tlvData = bodyBytes.slice(0, laneOffset);
    laneData = bodyBytes.slice(laneOffset);
  } else {
    tlvData = bodyBytes;
    laneData = new Uint8Array(0);
  }

  reader.offset += bodyBytes.length;

  // Decode TLV fields
  const tlvDecoder = new TLVDecoder(tlvData, dict);
  const fields = tlvDecoder.decode();

  // Build APF object from fields
  const apf = {};

  for (const field of fields) {
    switch (field.fieldId) {
      case FIELD.FOLD_ID:
        apf['@fold'] = field.value;
        break;
      case FIELD.INTENT:
        apf['@intent'] = INTENT_REVERSE[field.value];
        break;
      case FIELD.ROLE:
        apf['@role'] = ROLE_REVERSE[field.value];
        break;
      case FIELD.SCOPE:
        apf['@scope'] = SCOPE_REVERSE[field.value];
        break;
      case FIELD.SYMBOLS:
        apf['@symbols'] = field.value;
        break;
      case FIELD.CONSTRAINTS:
        apf['@constraints'] = field.value;
        break;
      case FIELD.INPUT:
        apf['@input'] = field.value;
        break;
      case FIELD.OUTPUT_SPEC: {
        apf['@output'] = {};
        for (const subField of field.value) {
          switch (subField.fieldId) {
            case OUTPUT_FIELD.TYPE:
              apf['@output'].type = OUTPUT_TYPE_REVERSE[subField.value];
              break;
            case OUTPUT_FIELD.FORMAT:
              apf['@output'].format = OUTPUT_FORMAT_REVERSE[subField.value];
              break;
            case OUTPUT_FIELD.MAX_TOKENS:
              apf['@output'].max_tokens = subField.value;
              break;
          }
        }
        break;
      }
      case FIELD.POLICY_HASH:
        apf['@policy_hash'] = field.value;
        break;
      case FIELD.EPOCH:
        apf['@epoch'] = field.value;
        break;
      case FIELD.SCHEMA_HASH:
        apf['@schema_hash'] = field.value;
        break;
      case FIELD.META:
        apf['@meta'] = field.value;
        break;
    }
  }

  // Decode lanes if present
  if (laneData.length > 0 && (flags & FLAGS.HAS_SYMBOL_LANE)) {
    const laneReader = new ByteReader(laneData);
    const laneMagic = laneReader.readBytes(4);
    if (arraysEqual(laneMagic, LANE_MAGIC)) {
      const symLen = laneReader.readVarU();
      const symBytes = laneReader.readBytes(symLen);
      const rawLen = laneReader.readVarU();
      const rawBytes = laneReader.readBytes(rawLen);

      apf['@_symbol_lane'] = new SymbolLaneDecoder(symBytes, dict).decode();
      if (rawLen > 0) {
        apf['@_raw_lane'] = rawBytes;
      }
    }
  }

  // Verify footer if present
  if (reader.remaining() >= 4) {
    const footMagic = reader.peekBytes(4);
    if (arraysEqual(footMagic, FOOT_MAGIC)) {
      reader.skip(4);
      const canonHash = reader.readBytes(32);
      const byteHash = reader.readBytes(32);
      const policyHash = reader.readBytes(32);
      const proofChainLen = reader.readVarU();

      apf['@_footer'] = {
        canon_hash: canonHash,
        byte_hash: byteHash,
        policy_hash: policyHash,
        proof_chain_len: proofChainLen,
      };

      // Verify hashes if requested
      if (options.verify) {
        const expectedCanon = await computeCanonicalHash(apf);
        if (!arraysEqual(canonHash, expectedCanon)) {
          throw new Error('APSX: canonical hash mismatch');
        }
      }
    }
  }

  return apf;
}

// ============================================================================
// UTILITIES
// ============================================================================

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// ============================================================================
// HIGH-LEVEL API
// ============================================================================

/**
 * Encode an APF object to APSX binary format
 */
async function pack(apf) {
  return encodeAPSX(apf);
}

/**
 * Decode APSX binary to APF object
 */
async function unpack(bytes, options = {}) {
  return decodeAPSX(bytes, options);
}

/**
 * Validate an APSX binary without full decode
 */
async function validate(bytes) {
  const reader = new ByteReader(bytes);

  // Check magic
  if (reader.remaining() < 4) return { valid: false, error: 'Too short for magic' };
  const magic = reader.readBytes(4);
  if (!arraysEqual(magic, APSX_MAGIC)) {
    return { valid: false, error: 'Invalid magic' };
  }

  // Check version
  const version = reader.readU16();
  if (version !== APSX_VERSION) {
    return { valid: false, error: `Unsupported version: ${version}` };
  }

  // Check flags and lengths
  const flags = reader.readU16();
  const headerLen = reader.readU32();
  const bodyLen = reader.readU32();

  if (reader.remaining() < bodyLen) {
    return { valid: false, error: 'Body length exceeds buffer' };
  }

  return { valid: true, version, flags, headerLen, bodyLen };
}

/**
 * Get statistics about an APSX binary
 */
async function stats(bytes) {
  const validation = await validate(bytes);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const apf = await unpack(bytes);

  return {
    totalBytes: bytes.length,
    version: validation.version,
    flags: validation.flags,
    headerLen: validation.headerLen,
    bodyLen: validation.bodyLen,
    foldId: apf['@fold'],
    intent: apf['@intent'],
    role: apf['@role'],
    symbolCount: apf['@symbols']?.length || 0,
    constraintCount: apf['@constraints']?.length || 0,
    hasEpoch: apf['@epoch'] !== undefined,
    hasInput: apf['@input'] !== undefined,
    hasOutput: apf['@output'] !== undefined,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

const APSX = {
  // Version
  VERSION: '1.0.0',
  SPEC_VERSION: APSX_VERSION,

  // Constants
  MAGIC: APSX_MAGIC,
  FLAGS,
  WIRE,
  FIELD,
  OUTPUT_FIELD,
  SYM_OP,

  // Enums
  INTENT: INTENT_ENUM,
  ROLE: ROLE_ENUM,
  SCOPE: SCOPE_ENUM,
  OUTPUT_TYPE: OUTPUT_TYPE_ENUM,
  OUTPUT_FORMAT: OUTPUT_FORMAT_ENUM,

  // Varint encoding
  encodeVarU,
  decodeVarU,
  encodeVarI,
  decodeVarI,

  // Buffer utilities
  ByteWriter,
  ByteReader,

  // Dictionary
  DictBuilder,

  // Lanes
  SymbolLaneEncoder,
  SymbolLaneDecoder,

  // TLV
  TLVEncoder,
  TLVDecoder,

  // Hashing
  sha256,
  computeCanonicalHash,

  // Core API
  encode: encodeAPSX,
  decode: decodeAPSX,
  pack,
  unpack,
  validate,
  stats,

  // Utilities
  arraysEqual,
  bytesToHex,
  hexToBytes,
};

// Browser/Worker global
if (typeof self !== 'undefined') {
  self.APSX = APSX;
}

// ES module export
export default APSX;
export {
  APSX_VERSION,
  FLAGS,
  WIRE,
  FIELD,
  OUTPUT_FIELD,
  SYM_OP,
  INTENT_ENUM,
  ROLE_ENUM,
  SCOPE_ENUM,
  OUTPUT_TYPE_ENUM,
  OUTPUT_FORMAT_ENUM,
  encodeVarU,
  decodeVarU,
  encodeVarI,
  decodeVarI,
  ByteWriter,
  ByteReader,
  DictBuilder,
  SymbolLaneEncoder,
  SymbolLaneDecoder,
  TLVEncoder,
  TLVDecoder,
  sha256,
  computeCanonicalHash,
  encodeAPSX,
  decodeAPSX,
  pack,
  unpack,
  validate,
  stats,
  arraysEqual,
  bytesToHex,
  hexToBytes,
};
