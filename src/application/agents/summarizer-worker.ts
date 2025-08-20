import {
    AgentExecutionParameters,
    AgentSummarizer,
    AgentWorker,
} from '../interfaces/agent';
import { SummaryResult } from '../models/summary';

/**
 * Worker that wraps any AgentWorker to provide conversation summarization capabilities.
 * Uses the underlying agent to condense conversation history for cost and context efficiency.
 */
export class SummarizerWorker implements AgentSummarizer {
    private worker: AgentWorker;

    /**
     * Creates a new SummarizerWorker instance.
     * @param worker - The underlying agent worker to use for summarization
     */
    constructor(worker: AgentWorker) {
        this.worker = worker;
    }

    /**
     * Summarizes the conversation history to reduce token usage.
     * Processes the conversation through the wrapped agent with special summarization instructions.
     *
     * @param parameters - The execution parameters containing the conversation to summarize
     * @returns Promise resolving to summary result with condensed content and usage metrics
     */
    async summarize(
        parameters: AgentExecutionParameters
    ): Promise<SummaryResult> {
        parameters.prompt = `${parameters.prompt}\n\n${this.summarizeInstructions()}`;
        let result = this.worker.singleProcess(parameters);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { done, value } = await result.next();
            if (done) {
                return {
                    summary: value.messages
                        .map((msg) => msg.content)
                        .join('\n'),
                    messageCount: value.messages.length,
                    usage: value.usage,
                };
            }
        }
    }

    private summarizeInstructions(): string {
        return `
## Summarizer Mode Instructions

You are a summarizer. 
Your task is to condense the information provided in the messages into a concise summary. 
Focus on the key points and main ideas, and avoid unnecessary details. 
Use clear and straightforward language to convey the essence of the content.
        `;
    }
}
