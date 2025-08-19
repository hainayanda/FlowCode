export interface SummaryResult {
    summary: string;
    messageCount: number;
    timeSpan?: {
        start: Date;
        end: Date;
    };
    usage: {
        inputTokens: number;
        outputTokens: number;
        toolsUsed: number;
    };
}