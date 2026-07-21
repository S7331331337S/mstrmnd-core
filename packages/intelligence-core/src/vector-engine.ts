export class VectorEngine {
  async embed(input: string) {
    return {
      input,
      vector: []
    };
  }
}
