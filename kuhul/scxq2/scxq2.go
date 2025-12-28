// Package scxq2 provides SCXQ2 fingerprinting and XCFE compression for K'UHUL.
//
// SCXQ2 = Secure Compressed eXecution Quantum 2 (fingerprinting)
// XCFE = eXtended Compressed Format Encoding (compression)
package scxq2

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
	"time"
)

const (
	SCXQ2Version = "SCXQ2-v1"
	XCFEVersion  = "XCFE-v1"
)

// Fingerprint generates an SCXQ2 fingerprint for any data
func Fingerprint(data interface{}) string {
	payload := canonicalize(data)
	hash := sha256.Sum256([]byte(payload))
	hashHex := hex.EncodeToString(hash[:])
	return SCXQ2Version + ":" + hashHex[:32]
}

// FingerprintExecution generates a fingerprint for an execution context
func FingerprintExecution(handler string, context map[string]interface{}, result interface{}) string {
	execData := map[string]interface{}{
		"handler":          handler,
		"context_keys":     sortedKeys(context),
		"result_type":      getTypeName(result),
		"timestamp_bucket": time.Now().Unix() / 60, // 1-minute buckets
	}
	return Fingerprint(execData)
}

// Verify verifies an SCXQ2 fingerprint against data
func Verify(data interface{}, fingerprint string) bool {
	computed := Fingerprint(data)
	return computed == fingerprint
}

// canonicalize converts data to a canonical JSON string
func canonicalize(data interface{}) string {
	// Convert to map for sorting
	normalized := normalizeValue(data)
	bytes, _ := json.Marshal(normalized)
	return string(bytes)
}

// normalizeValue recursively normalizes a value for canonical representation
func normalizeValue(v interface{}) interface{} {
	switch val := v.(type) {
	case map[string]interface{}:
		return normalizeMap(val)
	case []interface{}:
		return normalizeArray(val)
	default:
		return val
	}
}

// normalizeMap sorts keys and normalizes values
func normalizeMap(m map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	keys := sortedKeys(m)
	for _, k := range keys {
		result[k] = normalizeValue(m[k])
	}
	return result
}

// normalizeArray normalizes array elements
func normalizeArray(arr []interface{}) []interface{} {
	result := make([]interface{}, len(arr))
	for i, v := range arr {
		result[i] = normalizeValue(v)
	}
	return result
}

// sortedKeys returns sorted keys of a map
func sortedKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// getTypeName returns a string representation of a type
func getTypeName(v interface{}) string {
	if v == nil {
		return "null"
	}
	switch v.(type) {
	case bool:
		return "bool"
	case int, int8, int16, int32, int64:
		return "int"
	case uint, uint8, uint16, uint32, uint64:
		return "uint"
	case float32, float64:
		return "float"
	case string:
		return "string"
	case []interface{}:
		return "array"
	case map[string]interface{}:
		return "object"
	default:
		return "unknown"
	}
}

// XCFE Compression

// Abbreviations for common keys
var keyAbbreviations = map[string]string{
	"type":          "t",
	"name":          "n",
	"value":         "v",
	"params":        "p",
	"handler":       "h",
	"content":       "c",
	"body":          "b",
	"manifest":      "m",
	"coolBlocks":    "cb",
	"coolVectors":   "cv",
	"coolVariables": "cx",
	"atomicBlocks":  "ab",
	"declarations":  "d",
	"assignments":   "a",
	"blocks":        "bk",
}

// Key expansions (reverse of abbreviations)
var keyExpansions = map[string]string{
	"t":  "type",
	"n":  "name",
	"v":  "value",
	"p":  "params",
	"h":  "handler",
	"c":  "content",
	"b":  "body",
	"m":  "manifest",
	"cb": "coolBlocks",
	"cv": "coolVectors",
	"cx": "coolVariables",
	"ab": "atomicBlocks",
	"d":  "declarations",
	"a":  "assignments",
	"bk": "blocks",
}

// XCFECompressed represents a compressed XCFE structure
type XCFECompressed struct {
	Version   string      `json:"@xcfe"`
	Type      string      `json:"@type"`
	Signature string      `json:"@sig"`
	Data      interface{} `json:"@data"`
}

// Compress compresses an AST or data structure to XCFE format
func Compress(data interface{}) *XCFECompressed {
	if data == nil {
		return nil
	}

	dataMap, isMap := data.(map[string]interface{})
	typeName := "unknown"
	if isMap {
		if t, ok := dataMap["type"].(string); ok {
			typeName = t
		}
	}

	return &XCFECompressed{
		Version:   XCFEVersion,
		Type:      typeName,
		Signature: generateSignature(data),
		Data:      compressNode(data),
	}
}

// Decompress decompresses an XCFE structure back to the original format
func Decompress(xcfe *XCFECompressed) interface{} {
	if xcfe == nil || xcfe.Version == "" {
		return xcfe
	}
	return decompressNode(xcfe.Data)
}

// generateSignature generates a signature for an AST node
func generateSignature(node interface{}) string {
	nodeMap, ok := node.(map[string]interface{})
	if !ok {
		return ""
	}

	var sig []string

	if t, ok := nodeMap["type"].(string); ok && len(t) > 0 {
		sig = append(sig, string(t[0]))
	}
	if n, ok := nodeMap["name"].(string); ok && len(n) >= 3 {
		sig = append(sig, n[:3])
	}
	if _, ok := nodeMap["manifest"]; ok {
		sig = append(sig, "M")
	}
	if cb, ok := nodeMap["coolBlocks"].(map[string]interface{}); ok {
		sig = append(sig, "C"+string(rune('0'+len(cb))))
	}
	if cv, ok := nodeMap["coolVectors"].(map[string]interface{}); ok {
		sig = append(sig, "V"+string(rune('0'+len(cv))))
	}
	if cx, ok := nodeMap["coolVariables"].(map[string]interface{}); ok {
		sig = append(sig, "X"+string(rune('0'+len(cx))))
	}

	result := ""
	for i, s := range sig {
		if i > 0 {
			result += "."
		}
		result += s
	}
	return result
}

// compressNode recursively compresses a node
func compressNode(node interface{}) interface{} {
	switch v := node.(type) {
	case map[string]interface{}:
		compressed := make(map[string]interface{})
		for key, value := range v {
			abbrevKey := key
			if abbrev, ok := keyAbbreviations[key]; ok {
				abbrevKey = abbrev
			}
			compressed[abbrevKey] = compressNode(value)
		}
		return compressed
	case []interface{}:
		compressed := make([]interface{}, len(v))
		for i, elem := range v {
			compressed[i] = compressNode(elem)
		}
		return compressed
	default:
		return v
	}
}

// decompressNode recursively decompresses a node
func decompressNode(node interface{}) interface{} {
	switch v := node.(type) {
	case map[string]interface{}:
		decompressed := make(map[string]interface{})
		for key, value := range v {
			fullKey := key
			if expansion, ok := keyExpansions[key]; ok {
				fullKey = expansion
			}
			decompressed[fullKey] = decompressNode(value)
		}
		return decompressed
	case []interface{}:
		decompressed := make([]interface{}, len(v))
		for i, elem := range v {
			decompressed[i] = decompressNode(elem)
		}
		return decompressed
	default:
		return v
	}
}
