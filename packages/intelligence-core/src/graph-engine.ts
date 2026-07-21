export class GraphEngine {
  createRelationship(source: string, target: string, type: string) {
    return {
      source,
      target,
      type
    };
  }
}
