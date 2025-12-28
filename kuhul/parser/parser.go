// Package parser provides parsing for K'UHUL source code.
package parser

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/ollama/ollama/kuhul/ast"
	"github.com/ollama/ollama/kuhul/lexer"
)

// Parser parses K'UHUL tokens into an AST
type Parser struct {
	tokens  []lexer.Token
	pos     int
	errors  []string
	program *ast.Program
}

// New creates a new Parser for the given tokens
func New(tokens []lexer.Token) *Parser {
	return &Parser{
		tokens:  tokens,
		pos:     0,
		errors:  make([]string, 0),
		program: ast.NewProgram(),
	}
}

// Parse parses the tokens into a complete AST
func Parse(source string) (*ast.Program, []string) {
	l := lexer.New(source)
	tokens := l.Tokenize()

	// Filter out comments and newlines for parsing
	filtered := make([]lexer.Token, 0, len(tokens))
	for _, t := range tokens {
		if t.Type != lexer.COMMENT && t.Type != lexer.NEWLINE && t.Type != lexer.BLOCK_COMMENT {
			filtered = append(filtered, t)
		}
	}

	p := New(filtered)
	return p.Parse(), p.errors
}

// Parse parses all tokens and returns the program AST
func (p *Parser) Parse() *ast.Program {
	for !p.isAtEnd() {
		node := p.parseTopLevel()
		if node != nil {
			p.addNodeToProgram(node)
		}
	}
	return p.program
}

// Errors returns any parsing errors
func (p *Parser) Errors() []string {
	return p.errors
}

// parseTopLevel parses a top-level construct
func (p *Parser) parseTopLevel() interface{} {
	tok := p.peek()

	switch tok.Type {
	case lexer.POP:
		return p.parseDeclaration()
	case lexer.WO:
		return p.parseAssignment()
	case lexer.SEK:
		return p.parseControlVector()
	case lexer.XUL:
		return p.parseBlockDefinition()
	case lexer.CHEN:
		return p.parseReturnStatement()
	case lexer.ATOMIC_BLOCK:
		return p.parseAtomicBlock()
	case lexer.COOL_BLOCK:
		return p.parseCoolBlock()
	case lexer.COOL_VECTOR:
		return p.parseCoolVector()
	case lexer.COOL_VARIABLE:
		return p.parseCoolVariable()
	case lexer.EOF:
		return nil
	default:
		p.advance()
		return nil
	}
}

// parseDeclaration parses a Pop declaration
func (p *Parser) parseDeclaration() *ast.Declaration {
	popTok := p.advance() // skip ⟁Pop⟁

	nameTok := p.expect(lexer.IDENT, "Expected identifier after ⟁Pop⟁")
	if nameTok == nil {
		return nil
	}

	decl := &ast.Declaration{
		BaseNode: ast.BaseNode{
			NodeType: ast.NodeDeclaration,
			Position: ast.Position{Line: popTok.Line, Column: popTok.Column},
		},
		Name: nameTok.Literal,
	}

	// Check for JSON value
	if p.check(lexer.JSON) {
		jsonTok := p.advance()
		decl.Value = jsonTok.Value
	}

	return decl
}

// parseAssignment parses a Wo assignment
func (p *Parser) parseAssignment() *ast.Assignment {
	woTok := p.advance() // skip ⟁Wo⟁

	nameTok := p.expect(lexer.IDENT, "Expected identifier after ⟁Wo⟁")
	if nameTok == nil {
		return nil
	}

	assign := &ast.Assignment{
		BaseNode: ast.BaseNode{
			NodeType: ast.NodeAssignment,
			Position: ast.Position{Line: woTok.Line, Column: woTok.Column},
		},
		Name: nameTok.Literal,
	}

	// Optional = sign
	if p.check(lexer.ASSIGN) {
		p.advance()
	}

	// Parse value
	assign.Value = p.parseValue()

	return assign
}

// parseControlVector parses a Sek control vector
func (p *Parser) parseControlVector() *ast.ControlVector {
	sekTok := p.advance() // skip ⟁Sek⟁

	vectorTypeTok := p.expect(lexer.IDENT, "Expected vector type after ⟁Sek⟁")
	if vectorTypeTok == nil {
		return nil
	}

	cv := &ast.ControlVector{
		BaseNode: ast.BaseNode{
			NodeType: ast.NodeControlVector,
			Position: ast.Position{Line: sekTok.Line, Column: sekTok.Column},
		},
		VectorType: vectorTypeTok.Literal,
		Params:     make(map[string]interface{}),
	}

	// Parse parameters until next marker or EOF
	for !p.isAtEnd() && !p.isMarker() {
		if p.check(lexer.AT) {
			name, value := p.parseAtomParam()
			cv.Params[name] = value
		} else {
			p.advance()
		}
	}

	return cv
}

// parseBlockDefinition parses a Xul block definition
func (p *Parser) parseBlockDefinition() *ast.BlockDefinition {
	xulTok := p.advance() // skip ⟁Xul⟁

	nameTok := p.expect(lexer.IDENT, "Expected block name after ⟁Xul⟁")
	if nameTok == nil {
		return nil
	}

	block := &ast.BlockDefinition{
		BaseNode: ast.BaseNode{
			NodeType: ast.NodeBlockDefinition,
			Position: ast.Position{Line: xulTok.Line, Column: xulTok.Column},
		},
		Name:   nameTok.Literal,
		Params: make(map[string]interface{}),
		Body:   make([]ast.Node, 0),
	}

	// Parse block content until ⟁Ch'en⟁ or next ⟁Xul⟁
	for !p.isAtEnd() && !p.check(lexer.CHEN) && !p.check(lexer.XUL) {
		if p.check(lexer.AT) {
			name, value := p.parseAtomParam()
			block.Params[name] = value
		} else if p.check(lexer.COOL_BLOCK) {
			coolBlock := p.parseCoolBlock()
			if coolBlock != nil {
				block.Body = append(block.Body, coolBlock)
			}
		} else {
			p.advance()
		}
	}

	return block
}

// parseReturnStatement parses a Ch'en return statement
func (p *Parser) parseReturnStatement() *ast.ReturnStatement {
	chenTok := p.advance() // skip ⟁Ch'en⟁

	ret := &ast.ReturnStatement{
		BaseNode: ast.BaseNode{
			NodeType: ast.NodeReturn,
			Position: ast.Position{Line: chenTok.Line, Column: chenTok.Column},
		},
	}

	// Parse optional return value
	if p.check(lexer.JSON) {
		jsonTok := p.advance()
		ret.Value = jsonTok.Value
	} else if p.check(lexer.AT) {
		name, value := p.parseAtomParam()
		ret.Value = map[string]interface{}{name: value}
	}

	return ret
}

// parseAtomicBlock parses an ATOMIC_BLOCK
func (p *Parser) parseAtomicBlock() *ast.AtomicBlock {
	tok := p.advance()
	blockName := ""
	if v, ok := tok.Value.(string); ok {
		blockName = v
	}

	block := &ast.AtomicBlock{
		BaseNode: ast.BaseNode{
			NodeType: ast.NodeAtomicBlock,
			Position: ast.Position{Line: tok.Line, Column: tok.Column},
		},
		Name:    blockName,
		Content: make(map[string]interface{}),
	}

	// Parse content until next ATOMIC_BLOCK or major marker
	for !p.isAtEnd() && !p.check(lexer.ATOMIC_BLOCK) && !p.check(lexer.POP) && !p.check(lexer.XUL) {
		if p.check(lexer.AT) {
			name, value := p.parseAtomParam()
			block.Content[name] = value
		} else if p.check(lexer.JSON) {
			jsonTok := p.advance()
			if m, ok := jsonTok.Value.(map[string]interface{}); ok {
				for k, v := range m {
					block.Content[k] = v
				}
			}
		} else {
			p.advance()
		}
	}

	return block
}

// parseCoolBlock parses a C@@L BLOCK
func (p *Parser) parseCoolBlock() *ast.CoolBlock {
	tok := p.advance()

	// Extract block name from literal
	re := regexp.MustCompile(`C@@L\s+BLOCK\s+(\w+)`)
	matches := re.FindStringSubmatch(tok.Literal)
	blockName := "unknown"
	if len(matches) > 1 {
		blockName = matches[1]
	}

	block := &ast.CoolBlock{
		BaseNode: ast.BaseNode{
			NodeType: ast.NodeCoolBlock,
			Position: ast.Position{Line: tok.Line, Column: tok.Column},
		},
		Name:   blockName,
		Params: make(map[string]interface{}),
		Body:   make([]interface{}, 0),
	}

	// Parse block content
	for !p.isAtEnd() && !p.check(lexer.COOL_BLOCK) && !p.check(lexer.XUL) && !p.check(lexer.CHEN) {
		if p.check(lexer.AT) {
			name, value := p.parseAtomParam()
			block.Params[name] = value
			if name == "handler" {
				if s, ok := value.(string); ok {
					block.Handler = s
				}
			}
		} else if p.check(lexer.JSON) {
			jsonTok := p.advance()
			block.Body = append(block.Body, jsonTok.Value)
		} else {
			p.advance()
		}
	}

	return block
}

// parseCoolVector parses a C@@L ATOMIC_VECTOR
func (p *Parser) parseCoolVector() *ast.CoolVector {
	tok := p.advance()

	// Extract vector name from literal
	re := regexp.MustCompile(`C@@L\s+ATOMIC_VECTOR\s+(@\w+)`)
	matches := re.FindStringSubmatch(tok.Literal)
	vectorName := "@unknown"
	if len(matches) > 1 {
		vectorName = matches[1]
	}

	vector := &ast.CoolVector{
		BaseNode: ast.BaseNode{
			NodeType: ast.NodeCoolVector,
			Position: ast.Position{Line: tok.Line, Column: tok.Column},
		},
		Name:   vectorName,
		Params: make(map[string]interface{}),
	}

	// Parse vector params
	for !p.isAtEnd() && !p.check(lexer.COOL_VECTOR) && !p.check(lexer.COOL_VARIABLE) && !p.check(lexer.COOL_BLOCK) {
		if p.check(lexer.AT) {
			name, value := p.parseAtomParam()
			vector.Params[name] = value
		} else {
			p.advance()
		}
	}

	return vector
}

// parseCoolVariable parses a C@@L ATOMIC_VARIABLE
func (p *Parser) parseCoolVariable() *ast.CoolVariable {
	tok := p.advance()

	// Extract variable name from literal
	re := regexp.MustCompile(`C@@L\s+ATOMIC_VARIABLE\s+(@\w+)`)
	matches := re.FindStringSubmatch(tok.Literal)
	varName := "@unknown"
	if len(matches) > 1 {
		varName = matches[1]
	}

	variable := &ast.CoolVariable{
		BaseNode: ast.BaseNode{
			NodeType: ast.NodeCoolVariable,
			Position: ast.Position{Line: tok.Line, Column: tok.Column},
		},
		Name:  varName,
		Scope: "global",
	}

	// Parse variable definition
	for !p.isAtEnd() && !p.check(lexer.COOL_VECTOR) && !p.check(lexer.COOL_VARIABLE) && !p.check(lexer.COOL_BLOCK) {
		if p.check(lexer.AT) {
			name, value := p.parseAtomParam()
			switch name {
			case "default":
				variable.DefaultValue = value
			case "scope":
				if s, ok := value.(string); ok {
					variable.Scope = s
				}
			}
		} else {
			p.advance()
		}
	}

	return variable
}

// parseAtomParam parses @param: value
func (p *Parser) parseAtomParam() (string, interface{}) {
	atomTok := p.advance() // @name
	name := strings.TrimPrefix(atomTok.Literal, "@")

	var value interface{}

	// Check for colon
	if p.check(lexer.COLON) {
		p.advance()
	}

	// Parse value
	if p.check(lexer.JSON) {
		jsonTok := p.advance()
		value = jsonTok.Value
	} else if p.check(lexer.STRING) {
		strTok := p.advance()
		value = strTok.Value
	} else if p.check(lexer.NUMBER) {
		numTok := p.advance()
		value = numTok.Value
	} else if p.check(lexer.IDENT) {
		identTok := p.advance()
		value = identTok.Literal
	} else if p.check(lexer.AT) {
		// Reference to another atom
		refTok := p.advance()
		value = refTok.Literal
	}

	return name, value
}

// parseValue parses a value (JSON, string, number, identifier, expression)
func (p *Parser) parseValue() interface{} {
	if p.check(lexer.JSON) {
		tok := p.advance()
		return tok.Value
	}
	if p.check(lexer.STRING) {
		tok := p.advance()
		return tok.Value
	}
	if p.check(lexer.NUMBER) {
		tok := p.advance()
		return tok.Value
	}
	if p.check(lexer.LBRACKET) {
		return p.parseArrayLiteral()
	}
	if p.check(lexer.IDENT) {
		tok := p.advance()
		return tok.Literal
	}
	if p.check(lexer.AT) {
		tok := p.advance()
		return tok.Literal
	}
	if p.check(lexer.TRUE) {
		p.advance()
		return true
	}
	if p.check(lexer.FALSE) {
		p.advance()
		return false
	}
	if p.check(lexer.NULL) {
		p.advance()
		return nil
	}
	return nil
}

// parseArrayLiteral parses [...]
func (p *Parser) parseArrayLiteral() []interface{} {
	p.advance() // skip [
	elements := make([]interface{}, 0)

	for !p.isAtEnd() && !p.check(lexer.RBRACKET) {
		elem := p.parseValue()
		if elem != nil {
			elements = append(elements, elem)
		}
		if p.check(lexer.COMMA) {
			p.advance()
		}
	}

	if p.check(lexer.RBRACKET) {
		p.advance()
	}

	return elements
}

// addNodeToProgram adds a parsed node to the program
func (p *Parser) addNodeToProgram(node interface{}) {
	switch n := node.(type) {
	case *ast.Declaration:
		if n.Name == "manifest_ast" {
			// Parse manifest
			if m, ok := n.Value.(map[string]interface{}); ok {
				p.program.Manifest = p.parseManifest(m)
			}
		}
		p.program.Declarations = append(p.program.Declarations, n)
	case *ast.Assignment:
		p.program.Assignments = append(p.program.Assignments, n)
	case *ast.AtomicBlock:
		p.program.AtomicBlocks[n.Name] = n
	case *ast.CoolBlock:
		p.program.CoolBlocks[n.Name] = n
	case *ast.CoolVector:
		p.program.CoolVectors[n.Name] = n
	case *ast.CoolVariable:
		p.program.CoolVariables[n.Name] = n
	case *ast.BlockDefinition:
		p.program.Blocks = append(p.program.Blocks, n)
	}
}

// parseManifest parses a manifest from a map
func (p *Parser) parseManifest(m map[string]interface{}) *ast.Manifest {
	manifest := &ast.Manifest{
		BaseNode: ast.BaseNode{NodeType: ast.NodeManifest},
		Raw:      m,
	}

	if v, ok := m["n"].(string); ok {
		manifest.Name = v
	}
	if v, ok := m["v"].(string); ok {
		manifest.Version = v
	}
	if v, ok := m["atomic_law"].(string); ok {
		manifest.AtomicLaw = v
	}
	if v, ok := m["packs"].([]interface{}); ok {
		manifest.Packs = make([]string, len(v))
		for i, pack := range v {
			if s, ok := pack.(string); ok {
				manifest.Packs[i] = s
			}
		}
	}
	if v, ok := m["tapes"].(map[string]interface{}); ok {
		manifest.Tapes = v
	}
	if v, ok := m["kuhul_folds"].(map[string]interface{}); ok {
		manifest.KuhulFolds = v
	}
	if v, ok := m["rest_mesh"].(map[string]interface{}); ok {
		manifest.RestMesh = v
	}
	if v, ok := m["site_content"].(map[string]interface{}); ok {
		manifest.SiteContent = v
	}

	return manifest
}

// Helper methods

func (p *Parser) peek() lexer.Token {
	if p.pos >= len(p.tokens) {
		return lexer.Token{Type: lexer.EOF}
	}
	return p.tokens[p.pos]
}

func (p *Parser) advance() lexer.Token {
	tok := p.peek()
	if !p.isAtEnd() {
		p.pos++
	}
	return tok
}

func (p *Parser) check(t lexer.TokenType) bool {
	return p.peek().Type == t
}

func (p *Parser) expect(t lexer.TokenType, msg string) *lexer.Token {
	if p.check(t) {
		tok := p.advance()
		return &tok
	}
	p.error(fmt.Sprintf("%s at line %d", msg, p.peek().Line))
	return nil
}

func (p *Parser) isAtEnd() bool {
	return p.peek().Type == lexer.EOF
}

func (p *Parser) isMarker() bool {
	t := p.peek().Type
	return t == lexer.POP || t == lexer.WO || t == lexer.SEK ||
		t == lexer.XUL || t == lexer.CHEN || t == lexer.ATOMIC_BLOCK
}

func (p *Parser) error(msg string) {
	p.errors = append(p.errors, msg)
}
