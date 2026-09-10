import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Lightweight In-Memory Mock for Cache and CacheStorage ---

class MockResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new Map(Object.entries(init.headers || {}));
  }

  clone() {
    return new MockResponse(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: Object.fromEntries(this.headers.entries()),
    });
  }

  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }
}

class MockCache {
  constructor(name) {
    this.name = name;
    this.entries = new Map();
  }

  async put(request, response) {
    const url = typeof request === 'string' ? request : request.url;
    this.entries.set(url, response.clone());
  }

  async match(request) {
    const url = typeof request === 'string' ? request : request.url;
    const match = this.entries.get(url);
    return match ? match.clone() : undefined;
  }

  async addAll(urls) {
    for (const url of urls) {
      await this.put(url, new MockResponse(`Mock content for ${url}`));
    }
  }
}

class MockCacheStorage {
  constructor() {
    this.caches = new Map();
  }

  async open(name) {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MockCache(name));
    }
    return this.caches.get(name);
  }

  async keys() {
    return Array.from(this.caches.keys());
  }

  async delete(name) {
    return this.caches.delete(name);
  }

  async match(request) {
    const url = typeof request === 'string' ? request : request.url;
    for (const cache of this.caches.values()) {
      const found = await cache.match(url);
      if (found) return found;
    }
    return undefined;
  }
}

// Load and evaluate the service worker script in an isolated sandbox context
function setupServiceWorkerEnvironment() {
  const listeners = new Map();
  const mockCaches = new MockCacheStorage();

  const sandboxSelf = {
    location: {
      origin: 'https://arthsahayak.local',
    },
    caches: mockCaches,
    addEventListener: (event, handler) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    skipWaiting: () => {},
    clients: {
      claim: async () => {},
    },
  };

  const swCode = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf-8');

  // Evaluate sw.js with sandboxSelf bound as `self`
  const swFunction = new Function('self', 'caches', 'URL', swCode);
  swFunction(sandboxSelf, mockCaches, globalThis.URL);

  return {
    self: sandboxSelf,
    caches: mockCaches,
    triggerInstall: async () => {
      const handlers = listeners.get('install') || [];
      for (const handler of handlers) {
        let waitPromise = null;
        handler({
          waitUntil: (p) => {
            waitPromise = p;
          },
        });
        if (waitPromise) await waitPromise;
      }
    },
    triggerActivate: async () => {
      const handlers = listeners.get('activate') || [];
      for (const handler of handlers) {
        let waitPromise = null;
        handler({
          waitUntil: (p) => {
            waitPromise = p;
          },
        });
        if (waitPromise) await waitPromise;
      }
    },
    triggerFetch: async (request, mockFetch) => {
      const handlers = listeners.get('fetch') || [];
      let respondedPromise = null;
      const event = {
        request,
        respondWith: (p) => {
          respondedPromise = p;
        },
      };

      // Temporarily bind global fetch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch;
      try {
        for (const handler of handlers) {
          handler(event);
          if (respondedPromise) break;
        }
        return respondedPromise ? await respondedPromise : null;
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  };
}

// ============================================================================
// TEST SUITE: Phase D PWA Service Worker Caching & Offline Shell
// ============================================================================

test('Service Worker: Pre-caches static shell assets on install', async () => {
  const env = setupServiceWorkerEnvironment();
  await env.triggerInstall();

  const shellCache = await env.caches.open('arthsahayak-shell-v2');
  assert.ok(shellCache, 'Shell cache v2 must exist');

  const indexMatch = await shellCache.match('/index.html');
  assert.ok(indexMatch, '/index.html must be pre-cached');

  const manifestMatch = await shellCache.match('/manifest.json');
  assert.ok(manifestMatch, '/manifest.json must be pre-cached');

  const logoMatch = await shellCache.match('/logo.png');
  assert.ok(logoMatch, '/logo.png must be pre-cached');

  const faviconMatch = await shellCache.match('/favicon.svg');
  assert.ok(faviconMatch, '/favicon.svg must be pre-cached');
});

test('Service Worker: Deletes obsolete versioned caches on activate', async () => {
  const env = setupServiceWorkerEnvironment();

  // Create obsolete caches from older versions
  await env.caches.open('arthsahayak-v1');
  await env.caches.open('arthsahayak-shell-v1');
  await env.caches.open('arthsahayak-assets-v1');

  let keys = await env.caches.keys();
  assert.ok(keys.includes('arthsahayak-v1'));
  assert.ok(keys.includes('arthsahayak-shell-v1'));

  // Trigger activate event
  await env.triggerActivate();

  keys = await env.caches.keys();
  assert.strictEqual(keys.includes('arthsahayak-v1'), false, 'Obsolete v1 cache must be deleted');
  assert.strictEqual(keys.includes('arthsahayak-shell-v1'), false, 'Obsolete shell-v1 cache must be deleted');
  assert.strictEqual(keys.includes('arthsahayak-assets-v1'), false, 'Obsolete assets-v1 cache must be deleted');
});

test('Service Worker: Asset responses are cached after successful network fetch', async () => {
  const env = setupServiceWorkerEnvironment();
  await env.triggerInstall();

  const assetUrl = 'https://arthsahayak.local/assets/index-D3eZI2vX.js';
  const request = {
    method: 'GET',
    url: assetUrl,
    mode: 'cors',
  };

  let networkCallCount = 0;
  const mockFetch = async () => {
    networkCallCount++;
    return new MockResponse('console.log("main bundle")', { status: 200 });
  };

  // First fetch while online
  const response = await env.triggerFetch(request, mockFetch);
  assert.ok(response, 'Service worker must respond');
  assert.strictEqual(networkCallCount, 1, 'Fetched from network on first request');

  const text = await response.text();
  assert.strictEqual(text, 'console.log("main bundle")');

  // Verify it was dynamically cached in ASSETS_CACHE
  const assetsCache = await env.caches.open('arthsahayak-assets-v2');
  const cachedAsset = await assetsCache.match(assetUrl);
  assert.ok(cachedAsset, 'Hashed asset must be saved into assets cache');
});

test('Service Worker: Cached assets are served Cache-First when offline', async () => {
  const env = setupServiceWorkerEnvironment();
  await env.triggerInstall();

  const assetUrl = 'https://arthsahayak.local/assets/index-RWxrwu2o.css';
  const request = {
    method: 'GET',
    url: assetUrl,
    mode: 'cors',
  };

  // Pre-populate asset cache
  const assetsCache = await env.caches.open('arthsahayak-assets-v2');
  await assetsCache.put(assetUrl, new MockResponse('body { background: #000; }'));

  // Offline mock fetch: throws error if called
  let networkCalled = false;
  const offlineFetch = async () => {
    networkCalled = true;
    throw new Error('net::ERR_INTERNET_DISCONNECTED');
  };

  const response = await env.triggerFetch(request, offlineFetch);
  assert.ok(response, 'Must return response from cache');
  assert.strictEqual(networkCalled, false, 'Network must NOT be called for cached hashed assets');

  const css = await response.text();
  assert.strictEqual(css, 'body { background: #000; }');
});

test('Service Worker: Navigation requests fall back to cached /index.html when offline', async () => {
  const env = setupServiceWorkerEnvironment();
  await env.triggerInstall();

  // Populate shell cache with index.html
  const shellCache = await env.caches.open('arthsahayak-shell-v2');
  await shellCache.put('/index.html', new MockResponse('<!doctype html><title>ArthSahayak Shell</title>'));

  const navRequest = {
    method: 'GET',
    url: 'https://arthsahayak.local/dashboard',
    mode: 'navigate',
  };

  // Offline network throws
  const offlineFetch = async () => {
    throw new Error('net::ERR_INTERNET_DISCONNECTED');
  };

  const response = await env.triggerFetch(navRequest, offlineFetch);
  assert.ok(response, 'Must return offline shell');

  const html = await response.text();
  assert.strictEqual(html, '<!doctype html><title>ArthSahayak Shell</title>');
});

test('Service Worker: POST requests are NEVER intercepted or cached', async () => {
  const env = setupServiceWorkerEnvironment();

  const postRequest = {
    method: 'POST',
    url: 'https://arthsahayak.local/finance/calculate',
  };

  const response = await env.triggerFetch(postRequest, async () => {
    return new MockResponse({ total_credit: 5000 });
  });

  assert.strictEqual(response, null, 'Service worker must return null (not intercept) for POST requests');
});

test('Service Worker: Backend routes (/finance, /ocr, /voice, /health) are NEVER cached', async () => {
  const env = setupServiceWorkerEnvironment();

  const apiRoutes = [
    'https://arthsahayak.local/finance/calculate',
    'https://arthsahayak.local/ocr/extract',
    'https://arthsahayak.local/voice/extract',
    'https://arthsahayak.local/voice/transcribe',
    'https://arthsahayak.local/health',
  ];

  for (const route of apiRoutes) {
    const request = {
      method: 'GET',
      url: route,
    };

    const response = await env.triggerFetch(request, async () => new MockResponse('ok'));
    assert.strictEqual(
      response,
      null,
      `Route ${route} must be bypassed by the service worker cache entirely`
    );
  }
});

test('Service Worker: Cross-origin requests are NEVER intercepted or cached', async () => {
  const env = setupServiceWorkerEnvironment();

  const crossOriginRequest = {
    method: 'GET',
    url: 'http://127.0.0.1:8000/health', // Different port/origin
  };

  const response = await env.triggerFetch(crossOriginRequest, async () => new MockResponse('ok'));
  assert.strictEqual(response, null, 'Cross-origin requests must bypass the service worker cache');
});

test('Service Worker: Vite development paths (/@vite/, /@react-refresh, /src/, /node_modules/, /node_modules/.vite/) are NEVER cached or intercepted', async () => {
  const env = setupServiceWorkerEnvironment();

  const devRoutes = [
    'https://arthsahayak.local/@vite/client',
    'https://arthsahayak.local/@react-refresh',
    'https://arthsahayak.local/src/App.tsx',
    'https://arthsahayak.local/src/hooks/useOnlineStatus.ts',
    'https://arthsahayak.local/node_modules/react/index.js',
    'https://arthsahayak.local/node_modules/.vite/deps/react.js?v=5fe8dcf8',
  ];

  for (const route of devRoutes) {
    const request = {
      method: 'GET',
      url: route,
    };

    const response = await env.triggerFetch(request, async () => new MockResponse('export default {}'));
    assert.strictEqual(
      response,
      null,
      `Vite development route ${route} must bypass the service worker cache and go directly to network`
    );
  }
});

