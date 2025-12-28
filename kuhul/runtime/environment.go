// Package runtime provides the K'UHUL execution environment.
package runtime

import (
	"sync"
)

// Environment represents a variable scope
type Environment struct {
	store  map[string]interface{}
	parent *Environment
	mu     sync.RWMutex
}

// NewEnvironment creates a new root environment
func NewEnvironment() *Environment {
	return &Environment{
		store:  make(map[string]interface{}),
		parent: nil,
	}
}

// NewEnclosedEnvironment creates a child environment
func NewEnclosedEnvironment(parent *Environment) *Environment {
	return &Environment{
		store:  make(map[string]interface{}),
		parent: parent,
	}
}

// Get retrieves a variable value
func (e *Environment) Get(name string) (interface{}, bool) {
	e.mu.RLock()
	val, ok := e.store[name]
	e.mu.RUnlock()

	if !ok && e.parent != nil {
		return e.parent.Get(name)
	}
	return val, ok
}

// Set creates or updates a variable in the current scope
func (e *Environment) Set(name string, val interface{}) {
	e.mu.Lock()
	e.store[name] = val
	e.mu.Unlock()
}

// Update updates an existing variable (searches parent scopes)
func (e *Environment) Update(name string, val interface{}) bool {
	e.mu.Lock()
	if _, ok := e.store[name]; ok {
		e.store[name] = val
		e.mu.Unlock()
		return true
	}
	e.mu.Unlock()

	if e.parent != nil {
		return e.parent.Update(name, val)
	}
	return false
}

// Delete removes a variable from the current scope
func (e *Environment) Delete(name string) {
	e.mu.Lock()
	delete(e.store, name)
	e.mu.Unlock()
}

// Keys returns all variable names in the current scope
func (e *Environment) Keys() []string {
	e.mu.RLock()
	defer e.mu.RUnlock()

	keys := make([]string, 0, len(e.store))
	for k := range e.store {
		keys = append(keys, k)
	}
	return keys
}

// AllKeys returns all variable names including parent scopes
func (e *Environment) AllKeys() []string {
	seen := make(map[string]bool)
	var keys []string

	env := e
	for env != nil {
		env.mu.RLock()
		for k := range env.store {
			if !seen[k] {
				seen[k] = true
				keys = append(keys, k)
			}
		}
		env.mu.RUnlock()
		env = env.parent
	}

	return keys
}

// Clone creates a shallow copy of the environment
func (e *Environment) Clone() *Environment {
	e.mu.RLock()
	defer e.mu.RUnlock()

	clone := &Environment{
		store:  make(map[string]interface{}, len(e.store)),
		parent: e.parent,
	}
	for k, v := range e.store {
		clone.store[k] = v
	}
	return clone
}

// RuntimeState holds global runtime state
type RuntimeState struct {
	// Global variables
	Variables *Environment

	// Registered handlers (C@@L BLOCKs)
	Handlers map[string]*Handler

	// Registered vectors (C@@L ATOMIC_VECTORs)
	Vectors map[string]*Vector

	// Manifest
	Manifest map[string]interface{}

	// Boot state
	Booted    bool
	BootSteps []string
	Errors    []string

	// MX2DB runtime storage
	MX2DB *MX2DB

	// ASX-RAM
	ASXRAM map[string]interface{}

	mu sync.RWMutex
}

// Handler represents a registered C@@L BLOCK handler
type Handler struct {
	Name    string
	Block   interface{}
	Params  map[string]interface{}
	Execute func(ctx *Context) (interface{}, error)
}

// Vector represents a registered C@@L ATOMIC_VECTOR
type Vector struct {
	Name   string
	Params map[string]interface{}
}

// MX2DB represents the MX2DB runtime storage
type MX2DB struct {
	NGrams          map[string]int
	Supagrams       map[string]interface{}
	RLHFTraces      map[string]interface{}
	AgentState      map[string]interface{}
	TrainingHistory map[string]interface{}
	Tapes           map[string]interface{}
	FeedEntries     map[string]interface{}
	mu              sync.RWMutex
}

// NewMX2DB creates a new MX2DB storage
func NewMX2DB() *MX2DB {
	return &MX2DB{
		NGrams:          make(map[string]int),
		Supagrams:       make(map[string]interface{}),
		RLHFTraces:      make(map[string]interface{}),
		AgentState:      make(map[string]interface{}),
		TrainingHistory: make(map[string]interface{}),
		Tapes:           make(map[string]interface{}),
		FeedEntries:     make(map[string]interface{}),
	}
}

// Context represents the execution context for a handler
type Context struct {
	Handler string
	Params  map[string]interface{}
	Body    map[string]interface{}
	Query   map[string]interface{}
	Runtime *RuntimeState
	Env     *Environment
}

// NewRuntimeState creates a new RuntimeState
func NewRuntimeState() *RuntimeState {
	return &RuntimeState{
		Variables: NewEnvironment(),
		Handlers:  make(map[string]*Handler),
		Vectors:   make(map[string]*Vector),
		Manifest:  make(map[string]interface{}),
		Booted:    false,
		BootSteps: make([]string, 0),
		Errors:    make([]string, 0),
		MX2DB:     NewMX2DB(),
		ASXRAM:    make(map[string]interface{}),
	}
}

// RegisterHandler registers a handler
func (rs *RuntimeState) RegisterHandler(name string, h *Handler) {
	rs.mu.Lock()
	rs.Handlers[name] = h
	rs.mu.Unlock()
}

// GetHandler retrieves a handler by name
func (rs *RuntimeState) GetHandler(name string) (*Handler, bool) {
	rs.mu.RLock()
	h, ok := rs.Handlers[name]
	rs.mu.RUnlock()
	return h, ok
}

// RegisterVector registers a vector
func (rs *RuntimeState) RegisterVector(name string, v *Vector) {
	rs.mu.Lock()
	rs.Vectors[name] = v
	rs.mu.Unlock()
}

// GetVector retrieves a vector by name
func (rs *RuntimeState) GetVector(name string) (*Vector, bool) {
	rs.mu.RLock()
	v, ok := rs.Vectors[name]
	rs.mu.RUnlock()
	return v, ok
}

// AddBootStep adds a boot step
func (rs *RuntimeState) AddBootStep(step string) {
	rs.mu.Lock()
	rs.BootSteps = append(rs.BootSteps, step)
	rs.mu.Unlock()
}

// AddError adds an error
func (rs *RuntimeState) AddError(err string) {
	rs.mu.Lock()
	rs.Errors = append(rs.Errors, err)
	rs.mu.Unlock()
}

// SetASXRAM sets a value in ASX-RAM
func (rs *RuntimeState) SetASXRAM(key string, value interface{}) {
	rs.mu.Lock()
	rs.ASXRAM[key] = value
	rs.mu.Unlock()
}

// GetASXRAM gets a value from ASX-RAM
func (rs *RuntimeState) GetASXRAM(key string) (interface{}, bool) {
	rs.mu.RLock()
	v, ok := rs.ASXRAM[key]
	rs.mu.RUnlock()
	return v, ok
}

// GetState returns a snapshot of the runtime state
func (rs *RuntimeState) GetState() map[string]interface{} {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	handlers := make([]string, 0, len(rs.Handlers))
	for k := range rs.Handlers {
		handlers = append(handlers, k)
	}

	return map[string]interface{}{
		"booted":     rs.Booted,
		"boot_steps": rs.BootSteps,
		"errors":     rs.Errors,
		"handlers":   handlers,
		"variables":  rs.Variables.AllKeys(),
	}
}
