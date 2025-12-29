// Package packs provides the K'UHUL pack system for modular capabilities.
//
// Packs are self-contained modules that extend K'UHUL with specific functionality.
// Each pack registers handlers, vectors, and variables that can be invoked from
// K'UHUL code.
//
// Core Packs:
//   - pack_lam_o: Llama/Ollama model runner
//   - pack_scxq2: SCXQ2 fingerprinting and XCFE compression
//   - pack_asx_ram: ASX memory system
//   - pack_mx2lm: MX2LM orchestrator
//   - pack_pi_goat: Polyglot AST engine
package packs

import (
	"fmt"
	"sync"

	"github.com/ollama/ollama/api/xjson"
	"github.com/ollama/ollama/kuhul/runtime"
	"github.com/ollama/ollama/kuhul/scxq2"
)

// Pack represents a K'UHUL pack
type Pack interface {
	// Name returns the pack name
	Name() string

	// Version returns the pack version
	Version() string

	// Description returns a description of the pack
	Description() string

	// Init initializes the pack with the runtime
	Init(state *runtime.RuntimeState) error

	// Handlers returns the pack's handlers
	Handlers() map[string]HandlerFunc

	// Vectors returns the pack's vectors
	Vectors() map[string]VectorFunc

	// Variables returns the pack's variables
	Variables() map[string]interface{}
}

// HandlerFunc is a pack handler function
type HandlerFunc func(ctx *runtime.Context) (interface{}, error)

// VectorFunc is a pack vector function
type VectorFunc func(args ...interface{}) interface{}

// Registry manages pack registration and discovery
type Registry struct {
	packs map[string]Pack
	mu    sync.RWMutex
}

// Global registry
var globalRegistry = &Registry{
	packs: make(map[string]Pack),
}

// Register registers a pack globally
func Register(pack Pack) error {
	return globalRegistry.Register(pack)
}

// Get retrieves a pack by name
func Get(name string) (Pack, bool) {
	return globalRegistry.Get(name)
}

// All returns all registered packs
func All() []Pack {
	return globalRegistry.All()
}

// Register registers a pack with the registry
func (r *Registry) Register(pack Pack) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	name := pack.Name()
	if _, exists := r.packs[name]; exists {
		return fmt.Errorf("pack already registered: %s", name)
	}

	r.packs[name] = pack
	return nil
}

// Get retrieves a pack by name
func (r *Registry) Get(name string) (Pack, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	pack, ok := r.packs[name]
	return pack, ok
}

// All returns all registered packs
func (r *Registry) All() []Pack {
	r.mu.RLock()
	defer r.mu.RUnlock()

	packs := make([]Pack, 0, len(r.packs))
	for _, p := range r.packs {
		packs = append(packs, p)
	}
	return packs
}

// InitAll initializes all packs with the runtime
func (r *Registry) InitAll(state *runtime.RuntimeState) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for name, pack := range r.packs {
		if err := pack.Init(state); err != nil {
			return fmt.Errorf("failed to init pack %s: %w", name, err)
		}

		// Register handlers
		for handlerName, handler := range pack.Handlers() {
			state.RegisterHandler(handlerName, &runtime.Handler{
				Name: handlerName,
				Execute: func(ctx *runtime.Context) (interface{}, error) {
					return handler(ctx)
				},
			})
		}

		// Register vectors
		for vectorName, _ := range pack.Vectors() {
			state.RegisterVector(vectorName, &runtime.Vector{
				Name: vectorName,
			})
		}

		// Register variables
		for varName, value := range pack.Variables() {
			state.Variables.Set(varName, value)
		}
	}

	return nil
}

// ============================================
// PACK: lam.o (Llama/Ollama Runner)
// ============================================

// LamOPack provides Llama/Ollama model inference
type LamOPack struct {
	state    *runtime.RuntimeState
	endpoint string
}

// NewLamOPack creates a new lam.o pack
func NewLamOPack() *LamOPack {
	return &LamOPack{
		endpoint: "http://localhost:11434",
	}
}

func (p *LamOPack) Name() string        { return "pack_lam_o" }
func (p *LamOPack) Version() string     { return "1.0.0" }
func (p *LamOPack) Description() string { return "Llama/Ollama model runner pack" }

func (p *LamOPack) Init(state *runtime.RuntimeState) error {
	p.state = state
	return nil
}

func (p *LamOPack) Handlers() map[string]HandlerFunc {
	return map[string]HandlerFunc{
		"lam_o.infer":       p.handleInfer,
		"lam_o.chat":        p.handleChat,
		"lam_o.generate":    p.handleGenerate,
		"lam_o.embed":       p.handleEmbed,
		"lam_o.list_models": p.handleListModels,
		"lam_o.show_model":  p.handleShowModel,
	}
}

func (p *LamOPack) Vectors() map[string]VectorFunc {
	return map[string]VectorFunc{}
}

func (p *LamOPack) Variables() map[string]interface{} {
	return map[string]interface{}{
		"@lam_o_endpoint":      p.endpoint,
		"@lam_o_default_model": "llama3.2",
	}
}

func (p *LamOPack) handleInfer(ctx *runtime.Context) (interface{}, error) {
	// Create XJSON request from context
	req := xjson.CreateInferRequest(ctx.Body)
	if err := req.Validate(); err != nil {
		return xjson.NewErrorResponse("lam.o", err.Error(), 400), nil
	}

	// TODO: Actual Ollama API call
	// For now, return a mock response
	resp := xjson.NewCompletionResponse(req.Model, "lam.o", "[Mock response from "+req.Model+"]")
	resp.WithTokens(len(req.Prompt)/4, 50)

	return resp, nil
}

func (p *LamOPack) handleChat(ctx *runtime.Context) (interface{}, error) {
	return p.handleInfer(ctx)
}

func (p *LamOPack) handleGenerate(ctx *runtime.Context) (interface{}, error) {
	return p.handleInfer(ctx)
}

func (p *LamOPack) handleEmbed(ctx *runtime.Context) (interface{}, error) {
	text, _ := ctx.Body["text"].(string)
	model, _ := ctx.Body["model"].(string)
	if model == "" {
		model = "nomic-embed-text"
	}

	// Mock embedding
	embedding := make([]float64, 384)
	for i := range embedding {
		embedding[i] = float64(i) * 0.001
	}

	return map[string]interface{}{
		"ok":        true,
		"model":     model,
		"embedding": embedding,
		"text_len":  len(text),
	}, nil
}

func (p *LamOPack) handleListModels(ctx *runtime.Context) (interface{}, error) {
	// Mock model list
	return map[string]interface{}{
		"ok": true,
		"models": []map[string]interface{}{
			{"name": "llama3.2", "size": "4.7GB"},
			{"name": "deepseek-r1", "size": "8.4GB"},
			{"name": "qwen2.5-coder", "size": "4.9GB"},
		},
	}, nil
}

func (p *LamOPack) handleShowModel(ctx *runtime.Context) (interface{}, error) {
	model, _ := ctx.Body["model"].(string)
	return map[string]interface{}{
		"ok":    true,
		"model": model,
		"info": map[string]interface{}{
			"parameters": "7B",
			"quantization": "Q4_K_M",
			"format": "gguf",
		},
	}, nil
}

// ============================================
// PACK: scxq2 (Fingerprinting)
// ============================================

// SCXQ2Pack provides fingerprinting and compression
type SCXQ2Pack struct {
	state *runtime.RuntimeState
}

// NewSCXQ2Pack creates a new SCXQ2 pack
func NewSCXQ2Pack() *SCXQ2Pack {
	return &SCXQ2Pack{}
}

func (p *SCXQ2Pack) Name() string        { return "pack_scxq2" }
func (p *SCXQ2Pack) Version() string     { return "1.0.0" }
func (p *SCXQ2Pack) Description() string { return "SCXQ2 fingerprinting and XCFE compression" }

func (p *SCXQ2Pack) Init(state *runtime.RuntimeState) error {
	p.state = state
	return nil
}

func (p *SCXQ2Pack) Handlers() map[string]HandlerFunc {
	return map[string]HandlerFunc{
		"scxq2.fingerprint": p.handleFingerprint,
		"scxq2.verify":      p.handleVerify,
		"scxq2.compress":    p.handleCompress,
		"scxq2.decompress":  p.handleDecompress,
	}
}

func (p *SCXQ2Pack) Vectors() map[string]VectorFunc {
	return map[string]VectorFunc{
		"@fingerprint": func(args ...interface{}) interface{} {
			if len(args) > 0 {
				return scxq2.Fingerprint(args[0])
			}
			return ""
		},
	}
}

func (p *SCXQ2Pack) Variables() map[string]interface{} {
	return map[string]interface{}{
		"@scxq2_version": "SCXQ2-v1",
		"@xcfe_version":  "XCFE-v1",
	}
}

func (p *SCXQ2Pack) handleFingerprint(ctx *runtime.Context) (interface{}, error) {
	data := ctx.Body["data"]
	fp := scxq2.Fingerprint(data)
	return map[string]interface{}{
		"ok":          true,
		"fingerprint": fp,
	}, nil
}

func (p *SCXQ2Pack) handleVerify(ctx *runtime.Context) (interface{}, error) {
	data := ctx.Body["data"]
	fp, _ := ctx.Body["fingerprint"].(string)
	valid := scxq2.Verify(data, fp)
	return map[string]interface{}{
		"ok":    true,
		"valid": valid,
	}, nil
}

func (p *SCXQ2Pack) handleCompress(ctx *runtime.Context) (interface{}, error) {
	data := ctx.Body["data"]
	compressed := scxq2.Compress(data)
	return map[string]interface{}{
		"ok":         true,
		"compressed": compressed,
	}, nil
}

func (p *SCXQ2Pack) handleDecompress(ctx *runtime.Context) (interface{}, error) {
	// Parse XCFE data
	if xcfe, ok := ctx.Body["data"].(*scxq2.XCFECompressed); ok {
		decompressed := scxq2.Decompress(xcfe)
		return map[string]interface{}{
			"ok":           true,
			"decompressed": decompressed,
		}, nil
	}
	return map[string]interface{}{"ok": false, "error": "Invalid XCFE data"}, nil
}

// ============================================
// PACK: asx_ram (Memory System)
// ============================================

// ASXRAMPack provides the ASX memory system
type ASXRAMPack struct {
	state *runtime.RuntimeState
}

// NewASXRAMPack creates a new ASX-RAM pack
func NewASXRAMPack() *ASXRAMPack {
	return &ASXRAMPack{}
}

func (p *ASXRAMPack) Name() string        { return "pack_asx_ram" }
func (p *ASXRAMPack) Version() string     { return "1.0.0" }
func (p *ASXRAMPack) Description() string { return "ASX-RAM memory system" }

func (p *ASXRAMPack) Init(state *runtime.RuntimeState) error {
	p.state = state
	return nil
}

func (p *ASXRAMPack) Handlers() map[string]HandlerFunc {
	return map[string]HandlerFunc{
		"asx_ram.get":    p.handleGet,
		"asx_ram.set":    p.handleSet,
		"asx_ram.delete": p.handleDelete,
		"asx_ram.list":   p.handleList,
		"asx_ram.clear":  p.handleClear,
	}
}

func (p *ASXRAMPack) Vectors() map[string]VectorFunc {
	return map[string]VectorFunc{}
}

func (p *ASXRAMPack) Variables() map[string]interface{} {
	return map[string]interface{}{}
}

func (p *ASXRAMPack) handleGet(ctx *runtime.Context) (interface{}, error) {
	key, _ := ctx.Body["key"].(string)
	value, ok := p.state.GetASXRAM(key)
	return map[string]interface{}{
		"ok":    ok,
		"key":   key,
		"value": value,
	}, nil
}

func (p *ASXRAMPack) handleSet(ctx *runtime.Context) (interface{}, error) {
	key, _ := ctx.Body["key"].(string)
	value := ctx.Body["value"]
	p.state.SetASXRAM(key, value)
	return map[string]interface{}{
		"ok":  true,
		"key": key,
	}, nil
}

func (p *ASXRAMPack) handleDelete(ctx *runtime.Context) (interface{}, error) {
	key, _ := ctx.Body["key"].(string)
	p.state.SetASXRAM(key, nil)
	return map[string]interface{}{
		"ok":  true,
		"key": key,
	}, nil
}

func (p *ASXRAMPack) handleList(ctx *runtime.Context) (interface{}, error) {
	keys := make([]string, 0)
	for k := range p.state.ASXRAM {
		keys = append(keys, k)
	}
	return map[string]interface{}{
		"ok":    true,
		"keys":  keys,
		"count": len(keys),
	}, nil
}

func (p *ASXRAMPack) handleClear(ctx *runtime.Context) (interface{}, error) {
	for k := range p.state.ASXRAM {
		delete(p.state.ASXRAM, k)
	}
	return map[string]interface{}{
		"ok": true,
	}, nil
}

// ============================================
// PACK: mx2lm (Orchestrator)
// ============================================

// MX2LMPack provides the MX2LM orchestrator
type MX2LMPack struct {
	state *runtime.RuntimeState
}

// NewMX2LMPack creates a new MX2LM pack
func NewMX2LMPack() *MX2LMPack {
	return &MX2LMPack{}
}

func (p *MX2LMPack) Name() string        { return "pack_mx2lm" }
func (p *MX2LMPack) Version() string     { return "1.0.0" }
func (p *MX2LMPack) Description() string { return "MX2LM multi-model orchestrator" }

func (p *MX2LMPack) Init(state *runtime.RuntimeState) error {
	p.state = state
	return nil
}

func (p *MX2LMPack) Handlers() map[string]HandlerFunc {
	return map[string]HandlerFunc{
		"mx2lm.route":     p.handleRoute,
		"mx2lm.pipeline":  p.handlePipeline,
		"mx2lm.broadcast": p.handleBroadcast,
		"mx2lm.status":    p.handleStatus,
	}
}

func (p *MX2LMPack) Vectors() map[string]VectorFunc {
	return map[string]VectorFunc{}
}

func (p *MX2LMPack) Variables() map[string]interface{} {
	return map[string]interface{}{
		"@mx2lm_mode": "orchestrator",
	}
}

func (p *MX2LMPack) handleRoute(ctx *runtime.Context) (interface{}, error) {
	target, _ := ctx.Body["target"].(string)
	action, _ := ctx.Body["action"].(string)
	payload := ctx.Body["payload"]

	return map[string]interface{}{
		"ok":      true,
		"target":  target,
		"action":  action,
		"payload": payload,
		"routed":  true,
	}, nil
}

func (p *MX2LMPack) handlePipeline(ctx *runtime.Context) (interface{}, error) {
	steps, _ := ctx.Body["steps"].([]interface{})
	return map[string]interface{}{
		"ok":          true,
		"steps":       len(steps),
		"status":      "queued",
		"pipeline_id": fmt.Sprintf("pipe_%d", len(steps)),
	}, nil
}

func (p *MX2LMPack) handleBroadcast(ctx *runtime.Context) (interface{}, error) {
	message := ctx.Body["message"]
	targets, _ := ctx.Body["targets"].([]interface{})
	return map[string]interface{}{
		"ok":       true,
		"message":  message,
		"targets":  len(targets),
		"sent":     true,
	}, nil
}

func (p *MX2LMPack) handleStatus(ctx *runtime.Context) (interface{}, error) {
	return map[string]interface{}{
		"ok":       true,
		"mode":     "orchestrator",
		"handlers": len(p.state.Handlers),
		"vectors":  len(p.state.Vectors),
		"booted":   p.state.Booted,
	}, nil
}

// RegisterCorePacks registers all core packs
func RegisterCorePacks() {
	Register(NewLamOPack())
	Register(NewSCXQ2Pack())
	Register(NewASXRAMPack())
	Register(NewMX2LMPack())
}

func init() {
	RegisterCorePacks()
}
