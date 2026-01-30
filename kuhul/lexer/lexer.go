package lexer

import (
	"encoding/json"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Lexer tokenizes K'UHUL source code
type Lexer struct {
	source  string
	pos     int  // current position in source
	readPos int  // next position to read
	ch      rune // current character
	line    int  // current line number (1-based)
	col     int  // current column number (1-based)
	tokens  []Token
}

// New creates a new Lexer for the given source
func New(source string) *Lexer {
	l := &Lexer{
		source: source,
		line:   1,
		col:    1,
		tokens: make([]Token, 0),
	}
	l.readChar()
	return l
}

// Tokenize processes the entire source and returns all tokens
func (l *Lexer) Tokenize() []Token {
	for {
		tok := l.NextToken()
		l.tokens = append(l.tokens, tok)
		if tok.Type == EOF {
			break
		}
	}
	return l.tokens
}

// NextToken returns the next token from the source
func (l *Lexer) NextToken() Token {
	l.skipWhitespace()

	if l.ch == 0 {
		return l.makeToken(EOF, "")
	}

	// Check for Mayan glyph markers (⟁...⟁)
	if l.ch == '⟁' {
		return l.readMayanMarker()
	}

	// Check for comments
	if l.ch == '/' && l.peekChar() == '*' {
		return l.readBlockComment()
	}
	if l.ch == '/' && l.peekChar() == '/' {
		return l.readLineComment()
	}
	if l.ch == '#' {
		return l.readLineComment()
	}

	// Check for strings
	if l.ch == '"' {
		return l.readString()
	}

	// Check for JSON blocks
	if l.ch == '{' {
		return l.readJSONBlock()
	}
	if l.ch == '[' {
		return l.readJSONArray()
	}

	// Check for numbers
	if isDigit(l.ch) || (l.ch == '-' && isDigit(l.peekChar())) {
		return l.readNumber()
	}

	// Check for @ prefix (atoms)
	if l.ch == '@' {
		return l.readAtom()
	}

	// Check for C@@L markers
	if l.ch == 'C' && l.matchAhead("C@@L") {
		return l.readCoolMarker()
	}

	// Check for operators and delimiters
	tok := l.readOperator()
	if tok.Type != ILLEGAL {
		return tok
	}

	// Check for identifiers/keywords
	if isLetter(l.ch) || l.ch == '_' {
		return l.readIdentifier()
	}

	// Newline
	if l.ch == '\n' {
		tok := l.makeToken(NEWLINE, "\n")
		l.readChar()
		return tok
	}

	// Unknown character
	ch := l.ch
	l.readChar()
	return l.makeToken(ILLEGAL, string(ch))
}

// readMayanMarker reads a Mayan glyph marker (⟁...⟁)
func (l *Lexer) readMayanMarker() Token {
	startLine, startCol := l.line, l.col
	l.readChar() // skip opening ⟁

	var content strings.Builder
	for l.ch != 0 && l.ch != '⟁' {
		content.WriteRune(l.ch)
		l.readChar()
	}

	if l.ch == '⟁' {
		l.readChar() // skip closing ⟁
	}

	markerContent := content.String()
	marker := "⟁" + markerContent + "⟁"

	// Check for known Mayan markers
	if tokType, ok := MayanMarkers[markerContent]; ok {
		return Token{
			Type:    tokType,
			Literal: marker,
			Line:    startLine,
			Column:  startCol,
		}
	}

	// Check for ATOMIC_BLOCK markers
	if strings.HasPrefix(markerContent, " ATOMIC_BLOCK") {
		blockName := strings.TrimPrefix(markerContent, " ATOMIC_BLOCK_")
		blockName = strings.TrimSpace(blockName)
		return Token{
			Type:    ATOMIC_BLOCK,
			Literal: marker,
			Value:   blockName,
			Line:    startLine,
			Column:  startCol,
		}
	}

	// Unknown marker, treat as identifier
	return Token{
		Type:    IDENT,
		Literal: marker,
		Line:    startLine,
		Column:  startCol,
	}
}

// readCoolMarker reads a C@@L marker
func (l *Lexer) readCoolMarker() Token {
	startLine, startCol := l.line, l.col

	var content strings.Builder
	// Read C@@L
	for i := 0; i < 4; i++ {
		content.WriteRune(l.ch)
		l.readChar()
	}

	l.skipInlineWhitespace()

	// Read the rest of the line
	for l.ch != 0 && l.ch != '\n' {
		content.WriteRune(l.ch)
		l.readChar()
	}

	literal := strings.TrimSpace(content.String())

	// Determine marker type
	if strings.Contains(literal, "ATOMIC_VECTOR") {
		return Token{
			Type:    COOL_VECTOR,
			Literal: literal,
			Line:    startLine,
			Column:  startCol,
		}
	}
	if strings.Contains(literal, "ATOMIC_VARIABLE") {
		return Token{
			Type:    COOL_VARIABLE,
			Literal: literal,
			Line:    startLine,
			Column:  startCol,
		}
	}
	if strings.Contains(literal, "BLOCK") {
		return Token{
			Type:    COOL_BLOCK,
			Literal: literal,
			Line:    startLine,
			Column:  startCol,
		}
	}

	return Token{
		Type:    IDENT,
		Literal: literal,
		Line:    startLine,
		Column:  startCol,
	}
}

// readAtom reads an @identifier
func (l *Lexer) readAtom() Token {
	startLine, startCol := l.line, l.col

	var content strings.Builder
	content.WriteRune(l.ch) // @
	l.readChar()

	for l.ch != 0 && (isAlphaNum(l.ch) || l.ch == '_') {
		content.WriteRune(l.ch)
		l.readChar()
	}

	return Token{
		Type:    AT,
		Literal: content.String(),
		Line:    startLine,
		Column:  startCol,
	}
}

// readString reads a string literal
func (l *Lexer) readString() Token {
	startLine, startCol := l.line, l.col
	l.readChar() // skip opening quote

	var content strings.Builder
	for l.ch != 0 && l.ch != '"' {
		if l.ch == '\\' {
			l.readChar()
			content.WriteRune(l.readEscapeChar())
		} else {
			content.WriteRune(l.ch)
			l.readChar()
		}
	}

	l.readChar() // skip closing quote

	return Token{
		Type:    STRING,
		Literal: content.String(),
		Value:   content.String(),
		Line:    startLine,
		Column:  startCol,
	}
}

// readJSONBlock reads a JSON object {...}
func (l *Lexer) readJSONBlock() Token {
	startLine, startCol := l.line, l.col
	depth := 0
	var content strings.Builder

	for l.ch != 0 {
		if l.ch == '{' {
			depth++
		} else if l.ch == '}' {
			depth--
			if depth == 0 {
				content.WriteRune(l.ch)
				l.readChar()
				break
			}
		}

		if l.ch == '\n' {
			l.line++
			l.col = 1
		}

		content.WriteRune(l.ch)
		l.readChar()
	}

	literal := content.String()

	// Try to parse as JSON
	var parsed interface{}
	if err := json.Unmarshal([]byte(literal), &parsed); err == nil {
		return Token{
			Type:    JSON,
			Literal: literal,
			Value:   parsed,
			Line:    startLine,
			Column:  startCol,
		}
	}

	// Not valid JSON, return as string
	return Token{
		Type:    STRING,
		Literal: literal,
		Line:    startLine,
		Column:  startCol,
	}
}

// readJSONArray reads a JSON array [...]
func (l *Lexer) readJSONArray() Token {
	startLine, startCol := l.line, l.col
	depth := 0
	var content strings.Builder

	for l.ch != 0 {
		if l.ch == '[' {
			depth++
		} else if l.ch == ']' {
			depth--
			if depth == 0 {
				content.WriteRune(l.ch)
				l.readChar()
				break
			}
		}

		if l.ch == '\n' {
			l.line++
			l.col = 1
		}

		content.WriteRune(l.ch)
		l.readChar()
	}

	literal := content.String()

	// Try to parse as JSON
	var parsed interface{}
	if err := json.Unmarshal([]byte(literal), &parsed); err == nil {
		return Token{
			Type:    JSON,
			Literal: literal,
			Value:   parsed,
			Line:    startLine,
			Column:  startCol,
		}
	}

	// Not valid JSON, return as string
	return Token{
		Type:    STRING,
		Literal: literal,
		Line:    startLine,
		Column:  startCol,
	}
}

// readNumber reads a number literal
func (l *Lexer) readNumber() Token {
	startLine, startCol := l.line, l.col
	var content strings.Builder

	if l.ch == '-' {
		content.WriteRune(l.ch)
		l.readChar()
	}

	for isDigit(l.ch) {
		content.WriteRune(l.ch)
		l.readChar()
	}

	// Check for decimal point
	if l.ch == '.' && isDigit(l.peekChar()) {
		content.WriteRune(l.ch)
		l.readChar()
		for isDigit(l.ch) {
			content.WriteRune(l.ch)
			l.readChar()
		}
	}

	// Check for exponent
	if l.ch == 'e' || l.ch == 'E' {
		content.WriteRune(l.ch)
		l.readChar()
		if l.ch == '+' || l.ch == '-' {
			content.WriteRune(l.ch)
			l.readChar()
		}
		for isDigit(l.ch) {
			content.WriteRune(l.ch)
			l.readChar()
		}
	}

	literal := content.String()
	value, _ := strconv.ParseFloat(literal, 64)

	return Token{
		Type:    NUMBER,
		Literal: literal,
		Value:   value,
		Line:    startLine,
		Column:  startCol,
	}
}

// readIdentifier reads an identifier or keyword
func (l *Lexer) readIdentifier() Token {
	startLine, startCol := l.line, l.col
	var content strings.Builder

	for l.ch != 0 && (isAlphaNum(l.ch) || l.ch == '_' || l.ch == '.') {
		content.WriteRune(l.ch)
		l.readChar()
	}

	literal := content.String()
	tokType := LookupIdent(literal)

	return Token{
		Type:    tokType,
		Literal: literal,
		Line:    startLine,
		Column:  startCol,
	}
}

// readBlockComment reads a /* ... */ comment
func (l *Lexer) readBlockComment() Token {
	startLine, startCol := l.line, l.col
	l.readChar() // /
	l.readChar() // *

	var content strings.Builder
	for l.ch != 0 {
		if l.ch == '*' && l.peekChar() == '/' {
			l.readChar()
			l.readChar()
			break
		}
		if l.ch == '\n' {
			l.line++
			l.col = 1
		}
		content.WriteRune(l.ch)
		l.readChar()
	}

	return Token{
		Type:    BLOCK_COMMENT,
		Literal: strings.TrimSpace(content.String()),
		Line:    startLine,
		Column:  startCol,
	}
}

// readLineComment reads a // or # comment
func (l *Lexer) readLineComment() Token {
	startLine, startCol := l.line, l.col

	if l.ch == '#' {
		l.readChar()
	} else {
		l.readChar() // /
		l.readChar() // /
	}

	var content strings.Builder
	for l.ch != 0 && l.ch != '\n' {
		content.WriteRune(l.ch)
		l.readChar()
	}

	return Token{
		Type:    COMMENT,
		Literal: strings.TrimSpace(content.String()),
		Line:    startLine,
		Column:  startCol,
	}
}

// readOperator reads operators and delimiters
func (l *Lexer) readOperator() Token {
	startLine, startCol := l.line, l.col
	ch := l.ch

	// Two-character operators
	switch ch {
	case '=':
		if l.peekChar() == '=' {
			l.readChar()
			l.readChar()
			return Token{Type: EQ, Literal: "==", Line: startLine, Column: startCol}
		}
		l.readChar()
		return Token{Type: ASSIGN, Literal: "=", Line: startLine, Column: startCol}
	case '!':
		if l.peekChar() == '=' {
			l.readChar()
			l.readChar()
			return Token{Type: NEQ, Literal: "!=", Line: startLine, Column: startCol}
		}
		l.readChar()
		return Token{Type: NOT, Literal: "!", Line: startLine, Column: startCol}
	case '<':
		if l.peekChar() == '=' {
			l.readChar()
			l.readChar()
			return Token{Type: LTE, Literal: "<=", Line: startLine, Column: startCol}
		}
		l.readChar()
		return Token{Type: LT, Literal: "<", Line: startLine, Column: startCol}
	case '>':
		if l.peekChar() == '=' {
			l.readChar()
			l.readChar()
			return Token{Type: GTE, Literal: ">=", Line: startLine, Column: startCol}
		}
		l.readChar()
		return Token{Type: GT, Literal: ">", Line: startLine, Column: startCol}
	case '&':
		if l.peekChar() == '&' {
			l.readChar()
			l.readChar()
			return Token{Type: AND, Literal: "&&", Line: startLine, Column: startCol}
		}
		l.readChar()
		return Token{Type: BAND, Literal: "&", Line: startLine, Column: startCol}
	case '|':
		if l.peekChar() == '|' {
			l.readChar()
			l.readChar()
			return Token{Type: OR, Literal: "||", Line: startLine, Column: startCol}
		}
		l.readChar()
		return Token{Type: BOR, Literal: "|", Line: startLine, Column: startCol}
	}

	// Single-character operators
	var tokType TokenType
	switch ch {
	case '+':
		tokType = PLUS
	case '-':
		tokType = MINUS
	case '*':
		tokType = STAR
	case '/':
		tokType = SLASH
	case '%':
		tokType = PERCENT
	case '^':
		tokType = XOR
	case '.':
		tokType = DOT
	case ',':
		tokType = COMMA
	case ':':
		tokType = COLON
	case ';':
		tokType = SEMICOL
	case '?':
		tokType = QUESTION
	case '(':
		tokType = LPAREN
	case ')':
		tokType = RPAREN
	case '{':
		tokType = LBRACE
	case '}':
		tokType = RBRACE
	case '[':
		tokType = LBRACKET
	case ']':
		tokType = RBRACKET
	default:
		return Token{Type: ILLEGAL, Line: startLine, Column: startCol}
	}

	l.readChar()
	return Token{
		Type:    tokType,
		Literal: string(ch),
		Line:    startLine,
		Column:  startCol,
	}
}

// readEscapeChar reads an escape character
func (l *Lexer) readEscapeChar() rune {
	switch l.ch {
	case 'n':
		l.readChar()
		return '\n'
	case 't':
		l.readChar()
		return '\t'
	case 'r':
		l.readChar()
		return '\r'
	case '"':
		l.readChar()
		return '"'
	case '\\':
		l.readChar()
		return '\\'
	default:
		ch := l.ch
		l.readChar()
		return ch
	}
}

// readChar advances to the next character
func (l *Lexer) readChar() {
	if l.readPos >= len(l.source) {
		l.ch = 0
	} else {
		r, size := utf8.DecodeRuneInString(l.source[l.readPos:])
		l.ch = r
		l.pos = l.readPos
		l.readPos += size

		if r == '\n' {
			l.line++
			l.col = 1
		} else {
			l.col++
		}
	}
}

// peekChar returns the next character without advancing
func (l *Lexer) peekChar() rune {
	if l.readPos >= len(l.source) {
		return 0
	}
	r, _ := utf8.DecodeRuneInString(l.source[l.readPos:])
	return r
}

// matchAhead checks if the source matches a string starting at current position
func (l *Lexer) matchAhead(s string) bool {
	end := l.pos + len(s)
	if end > len(l.source) {
		return false
	}
	return l.source[l.pos:end] == s
}

// skipWhitespace skips spaces, tabs, and carriage returns (but not newlines)
func (l *Lexer) skipWhitespace() {
	for l.ch == ' ' || l.ch == '\t' || l.ch == '\r' {
		l.readChar()
	}
}

// skipInlineWhitespace skips spaces and tabs only
func (l *Lexer) skipInlineWhitespace() {
	for l.ch == ' ' || l.ch == '\t' {
		l.readChar()
	}
}

// makeToken creates a new token with current position
func (l *Lexer) makeToken(tokType TokenType, literal string) Token {
	return Token{
		Type:    tokType,
		Literal: literal,
		Line:    l.line,
		Column:  l.col,
	}
}

// Helper functions

func isDigit(ch rune) bool {
	return ch >= '0' && ch <= '9'
}

func isLetter(ch rune) bool {
	return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || unicode.IsLetter(ch)
}

func isAlphaNum(ch rune) bool {
	return isLetter(ch) || isDigit(ch)
}
