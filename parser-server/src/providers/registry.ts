import type { SourceProvider } from './provider.interface.js';

export class ProviderRegistry {
  private providers: SourceProvider[] = [];

  register(provider: SourceProvider): void {
    this.providers.push(provider);
  }

  getAll(): readonly SourceProvider[] {
    return this.providers;
  }

  getByName(name: string): SourceProvider | null {
    return this.providers.find((provider) => provider.name === name) ?? null;
  }
}
