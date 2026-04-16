import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ProviderRegistry } from '../src/providers/registry.js';

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('returns providers in registration order', () => {
    registry.register({ name: 'first' } as never);
    registry.register({ name: 'second' } as never);

    assert.deepEqual(
      registry.getAll().map((provider) => provider.name),
      ['first', 'second'],
    );
  });

  it('returns provider by name', () => {
    const fakeProvider = { name: 'mangabuff' } as never;
    registry.register(fakeProvider);

    assert.equal(registry.getByName('mangabuff'), fakeProvider);
    assert.equal(registry.getByName('missing'), null);
  });
});
