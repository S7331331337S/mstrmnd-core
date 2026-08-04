export interface UsageRecord {
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: Date;
}

/**
 * Lightweight in-process token usage tracker.
 * Records usage per model call for auditing and billing purposes.
 */
export class UsageTracker {
  private records: UsageRecord[] = [];

  record(
    modelId: string,
    provider: string,
    usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  ): void {
    this.records.push({
      model: modelId,
      provider,
      ...usage,
      timestamp: new Date(),
    });
  }

  getRecords(): ReadonlyArray<UsageRecord> {
    return this.records;
  }

  getTotalTokens(): number {
    return this.records.reduce((sum, r) => sum + r.totalTokens, 0);
  }

  reset(): void {
    this.records = [];
  }
}
