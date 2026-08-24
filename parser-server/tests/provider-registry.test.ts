import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_PROVIDER_PRIORITY } from '../src/config.js';
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

describe('buildApp provider wiring', () => {
  it('does not wire teletype into resolve (domain dead 2026-08-24)', async () => {
    const source = await readFile(
      new URL('../src/server.ts', import.meta.url),
      'utf8',
    );

    assert.equal(
      /registry\.register\(new TeletypeProvider/.test(source),
      false,
      'TeletypeProvider must not be registered — teletype.in is dead',
    );
    assert.match(source, /registry\.register\(new UsagiProvider/);
  });
});

describe('DEFAULT_PROVIDER_PRIORITY', () => {
  it('omits teletype so it is not used in resolve', () => {
    assert.equal(DEFAULT_PROVIDER_PRIORITY.includes('teletype'), false);
  });

  it('still includes usagi', () => {
    assert.equal(DEFAULT_PROVIDER_PRIORITY.includes('usagi'), true);
  });
});
