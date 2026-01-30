// Package server provides K'UHUL API handlers for the Ollama server.
package server

import (
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/ollama/ollama/api/xjson"
	"github.com/ollama/ollama/kuhul"
	"github.com/ollama/ollama/kuhul/runtime"
	"github.com/ollama/ollama/packs"
)

// KuhulState holds the server-wide K'UHUL runtime state
type KuhulState struct {
	interpreter *kuhul.Interpreter
	runtime     *runtime.RuntimeState
	mu          sync.RWMutex
}

var globalKuhulState *KuhulState

func init() {
	globalKuhulState = &KuhulState{
		interpreter: kuhul.NewInterpreter(),
		runtime:     runtime.NewRuntimeState(),
	}
	// Initialize packs with runtime
	packs.All() // Ensure packs are registered
}

// GetKuhulState returns the global K'UHUL state
func GetKuhulState() *KuhulState {
	return globalKuhulState
}

// KuhulExecuteRequest represents a K'UHUL execute request
type KuhulExecuteRequest struct {
	Source string `json:"source"`
	Mode   string `json:"mode,omitempty"` // "run", "eval", "parse", "tokenize"
}

// KuhulExecuteResponse represents a K'UHUL execute response
type KuhulExecuteResponse struct {
	Ok      bool        `json:"ok"`
	Result  interface{} `json:"result,omitempty"`
	Error   string      `json:"error,omitempty"`
	SCXQ2   string      `json:"scxq2,omitempty"`
	Metrics interface{} `json:"metrics,omitempty"`
}

// KuhulDispatchRequest represents a K'UHUL dispatch request
type KuhulDispatchRequest struct {
	Handler string                 `json:"handler"`
	Params  map[string]interface{} `json:"params,omitempty"`
	Body    map[string]interface{} `json:"body,omitempty"`
}

// KuhulExecuteHandler handles K'UHUL code execution
func (s *Server) KuhulExecuteHandler(c *gin.Context) {
	var req KuhulExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, KuhulExecuteResponse{
			Ok:    false,
			Error: "Invalid request: " + err.Error(),
		})
		return
	}

	if req.Source == "" {
		c.JSON(http.StatusBadRequest, KuhulExecuteResponse{
			Ok:    false,
			Error: "source is required",
		})
		return
	}

	mode := req.Mode
	if mode == "" {
		mode = "run"
	}

	var result interface{}
	var err error

	switch mode {
	case "tokenize":
		result = kuhul.Tokenize(req.Source)
	case "parse":
		program, errors := kuhul.Parse(req.Source)
		if len(errors) > 0 {
			c.JSON(http.StatusOK, KuhulExecuteResponse{
				Ok:    false,
				Error: errors[0],
			})
			return
		}
		result = program
	case "eval":
		result, err = kuhul.Eval(req.Source)
	case "run":
		result, err = kuhul.Run(req.Source)
	default:
		c.JSON(http.StatusBadRequest, KuhulExecuteResponse{
			Ok:    false,
			Error: "Invalid mode: " + mode,
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusOK, KuhulExecuteResponse{
			Ok:    false,
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, KuhulExecuteResponse{
		Ok:     true,
		Result: result,
		SCXQ2:  kuhul.Fingerprint(result),
	})
}

// KuhulDispatchHandler handles K'UHUL handler dispatch
func (s *Server) KuhulDispatchHandler(c *gin.Context) {
	var req KuhulDispatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, KuhulExecuteResponse{
			Ok:    false,
			Error: "Invalid request: " + err.Error(),
		})
		return
	}

	if req.Handler == "" {
		c.JSON(http.StatusBadRequest, KuhulExecuteResponse{
			Ok:    false,
			Error: "handler is required",
		})
		return
	}

	globalKuhulState.mu.RLock()
	interp := globalKuhulState.interpreter
	globalKuhulState.mu.RUnlock()

	result, err := interp.Dispatch(req.Handler, req.Body)
	if err != nil {
		c.JSON(http.StatusOK, KuhulExecuteResponse{
			Ok:    false,
			Error: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, KuhulExecuteResponse{
		Ok:     true,
		Result: result,
		SCXQ2:  kuhul.Fingerprint(result),
	})
}

// KuhulStateHandler returns the K'UHUL runtime state
func (s *Server) KuhulStateHandler(c *gin.Context) {
	globalKuhulState.mu.RLock()
	state := globalKuhulState.interpreter.GetState()
	globalKuhulState.mu.RUnlock()

	c.JSON(http.StatusOK, KuhulExecuteResponse{
		Ok:     true,
		Result: state.GetState(),
	})
}

// KuhulLoadHandler loads K'UHUL source into the interpreter
func (s *Server) KuhulLoadHandler(c *gin.Context) {
	var req KuhulExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, KuhulExecuteResponse{
			Ok:    false,
			Error: "Invalid request: " + err.Error(),
		})
		return
	}

	globalKuhulState.mu.Lock()
	_, errors := globalKuhulState.interpreter.Load(req.Source)
	globalKuhulState.mu.Unlock()

	if len(errors) > 0 {
		c.JSON(http.StatusOK, KuhulExecuteResponse{
			Ok:    false,
			Error: errors[0],
		})
		return
	}

	c.JSON(http.StatusOK, KuhulExecuteResponse{
		Ok: true,
	})
}

// XJSONInferHandler handles XJSON @infer requests
func (s *Server) XJSONInferHandler(c *gin.Context) {
	var envelope xjson.XJSONEnvelope
	if err := c.ShouldBindJSON(&envelope); err != nil {
		errResp := xjson.NewErrorResponse("server", "Invalid XJSON: "+err.Error(), 400)
		data, _ := errResp.ToJSON()
		c.Data(http.StatusBadRequest, "application/json", data)
		return
	}

	if !envelope.IsInferRequest() {
		errResp := xjson.NewErrorResponse("server", "Expected @infer request", 400)
		data, _ := errResp.ToJSON()
		c.Data(http.StatusBadRequest, "application/json", data)
		return
	}

	req := envelope.Infer
	if err := req.Validate(); err != nil {
		errResp := xjson.NewErrorResponse("server", err.Error(), 400)
		data, _ := errResp.ToJSON()
		c.Data(http.StatusBadRequest, "application/json", data)
		return
	}

	// Route to the appropriate pack handler based on runner
	runner := req.Runner
	if runner == "" {
		runner = "lam.o"
	}

	// For now, dispatch through the K'UHUL runtime
	globalKuhulState.mu.RLock()
	interp := globalKuhulState.interpreter
	globalKuhulState.mu.RUnlock()

	body := map[string]interface{}{
		"model":  req.Model,
		"prompt": req.Prompt,
		"mode":   req.Mode,
		"stream": req.Stream,
	}
	if req.Params != nil {
		body["params"] = map[string]interface{}{
			"temperature": req.Params.Temperature,
			"top_p":       req.Params.TopP,
			"max_tokens":  req.Params.MaxTokens,
		}
	}

	result, err := interp.Dispatch("lam_o.infer", body)
	if err != nil {
		errResp := xjson.NewErrorResponse(runner, err.Error(), 500)
		data, _ := errResp.ToJSON()
		c.Data(http.StatusInternalServerError, "application/json", data)
		return
	}

	// Build response
	var respText string
	if m, ok := result.(map[string]interface{}); ok {
		if text, ok := m["text"].(string); ok {
			respText = text
		}
	}

	resp := xjson.NewCompletionResponse(req.Model, runner, respText)
	data, _ := resp.ToJSON()
	c.Data(http.StatusOK, "application/json", data)
}

// PacksListHandler lists all registered packs
func (s *Server) PacksListHandler(c *gin.Context) {
	allPacks := packs.All()
	packList := make([]map[string]interface{}, len(allPacks))
	for i, p := range allPacks {
		packList[i] = map[string]interface{}{
			"name":        p.Name(),
			"version":     p.Version(),
			"description": p.Description(),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":    true,
		"packs": packList,
	})
}

// FingerprintHandler generates SCXQ2 fingerprint
func (s *Server) FingerprintHandler(c *gin.Context) {
	var data interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"ok":    false,
			"error": "Invalid JSON: " + err.Error(),
		})
		return
	}

	fp := kuhul.Fingerprint(data)
	c.JSON(http.StatusOK, gin.H{
		"ok":          true,
		"fingerprint": fp,
	})
}
