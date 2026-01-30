// Package llama provides Llama model components implemented in K'UHUL.
//
// This package demonstrates how LLM architectures can be expressed in K'UHUL
// syntax, enabling unified AI orchestration through the glyph-based language.
//
// Components:
//   - Tokenizer: BPE tokenization with vocab management
//   - Attention: Multi-head attention mechanism
//   - FFN: Feed-forward network
//   - Inference: Full inference pipeline
package llama

import (
	"math"
	"strings"

	"github.com/ollama/ollama/kuhul/runtime"
	"github.com/ollama/ollama/kuhul/scxq2"
)

// TokenizerConfig holds tokenizer configuration
type TokenizerConfig struct {
	VocabSize    int                `json:"vocab_size"`
	BOS          int                `json:"bos_token"`
	EOS          int                `json:"eos_token"`
	PAD          int                `json:"pad_token"`
	UNK          int                `json:"unk_token"`
	Vocab        map[string]int     `json:"vocab"`
	Merges       [][]string         `json:"merges"`
	SpecialTokens map[string]int    `json:"special_tokens"`
}

// Tokenizer implements BPE tokenization
type Tokenizer struct {
	Config    TokenizerConfig
	VocabRev  map[int]string
	MergeRank map[string]int
}

// NewTokenizer creates a new tokenizer
func NewTokenizer(config TokenizerConfig) *Tokenizer {
	t := &Tokenizer{
		Config:    config,
		VocabRev:  make(map[int]string),
		MergeRank: make(map[string]int),
	}

	// Build reverse vocab
	for k, v := range config.Vocab {
		t.VocabRev[v] = k
	}

	// Build merge ranks
	for i, merge := range config.Merges {
		key := merge[0] + " " + merge[1]
		t.MergeRank[key] = i
	}

	return t
}

// Encode tokenizes text to token IDs
func (t *Tokenizer) Encode(text string) []int {
	if text == "" {
		return []int{}
	}

	// Simple word-level tokenization with BPE
	words := strings.Fields(text)
	tokens := make([]int, 0)

	for _, word := range words {
		wordTokens := t.encodeWord(word)
		tokens = append(tokens, wordTokens...)
	}

	return tokens
}

// encodeWord applies BPE to a single word
func (t *Tokenizer) encodeWord(word string) []int {
	// Check if word is in vocab
	if id, ok := t.Config.Vocab[word]; ok {
		return []int{id}
	}

	// Check special tokens
	if id, ok := t.Config.SpecialTokens[word]; ok {
		return []int{id}
	}

	// Apply character-level fallback
	tokens := make([]int, 0)
	for _, ch := range word {
		charStr := string(ch)
		if id, ok := t.Config.Vocab[charStr]; ok {
			tokens = append(tokens, id)
		} else {
			tokens = append(tokens, t.Config.UNK)
		}
	}

	return tokens
}

// Decode converts token IDs back to text
func (t *Tokenizer) Decode(tokens []int) string {
	parts := make([]string, 0, len(tokens))

	for _, id := range tokens {
		if token, ok := t.VocabRev[id]; ok {
			parts = append(parts, token)
		}
	}

	return strings.Join(parts, " ")
}

// Fingerprint generates an SCXQ2 fingerprint for tokens
func (t *Tokenizer) Fingerprint(tokens []int) string {
	return scxq2.Fingerprint(tokens)
}

// AttentionConfig holds attention layer configuration
type AttentionConfig struct {
	NumHeads   int     `json:"num_heads"`
	HeadDim    int     `json:"head_dim"`
	HiddenSize int     `json:"hidden_size"`
	Dropout    float64 `json:"dropout"`
}

// Attention implements multi-head attention
type Attention struct {
	Config AttentionConfig
	WQ     [][]float64 // Query weights
	WK     [][]float64 // Key weights
	WV     [][]float64 // Value weights
	WO     [][]float64 // Output projection
}

// NewAttention creates a new attention layer
func NewAttention(config AttentionConfig) *Attention {
	dim := config.HiddenSize
	return &Attention{
		Config: config,
		WQ:     makeMatrix(dim, dim),
		WK:     makeMatrix(dim, dim),
		WV:     makeMatrix(dim, dim),
		WO:     makeMatrix(dim, dim),
	}
}

// Forward computes attention
func (a *Attention) Forward(x [][]float64, mask [][]float64) [][]float64 {
	seqLen := len(x)
	if seqLen == 0 {
		return x
	}

	dim := a.Config.HiddenSize
	headDim := a.Config.HeadDim
	numHeads := a.Config.NumHeads

	// Project Q, K, V
	Q := matmul(x, a.WQ)
	K := matmul(x, a.WK)
	V := matmul(x, a.WV)

	// Scaled dot-product attention
	scale := 1.0 / math.Sqrt(float64(headDim))

	// Compute attention scores
	scores := make([][]float64, seqLen)
	for i := 0; i < seqLen; i++ {
		scores[i] = make([]float64, seqLen)
		for j := 0; j < seqLen; j++ {
			dot := 0.0
			for k := 0; k < dim; k++ {
				dot += Q[i][k] * K[j][k]
			}
			scores[i][j] = dot * scale

			// Apply mask if provided
			if mask != nil && mask[i][j] < 0 {
				scores[i][j] = math.Inf(-1)
			}
		}
	}

	// Apply softmax
	for i := 0; i < seqLen; i++ {
		scores[i] = softmax(scores[i])
	}

	// Compute weighted sum of values
	output := make([][]float64, seqLen)
	for i := 0; i < seqLen; i++ {
		output[i] = make([]float64, dim)
		for j := 0; j < seqLen; j++ {
			for k := 0; k < dim; k++ {
				output[i][k] += scores[i][j] * V[j][k]
			}
		}
	}

	// Output projection
	output = matmul(output, a.WO)

	_ = headDim
	_ = numHeads

	return output
}

// FFNConfig holds feed-forward network configuration
type FFNConfig struct {
	HiddenSize      int     `json:"hidden_size"`
	IntermediateSize int    `json:"intermediate_size"`
	Activation      string  `json:"activation"`
}

// FFN implements the feed-forward network
type FFN struct {
	Config FFNConfig
	W1     [][]float64 // First projection
	W2     [][]float64 // Second projection
	W3     [][]float64 // Gate projection (for SwiGLU)
}

// NewFFN creates a new FFN layer
func NewFFN(config FFNConfig) *FFN {
	return &FFN{
		Config: config,
		W1:     makeMatrix(config.HiddenSize, config.IntermediateSize),
		W2:     makeMatrix(config.IntermediateSize, config.HiddenSize),
		W3:     makeMatrix(config.HiddenSize, config.IntermediateSize),
	}
}

// Forward computes FFN output
func (f *FFN) Forward(x [][]float64) [][]float64 {
	seqLen := len(x)
	if seqLen == 0 {
		return x
	}

	// First projection with activation
	h := matmul(x, f.W1)

	// Apply SwiGLU activation
	if f.Config.Activation == "silu" || f.Config.Activation == "swiglu" {
		gate := matmul(x, f.W3)
		for i := range h {
			for j := range h[i] {
				h[i][j] = silu(h[i][j]) * gate[i][j]
			}
		}
	} else {
		// Default GELU
		for i := range h {
			for j := range h[i] {
				h[i][j] = gelu(h[i][j])
			}
		}
	}

	// Second projection
	return matmul(h, f.W2)
}

// TransformerBlock represents a single transformer block
type TransformerBlock struct {
	Attention *Attention
	FFN       *FFN
	LNAttn    *LayerNorm
	LNFFN     *LayerNorm
}

// LayerNorm implements layer normalization
type LayerNorm struct {
	Gamma []float64
	Beta  []float64
	Eps   float64
}

// NewLayerNorm creates a new layer norm
func NewLayerNorm(dim int) *LayerNorm {
	gamma := make([]float64, dim)
	beta := make([]float64, dim)
	for i := 0; i < dim; i++ {
		gamma[i] = 1.0
	}
	return &LayerNorm{
		Gamma: gamma,
		Beta:  beta,
		Eps:   1e-5,
	}
}

// Forward applies layer normalization
func (ln *LayerNorm) Forward(x []float64) []float64 {
	n := len(x)
	if n == 0 {
		return x
	}

	// Compute mean
	mean := 0.0
	for _, v := range x {
		mean += v
	}
	mean /= float64(n)

	// Compute variance
	variance := 0.0
	for _, v := range x {
		diff := v - mean
		variance += diff * diff
	}
	variance /= float64(n)

	// Normalize
	result := make([]float64, n)
	std := math.Sqrt(variance + ln.Eps)
	for i, v := range x {
		result[i] = (v-mean)/std*ln.Gamma[i] + ln.Beta[i]
	}

	return result
}

// InferenceConfig holds inference configuration
type InferenceConfig struct {
	Temperature float64 `json:"temperature"`
	TopP        float64 `json:"top_p"`
	TopK        int     `json:"top_k"`
	MaxTokens   int     `json:"max_tokens"`
}

// DefaultInferenceConfig returns default inference config
func DefaultInferenceConfig() InferenceConfig {
	return InferenceConfig{
		Temperature: 0.7,
		TopP:        0.9,
		TopK:        40,
		MaxTokens:   2048,
	}
}

// LlamaModel represents a Llama model
type LlamaModel struct {
	Tokenizer *Tokenizer
	Blocks    []*TransformerBlock
	Embed     [][]float64  // Token embeddings
	LNFinal   *LayerNorm
	LMHead    [][]float64  // Output projection
	Config    ModelConfig
}

// ModelConfig holds model configuration
type ModelConfig struct {
	VocabSize        int    `json:"vocab_size"`
	HiddenSize       int    `json:"hidden_size"`
	IntermediateSize int    `json:"intermediate_size"`
	NumLayers        int    `json:"num_layers"`
	NumHeads         int    `json:"num_heads"`
	HeadDim          int    `json:"head_dim"`
	MaxSeqLen        int    `json:"max_seq_len"`
	RopeTheta        float64 `json:"rope_theta"`
}

// NewLlamaModel creates a mock Llama model
func NewLlamaModel(config ModelConfig) *LlamaModel {
	// Create tokenizer with mock vocab
	tokConfig := TokenizerConfig{
		VocabSize: config.VocabSize,
		BOS:       1,
		EOS:       2,
		PAD:       0,
		UNK:       3,
		Vocab:     make(map[string]int),
		Merges:    [][]string{},
		SpecialTokens: map[string]int{
			"<|begin_of_text|>": 1,
			"<|end_of_text|>":   2,
		},
	}

	// Add basic vocab
	for i := 0; i < 256; i++ {
		tokConfig.Vocab[string(rune(i))] = i + 4
	}

	model := &LlamaModel{
		Tokenizer: NewTokenizer(tokConfig),
		Blocks:    make([]*TransformerBlock, config.NumLayers),
		Embed:     makeMatrix(config.VocabSize, config.HiddenSize),
		LNFinal:   NewLayerNorm(config.HiddenSize),
		LMHead:    makeMatrix(config.HiddenSize, config.VocabSize),
		Config:    config,
	}

	// Create transformer blocks
	for i := 0; i < config.NumLayers; i++ {
		model.Blocks[i] = &TransformerBlock{
			Attention: NewAttention(AttentionConfig{
				NumHeads:   config.NumHeads,
				HeadDim:    config.HeadDim,
				HiddenSize: config.HiddenSize,
			}),
			FFN: NewFFN(FFNConfig{
				HiddenSize:       config.HiddenSize,
				IntermediateSize: config.IntermediateSize,
				Activation:       "silu",
			}),
			LNAttn: NewLayerNorm(config.HiddenSize),
			LNFFN:  NewLayerNorm(config.HiddenSize),
		}
	}

	return model
}

// Generate generates tokens given input
func (m *LlamaModel) Generate(input string, config InferenceConfig) (string, error) {
	// Tokenize input
	tokens := m.Tokenizer.Encode(input)

	// Add BOS token
	tokens = append([]int{m.Config.VocabSize + 1}, tokens...)

	// Generate tokens (mock)
	generated := make([]int, 0)
	for i := 0; i < config.MaxTokens; i++ {
		// Get next token (mock - just repeat pattern)
		nextToken := (tokens[len(tokens)-1] + i) % m.Tokenizer.Config.VocabSize
		generated = append(generated, nextToken)

		// Check for EOS
		if nextToken == m.Tokenizer.Config.EOS {
			break
		}
	}

	// Decode output
	output := m.Tokenizer.Decode(generated)
	return output, nil
}

// RegisterLlamaHandlers registers Llama handlers with the runtime
func RegisterLlamaHandlers(state *runtime.RuntimeState) {
	// Create a small mock model
	config := ModelConfig{
		VocabSize:        32000,
		HiddenSize:       4096,
		IntermediateSize: 11008,
		NumLayers:        2,    // Use fewer layers for mock
		NumHeads:         32,
		HeadDim:          128,
		MaxSeqLen:        4096,
		RopeTheta:        10000.0,
	}
	model := NewLlamaModel(config)

	// Register tokenize handler
	state.RegisterHandler("llama.tokenize", &runtime.Handler{
		Name: "llama.tokenize",
		Execute: func(ctx *runtime.Context) (interface{}, error) {
			text, _ := ctx.Body["text"].(string)
			tokens := model.Tokenizer.Encode(text)
			return map[string]interface{}{
				"ok":          true,
				"tokens":      tokens,
				"token_count": len(tokens),
				"fingerprint": model.Tokenizer.Fingerprint(tokens),
			}, nil
		},
	})

	// Register decode handler
	state.RegisterHandler("llama.decode", &runtime.Handler{
		Name: "llama.decode",
		Execute: func(ctx *runtime.Context) (interface{}, error) {
			tokensRaw, _ := ctx.Body["tokens"].([]interface{})
			tokens := make([]int, len(tokensRaw))
			for i, t := range tokensRaw {
				if f, ok := t.(float64); ok {
					tokens[i] = int(f)
				}
			}
			text := model.Tokenizer.Decode(tokens)
			return map[string]interface{}{
				"ok":   true,
				"text": text,
			}, nil
		},
	})

	// Register generate handler
	state.RegisterHandler("llama.generate", &runtime.Handler{
		Name: "llama.generate",
		Execute: func(ctx *runtime.Context) (interface{}, error) {
			prompt, _ := ctx.Body["prompt"].(string)
			inferConfig := DefaultInferenceConfig()

			if temp, ok := ctx.Body["temperature"].(float64); ok {
				inferConfig.Temperature = temp
			}
			if maxTok, ok := ctx.Body["max_tokens"].(float64); ok {
				inferConfig.MaxTokens = int(maxTok)
			}

			output, err := model.Generate(prompt, inferConfig)
			if err != nil {
				return map[string]interface{}{"ok": false, "error": err.Error()}, nil
			}

			return map[string]interface{}{
				"ok":     true,
				"output": output,
				"model":  "llama-kuhul",
			}, nil
		},
	})

	// Register model info handler
	state.RegisterHandler("llama.info", &runtime.Handler{
		Name: "llama.info",
		Execute: func(ctx *runtime.Context) (interface{}, error) {
			return map[string]interface{}{
				"ok":          true,
				"model":       "llama-kuhul",
				"vocab_size":  model.Config.VocabSize,
				"hidden_size": model.Config.HiddenSize,
				"num_layers":  model.Config.NumLayers,
				"num_heads":   model.Config.NumHeads,
			}, nil
		},
	})
}

// Helper functions

func makeMatrix(rows, cols int) [][]float64 {
	mat := make([][]float64, rows)
	for i := range mat {
		mat[i] = make([]float64, cols)
		// Initialize with small random values
		for j := range mat[i] {
			mat[i][j] = 0.01 * float64((i+j)%100) / 100.0
		}
	}
	return mat
}

func matmul(a, b [][]float64) [][]float64 {
	if len(a) == 0 || len(b) == 0 {
		return nil
	}

	m, k := len(a), len(a[0])
	n := len(b[0])

	result := make([][]float64, m)
	for i := range result {
		result[i] = make([]float64, n)
		for j := 0; j < n; j++ {
			for l := 0; l < k && l < len(b); l++ {
				result[i][j] += a[i][l] * b[l][j]
			}
		}
	}

	return result
}

func softmax(x []float64) []float64 {
	if len(x) == 0 {
		return x
	}

	// Find max for numerical stability
	max := x[0]
	for _, v := range x[1:] {
		if v > max {
			max = v
		}
	}

	// Compute exp and sum
	result := make([]float64, len(x))
	sum := 0.0
	for i, v := range x {
		result[i] = math.Exp(v - max)
		sum += result[i]
	}

	// Normalize
	for i := range result {
		result[i] /= sum
	}

	return result
}

func silu(x float64) float64 {
	return x / (1.0 + math.Exp(-x))
}

func gelu(x float64) float64 {
	return 0.5 * x * (1.0 + math.Tanh(math.Sqrt(2.0/math.Pi)*(x+0.044715*x*x*x)))
}
