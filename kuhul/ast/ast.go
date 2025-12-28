// Package ast defines the Abstract Syntax Tree for K'UHUL programs.
//
// K'UHUL (Kernel Hyper Universal Language) uses Mayan calendar-inspired
// keywords and glyph-based syntax for multi-paradigm programming.
//
// The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK
package ast

import "encoding/json"

// NodeType represents the type of an AST node
type NodeType string

const (
	// Program nodes
	NodeProgram NodeType = "Program"

	// Declaration nodes (Pop)
	NodeDeclaration NodeType = "Declaration"
	NodeManifest    NodeType = "Manifest"

	// Assignment nodes (Wo)
	NodeAssignment NodeType = "Assignment"
	NodeVariable   NodeType = "Variable"

	// Control flow nodes (Sek)
	NodeControlVector NodeType = "ControlVector"
	NodeIfThenElse    NodeType = "IfThenElse"
	NodeLoop          NodeType = "Loop"
	NodeDispatch      NodeType = "Dispatch"

	// Block nodes (Xul)
	NodeBlock           NodeType = "Block"
	NodeBlockDefinition NodeType = "BlockDefinition"
	NodeFunction        NodeType = "Function"

	// Return nodes (Ch'en)
	NodeReturn NodeType = "Return"
	NodeEmit   NodeType = "Emit"

	// Atomic block nodes
	NodeAtomicBlock    NodeType = "AtomicBlock"
	NodeCoolBlock      NodeType = "CoolBlock"
	NodeCoolVector     NodeType = "CoolVector"
	NodeCoolVariable   NodeType = "CoolVariable"

	// Expression nodes
	NodeIdentifier   NodeType = "Identifier"
	NodeLiteral      NodeType = "Literal"
	NodeBinaryExpr   NodeType = "BinaryExpr"
	NodeUnaryExpr    NodeType = "UnaryExpr"
	NodeCallExpr     NodeType = "CallExpr"
	NodeMemberExpr   NodeType = "MemberExpr"
	NodeIndexExpr    NodeType = "IndexExpr"
	NodeArrayExpr    NodeType = "ArrayExpr"
	NodeObjectExpr   NodeType = "ObjectExpr"
	NodeLambda       NodeType = "Lambda"

	// Pack nodes
	NodePack       NodeType = "Pack"
	NodePackInvoke NodeType = "PackInvoke"
)

// Position represents a source location
type Position struct {
	Line   int `json:"line"`
	Column int `json:"col"`
	Offset int `json:"offset,omitempty"`
}

// Node is the base interface for all AST nodes
type Node interface {
	Type() NodeType
	Pos() Position
	String() string
}

// BaseNode provides common fields for all nodes
type BaseNode struct {
	NodeType NodeType `json:"type"`
	Position Position `json:"pos"`
}

func (n *BaseNode) Type() NodeType { return n.NodeType }
func (n *BaseNode) Pos() Position  { return n.Position }

// Program represents a complete K'UHUL program
type Program struct {
	BaseNode
	Version       string                  `json:"version"`
	Manifest      *Manifest               `json:"manifest,omitempty"`
	Declarations  []*Declaration          `json:"declarations"`
	Assignments   []*Assignment           `json:"assignments"`
	Blocks        []*BlockDefinition      `json:"blocks"`
	AtomicBlocks  map[string]*AtomicBlock `json:"atomicBlocks"`
	CoolBlocks    map[string]*CoolBlock   `json:"coolBlocks"`
	CoolVectors   map[string]*CoolVector  `json:"coolVectors"`
	CoolVariables map[string]*CoolVariable `json:"coolVariables"`
}

func NewProgram() *Program {
	return &Program{
		BaseNode:      BaseNode{NodeType: NodeProgram},
		Version:       "1.0.0",
		Declarations:  make([]*Declaration, 0),
		Assignments:   make([]*Assignment, 0),
		Blocks:        make([]*BlockDefinition, 0),
		AtomicBlocks:  make(map[string]*AtomicBlock),
		CoolBlocks:    make(map[string]*CoolBlock),
		CoolVectors:   make(map[string]*CoolVector),
		CoolVariables: make(map[string]*CoolVariable),
	}
}

func (n *Program) String() string {
	b, _ := json.MarshalIndent(n, "", "  ")
	return string(b)
}

// Manifest represents program metadata (from Pop manifest_ast)
type Manifest struct {
	BaseNode
	Name        string                 `json:"n,omitempty"`
	Version     string                 `json:"v,omitempty"`
	AtomicLaw   string                 `json:"atomic_law,omitempty"`
	Packs       []string               `json:"packs,omitempty"`
	Tapes       map[string]interface{} `json:"tapes,omitempty"`
	KuhulFolds  map[string]interface{} `json:"kuhul_folds,omitempty"`
	RestMesh    map[string]interface{} `json:"rest_mesh,omitempty"`
	SiteContent map[string]interface{} `json:"site_content,omitempty"`
	Raw         map[string]interface{} `json:"raw,omitempty"`
}

func (n *Manifest) String() string {
	b, _ := json.MarshalIndent(n, "", "  ")
	return string(b)
}

// Declaration represents a Pop declaration
type Declaration struct {
	BaseNode
	Name  string      `json:"name"`
	Value interface{} `json:"value,omitempty"`
}

func (n *Declaration) String() string {
	return "Pop " + n.Name
}

// Assignment represents a Wo assignment
type Assignment struct {
	BaseNode
	Name  string      `json:"name"`
	Value interface{} `json:"value"`
}

func (n *Assignment) String() string {
	return "Wo " + n.Name
}

// ControlVector represents a Sek control flow construct
type ControlVector struct {
	BaseNode
	VectorType string                 `json:"vectorType"`
	Params     map[string]interface{} `json:"params"`
	Body       []Node                 `json:"body,omitempty"`
}

func (n *ControlVector) String() string {
	return "Sek " + n.VectorType
}

// BlockDefinition represents a Xul block definition
type BlockDefinition struct {
	BaseNode
	Name   string                 `json:"name"`
	Params map[string]interface{} `json:"params"`
	Body   []Node                 `json:"body"`
}

func (n *BlockDefinition) String() string {
	return "Xul " + n.Name
}

// ReturnStatement represents a Ch'en return statement
type ReturnStatement struct {
	BaseNode
	Value interface{} `json:"value,omitempty"`
}

func (n *ReturnStatement) String() string {
	return "Ch'en"
}

// AtomicBlock represents an ATOMIC_BLOCK
type AtomicBlock struct {
	BaseNode
	Name    string                 `json:"name"`
	Content map[string]interface{} `json:"content"`
}

func (n *AtomicBlock) String() string {
	return "ATOMIC_BLOCK_" + n.Name
}

// CoolBlock represents a C@@L BLOCK
type CoolBlock struct {
	BaseNode
	Name    string                 `json:"name"`
	Handler string                 `json:"handler,omitempty"`
	Params  map[string]interface{} `json:"params"`
	Body    []interface{}          `json:"body"`
}

func (n *CoolBlock) String() string {
	return "C@@L BLOCK " + n.Name
}

// CoolVector represents a C@@L ATOMIC_VECTOR
type CoolVector struct {
	BaseNode
	Name   string                 `json:"name"`
	Params map[string]interface{} `json:"params"`
}

func (n *CoolVector) String() string {
	return "C@@L ATOMIC_VECTOR " + n.Name
}

// CoolVariable represents a C@@L ATOMIC_VARIABLE
type CoolVariable struct {
	BaseNode
	Name         string      `json:"name"`
	DefaultValue interface{} `json:"defaultValue,omitempty"`
	Scope        string      `json:"scope"`
}

func (n *CoolVariable) String() string {
	return "C@@L ATOMIC_VARIABLE " + n.Name
}

// Expression nodes

// Identifier represents a variable or function name
type Identifier struct {
	BaseNode
	Name string `json:"name"`
}

func (n *Identifier) String() string {
	return n.Name
}

// Literal represents a literal value (number, string, bool, null)
type Literal struct {
	BaseNode
	Value interface{} `json:"value"`
	Raw   string      `json:"raw,omitempty"`
}

func (n *Literal) String() string {
	b, _ := json.Marshal(n.Value)
	return string(b)
}

// BinaryExpr represents a binary expression (a + b, a == b, etc.)
type BinaryExpr struct {
	BaseNode
	Operator string `json:"operator"`
	Left     Node   `json:"left"`
	Right    Node   `json:"right"`
}

func (n *BinaryExpr) String() string {
	return n.Left.String() + " " + n.Operator + " " + n.Right.String()
}

// UnaryExpr represents a unary expression (!a, -a, etc.)
type UnaryExpr struct {
	BaseNode
	Operator string `json:"operator"`
	Operand  Node   `json:"operand"`
}

func (n *UnaryExpr) String() string {
	return n.Operator + n.Operand.String()
}

// CallExpr represents a function/pack call
type CallExpr struct {
	BaseNode
	Callee    Node   `json:"callee"`
	Arguments []Node `json:"arguments"`
}

func (n *CallExpr) String() string {
	return n.Callee.String() + "(...)"
}

// MemberExpr represents property access (a.b)
type MemberExpr struct {
	BaseNode
	Object   Node   `json:"object"`
	Property string `json:"property"`
}

func (n *MemberExpr) String() string {
	return n.Object.String() + "." + n.Property
}

// IndexExpr represents index access (a[b])
type IndexExpr struct {
	BaseNode
	Object Node `json:"object"`
	Index  Node `json:"index"`
}

func (n *IndexExpr) String() string {
	return n.Object.String() + "[" + n.Index.String() + "]"
}

// ArrayExpr represents an array literal
type ArrayExpr struct {
	BaseNode
	Elements []Node `json:"elements"`
}

func (n *ArrayExpr) String() string {
	return "[...]"
}

// ObjectExpr represents an object literal
type ObjectExpr struct {
	BaseNode
	Properties map[string]Node `json:"properties"`
}

func (n *ObjectExpr) String() string {
	return "{...}"
}

// Lambda represents an anonymous function
type Lambda struct {
	BaseNode
	Params []string `json:"params"`
	Body   Node     `json:"body"`
}

func (n *Lambda) String() string {
	return "lambda(...)"
}

// Pack represents a pack invocation
type Pack struct {
	BaseNode
	Name   string                 `json:"name"`
	Action string                 `json:"action,omitempty"`
	Params map[string]interface{} `json:"params"`
}

func (n *Pack) String() string {
	return "Pack " + n.Name
}
