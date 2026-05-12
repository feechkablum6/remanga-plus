import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ResolveSessionStore } from '../src/resolve-session.js';

describe('ResolveSessionStore', () => {
  it('creates a session with all providers in pending status', () => {
    const store = new ResolveSessionStore();
    const session = store.create(['mangabuff', 'senkuro']);

    assert.ok(session.sessionId);
    assert.equal(session.providers.mangabuff.status, 'pending');
    assert.equal(session.providers.senkuro.status, 'pending');
    assert.equal(session.finalResult, null);
  });

  it('updates provider status', () => {
    const store = new ResolveSessionStore();
    const session = store.create(['mangabuff']);
    store.updateProviderStatus(session.sessionId, 'mangabuff', 'searching');
    const retrieved = store.get(session.sessionId);
    assert.equal(retrieved?.providers.mangabuff.status, 'searching');
  });

  it('sets finalResult and marks remaining providers as cancelled', () => {
    const store = new ResolveSessionStore();
    const session = store.create(['mangabuff', 'senkuro']);
    const mockResult = { status: 'success' as const, provider: 'mangabuff' };
    store.setFinalResult(session.sessionId, mockResult);
    const retrieved = store.get(session.sessionId);
    assert.deepEqual(retrieved?.finalResult, mockResult);
  });

  it('returns null for non-existent session', () => {
    const store = new ResolveSessionStore();
    assert.equal(store.get('nope'), null);
  });

  it('deletes sessions older than TTL', () => {
    const store = new ResolveSessionStore({ ttlMs: 50 });
    const session = store.create(['mangabuff']);
    const retrieved = store.get(session.sessionId);
    assert.ok(retrieved);
    store.prune(Date.now() + 100);
    assert.equal(store.get(session.sessionId), null);
  });
});
