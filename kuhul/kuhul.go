// Package kuhul provides the K'UHUL (Kernel Hyper Universal Language) runtime.
//
// K'UHUL is a multi-paradigm programming language inspired by Mayan calendar
// notation, designed for AI orchestration and LLM control.
//
// The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK
//
// Syntax Keywords (Mayan calendar-inspired):
//   - Pop   : Definition/Declaration (begin manifest)
//   - Wo    : Assignment/Binding (variables, constants)
//   - Sek   : Control flow/Vectors (if, loop, dispatch)
//   - Xul   : Block/Function definition (C@@L BLOCKS)
//   - Ch'en : Output/Return (emit, return, yield)
//
// Special Markers:
//   - ⟁Pop⟁   : Start of declaration block
//   - ⟁Wo⟁    : Variable/constant assignment
//   - ⟁Sek⟁   : Control vector (atomic control flow)
//   - ⟁Xul⟁   : Block definition start
//   - ⟁Ch'en⟁ : Return/emit from block
//   - ⟁Yax⟁   : Value reference
//   - ⟁K'ayab⟁: Loop construct
//   - ⟁Shen⟁  : Conditional (if)
//   - ⟁Kumk'u⟁: End loop
//
// Example:
//
//	⟁Pop⟁ manifest_ast {
//	  "n": "my_program",
//	  "v": "1.0.0"
//	}
//
//	⟁Wo⟁ x = 10
//	⟁Wo⟁ y = 20
//
//	⟁Xul⟁ add_numbers
//	  @a: ⟁Yax⟁ x
//	  @b: ⟁Yax⟁ y
//	⟁Ch'en⟁ {"result": 30}
package kuhul

import (
	"github.com/ollama/ollama/kuhul/ast"
	"github.com/ollama/ollama/kuhul/lexer"
	"github.com/ollama/ollama/kuhul/parser"
	"github.com/ollama/ollama/kuhul/runtime"
	"github.com/ollama/ollama/kuhul/scxq2"
)

const Version = "1.0.0"

// Tokenize tokenizes K'UHUL source code
func Tokenize(source string) []lexer.Token {
	l := lexer.New(source)
	return l.Tokenize()
}

// Parse parses K'UHUL source code into an AST
func Parse(source string) (*ast.Program, []string) {
	return parser.Parse(source)
}

// NewInterpreter creates a new K'UHUL interpreter
func NewInterpreter() *runtime.Interpreter {
	return runtime.NewInterpreter()
}

// Run parses and executes K'UHUL source code
func Run(source string) (interface{}, error) {
	interp := runtime.NewInterpreter()
	_, errors := interp.Load(source)
	if len(errors) > 0 {
		return nil, &ParseError{Errors: errors}
	}
	return interp.Run()
}

// Eval evaluates a K'UHUL expression
func Eval(source string) (interface{}, error) {
	interp := runtime.NewInterpreter()
	return interp.Eval(source)
}

// Fingerprint generates an SCXQ2 fingerprint for data
func Fingerprint(data interface{}) string {
	return scxq2.Fingerprint(data)
}

// VerifyFingerprint verifies an SCXQ2 fingerprint
func VerifyFingerprint(data interface{}, fingerprint string) bool {
	return scxq2.Verify(data, fingerprint)
}

// Compress compresses data to XCFE format
func Compress(data interface{}) *scxq2.XCFECompressed {
	return scxq2.Compress(data)
}

// Decompress decompresses XCFE data
func Decompress(xcfe *scxq2.XCFECompressed) interface{} {
	return scxq2.Decompress(xcfe)
}

// ParseError represents parsing errors
type ParseError struct {
	Errors []string
}

func (e *ParseError) Error() string {
	if len(e.Errors) == 0 {
		return "unknown parse error"
	}
	return e.Errors[0]
}

// Exported types for external use
type (
	Token        = lexer.Token
	TokenType    = lexer.TokenType
	Program      = ast.Program
	Interpreter  = runtime.Interpreter
	RuntimeState = runtime.RuntimeState
	Environment  = runtime.Environment
	Context      = runtime.Context
	Handler      = runtime.Handler
	BuiltinFunc  = runtime.BuiltinFunc
)

// Re-export token types
const (
	TokenPOP   = lexer.POP
	TokenWO    = lexer.WO
	TokenSEK   = lexer.SEK
	TokenXUL   = lexer.XUL
	TokenCHEN  = lexer.CHEN
	TokenYAX   = lexer.YAX
	TokenKAYAB = lexer.KAYAB
	TokenSHEN  = lexer.SHEN
	TokenKUMKU = lexer.KUMKU
	TokenEOF   = lexer.EOF
)

// Builtins provides access to built-in functions
var Builtins = runtime.Builtins
