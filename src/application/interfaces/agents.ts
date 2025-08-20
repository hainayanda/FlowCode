import type { AsyncControl, AsyncControlResponse } from "../models/async-control";
import type { Message } from "../models/messages";
import { SummaryResult } from "../models/summary";

export interface AgentExecutionParameters {
    prompt: string;
    messages: Message[];
}

export interface AgentWorker {
    singleProcess(parameters: AgentExecutionParameters): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;
    process(parameters: AgentExecutionParameters, maxIterations?: number): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;
}

export interface AgentSummarizer {
    summarize(parameters: AgentExecutionParameters): Promise<SummaryResult>;
}

export interface AgentEmbedder {
    isAvailable: boolean;
    embed(text: string): Promise<number[]>;
}