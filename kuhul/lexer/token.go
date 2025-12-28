// Package lexer provides tokenization for K'UHUL source code.
package lexer

import "fmt"

// TokenType represents the type of a token
type TokenType int

const (
	// Special tokens
	ILLEGAL TokenType = iota
	EOF
	NEWLINE
	COMMENT
	BLOCK_COMMENT

	// Mayan glyph markers
	POP   // ⟁Pop⟁ - declaration
	WO    // ⟁Wo⟁ - assignment
	SEK   // ⟁Sek⟁ - control vector
	XUL   // ⟁Xul⟁ - block definition
	CHEN  // ⟁Ch'en⟁ - return/emit
	YAX   // ⟁Yax⟁ - reference/value
	KAYAB // ⟁K'ayab⟁ - loop
	SHEN  // ⟁Shen⟁ - if/condition
	THEN  // ⟁then⟁ - then branch
	ELSE  // ⟁else⟁ - else branch
	KUMKU // ⟁Kumk'u⟁ - end loop

	// C@@L markers
	COOL_BLOCK    // C@@L BLOCK
	COOL_VECTOR   // C@@L ATOMIC_VECTOR
	COOL_VARIABLE // C@@L ATOMIC_VARIABLE
	ATOMIC_BLOCK  // ⟁ ATOMIC_BLOCK_* ⟁

	// Literals
	IDENT  // identifier
	NUMBER // number literal
	STRING // string literal
	JSON   // JSON object or array

	// Operators
	PLUS     // +
	MINUS    // -
	STAR     // *
	SLASH    // /
	PERCENT  // %
	ASSIGN   // =
	EQ       // ==
	NEQ      // !=
	LT       // <
	GT       // >
	LTE      // <=
	GTE      // >=
	AND      // &&
	OR       // ||
	NOT      // !
	BAND     // &
	BOR      // |
	XOR      // ^
	DOT      // .
	COMMA    // ,
	COLON    // :
	SEMICOL  // ;
	QUESTION // ?

	// Delimiters
	LPAREN   // (
	RPAREN   // )
	LBRACE   // {
	RBRACE   // }
	LBRACKET // [
	RBRACKET // ]

	// Atoms
	AT // @ prefix for atoms

	// Keywords
	DEFINE_FUNCTION // define_function
	DEFINE_CLASS    // define_class
	DEFINE_MACRO    // define_macro
	RETURN          // return
	IF              // if
	FOR             // for
	WHILE           // while
	IN              // in
	FROM            // from
	TO              // to
	NEW             // new
	TRUE            // true
	FALSE           // false
	NULL            // null
	MAP             // map
	GO              // go (goroutine)
	CHANNEL         // channel
	OBSERVABLE      // observable
	SUBSCRIBE       // subscribe
	QUERY           // query
	ASSERT_FACT     // assert_fact
	DEFINE_RULE     // define_rule
	MATRIX_MULTIPLY // matrix_multiply
	TRANSPOSE       // transpose
	SOFTMAX         // softmax
)

var tokenNames = map[TokenType]string{
	ILLEGAL:       "ILLEGAL",
	EOF:           "EOF",
	NEWLINE:       "NEWLINE",
	COMMENT:       "COMMENT",
	BLOCK_COMMENT: "BLOCK_COMMENT",

	POP:   "POP",
	WO:    "WO",
	SEK:   "SEK",
	XUL:   "XUL",
	CHEN:  "CHEN",
	YAX:   "YAX",
	KAYAB: "KAYAB",
	SHEN:  "SHEN",
	THEN:  "THEN",
	ELSE:  "ELSE",
	KUMKU: "KUMKU",

	COOL_BLOCK:    "COOL_BLOCK",
	COOL_VECTOR:   "COOL_VECTOR",
	COOL_VARIABLE: "COOL_VARIABLE",
	ATOMIC_BLOCK:  "ATOMIC_BLOCK",

	IDENT:  "IDENT",
	NUMBER: "NUMBER",
	STRING: "STRING",
	JSON:   "JSON",

	PLUS:     "+",
	MINUS:    "-",
	STAR:     "*",
	SLASH:    "/",
	PERCENT:  "%",
	ASSIGN:   "=",
	EQ:       "==",
	NEQ:      "!=",
	LT:       "<",
	GT:       ">",
	LTE:      "<=",
	GTE:      ">=",
	AND:      "&&",
	OR:       "||",
	NOT:      "!",
	BAND:     "&",
	BOR:      "|",
	XOR:      "^",
	DOT:      ".",
	COMMA:    ",",
	COLON:    ":",
	SEMICOL:  ";",
	QUESTION: "?",

	LPAREN:   "(",
	RPAREN:   ")",
	LBRACE:   "{",
	RBRACE:   "}",
	LBRACKET: "[",
	RBRACKET: "]",

	AT: "@",

	DEFINE_FUNCTION: "define_function",
	DEFINE_CLASS:    "define_class",
	DEFINE_MACRO:    "define_macro",
	RETURN:          "return",
	IF:              "if",
	FOR:             "for",
	WHILE:           "while",
	IN:              "in",
	FROM:            "from",
	TO:              "to",
	NEW:             "new",
	TRUE:            "true",
	FALSE:           "false",
	NULL:            "null",
	MAP:             "map",
	GO:              "go",
	CHANNEL:         "channel",
	OBSERVABLE:      "observable",
	SUBSCRIBE:       "subscribe",
	QUERY:           "query",
	ASSERT_FACT:     "assert_fact",
	DEFINE_RULE:     "define_rule",
	MATRIX_MULTIPLY: "matrix_multiply",
	TRANSPOSE:       "transpose",
	SOFTMAX:         "softmax",
}

func (t TokenType) String() string {
	if name, ok := tokenNames[t]; ok {
		return name
	}
	return fmt.Sprintf("TOKEN(%d)", t)
}

// Keywords maps keyword strings to token types
var Keywords = map[string]TokenType{
	"define_function": DEFINE_FUNCTION,
	"define_class":    DEFINE_CLASS,
	"define_macro":    DEFINE_MACRO,
	"return":          RETURN,
	"if":              IF,
	"for":             FOR,
	"while":           WHILE,
	"in":              IN,
	"from":            FROM,
	"to":              TO,
	"new":             NEW,
	"true":            TRUE,
	"false":           FALSE,
	"null":            NULL,
	"map":             MAP,
	"go":              GO,
	"channel":         CHANNEL,
	"observable":      OBSERVABLE,
	"subscribe":       SUBSCRIBE,
	"query":           QUERY,
	"assert_fact":     ASSERT_FACT,
	"define_rule":     DEFINE_RULE,
	"matrix_multiply": MATRIX_MULTIPLY,
	"transpose":       TRANSPOSE,
	"softmax":         SOFTMAX,
}

// LookupIdent checks if an identifier is a keyword
func LookupIdent(ident string) TokenType {
	if tok, ok := Keywords[ident]; ok {
		return tok
	}
	return IDENT
}

// Token represents a lexical token
type Token struct {
	Type    TokenType   // Token type
	Literal string      // Literal value (source text)
	Value   interface{} // Parsed value (for numbers, JSON, etc.)
	Line    int         // Line number (1-based)
	Column  int         // Column number (1-based)
}

func (t Token) String() string {
	if t.Literal != "" {
		return fmt.Sprintf("%s(%q) at %d:%d", t.Type, t.Literal, t.Line, t.Column)
	}
	return fmt.Sprintf("%s at %d:%d", t.Type, t.Line, t.Column)
}

// MayanMarkers maps glyph content to token types
var MayanMarkers = map[string]TokenType{
	"Pop":     POP,
	"Wo":      WO,
	"Sek":     SEK,
	"Xul":     XUL,
	"Ch'en":   CHEN,
	"Yax":     YAX,
	"K'ayab":  KAYAB,
	"Shen":    SHEN,
	"then":    THEN,
	"else":    ELSE,
	"Kumk'u":  KUMKU,
}
