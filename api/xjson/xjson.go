// Package xjson provides XJSON (eXecutable JSON) support for K'UHUL.
//
// XJSON is a semantic data format for K'UHUL operations with typed contracts.
// It enables declarative LLM inference requests and structured responses.
//
// Request Schema (@infer):
//
//	{
//	  "@infer": {
//	    "@runner": "lam.o",
//	    "@model": "deepseek-r1",
//	    "@prompt": "...",
//	    "@params": {...},
//	    "@context": [],
//	    "@mode": "chat"|"code"|"..."
//	  }
//	}
//
// Response Schema (@completion):
//
//	{
//	  "@completion": {
//	    "@model": "...",
//	    "@runner": "...",
//	    "@text": "...",
//	    "@tokens": {...},
//	    "@metrics": {...},
//	    "@scxq2": "..."
//	  }
//	}
package xjson

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/ollama/ollama/kuhul/scxq2"
)

// InferRequest represents an @infer XJSON request
type InferRequest struct {
	Runner  string                 `json:"@runner"`
	Model   string                 `json:"@model"`
	Prompt  string                 `json:"@prompt"`
	Params  *InferParams           `json:"@params,omitempty"`
	Context []Message              `json:"@context,omitempty"`
	Mode    string                 `json:"@mode,omitempty"`
	Stream  bool                   `json:"@stream,omitempty"`
	Extra   map[string]interface{} `json:"-"` // Additional fields
}

// InferParams contains inference parameters
type InferParams struct {
	Temperature      float64 `json:"temperature,omitempty"`
	TopP             float64 `json:"top_p,omitempty"`
	TopK             int     `json:"top_k,omitempty"`
	MaxTokens        int     `json:"max_tokens,omitempty"`
	RepeatPenalty    float64 `json:"repeat_penalty,omitempty"`
	PresencePenalty  float64 `json:"presence_penalty,omitempty"`
	FrequencyPenalty float64 `json:"frequency_penalty,omitempty"`
	Seed             int     `json:"seed,omitempty"`
	Stop             []string `json:"stop,omitempty"`
}

// Message represents a conversation message
type Message struct {
	Role    string   `json:"role"`
	Content string   `json:"content"`
	Images  []string `json:"images,omitempty"`
}

// CompletionResponse represents an @completion XJSON response
type CompletionResponse struct {
	Model   string          `json:"@model"`
	Runner  string          `json:"@runner"`
	Text    string          `json:"@text"`
	Tokens  *TokenStats     `json:"@tokens,omitempty"`
	Metrics *InferMetrics   `json:"@metrics,omitempty"`
	SCXQ2   string          `json:"@scxq2,omitempty"`
	Done    bool            `json:"@done,omitempty"`
}

// TokenStats contains token usage statistics
type TokenStats struct {
	Input    int `json:"input"`
	Output   int `json:"output"`
	Total    int `json:"total,omitempty"`
}

// InferMetrics contains inference performance metrics
type InferMetrics struct {
	LatencyMS       float64 `json:"latency_ms,omitempty"`
	TokensPerSecond float64 `json:"tokens_per_second,omitempty"`
	Backend         string  `json:"backend,omitempty"`
	GPULayers       int     `json:"gpu_layers,omitempty"`
	StartedAt       int64   `json:"started_at,omitempty"`
	CompletedAt     int64   `json:"completed_at,omitempty"`
}

// ErrorResponse represents an @error XJSON response
type ErrorResponse struct {
	Runner  string `json:"@runner"`
	Message string `json:"@message"`
	Code    int    `json:"@code"`
	Details string `json:"@details,omitempty"`
}

// XJSONEnvelope wraps XJSON messages
type XJSONEnvelope struct {
	Infer      *InferRequest       `json:"@infer,omitempty"`
	Completion *CompletionResponse `json:"@completion,omitempty"`
	Error      *ErrorResponse      `json:"@error,omitempty"`
}

// DefaultParams returns default inference parameters
func DefaultParams() *InferParams {
	return &InferParams{
		Temperature:   0.7,
		TopP:          0.9,
		TopK:          40,
		MaxTokens:     2048,
		RepeatPenalty: 1.1,
	}
}

// NewInferRequest creates a new inference request
func NewInferRequest(model, prompt string) *InferRequest {
	return &InferRequest{
		Runner: "lam.o",
		Model:  model,
		Prompt: prompt,
		Params: DefaultParams(),
		Mode:   "chat",
	}
}

// WithParams sets inference parameters
func (r *InferRequest) WithParams(p *InferParams) *InferRequest {
	r.Params = p
	return r
}

// WithContext sets conversation context
func (r *InferRequest) WithContext(ctx []Message) *InferRequest {
	r.Context = ctx
	return r
}

// WithMode sets the inference mode
func (r *InferRequest) WithMode(mode string) *InferRequest {
	r.Mode = mode
	return r
}

// Validate validates the inference request
func (r *InferRequest) Validate() error {
	if r.Runner == "" {
		return fmt.Errorf("@runner is required")
	}
	if r.Model == "" {
		return fmt.Errorf("@model is required")
	}
	if r.Prompt == "" && len(r.Context) == 0 {
		return fmt.Errorf("@prompt or @context is required")
	}
	return nil
}

// ToJSON converts the request to XJSON format
func (r *InferRequest) ToJSON() ([]byte, error) {
	envelope := XJSONEnvelope{Infer: r}
	return json.MarshalIndent(envelope, "", "  ")
}

// Fingerprint generates an SCXQ2 fingerprint for the request
func (r *InferRequest) Fingerprint() string {
	data := map[string]interface{}{
		"runner": r.Runner,
		"model":  r.Model,
		"mode":   r.Mode,
		"prompt_shape": map[string]interface{}{
			"length":         len(r.Prompt),
			"has_context":    len(r.Context) > 0,
			"context_length": len(r.Context),
		},
	}
	if r.Params != nil {
		data["params"] = r.Params
	}
	return scxq2.Fingerprint(data)
}

// NewCompletionResponse creates a completion response
func NewCompletionResponse(model, runner, text string) *CompletionResponse {
	resp := &CompletionResponse{
		Model:  model,
		Runner: runner,
		Text:   text,
		Done:   true,
		Metrics: &InferMetrics{
			CompletedAt: time.Now().UnixMilli(),
		},
	}
	resp.SCXQ2 = resp.Fingerprint()
	return resp
}

// WithTokens sets token statistics
func (r *CompletionResponse) WithTokens(input, output int) *CompletionResponse {
	r.Tokens = &TokenStats{
		Input:  input,
		Output: output,
		Total:  input + output,
	}
	return r
}

// WithMetrics sets inference metrics
func (r *CompletionResponse) WithMetrics(m *InferMetrics) *CompletionResponse {
	r.Metrics = m
	return r
}

// Fingerprint generates an SCXQ2 fingerprint for the response
func (r *CompletionResponse) Fingerprint() string {
	data := map[string]interface{}{
		"model":       r.Model,
		"runner":      r.Runner,
		"text_length": len(r.Text),
		"done":        r.Done,
	}
	if r.Tokens != nil {
		data["tokens"] = r.Tokens
	}
	if r.Metrics != nil {
		data["latency_ms"] = r.Metrics.LatencyMS
	}
	return scxq2.Fingerprint(data)
}

// ToJSON converts the response to XJSON format
func (r *CompletionResponse) ToJSON() ([]byte, error) {
	envelope := XJSONEnvelope{Completion: r}
	return json.MarshalIndent(envelope, "", "  ")
}

// NewErrorResponse creates an error response
func NewErrorResponse(runner, message string, code int) *ErrorResponse {
	return &ErrorResponse{
		Runner:  runner,
		Message: message,
		Code:    code,
	}
}

// WithDetails adds error details
func (r *ErrorResponse) WithDetails(details string) *ErrorResponse {
	r.Details = details
	return r
}

// ToJSON converts the error to XJSON format
func (r *ErrorResponse) ToJSON() ([]byte, error) {
	envelope := XJSONEnvelope{Error: r}
	return json.MarshalIndent(envelope, "", "  ")
}

// ParseXJSON parses an XJSON envelope
func ParseXJSON(data []byte) (*XJSONEnvelope, error) {
	var envelope XJSONEnvelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		return nil, fmt.Errorf("failed to parse XJSON: %w", err)
	}
	return &envelope, nil
}

// IsInferRequest checks if the envelope contains an @infer request
func (e *XJSONEnvelope) IsInferRequest() bool {
	return e.Infer != nil
}

// IsCompletion checks if the envelope contains an @completion
func (e *XJSONEnvelope) IsCompletion() bool {
	return e.Completion != nil
}

// IsError checks if the envelope contains an @error
func (e *XJSONEnvelope) IsError() bool {
	return e.Error != nil
}

// CreateInferRequest is a helper to create an @infer request
func CreateInferRequest(opts map[string]interface{}) *InferRequest {
	req := &InferRequest{
		Runner: "lam.o",
		Params: DefaultParams(),
	}

	if v, ok := opts["model"].(string); ok {
		req.Model = v
	}
	if v, ok := opts["prompt"].(string); ok {
		req.Prompt = v
	}
	if v, ok := opts["mode"].(string); ok {
		req.Mode = v
	}
	if v, ok := opts["runner"].(string); ok {
		req.Runner = v
	}
	if v, ok := opts["stream"].(bool); ok {
		req.Stream = v
	}
	if p, ok := opts["params"].(map[string]interface{}); ok {
		if t, ok := p["temperature"].(float64); ok {
			req.Params.Temperature = t
		}
		if t, ok := p["top_p"].(float64); ok {
			req.Params.TopP = t
		}
		if t, ok := p["max_tokens"].(float64); ok {
			req.Params.MaxTokens = int(t)
		}
	}

	return req
}

// CreateCompletionResponse is a helper to create an @completion response
func CreateCompletionResponse(opts map[string]interface{}) *CompletionResponse {
	resp := &CompletionResponse{
		Runner: "lam.o",
		Done:   true,
	}

	if v, ok := opts["model"].(string); ok {
		resp.Model = v
	}
	if v, ok := opts["text"].(string); ok {
		resp.Text = v
	}
	if v, ok := opts["runner"].(string); ok {
		resp.Runner = v
	}
	if t, ok := opts["tokens"].(map[string]interface{}); ok {
		resp.Tokens = &TokenStats{}
		if v, ok := t["input"].(float64); ok {
			resp.Tokens.Input = int(v)
		}
		if v, ok := t["output"].(float64); ok {
			resp.Tokens.Output = int(v)
		}
		resp.Tokens.Total = resp.Tokens.Input + resp.Tokens.Output
	}
	if m, ok := opts["metrics"].(map[string]interface{}); ok {
		resp.Metrics = &InferMetrics{}
		if v, ok := m["latency_ms"].(float64); ok {
			resp.Metrics.LatencyMS = v
		}
		if v, ok := m["backend"].(string); ok {
			resp.Metrics.Backend = v
		}
	}

	resp.SCXQ2 = resp.Fingerprint()
	return resp
}

// CreateError is a helper to create an @error response
func CreateError(opts map[string]interface{}) *ErrorResponse {
	err := &ErrorResponse{
		Runner: "lam.o",
		Code:   500,
	}

	if v, ok := opts["runner"].(string); ok {
		err.Runner = v
	}
	if v, ok := opts["message"].(string); ok {
		err.Message = v
	}
	if v, ok := opts["code"].(float64); ok {
		err.Code = int(v)
	}
	if v, ok := opts["details"].(string); ok {
		err.Details = v
	}

	return err
}
