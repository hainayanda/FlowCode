import { AgentExecutionParameters, AgentWorker, AgentSummarizer } from "../interfaces/agents";
import { SummaryResult } from "../models/summary";

export class SummarizerWorker implements AgentSummarizer {

    private worker: AgentWorker;

    constructor(worker: AgentWorker) {
        this.worker = worker;
    }

    async summarize(parameters: AgentExecutionParameters): Promise<SummaryResult> {
        parameters.prompt = `${parameters.prompt}\n\n${this.summarizeInstructions()}`;
        let result = this.worker.singleProcess(parameters);
        while (true) {
            const { done, value } = await result.next();
            if (done) {
                return {
                    summary: value.messages.map(msg => msg.content).join("\n"),
                    messageCount: value.messages.length,
                    usage: value.usage
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