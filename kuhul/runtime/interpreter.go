package runtime

import (
	"fmt"
	"strings"

	"github.com/ollama/ollama/kuhul/ast"
	"github.com/ollama/ollama/kuhul/parser"
)

// Interpreter executes K'UHUL programs
type Interpreter struct {
	state        *RuntimeState
	program      *ast.Program
	callDepth    int
	maxCallDepth int
}

// NewInterpreter creates a new interpreter
func NewInterpreter() *Interpreter {
	return &Interpreter{
		state:        NewRuntimeState(),
		maxCallDepth: 100,
	}
}

// Load parses and loads a K'UHUL source file
func (i *Interpreter) Load(source string) (*ast.Program, []string) {
	program, errors := parser.Parse(source)
	if len(errors) > 0 {
		return program, errors
	}

	i.program = program

	// Load manifest
	if program.Manifest != nil {
		i.state.Manifest = program.Manifest.Raw
	}

	// Register handlers from C@@L BLOCKs
	i.registerHandlers()

	// Register variables
	i.registerVariables()

	// Register vectors
	i.registerVectors()

	return program, nil
}

// Run executes the loaded program
func (i *Interpreter) Run() (interface{}, error) {
	if i.program == nil {
		return nil, fmt.Errorf("no program loaded")
	}

	// Execute declarations
	for _, decl := range i.program.Declarations {
		if err := i.executeDeclaration(decl); err != nil {
			return nil, err
		}
	}

	// Execute assignments
	for _, assign := range i.program.Assignments {
		if err := i.executeAssignment(assign); err != nil {
			return nil, err
		}
	}

	// Execute blocks
	for _, block := range i.program.Blocks {
		if _, err := i.executeBlock(block); err != nil {
			return nil, err
		}
	}

	return i.state.GetState(), nil
}

// Eval evaluates a single expression or statement
func (i *Interpreter) Eval(source string) (interface{}, error) {
	program, errors := parser.Parse(source)
	if len(errors) > 0 {
		return nil, fmt.Errorf("parse errors: %v", errors)
	}

	var result interface{}
	var err error

	// Execute declarations
	for _, decl := range program.Declarations {
		if err = i.executeDeclaration(decl); err != nil {
			return nil, err
		}
	}

	// Execute assignments
	for _, assign := range program.Assignments {
		if err = i.executeAssignment(assign); err != nil {
			return nil, err
		}
		result = i.state.Variables.store[assign.Name]
	}

	// Execute blocks
	for _, block := range program.Blocks {
		result, err = i.executeBlock(block)
		if err != nil {
			return nil, err
		}
	}

	return result, nil
}

// Dispatch calls a handler by name
func (i *Interpreter) Dispatch(handlerName string, ctx *Context) (interface{}, error) {
	handler, ok := i.state.GetHandler(handlerName)
	if !ok {
		return nil, fmt.Errorf("handler not found: %s", handlerName)
	}

	if ctx == nil {
		ctx = &Context{
			Handler: handlerName,
			Params:  make(map[string]interface{}),
			Body:    make(map[string]interface{}),
			Query:   make(map[string]interface{}),
			Runtime: i.state,
			Env:     i.state.Variables,
		}
	}

	return handler.Execute(ctx)
}

// registerHandlers registers C@@L BLOCK handlers
func (i *Interpreter) registerHandlers() {
	for name, block := range i.program.CoolBlocks {
		handlerName := block.Handler
		if handlerName == "" {
			if h, ok := block.Params["handler"].(string); ok {
				handlerName = h
			}
		}
		if handlerName == "" {
			handlerName = name
		}

		handler := &Handler{
			Name:   name,
			Block:  block,
			Params: block.Params,
		}

		// Create executor based on handler name
		handler.Execute = i.createExecutor(handlerName, block)

		i.state.RegisterHandler(handlerName, handler)
	}
}

// registerVariables registers C@@L ATOMIC_VARIABLE definitions
func (i *Interpreter) registerVariables() {
	for name, variable := range i.program.CoolVariables {
		if variable.DefaultValue != nil {
			i.state.Variables.Set(name, variable.DefaultValue)
		} else {
			i.state.Variables.Set(name, nil)
		}
	}
}

// registerVectors registers C@@L ATOMIC_VECTOR definitions
func (i *Interpreter) registerVectors() {
	for name, vector := range i.program.CoolVectors {
		i.state.RegisterVector(name, &Vector{
			Name:   name,
			Params: vector.Params,
		})
	}
}

// createExecutor creates an executor function for a handler
func (i *Interpreter) createExecutor(handlerName string, block *ast.CoolBlock) func(*Context) (interface{}, error) {
	return func(ctx *Context) (interface{}, error) {
		i.callDepth++
		if i.callDepth > i.maxCallDepth {
			i.callDepth--
			return nil, fmt.Errorf("maximum call depth exceeded")
		}
		defer func() { i.callDepth-- }()

		return i.executeHandler(handlerName, ctx)
	}
}

// executeHandler executes a handler by name
func (i *Interpreter) executeHandler(handlerName string, ctx *Context) (interface{}, error) {
	switch handlerName {
	// Kernel handlers
	case "kernel_boot":
		return i.handleKernelBoot(ctx)
	case "tape_boot":
		return i.handleTapeBoot(ctx)
	case "basher_run":
		return i.handleBasherRun(ctx)

	// CMS handlers
	case "cms_rlhf_list":
		return i.handleCmsRlhfList(ctx)
	case "cms_rlhf_get":
		return i.handleCmsRlhfGet(ctx)
	case "cms_rlhf_post":
		return i.handleCmsRlhfPost(ctx)

	// GRAM handlers
	case "gram_observe":
		return i.handleGramObserve(ctx)
	case "gram_analyze_patterns":
		return i.handleGramAnalyze(ctx)
	case "gram_suggest_next":
		return i.handleGramSuggest(ctx)

	// Default: return handler info
	default:
		return map[string]interface{}{
			"ok":      true,
			"handler": handlerName,
			"params":  ctx.Params,
		}, nil
	}
}

// executeDeclaration executes a Pop declaration
func (i *Interpreter) executeDeclaration(decl *ast.Declaration) error {
	i.state.Variables.Set(decl.Name, decl.Value)
	return nil
}

// executeAssignment executes a Wo assignment
func (i *Interpreter) executeAssignment(assign *ast.Assignment) error {
	value := i.evaluateValue(assign.Value)
	i.state.Variables.Set(assign.Name, value)
	return nil
}

// executeBlock executes a Xul block
func (i *Interpreter) executeBlock(block *ast.BlockDefinition) (interface{}, error) {
	// Create new scope
	env := NewEnclosedEnvironment(i.state.Variables)

	// Set parameters
	for name, value := range block.Params {
		env.Set(name, value)
	}

	// Execute body
	var result interface{}
	for _, node := range block.Body {
		switch n := node.(type) {
		case *ast.CoolBlock:
			if handler, ok := i.state.GetHandler(n.Handler); ok {
				ctx := &Context{
					Handler: n.Handler,
					Params:  n.Params,
					Runtime: i.state,
					Env:     env,
				}
				r, err := handler.Execute(ctx)
				if err != nil {
					return nil, err
				}
				result = r
			}
		}
	}

	return result, nil
}

// evaluateValue evaluates a value expression
func (i *Interpreter) evaluateValue(value interface{}) interface{} {
	switch v := value.(type) {
	case string:
		// Check if it's a variable reference
		if strings.HasPrefix(v, "@") {
			if val, ok := i.state.Variables.Get(v); ok {
				return val
			}
		}
		return v
	default:
		return v
	}
}

// Built-in handler implementations

func (i *Interpreter) handleKernelBoot(ctx *Context) (interface{}, error) {
	i.state.AddBootStep("kernel_boot_start")

	// Load manifest
	if i.state.Manifest != nil {
		bootCount := 0
		if v, ok := i.state.GetASXRAM("os.boot.count"); ok {
			if bc, ok := v.(int); ok {
				bootCount = bc
			}
		}
		i.state.SetASXRAM("os.boot.count", bootCount+1)
		i.state.SetASXRAM("os.state", "booting")
		i.state.SetASXRAM("os.kernel", "kuhul.go Ω.∞.Ω")
		i.state.AddBootStep("manifest_loaded")
	}

	// Initialize tapes
	if tapes, ok := i.state.Manifest["tapes"].(map[string]interface{}); ok {
		for id, tape := range tapes {
			i.state.MX2DB.Tapes[id] = tape
		}
		i.state.AddBootStep("tapes_registered")
	}

	i.state.Booted = true
	i.state.SetASXRAM("os.state", "active")
	i.state.AddBootStep("kernel_boot_complete")

	manifestName := ""
	if n, ok := i.state.Manifest["n"].(string); ok {
		manifestName = n
	}

	return map[string]interface{}{
		"ok":         true,
		"status":     "booted",
		"boot_steps": i.state.BootSteps,
		"manifest":   manifestName,
	}, nil
}

func (i *Interpreter) handleTapeBoot(ctx *Context) (interface{}, error) {
	tapeID := ""
	if v, ok := ctx.Params["tape_id"].(string); ok {
		tapeID = v
	}

	if tapeID == "" {
		return map[string]interface{}{"ok": false, "error": "No tape_id provided"}, nil
	}

	tape, ok := i.state.MX2DB.Tapes[tapeID]
	if !ok {
		return map[string]interface{}{"ok": false, "error": "Tape not found", "tape_id": tapeID}, nil
	}

	i.state.SetASXRAM("os.active_tape", tapeID)
	i.state.SetASXRAM("tapes.active_id", tapeID)

	return map[string]interface{}{
		"ok":      true,
		"message": fmt.Sprintf("Tape %s booted", tapeID),
		"tape":    tape,
	}, nil
}

func (i *Interpreter) handleBasherRun(ctx *Context) (interface{}, error) {
	command := ""
	if v, ok := ctx.Params["command"].(string); ok {
		command = v
	}
	if v, ok := ctx.Body["command"].(string); ok {
		command = v
	}

	if command == "" {
		return map[string]interface{}{"ok": false, "error": "No command provided"}, nil
	}

	parts := strings.Fields(command)
	cmd := parts[0]
	args := parts[1:]

	switch cmd {
	case "tapes.list":
		tapes := make([]map[string]interface{}, 0)
		for id, t := range i.state.MX2DB.Tapes {
			tape := map[string]interface{}{"id": id}
			if tm, ok := t.(map[string]interface{}); ok {
				if label, ok := tm["label"]; ok {
					tape["label"] = label
				}
				if role, ok := tm["role"]; ok {
					tape["role"] = role
				}
			}
			tapes = append(tapes, tape)
		}
		return map[string]interface{}{"ok": true, "tapes": tapes}, nil

	case "tapes.boot":
		if len(args) > 0 {
			return i.handleTapeBoot(&Context{Params: map[string]interface{}{"tape_id": args[0]}})
		}
		return map[string]interface{}{"ok": false, "error": "No tape_id provided"}, nil

	case "ram.get":
		if len(args) > 0 {
			v, _ := i.state.GetASXRAM(args[0])
			return map[string]interface{}{"ok": true, "key": args[0], "value": v}, nil
		}
		return map[string]interface{}{"ok": false, "error": "No key provided"}, nil

	case "ram.set":
		if len(args) >= 2 {
			i.state.SetASXRAM(args[0], strings.Join(args[1:], " "))
			return map[string]interface{}{"ok": true, "key": args[0]}, nil
		}
		return map[string]interface{}{"ok": false, "error": "Key and value required"}, nil

	case "ram.list":
		keys := make([]string, 0, len(i.state.ASXRAM))
		for k := range i.state.ASXRAM {
			keys = append(keys, k)
		}
		return map[string]interface{}{"ok": true, "keys": keys, "count": len(keys)}, nil

	case "health":
		return map[string]interface{}{
			"ok":       true,
			"kernel":   "kuhul.go Ω.∞.Ω",
			"booted":   i.state.Booted,
			"ram_keys": len(i.state.ASXRAM),
			"tapes":    len(i.state.MX2DB.Tapes),
		}, nil

	default:
		return map[string]interface{}{"ok": false, "error": fmt.Sprintf("Unknown command: %s", cmd)}, nil
	}
}

func (i *Interpreter) handleCmsRlhfList(ctx *Context) (interface{}, error) {
	items := make([]interface{}, 0)
	for _, v := range i.state.MX2DB.RLHFTraces {
		items = append(items, v)
	}
	return map[string]interface{}{
		"ok":    true,
		"mode":  "list",
		"items": items,
		"total": len(items),
	}, nil
}

func (i *Interpreter) handleCmsRlhfGet(ctx *Context) (interface{}, error) {
	caseID := ""
	if v, ok := ctx.Query["id"].(string); ok {
		caseID = v
	}
	if v, ok := ctx.Params["id"].(string); ok {
		caseID = v
	}

	if item, ok := i.state.MX2DB.RLHFTraces[caseID]; ok {
		return map[string]interface{}{"ok": true, "mode": "get", "item": item}, nil
	}
	return map[string]interface{}{"ok": false, "error": "Case not found", "case_id": caseID}, nil
}

func (i *Interpreter) handleCmsRlhfPost(ctx *Context) (interface{}, error) {
	caseID := fmt.Sprintf("rlhf_%d", len(i.state.MX2DB.RLHFTraces)+1)

	newCase := map[string]interface{}{
		"case_id": caseID,
		"title":   ctx.Body["title"],
		"label":   ctx.Body["label"],
		"body":    ctx.Body["body"],
	}

	i.state.MX2DB.RLHFTraces[caseID] = newCase

	return map[string]interface{}{
		"ok":      true,
		"mode":    "post",
		"case_id": caseID,
		"message": "RLHF case created",
	}, nil
}

func (i *Interpreter) handleGramObserve(ctx *Context) (interface{}, error) {
	sequence, ok := ctx.Body["sequence"].([]interface{})
	if !ok {
		return map[string]interface{}{"ok": false, "error": "No sequence provided"}, nil
	}

	windowSize := 3
	if ws, ok := ctx.Body["window_size"].(float64); ok {
		windowSize = int(ws)
	}

	// Generate n-grams
	for j := 0; j <= len(sequence)-windowSize; j++ {
		gram := ""
		for k := 0; k < windowSize; k++ {
			if k > 0 {
				gram += "|"
			}
			gram += fmt.Sprintf("%v", sequence[j+k])
		}
		i.state.MX2DB.NGrams[gram]++
	}

	return map[string]interface{}{
		"ok":            true,
		"observed":      len(sequence),
		"n_grams_count": len(i.state.MX2DB.NGrams),
	}, nil
}

func (i *Interpreter) handleGramAnalyze(ctx *Context) (interface{}, error) {
	patterns := make([]map[string]interface{}, 0)
	total := len(i.state.MX2DB.NGrams)

	for gram, count := range i.state.MX2DB.NGrams {
		patterns = append(patterns, map[string]interface{}{
			"gram":      gram,
			"count":     count,
			"frequency": float64(count) / float64(total),
		})
	}

	return map[string]interface{}{
		"ok":             true,
		"mode":           "analyze",
		"top_patterns":   patterns,
		"total_patterns": total,
	}, nil
}

func (i *Interpreter) handleGramSuggest(ctx *Context) (interface{}, error) {
	prefix, ok := ctx.Body["prefix"].([]interface{})
	if !ok {
		return map[string]interface{}{"ok": false, "error": "No prefix provided"}, nil
	}

	prefixStr := ""
	for j, p := range prefix {
		if j > 0 {
			prefixStr += "|"
		}
		prefixStr += fmt.Sprintf("%v", p)
	}

	suggestions := make([]map[string]interface{}, 0)

	for gram, count := range i.state.MX2DB.NGrams {
		if strings.HasPrefix(gram, prefixStr) {
			parts := strings.Split(gram, "|")
			if len(parts) > len(prefix) {
				suggestions = append(suggestions, map[string]interface{}{
					"next":       parts[len(prefix)],
					"count":      count,
					"confidence": float64(count) / float64(len(i.state.MX2DB.NGrams)),
				})
			}
		}
	}

	return map[string]interface{}{
		"ok":          true,
		"mode":        "suggest",
		"prefix":      prefix,
		"suggestions": suggestions,
	}, nil
}

// GetState returns the current runtime state
func (i *Interpreter) GetState() *RuntimeState {
	return i.state
}

// GetVariable gets a variable value
func (i *Interpreter) GetVariable(name string) (interface{}, bool) {
	return i.state.Variables.Get(name)
}

// SetVariable sets a variable value
func (i *Interpreter) SetVariable(name string, value interface{}) {
	i.state.Variables.Set(name, value)
}
