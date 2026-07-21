export interface PhotoArtifact {
  path: string;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}

export async function indexPhotos(paths: string[]): Promise<PhotoArtifact[]> {
  return paths.map((path) => ({ path }));
}
