import type { AsyncControl, AsyncControlResponse } from "../models/async-control";
import type { Message } from "../models/messages";
import { SummaryResult } from "../models/summary";

export interface AgentExecutionParameters {
    prompt: string;
    messages: Message[];
}

export interface AgentWorker {
    process(parameters: AgentExecutionParameters, maxIterations: number): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;
}

export interface SummarizerAgent {
    summarize(parameters: AgentExecutionParameters): Promise<SummaryResult>;
}