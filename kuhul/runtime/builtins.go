package runtime

import (
	"fmt"
	"math"
	"strings"
)

// BuiltinFunc represents a built-in function
type BuiltinFunc func(args ...interface{}) interface{}

// Builtins contains all built-in functions
var Builtins = map[string]BuiltinFunc{
	// Math functions
	"abs":   builtinAbs,
	"min":   builtinMin,
	"max":   builtinMax,
	"floor": builtinFloor,
	"ceil":  builtinCeil,
	"round": builtinRound,
	"sqrt":  builtinSqrt,
	"pow":   builtinPow,
	"exp":   builtinExp,
	"log":   builtinLog,

	// Array functions
	"len":     builtinLen,
	"push":    builtinPush,
	"pop":     builtinPop,
	"slice":   builtinSlice,
	"concat":  builtinConcat,
	"map":     builtinMap,
	"filter":  builtinFilter,
	"reduce":  builtinReduce,
	"reverse": builtinReverse,
	"sort":    builtinSort,

	// String functions
	"upper":    builtinUpper,
	"lower":    builtinLower,
	"trim":     builtinTrim,
	"split":    builtinSplit,
	"join":     builtinJoin,
	"replace":  builtinReplace,
	"contains": builtinContains,
	"starts":   builtinStartsWith,
	"ends":     builtinEndsWith,

	// Type functions
	"type":   builtinType,
	"str":    builtinStr,
	"int":    builtinInt,
	"float":  builtinFloat,
	"bool":   builtinBool,
	"array":  builtinArray,
	"object": builtinObject,

	// Matrix functions (for Llama K'UHUL)
	"matrix_multiply": builtinMatrixMultiply,
	"transpose":       builtinTranspose,
	"softmax":         builtinSoftmax,
	"dot":             builtinDot,
	"zeros":           builtinZeros,
	"ones":            builtinOnes,

	// Utility functions
	"print":  builtinPrint,
	"range":  builtinRange,
	"keys":   builtinKeys,
	"values": builtinValues,
}

// Math builtins

func builtinAbs(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}
	return math.Abs(toFloat(args[0]))
}

func builtinMin(args ...interface{}) interface{} {
	if len(args) < 2 {
		return nil
	}
	return math.Min(toFloat(args[0]), toFloat(args[1]))
}

func builtinMax(args ...interface{}) interface{} {
	if len(args) < 2 {
		return nil
	}
	return math.Max(toFloat(args[0]), toFloat(args[1]))
}

func builtinFloor(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}
	return math.Floor(toFloat(args[0]))
}

func builtinCeil(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}
	return math.Ceil(toFloat(args[0]))
}

func builtinRound(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}
	return math.Round(toFloat(args[0]))
}

func builtinSqrt(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}
	return math.Sqrt(toFloat(args[0]))
}

func builtinPow(args ...interface{}) interface{} {
	if len(args) < 2 {
		return nil
	}
	return math.Pow(toFloat(args[0]), toFloat(args[1]))
}

func builtinExp(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}
	return math.Exp(toFloat(args[0]))
}

func builtinLog(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}
	return math.Log(toFloat(args[0]))
}

// Array builtins

func builtinLen(args ...interface{}) interface{} {
	if len(args) < 1 {
		return 0
	}
	switch v := args[0].(type) {
	case []interface{}:
		return len(v)
	case string:
		return len(v)
	case map[string]interface{}:
		return len(v)
	default:
		return 0
	}
}

func builtinPush(args ...interface{}) interface{} {
	if len(args) < 2 {
		return args[0]
	}
	if arr, ok := args[0].([]interface{}); ok {
		return append(arr, args[1])
	}
	return args[0]
}

func builtinPop(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}
	if arr, ok := args[0].([]interface{}); ok && len(arr) > 0 {
		return arr[:len(arr)-1]
	}
	return args[0]
}

func builtinSlice(args ...interface{}) interface{} {
	if len(args) < 3 {
		return nil
	}
	if arr, ok := args[0].([]interface{}); ok {
		start := int(toFloat(args[1]))
		end := int(toFloat(args[2]))
		if start < 0 {
			start = 0
		}
		if end > len(arr) {
			end = len(arr)
		}
		return arr[start:end]
	}
	return nil
}

func builtinConcat(args ...interface{}) interface{} {
	result := make([]interface{}, 0)
	for _, arg := range args {
		if arr, ok := arg.([]interface{}); ok {
			result = append(result, arr...)
		} else {
			result = append(result, arg)
		}
	}
	return result
}

func builtinMap(args ...interface{}) interface{} {
	// Simple map - in a real implementation this would support lambdas
	if len(args) < 1 {
		return nil
	}
	if arr, ok := args[0].([]interface{}); ok {
		return arr
	}
	return args[0]
}

func builtinFilter(args ...interface{}) interface{} {
	// Simple filter - in a real implementation this would support lambdas
	if len(args) < 1 {
		return nil
	}
	if arr, ok := args[0].([]interface{}); ok {
		return arr
	}
	return args[0]
}

func builtinReduce(args ...interface{}) interface{} {
	// Simple reduce - in a real implementation this would support lambdas
	if len(args) < 1 {
		return nil
	}
	return args[0]
}

func builtinReverse(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}
	if arr, ok := args[0].([]interface{}); ok {
		result := make([]interface{}, len(arr))
		for i, v := range arr {
			result[len(arr)-1-i] = v
		}
		return result
	}
	return args[0]
}

func builtinSort(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}
	if arr, ok := args[0].([]interface{}); ok {
		// Simple numeric sort
		result := make([]interface{}, len(arr))
		copy(result, arr)
		// Basic bubble sort for simplicity
		for i := 0; i < len(result)-1; i++ {
			for j := 0; j < len(result)-1-i; j++ {
				if toFloat(result[j]) > toFloat(result[j+1]) {
					result[j], result[j+1] = result[j+1], result[j]
				}
			}
		}
		return result
	}
	return args[0]
}

// String builtins

func builtinUpper(args ...interface{}) interface{} {
	if len(args) < 1 {
		return ""
	}
	return strings.ToUpper(toString(args[0]))
}

func builtinLower(args ...interface{}) interface{} {
	if len(args) < 1 {
		return ""
	}
	return strings.ToLower(toString(args[0]))
}

func builtinTrim(args ...interface{}) interface{} {
	if len(args) < 1 {
		return ""
	}
	return strings.TrimSpace(toString(args[0]))
}

func builtinSplit(args ...interface{}) interface{} {
	if len(args) < 2 {
		return []interface{}{}
	}
	parts := strings.Split(toString(args[0]), toString(args[1]))
	result := make([]interface{}, len(parts))
	for i, p := range parts {
		result[i] = p
	}
	return result
}

func builtinJoin(args ...interface{}) interface{} {
	if len(args) < 2 {
		return ""
	}
	if arr, ok := args[0].([]interface{}); ok {
		strs := make([]string, len(arr))
		for i, v := range arr {
			strs[i] = toString(v)
		}
		return strings.Join(strs, toString(args[1]))
	}
	return ""
}

func builtinReplace(args ...interface{}) interface{} {
	if len(args) < 3 {
		return args[0]
	}
	return strings.ReplaceAll(toString(args[0]), toString(args[1]), toString(args[2]))
}

func builtinContains(args ...interface{}) interface{} {
	if len(args) < 2 {
		return false
	}
	return strings.Contains(toString(args[0]), toString(args[1]))
}

func builtinStartsWith(args ...interface{}) interface{} {
	if len(args) < 2 {
		return false
	}
	return strings.HasPrefix(toString(args[0]), toString(args[1]))
}

func builtinEndsWith(args ...interface{}) interface{} {
	if len(args) < 2 {
		return false
	}
	return strings.HasSuffix(toString(args[0]), toString(args[1]))
}

// Type builtins

func builtinType(args ...interface{}) interface{} {
	if len(args) < 1 {
		return "null"
	}
	switch args[0].(type) {
	case nil:
		return "null"
	case bool:
		return "bool"
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return "int"
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

func builtinStr(args ...interface{}) interface{} {
	if len(args) < 1 {
		return ""
	}
	return toString(args[0])
}

func builtinInt(args ...interface{}) interface{} {
	if len(args) < 1 {
		return 0
	}
	return int(toFloat(args[0]))
}

func builtinFloat(args ...interface{}) interface{} {
	if len(args) < 1 {
		return 0.0
	}
	return toFloat(args[0])
}

func builtinBool(args ...interface{}) interface{} {
	if len(args) < 1 {
		return false
	}
	return toBool(args[0])
}

func builtinArray(args ...interface{}) interface{} {
	return args
}

func builtinObject(args ...interface{}) interface{} {
	result := make(map[string]interface{})
	for i := 0; i+1 < len(args); i += 2 {
		key := toString(args[i])
		result[key] = args[i+1]
	}
	return result
}

// Matrix builtins (for Llama K'UHUL support)

func builtinMatrixMultiply(args ...interface{}) interface{} {
	if len(args) < 2 {
		return nil
	}

	a, aOk := args[0].([]interface{})
	b, bOk := args[1].([]interface{})
	if !aOk || !bOk || len(a) == 0 || len(b) == 0 {
		return nil
	}

	// Get dimensions
	aRows := len(a)
	aCols := 0
	if row, ok := a[0].([]interface{}); ok {
		aCols = len(row)
	}
	bRows := len(b)
	bCols := 0
	if row, ok := b[0].([]interface{}); ok {
		bCols = len(row)
	}

	if aCols != bRows {
		return nil // Dimension mismatch
	}

	// Perform multiplication
	result := make([]interface{}, aRows)
	for i := 0; i < aRows; i++ {
		row := make([]interface{}, bCols)
		for j := 0; j < bCols; j++ {
			sum := 0.0
			for k := 0; k < aCols; k++ {
				aVal := 0.0
				if aRow, ok := a[i].([]interface{}); ok && k < len(aRow) {
					aVal = toFloat(aRow[k])
				}
				bVal := 0.0
				if bRow, ok := b[k].([]interface{}); ok && j < len(bRow) {
					bVal = toFloat(bRow[j])
				}
				sum += aVal * bVal
			}
			row[j] = sum
		}
		result[i] = row
	}

	return result
}

func builtinTranspose(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}

	mat, ok := args[0].([]interface{})
	if !ok || len(mat) == 0 {
		return nil
	}

	rows := len(mat)
	cols := 0
	if row, ok := mat[0].([]interface{}); ok {
		cols = len(row)
	}

	result := make([]interface{}, cols)
	for j := 0; j < cols; j++ {
		row := make([]interface{}, rows)
		for i := 0; i < rows; i++ {
			if matRow, ok := mat[i].([]interface{}); ok && j < len(matRow) {
				row[i] = matRow[j]
			} else {
				row[i] = 0.0
			}
		}
		result[j] = row
	}

	return result
}

func builtinSoftmax(args ...interface{}) interface{} {
	if len(args) < 1 {
		return nil
	}

	arr, ok := args[0].([]interface{})
	if !ok || len(arr) == 0 {
		return nil
	}

	// Find max for numerical stability
	maxVal := toFloat(arr[0])
	for _, v := range arr[1:] {
		if f := toFloat(v); f > maxVal {
			maxVal = f
		}
	}

	// Compute exp(x - max) and sum
	exps := make([]float64, len(arr))
	sum := 0.0
	for i, v := range arr {
		exps[i] = math.Exp(toFloat(v) - maxVal)
		sum += exps[i]
	}

	// Normalize
	result := make([]interface{}, len(arr))
	for i, exp := range exps {
		result[i] = exp / sum
	}

	return result
}

func builtinDot(args ...interface{}) interface{} {
	if len(args) < 2 {
		return 0.0
	}

	a, aOk := args[0].([]interface{})
	b, bOk := args[1].([]interface{})
	if !aOk || !bOk || len(a) != len(b) {
		return 0.0
	}

	sum := 0.0
	for i := range a {
		sum += toFloat(a[i]) * toFloat(b[i])
	}
	return sum
}

func builtinZeros(args ...interface{}) interface{} {
	if len(args) < 1 {
		return []interface{}{}
	}

	n := int(toFloat(args[0]))
	if len(args) >= 2 {
		// 2D zeros
		m := int(toFloat(args[1]))
		result := make([]interface{}, n)
		for i := 0; i < n; i++ {
			row := make([]interface{}, m)
			for j := 0; j < m; j++ {
				row[j] = 0.0
			}
			result[i] = row
		}
		return result
	}

	// 1D zeros
	result := make([]interface{}, n)
	for i := 0; i < n; i++ {
		result[i] = 0.0
	}
	return result
}

func builtinOnes(args ...interface{}) interface{} {
	if len(args) < 1 {
		return []interface{}{}
	}

	n := int(toFloat(args[0]))
	if len(args) >= 2 {
		// 2D ones
		m := int(toFloat(args[1]))
		result := make([]interface{}, n)
		for i := 0; i < n; i++ {
			row := make([]interface{}, m)
			for j := 0; j < m; j++ {
				row[j] = 1.0
			}
			result[i] = row
		}
		return result
	}

	// 1D ones
	result := make([]interface{}, n)
	for i := 0; i < n; i++ {
		result[i] = 1.0
	}
	return result
}

// Utility builtins

func builtinPrint(args ...interface{}) interface{} {
	for i, arg := range args {
		if i > 0 {
			fmt.Print(" ")
		}
		fmt.Print(toString(arg))
	}
	fmt.Println()
	return nil
}

func builtinRange(args ...interface{}) interface{} {
	if len(args) < 1 {
		return []interface{}{}
	}

	start := 0
	end := int(toFloat(args[0]))
	step := 1

	if len(args) >= 2 {
		start = int(toFloat(args[0]))
		end = int(toFloat(args[1]))
	}
	if len(args) >= 3 {
		step = int(toFloat(args[2]))
	}

	if step == 0 {
		return []interface{}{}
	}

	result := make([]interface{}, 0)
	if step > 0 {
		for i := start; i < end; i += step {
			result = append(result, i)
		}
	} else {
		for i := start; i > end; i += step {
			result = append(result, i)
		}
	}
	return result
}

func builtinKeys(args ...interface{}) interface{} {
	if len(args) < 1 {
		return []interface{}{}
	}
	if m, ok := args[0].(map[string]interface{}); ok {
		keys := make([]interface{}, 0, len(m))
		for k := range m {
			keys = append(keys, k)
		}
		return keys
	}
	return []interface{}{}
}

func builtinValues(args ...interface{}) interface{} {
	if len(args) < 1 {
		return []interface{}{}
	}
	if m, ok := args[0].(map[string]interface{}); ok {
		values := make([]interface{}, 0, len(m))
		for _, v := range m {
			values = append(values, v)
		}
		return values
	}
	return []interface{}{}
}

// Helper functions

func toFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case int32:
		return float64(val)
	case string:
		var f float64
		fmt.Sscanf(val, "%f", &f)
		return f
	default:
		return 0
	}
}

func toString(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	case nil:
		return ""
	default:
		return fmt.Sprintf("%v", val)
	}
}

func toBool(v interface{}) bool {
	switch val := v.(type) {
	case bool:
		return val
	case int:
		return val != 0
	case float64:
		return val != 0
	case string:
		return val != "" && val != "false" && val != "0"
	case nil:
		return false
	default:
		return true
	}
}
