import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Atomic JSON file operations.
 *
 * Uses temp-file-then-rename pattern for atomicity.
 */
export class FileStore {
  constructor(private baseDir: string) {}

  /**
   * Write JSON data atomically.
   *
   * Pattern: write to temp file, then rename to final path.
   * Creates parent directories if they don't exist.
   */
  async writeJson(filePath: string, data: unknown): Promise<void> {
    const fullPath = path.resolve(this.baseDir, filePath);
    const tempPath = `${fullPath}.tmp.${process.pid}`;

    try {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Write to temp file
      const json = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, json, 'utf-8');

      // Atomic rename
      await fs.rename(tempPath, fullPath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Read and parse JSON file.
   *
   * Throws descriptive error if file not found or JSON invalid.
   */
  async readJson<T>(filePath: string): Promise<T> {
    const fullPath = path.resolve(this.baseDir, filePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${fullPath}`);
      }
      throw new Error(`Failed to read JSON from ${fullPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Check if file exists.
   */
  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.resolve(this.baseDir, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files in directory, optionally filtered by extension.
   */
  async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    const fullPath = path.resolve(this.baseDir, dirPath);

    try {
      const entries = await fs.readdir(fullPath);
      if (extension) {
        return entries.filter(name => name.endsWith(extension));
      }
      return entries;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}
