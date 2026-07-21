export class VisionAgent {
  analyze(input: unknown) {
    return {
      type: 'vision-analysis',
      input
    };
  }
}
