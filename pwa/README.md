# K'uhul Model Runner PWA (lam.o + Pi-GOAT)

Progressive Web App for K'uhul Multi Hive OS with Ollama integration, XJSON contract, and Pi-GOAT polyglot AST engine.

**Pi-GOAT = Linux Without Linux** - Virtual runtimes through AST-driven execution. No Python, Java, Node, or Linux installation required.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HORIZONTAL SEAL RIBBON                                │
├─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────────────┤
│ SEAL_0  │ SEAL_1  │ SEAL_2  │ SEAL_3  │ SEAL_4  │ SEAL_5  │ SEAL_6          │
│ K'uhul  │ JS      │ Java    │ Python  │ Compress│ Memory  │ Integration     │
│ 🔤      │ 💻      │ ☕      │ 🐍      │ 🗜️      │ 🧬      │ 🏁              │
└────┬────┴────┬────┴────┬────┴────┬────┴────┬────┴────┬────┴────┬────────────┘
     │         │         │         │         │         │         │
     └─────────┴─────────┴─────────┴────┬────┴─────────┴─────────┘
                                        │
                                   ┌────┴────┐
                                   │ MX2LM   │
                                   │ 🧠      │
                                   │ Central │
                                   └─────────┘
```

### Pipelines

**Model Inference (lam.o):**
```
Sek model_pipeline -> route -> infer -> compress -> log
```

**Pi-GOAT AST Execution:**
```
Sek ast_pipeline -> detect -> parse -> normalize -> route -> execute -> compress
```

## Components

### Core PWA Files

| File | Purpose |
|------|---------|
| `index.html` | Symbolic DOM with K'uhul bindings, Chat/Code/API modes |
| `sw.js` | Service Worker with XJSON handling and offline caching |
| `manifest.json` | PWA manifest with K'uhul lam.o configuration |
| `orchestrator.js` | Node.js XJSON bridge to Ollama (port 61683) |
| `styles.css` | Cyberpunk brain grid UI |
| `package.json` | Node dependencies |

### K'uhul Libraries (`lib/`)

| File | Purpose |
|------|---------|
| `scxq2.js` | SCXQ2 fingerprint generator (SHA-256) |
| `kuhul-xjson.js` | XJSON schema library (`@infer`, `@completion`, `@error`) |
| `kuhul-client.js` | K'uhul client API with state management |
| `kuhul-packs.js` | Pack registry (lam.o, Pi-GOAT, SCXQ2, ASX-RAM, MX2LM) |
| `pi-goat.js` | **Polyglot AST Engine** - virtual runtimes |
| `pi-goat-api.js` | **API Language Adapter** - API as first-class language |

## Quick Start

### 1. Start Ollama

```bash
ollama serve
ollama pull llama3
ollama pull deepseek-r1  # optional
```

### 2. Start Orchestrator

```bash
cd pwa
npm install
npm start
```

### 3. Open PWA

Navigate to `http://localhost:61683` in your browser.

### 4. Select Mode

- **Chat**: Model inference via lam.o/Ollama
- **Code**: Pi-GOAT AST execution (JS, Python, Java, K'uhul)
- **API**: Pi-GOAT API language adapter

## Pi-GOAT: Polyglot AST Engine

Pi-GOAT provides virtual runtimes through AST-driven execution. Users don't need to install anything.

### Supported Languages

| Language | Runtime | Engine |
|----------|---------|--------|
| JavaScript | `js_runtime` | Sandboxed Function |
| TypeScript | `js_runtime` | Sandboxed Function |
| Python | `python_runtime` | Pyodide (WASM) or Virtual |
| Java | `java_runtime` | Virtual AST |
| K'uhul | `kuhul_runtime` | Pop/Sek execution |
| XJSON | `xjson_runtime` | Declarative spec |
| API | `api_runtime` | HTTP/Mesh/GAS |

### Pi-GOAT Dispatch

```javascript
const result = await PiGoat.dispatch({
  source: 'def hello(): return "world"',
  mode: 'code',
  hintLanguage: 'python'
});

// Result:
{
  success: true,
  language: 'python',
  ast: { /* NormalizedAST */ },
  runtime: 'python_runtime',
  result: { /* execution result */ },
  scxq2: 'SCXQ2-v1:abc123...'
}
```

### API as First-Class Language

Pi-GOAT treats API calls as a language:

```javascript
// REST style
await PiGoatAPI.dispatch({ source: 'GET /api/models' });

// XJSON style
await PiGoatAPI.dispatch({ source: '{"@api": {"@endpoint": "infer"}}' });

// Mesh style
await PiGoatAPI.dispatch({ source: 'mx2lm://node/123/api/status' });

// Dot notation
await PiGoatAPI.dispatch({ source: 'api.tokens.balance' });
```

## XJSON Contract

### Request Format

```json
{
  "@infer": {
    "@runner": "lam.o",
    "@model": "deepseek-r1",
    "@prompt": "Explain symbolic compression.",
    "@params": {
      "temperature": 0.7,
      "top_p": 0.9
    },
    "@mode": "chat"
  }
}
```

### Response Format

```json
{
  "@completion": {
    "@model": "deepseek-r1",
    "@runner": "lam.o",
    "@text": "Symbolic compression is...",
    "@tokens": {
      "input": 42,
      "output": 128
    },
    "@metrics": {
      "latency_ms": 182,
      "backend": "ollama"
    },
    "@scxq2": "SCXQ2-v1:abc123..."
  }
}
```

### Error Format

```json
{
  "@error": {
    "@runner": "lam.o",
    "@message": "Model not found",
    "@code": 404
  }
}
```

## K'uhul Pack Definitions

### Pack: lam.o (Ollama Model Runner)

```kuhul
Pack pack_lam_o {
  id: "pack_lam_o",
  name: "Ollama Model Runner Pack",
  role: "model_runner_backend",
  fold: "AI",
  functions: ["lam.o.infer", "lam.o.health", "lam.o.models"]
}
```

### Pack: Pi-GOAT (Polyglot AST Engine)

```kuhul
Pack pack_pi_goat {
  id: "pack_pi_goat",
  name: "Pi-GOAT Polyglot AST Engine",
  role: "polyglot_runtime_provider",
  fold: "RUNTIME",
  functions: ["pi_goat.dispatch", "pi_goat.run_code", "pi_goat.run_chat"]
}
```

### Pack: SCXQ2 (Compression Engine)

```kuhul
Pack pack_scxq2 {
  id: "pack_scxq2",
  name: "SCXQ2 Compression Engine",
  role: "semantic_compression",
  fold: "COMPRESSION",
  functions: ["scxq2.fingerprint", "scxq2.verify", "scxq2.attach"]
}
```

### Pack: MX2LM (Central Orchestrator)

```kuhul
Pack pack_mx2lm {
  id: "pack_mx2lm",
  name: "MX2LM Quantum Chat Intelligence",
  role: "central_orchestrator",
  fold: "INTELLIGENCE",
  functions: ["mx2lm.orchestrate", "mx2lm.broadcast", "mx2lm.receive"]
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/infer` | POST | Run model inference (XJSON) |
| `/api/health` | GET | Health check |
| `/api/models` | GET | List available models |
| `/api/caps` | GET | Runner capabilities |

## SCXQ2 Fingerprinting

Every operation generates an SCXQ2 fingerprint for verification:

```javascript
// From inference
const scxq2 = await SCXQ2.fromInference(request, response);
// Returns: "SCXQ2-v1:a1b2c3d4..."

// From DOM element
const scxq2 = await SCXQ2.fromDOM(element);

// Verify
const valid = await SCXQ2.verify(fingerprint, payload);
```

## Symbolic DOM

The UI uses K'uhul symbolic DOM with data attributes:

```html
<div data-kuhul-glyph="C"
     data-kuhul-semantic="MR,C1"
     data-kuhul-role="model_runner_backend"
     data-kuhul-pop="run_inference"
     data-scxq2="SCXQ2-v1:...">
</div>
```

### Glyph Types

| Glyph | Meaning |
|-------|---------|
| `D` | Document |
| `C` | Card |
| `B` | Button |
| `N` | Numeric |
| `MR` | Model Runner |
| `MC` | Main Content |

## Horizontal Seal Ribbon

The system uses a horizontal ribbon of seals for visualization:

| Seal | Position | Glyph | Color | Role |
|------|----------|-------|-------|------|
| SEAL_0 | [-8, 0, 0] | 🔤 | Green | K'uhul Entry |
| SEAL_1 | [-4, 0, 0.5] | 💻 | Yellow | JavaScript |
| SEAL_2 | [0, 0, 1.0] | ☕ | Orange | Java |
| SEAL_3 | [4, 0, 0.5] | 🐍 | Blue | Python |
| SEAL_4 | [8, 0, 0] | 🗜️ | Yellow | Compression |
| SEAL_5 | [12, 0, 0.5] | 🧬 | Magenta | Memory |
| SEAL_6 | [16, 0, 0] | 🏁 | White | Integration |
| MX2LM | [4, 2, -2] | 🧠 | Cyan | Orchestrator |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 61683 | Orchestrator port |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API URL |
| `DEFAULT_MODEL` | `llama3` | Default model |
| `TIMEOUT` | 120000 | Request timeout (ms) |

## PWA Features

- Offline support via Service Worker
- Install to home screen
- XJSON request caching
- Background sync
- Chat/Code/API mode switching
- Real-time XJSON inspector
- SCXQ2 fingerprint display

## Three-File Rule

The K'uhul system follows the three-file rule:

1. **index.html** - DOM, chat interface, seal visualization
2. **sw.js** - Service worker kernel, WASM bridges, runtime loaders
3. **manifest.json** - XCFE vectors, K'uhul pipeline, pack definitions

## Related Repositories

- [devmicro](https://github.com/cannaseedus-bot/devmicro.git) - Non-forked Ollama
- [ollama](https://github.com/ollama/ollama.git) - Main Ollama
- [Janus](https://github.com/cannaseedus-bot/Janus-text-to-image-.git) - DeepSeek R1/Janus
- [APP-BUILDER](https://github.com/cannaseedus-bot/APP-BUILDER.git) - Backend
- [ASX-BROWSER](https://github.com/cannaseedus-bot/ASX-BROWSER.git) - Frontend

## License

MIT
