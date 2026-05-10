import fs from 'node:fs/promises';
import path from 'node:path';

export class FileCache {
  constructor(private cacheDir: string) {}

  private keyPath(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, safe);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.keyPath(key));
    } catch {
      return null;
    }
  }

  async set(key: string, data: Buffer): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(this.keyPath(key), data);
  }

  async has(key: string): Promise<boolean> {
    try {
      await fs.access(this.keyPath(key));
      return true;
    } catch {
      return false;
    }
  }
}
