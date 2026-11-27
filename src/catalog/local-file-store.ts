import { statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, resolve, sep } from 'node:path';

import { FileNotFoundError, InvalidStoreConfigError } from '../core/errors.js';
import type { FileContent } from '../core/file-content.js';
import type { IStorageBackend } from './i-storage-backend.js';

const VERSION_HASH_LENGTH = 12;

/** `IStorageBackend` backed by the local filesystem. */
export class LocalFileStore implements IStorageBackend {
  constructor(private readonly rootDir: string) {
    let isDirectory;
    try {
      isDirectory = statSync(rootDir).isDirectory();
    } catch {
      isDirectory = false;
    }
    if (!isDirectory) {
      throw new InvalidStoreConfigError(`LocalFileStore root directory does not exist: ${rootDir}`);
    }
  }

  async read(path: string): Promise<string> {
    return (await this.readFileOrThrow(path)).toString('utf-8');
  }

  async readWithVersion(path: string): Promise<FileContent> {
    const buffer = await this.readFileOrThrow(path);
    const version = createHash('sha256').update(buffer).digest('hex').slice(0, VERSION_HASH_LENGTH);
    return { content: buffer.toString('utf-8'), version };
  }

  async list(prefix: string = ''): Promise<string[]> {
    const resolvedRoot = resolve(this.rootDir);
    const dirents = await readdir(resolvedRoot, { recursive: true, withFileTypes: true });
    return (
      dirents
        .filter((d) => d.isFile())
        // d.parentPath replaces the deprecated d.path (returns undefined in Node 22+)
        .map((d) => relative(resolvedRoot, join(d.parentPath, d.name)).split(sep).join('/'))
        .filter((p) => p.startsWith(prefix))
        .sort()
    );
  }

  private async readFileOrThrow(path: string): Promise<Buffer> {
    const resolvedRoot = resolve(this.rootDir);
    const resolvedPath = resolve(join(this.rootDir, path));
    if (!resolvedPath.startsWith(resolvedRoot + sep)) {
      throw new FileNotFoundError(path);
    }
    try {
      return await readFile(resolvedPath);
    } catch (error) {
      if (isEnoent(error)) {
        throw new FileNotFoundError(path);
      }
      throw error;
    }
  }
}

function isEnoent(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
