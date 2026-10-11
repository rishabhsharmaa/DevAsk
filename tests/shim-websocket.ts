/**
 * Test-only WebSocket shim. Must be the FIRST import in every test file that
 * (transitively) imports server modules.
 *
 * Plain Node 20 has no global WebSocket, but supabase-js constructs a
 * (never-connected) realtime client at import time. Next.js polyfills
 * WebSocket in the app runtime; tests run on bare Node, so `ws` is provided
 * here. Static imports evaluate before module bodies run, which is why this
 * lives in its own module imported first rather than inline in the test.
 */
import WebSocket from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
}
