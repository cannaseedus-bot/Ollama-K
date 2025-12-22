/**
 * K'uhul Model Runner Service Worker
 * Implements offline caching and XJSON request handling for lam.o
 *
 * Sek sw_pipeline -> cache_static -> intercept_fetch -> handle_xjson -> respond
 */

const CACHE_NAME = 'kuhul-lam-o-v4';
const XJSON_CACHE_NAME = 'kuhul-xjson-cache-v4';

// Static assets to cache for offline support
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/lib/kuhul-xjson.js',
  '/lib/scxq2.js',
  '/lib/kuhul-client.js',
  '/lib/kuhul-packs.js',
  '/lib/pi-goat.js',
  '/lib/pi-goat-api.js',
  '/lib/model-manager.js',
  '/lib/abr-engine.js',
  '/styles.css'
];

// K'uhul lam.o configuration
const LAM_O_CONFIG = {
  endpoint: 'http://localhost:61683/api/infer',
  healthEndpoint: 'http://localhost:61683/api/health',
  modelsEndpoint: 'http://localhost:61683/api/models',
  ollamaEndpoint: 'http://localhost:11434/api/generate',
  timeout: 120000 // 2 minutes for model inference
};

// SCXQ2 version for fingerprinting
const SCXQ2_VERSION = 'SCXQ2-v1';

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[K\'uhul SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[K\'uhul SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[K\'uhul SW] Cache addAll failed, continuing...', err);
        return self.skipWaiting();
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[K\'uhul SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== XJSON_CACHE_NAME)
            .map((name) => {
              console.log('[K\'uhul SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Fetch event - handle requests with caching strategy
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle XJSON inference requests specially
  if (isXJSONRequest(event.request)) {
    event.respondWith(handleXJSONRequest(event.request));
    return;
  }

  // Handle API requests - network first
  if (isAPIRequest(url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Handle static assets - cache first
  event.respondWith(cacheFirst(event.request));
});

/**
 * Check if request is an XJSON inference request
 */
function isXJSONRequest(request) {
  const contentType = request.headers.get('Content-Type') || '';
  return (
    request.method === 'POST' &&
    (contentType.includes('application/json') || contentType.includes('application/xjson')) &&
    (request.url.includes('/api/infer') || request.url.includes('/api/generate'))
  );
}

/**
 * Check if request is an API request
 */
function isAPIRequest(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.hostname === 'localhost' && (url.port === '61683' || url.port === '11434')
  );
}

/**
 * Handle XJSON inference requests
 * Implements: Sek model_pipeline -> route -> infer -> compress -> log
 */
async function handleXJSONRequest(request) {
  try {
    const requestBody = await request.clone().json();
    const startTime = performance.now();

    // Build XJSON request if not already formatted
    const xjsonRequest = normalizeToXJSON(requestBody);

    // Try orchestrator first, fall back to direct Ollama
    let response;
    try {
      response = await fetchWithTimeout(LAM_O_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kuhul-Runner': 'lam.o',
          'X-SCXQ2-Version': SCXQ2_VERSION
        },
        body: JSON.stringify(xjsonRequest)
      }, LAM_O_CONFIG.timeout);
    } catch (orchestratorError) {
      console.warn('[K\'uhul SW] Orchestrator unavailable, falling back to direct Ollama');
      response = await handleDirectOllamaRequest(xjsonRequest);
    }

    const endTime = performance.now();
    const latencyMs = endTime - startTime;

    // Parse response and attach SCXQ2
    const responseData = await response.json();
    const xjsonResponse = normalizeResponse(responseData, xjsonRequest, latencyMs);

    // Generate and attach SCXQ2 fingerprint
    xjsonResponse['@completion']['@scxq2'] = await generateSCXQ2(xjsonRequest, xjsonResponse);

    // Cache successful responses
    await cacheXJSONResponse(request, xjsonResponse);

    // Log to K'uhul memory (via message to main thread)
    logToKuhulMemory(xjsonRequest, xjsonResponse);

    return new Response(JSON.stringify(xjsonResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Kuhul-Runner': 'lam.o',
        'X-SCXQ2': xjsonResponse['@completion']['@scxq2']
      }
    });

  } catch (error) {
    console.error('[K\'uhul SW] XJSON request failed:', error);

    // Return XJSON error response
    const errorResponse = {
      '@error': {
        '@runner': 'lam.o',
        '@message': error.message,
        '@code': error.status || 500
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: error.status || 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle direct Ollama request (fallback when orchestrator unavailable)
 */
async function handleDirectOllamaRequest(xjsonRequest) {
  const infer = xjsonRequest['@infer'] || {};

  const ollamaRequest = {
    model: infer['@model'] || 'llama3',
    prompt: infer['@prompt'] || '',
    stream: false,
    ...infer['@params']
  };

  return fetchWithTimeout(LAM_O_CONFIG.ollamaEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ollamaRequest)
  }, LAM_O_CONFIG.timeout);
}

/**
 * Normalize request to XJSON format
 */
function normalizeToXJSON(body) {
  // Already in XJSON format
  if (body['@infer']) {
    return body;
  }

  // Convert from Ollama format
  return {
    '@infer': {
      '@runner': 'lam.o',
      '@model': body.model || 'llama3',
      '@prompt': body.prompt || '',
      '@params': {
        temperature: body.temperature || 0.7,
        top_p: body.top_p || 0.9,
        ...body.options
      },
      '@context': body.context || [],
      '@mode': body.mode || 'chat'
    }
  };
}

/**
 * Normalize response to XJSON format
 */
function normalizeResponse(data, request, latencyMs) {
  // Already in XJSON format
  if (data['@completion']) {
    data['@completion']['@metrics'] = data['@completion']['@metrics'] || {};
    data['@completion']['@metrics'].latency_ms = latencyMs;
    return data;
  }

  const infer = request['@infer'] || {};

  // Convert from Ollama format
  return {
    '@completion': {
      '@model': infer['@model'] || data.model || 'unknown',
      '@runner': 'lam.o',
      '@text': data.response || data.message?.content || '',
      '@tokens': {
        'input': data.prompt_eval_count || 0,
        'output': data.eval_count || 0
      },
      '@metrics': {
        'latency_ms': latencyMs,
        'backend': 'ollama',
        'total_duration': data.total_duration || 0,
        'load_duration': data.load_duration || 0,
        'eval_duration': data.eval_duration || 0
      }
    }
  };
}

/**
 * Generate SCXQ2 fingerprint for request/response pair
 */
async function generateSCXQ2(request, response) {
  const infer = request['@infer'] || {};
  const completion = response['@completion'] || {};

  const payload = {
    runner: infer['@runner'] || 'lam.o',
    model: infer['@model'] || 'unknown',
    mode: infer['@mode'] || null,
    params: infer['@params'] || {},
    prompt_shape: {
      length: (infer['@prompt'] || '').length,
      has_context: !!(infer['@context'] && infer['@context'].length)
    },
    metrics: completion['@metrics'] || {},
    tokens: completion['@tokens'] || {},
    timestamp: Date.now()
  };

  const payloadString = JSON.stringify(payload);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadString));
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return `${SCXQ2_VERSION}:${hashHex.substring(0, 32)}`;
}

/**
 * Cache XJSON response for offline access
 */
async function cacheXJSONResponse(request, response) {
  try {
    const cache = await caches.open(XJSON_CACHE_NAME);
    const cacheKey = new URL(request.url);
    cacheKey.searchParams.set('_xjson_cache', Date.now().toString());

    await cache.put(cacheKey.toString(), new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    console.warn('[K\'uhul SW] Failed to cache XJSON response:', error);
  }
}

/**
 * Log to K'uhul memory via message
 */
function logToKuhulMemory(request, response) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'KUHUL_XJSON_LOG',
        request: request,
        response: response,
        timestamp: Date.now()
      });
    });
  });
}

/**
 * Fetch with timeout
 */
function fetchWithTimeout(url, options, timeout) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
}

/**
 * Cache-first strategy for static assets
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network-first strategy for API requests
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({
      '@error': {
        '@runner': 'lam.o',
        '@message': 'Network unavailable and no cached response',
        '@code': 503
      }
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Message handler for K'uhul commands
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'KUHUL_CLEAR_CACHE':
      handleClearCache(event);
      break;
    case 'KUHUL_HEALTH_CHECK':
      handleHealthCheck(event);
      break;
    case 'KUHUL_GET_MODELS':
      handleGetModels(event);
      break;
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

/**
 * Handle cache clear request
 */
async function handleClearCache(event) {
  await caches.delete(CACHE_NAME);
  await caches.delete(XJSON_CACHE_NAME);
  event.ports[0]?.postMessage({ success: true });
}

/**
 * Handle health check request
 */
async function handleHealthCheck(event) {
  try {
    const [orchestratorHealth, ollamaHealth] = await Promise.allSettled([
      fetch(LAM_O_CONFIG.healthEndpoint, { method: 'GET' }),
      fetch('http://localhost:11434/api/tags', { method: 'GET' })
    ]);

    event.ports[0]?.postMessage({
      orchestrator: orchestratorHealth.status === 'fulfilled' && orchestratorHealth.value.ok,
      ollama: ollamaHealth.status === 'fulfilled' && ollamaHealth.value.ok
    });
  } catch (error) {
    event.ports[0]?.postMessage({ orchestrator: false, ollama: false });
  }
}

/**
 * Handle get models request
 */
async function handleGetModels(event) {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    event.ports[0]?.postMessage({ models: data.models || [] });
  } catch (error) {
    event.ports[0]?.postMessage({ models: [], error: error.message });
  }
}

console.log('[K\'uhul SW] Service worker loaded - lam.o ready');
