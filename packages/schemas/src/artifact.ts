export interface Artifact {
  id: string;
  type: 'image' | 'video' | 'document' | 'audio';
  source: string;
  path: string;
  metadata?: Record<string, unknown>;
  analysis?: {
    concepts: string[];
    style: string[];
    emotions: string[];
  };
  embedding?: number[];
}
