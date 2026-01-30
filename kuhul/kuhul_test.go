package kuhul

import (
	"strings"
	"testing"
)

func TestTokenize(t *testing.T) {
	tests := []struct {
		name     string
		source   string
		expected int // expected token count (including EOF)
	}{
		{
			name:     "empty",
			source:   "",
			expected: 1, // just EOF
		},
		{
			name:     "pop declaration",
			source:   `⟁Pop⟁ manifest_ast {"n": "test"}`,
			expected: 4, // POP, IDENT, JSON, EOF
		},
		{
			name:     "wo assignment",
			source:   `⟁Wo⟁ x = 10`,
			expected: 5, // WO, IDENT, ASSIGN, NUMBER, EOF
		},
		{
			name:     "multiple statements",
			source:   "⟁Wo⟁ x = 10\n⟁Wo⟁ y = 20",
			expected: 10, // WO, IDENT, ASSIGN, NUMBER, NEWLINE, WO, IDENT, ASSIGN, NUMBER, EOF
		},
		{
			name:     "json object",
			source:   `{"key": "value", "num": 42}`,
			expected: 2, // JSON, EOF
		},
		{
			name:     "json array",
			source:   `[1, 2, 3]`,
			expected: 2, // JSON, EOF
		},
		{
			name:     "cool block",
			source:   `C@@L BLOCK test_handler`,
			expected: 2, // COOL_BLOCK, EOF
		},
		{
			name:     "atom",
			source:   `@handler: kernel_boot`,
			expected: 4, // AT, COLON, IDENT, EOF
		},
		{
			name:     "comment",
			source:   "# this is a comment\n⟁Wo⟁ x = 1",
			expected: 7, // COMMENT, NEWLINE, WO, IDENT, ASSIGN, NUMBER, EOF
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tokens := Tokenize(tt.source)
			if len(tokens) != tt.expected {
				t.Errorf("Tokenize() got %d tokens, want %d", len(tokens), tt.expected)
				for i, tok := range tokens {
					t.Logf("  [%d] %s", i, tok.String())
				}
			}
		})
	}
}

func TestParse(t *testing.T) {
	tests := []struct {
		name       string
		source     string
		wantErrors bool
		checkAST   func(*Program) bool
	}{
		{
			name:       "empty program",
			source:     "",
			wantErrors: false,
			checkAST: func(p *Program) bool {
				return p != nil && len(p.Declarations) == 0
			},
		},
		{
			name:       "simple declaration",
			source:     `⟁Pop⟁ test_decl {"value": 42}`,
			wantErrors: false,
			checkAST: func(p *Program) bool {
				return len(p.Declarations) == 1 && p.Declarations[0].Name == "test_decl"
			},
		},
		{
			name:       "simple assignment",
			source:     `⟁Wo⟁ my_var = 100`,
			wantErrors: false,
			checkAST: func(p *Program) bool {
				return len(p.Assignments) == 1 && p.Assignments[0].Name == "my_var"
			},
		},
		{
			name: "manifest declaration",
			source: `⟁Pop⟁ manifest_ast {
				"n": "test_program",
				"v": "1.0.0",
				"atomic_law": "ASX = XCFE = XJSON = KUHUL"
			}`,
			wantErrors: false,
			checkAST: func(p *Program) bool {
				return p.Manifest != nil && p.Manifest.Name == "test_program"
			},
		},
		{
			name:       "cool block",
			source:     "C@@L BLOCK kernel_boot\n@handler: kernel_boot",
			wantErrors: false,
			checkAST: func(p *Program) bool {
				// Check if any cool block has the handler we want
				for _, block := range p.CoolBlocks {
					if block.Handler == "kernel_boot" {
						return true
					}
				}
				return false
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			program, errors := Parse(tt.source)

			if tt.wantErrors && len(errors) == 0 {
				t.Error("Parse() expected errors but got none")
			}
			if !tt.wantErrors && len(errors) > 0 {
				t.Errorf("Parse() unexpected errors: %v", errors)
			}

			if tt.checkAST != nil && !tt.checkAST(program) {
				t.Error("Parse() AST check failed")
				t.Logf("Program: %s", program.String())
			}
		})
	}
}

func TestRun(t *testing.T) {
	tests := []struct {
		name      string
		source    string
		wantError bool
		checkFn   func(interface{}) bool
	}{
		{
			name:      "simple assignment",
			source:    `⟁Wo⟁ x = 42`,
			wantError: false,
			checkFn: func(result interface{}) bool {
				return result != nil
			},
		},
		{
			name: "multiple assignments",
			source: `
				⟁Wo⟁ a = 10
				⟁Wo⟁ b = 20
				⟁Wo⟁ c = 30
			`,
			wantError: false,
			checkFn: func(result interface{}) bool {
				if m, ok := result.(map[string]interface{}); ok {
					vars, _ := m["variables"].([]string)
					return len(vars) >= 3
				}
				return false
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := Run(tt.source)

			if tt.wantError && err == nil {
				t.Error("Run() expected error but got none")
			}
			if !tt.wantError && err != nil {
				t.Errorf("Run() unexpected error: %v", err)
			}

			if tt.checkFn != nil && !tt.checkFn(result) {
				t.Error("Run() result check failed")
				t.Logf("Result: %v", result)
			}
		})
	}
}

func TestFingerprint(t *testing.T) {
	tests := []struct {
		name string
		data interface{}
	}{
		{
			name: "string",
			data: "hello world",
		},
		{
			name: "number",
			data: 42,
		},
		{
			name: "map",
			data: map[string]interface{}{"key": "value"},
		},
		{
			name: "array",
			data: []interface{}{1, 2, 3},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fp := Fingerprint(tt.data)

			// Check format
			if !strings.HasPrefix(fp, "SCXQ2-v1:") {
				t.Errorf("Fingerprint() format incorrect: %s", fp)
			}

			// Check length (SCXQ2-v1: + 32 hex chars)
			if len(fp) != 9+32 {
				t.Errorf("Fingerprint() length incorrect: got %d, want %d", len(fp), 41)
			}

			// Check determinism
			fp2 := Fingerprint(tt.data)
			if fp != fp2 {
				t.Errorf("Fingerprint() not deterministic: %s != %s", fp, fp2)
			}

			// Check verification
			if !VerifyFingerprint(tt.data, fp) {
				t.Error("VerifyFingerprint() failed to verify valid fingerprint")
			}
		})
	}
}

func TestCompress(t *testing.T) {
	data := map[string]interface{}{
		"type":   "Program",
		"name":   "test",
		"value":  42,
		"params": map[string]interface{}{"a": 1, "b": 2},
	}

	compressed := Compress(data)

	if compressed == nil {
		t.Fatal("Compress() returned nil")
	}

	if compressed.Version != "XCFE-v1" {
		t.Errorf("Compress() version = %s, want XCFE-v1", compressed.Version)
	}

	if compressed.Type != "Program" {
		t.Errorf("Compress() type = %s, want Program", compressed.Type)
	}

	// Check decompression
	decompressed := Decompress(compressed)
	if decompressed == nil {
		t.Fatal("Decompress() returned nil")
	}

	if dm, ok := decompressed.(map[string]interface{}); ok {
		if dm["type"] != "Program" {
			t.Errorf("Decompress() type mismatch")
		}
	} else {
		t.Error("Decompress() returned wrong type")
	}
}

func TestBuiltins(t *testing.T) {
	// Test matrix_multiply
	t.Run("matrix_multiply", func(t *testing.T) {
		mm := Builtins["matrix_multiply"]
		a := []interface{}{
			[]interface{}{1.0, 2.0},
			[]interface{}{3.0, 4.0},
		}
		b := []interface{}{
			[]interface{}{5.0, 6.0},
			[]interface{}{7.0, 8.0},
		}
		result := mm(a, b)
		if result == nil {
			t.Fatal("matrix_multiply returned nil")
		}
		// Expected: [[19, 22], [43, 50]]
		if r, ok := result.([]interface{}); ok {
			if len(r) != 2 {
				t.Errorf("matrix_multiply result rows = %d, want 2", len(r))
			}
		}
	})

	// Test softmax
	t.Run("softmax", func(t *testing.T) {
		sm := Builtins["softmax"]
		result := sm([]interface{}{1.0, 2.0, 3.0})
		if result == nil {
			t.Fatal("softmax returned nil")
		}
		if r, ok := result.([]interface{}); ok {
			// Check probabilities sum to 1
			sum := 0.0
			for _, v := range r {
				if f, ok := v.(float64); ok {
					sum += f
				}
			}
			if sum < 0.99 || sum > 1.01 {
				t.Errorf("softmax sum = %f, want ~1.0", sum)
			}
		}
	})

	// Test transpose
	t.Run("transpose", func(t *testing.T) {
		tr := Builtins["transpose"]
		mat := []interface{}{
			[]interface{}{1.0, 2.0, 3.0},
			[]interface{}{4.0, 5.0, 6.0},
		}
		result := tr(mat)
		if result == nil {
			t.Fatal("transpose returned nil")
		}
		if r, ok := result.([]interface{}); ok {
			if len(r) != 3 {
				t.Errorf("transpose result rows = %d, want 3", len(r))
			}
		}
	})
}

func TestInterpreter(t *testing.T) {
	interp := NewInterpreter()

	// Load a program
	source := `
		⟁Pop⟁ manifest_ast {
			"n": "test_program",
			"v": "1.0.0",
			"atomic_law": "ASX = XCFE = XJSON = KUHUL"
		}

		⟁Wo⟁ count = 0
		⟁Wo⟁ name = "K'UHUL"
		⟁Wo⟁ data = {"key": "value"}

		C@@L BLOCK kernel_boot
			@handler: kernel_boot
	`

	_, errors := interp.Load(source)
	if len(errors) > 0 {
		t.Fatalf("Load() errors: %v", errors)
	}

	// Check state
	state := interp.GetState()
	if !state.Booted {
		// Run to boot
		_, err := interp.Run()
		if err != nil {
			t.Fatalf("Run() error: %v", err)
		}
	}

	// Test dispatch
	result, err := interp.Dispatch("kernel_boot", nil)
	if err != nil {
		t.Fatalf("Dispatch() error: %v", err)
	}
	if result == nil {
		t.Fatal("Dispatch() returned nil")
	}
	if m, ok := result.(map[string]interface{}); ok {
		if m["ok"] != true {
			t.Errorf("Dispatch() ok = %v, want true", m["ok"])
		}
	}
}

func TestLlamaTokenizer(t *testing.T) {
	// Test K'UHUL code that mimics Llama tokenizer
	source := `
		⟁Pop⟁ llama_tokenizer {
			"name": "llama_tokenizer",
			"version": "1.0.0"
		}

		⟁Wo⟁ vocab = {
			"hello": 0,
			"world": 1,
			"test": 2
		}

		⟁Wo⟁ tokens = [0, 1, 2]
	`

	program, errors := Parse(source)
	if len(errors) > 0 {
		t.Fatalf("Parse() errors: %v", errors)
	}

	// Check declarations
	if len(program.Declarations) != 1 {
		t.Errorf("expected 1 declaration, got %d", len(program.Declarations))
	}

	// Check assignments
	if len(program.Assignments) != 2 {
		t.Errorf("expected 2 assignments, got %d", len(program.Assignments))
	}
}

func TestMayanGlyphs(t *testing.T) {
	// Test all Mayan glyph markers
	tests := []struct {
		glyph    string
		expected string
	}{
		{"⟁Pop⟁", "POP"},
		{"⟁Wo⟁", "WO"},
		{"⟁Sek⟁", "SEK"},
		{"⟁Xul⟁", "XUL"},
		{"⟁Ch'en⟁", "CHEN"},
		{"⟁Yax⟁", "YAX"},
		{"⟁K'ayab⟁", "KAYAB"},
		{"⟁Shen⟁", "SHEN"},
		{"⟁Kumk'u⟁", "KUMKU"},
	}

	for _, tt := range tests {
		t.Run(tt.glyph, func(t *testing.T) {
			tokens := Tokenize(tt.glyph + " test")
			if len(tokens) < 1 {
				t.Fatal("No tokens produced")
			}
			if tokens[0].Type.String() != tt.expected {
				t.Errorf("Token type = %s, want %s", tokens[0].Type.String(), tt.expected)
			}
		})
	}
}
