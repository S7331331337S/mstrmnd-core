import { readdir } from 'node:fs/promises';

export async function readVault(path: string) {
  return readdir(path);
}
