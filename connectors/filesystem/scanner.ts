import { readdir } from 'node:fs/promises';

export async function scanDirectory(path: string) {
  return readdir(path);
}
