/** Resolve the Obsidian vault path from env or the default location. */
export function resolveVaultPath(): string {
  const fromEnv = process.env.OBSIDIAN_VAULT_PATH;
  if (fromEnv) return fromEnv;
  return `${process.env.HOME}/Documents/Obsidian Vault`;
}
