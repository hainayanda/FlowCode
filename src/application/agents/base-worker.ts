import { generateUniqueId } from "../../utils/id-generator";
import { AgentExecutionParameters, AgentWorker, SummarizerAgent } from "../interfaces/agents";
import { Toolbox } from "../interfaces/toolbox";
import { AsyncControlResponse, AsyncControl } from "../models/async-control";
import { AgentModelConfig } from "../models/config";
import { Message } from "../models/messages";
import { SummaryResult } from "../models/summary";

export abstract class BaseWorker implements AgentWorker, SummarizerAgent {

    protected name: string;
    protected toolbox: Toolbox;
    protected config: AgentModelConfig;

    constructor(name: string, config: AgentModelConfig, toolbox: Toolbox) {
        this.name = name;
        this.toolbox = toolbox;
        this.config = config;
    }

    async* process(parameters: AgentExecutionParameters, maxIterations?: number): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const iterations = maxIterations || 25;
        let originalPrompt = parameters.prompt;

        let outputMessages: Message[] = []
        let inputTokens: number = 0;
        let outputTokens: number = 0;
        let toolsUsed: number = 0;
        let input: AsyncControl = { type: 'continue' };
        let canContinue: boolean = true;

        for (let i = 0; i < iterations && canContinue; i++) {
            parameters.prompt = `${originalPrompt}\n\n${this.processInstructions(i + 1, iterations)}`;
            const process = this.singleProcess(parameters)
            while (true) {
                const { done, value } = await process.next(input);
                if (done) {
                    parameters.messages.push(...value.messages);
                    parameters.messages.push(...this.userTextMessages(input || { type: 'continue' }));
                    outputMessages.push(...value.messages);
                    inputTokens += value.usage.inputTokens;
                    outputTokens += value.usage.outputTokens;
                    toolsUsed += value.usage.toolsUsed;
                    canContinue = value.messages.length > 0 || value.usage.toolsUsed > 0;
                    break;
                } else {
                    input = yield value as Message;
                }
            }
        }
        return { messages: outputMessages, usage: { inputTokens, outputTokens, toolsUsed } };
    }

    async summarize(parameters: AgentExecutionParameters): Promise<SummaryResult> {
        parameters.prompt = `${parameters.prompt}\n\n${this.summarizeInstructions()}`;
        let result = this.singleProcess(parameters);
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

    protected abstract singleProcess(parameters: AgentExecutionParameters): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>

    private userTextMessages(input: AsyncControl): Message[] {
        if (input.payload) {
            return input.payload.map(text => ({
                id: generateUniqueId("user"),
                type: 'user',
                sender: "user",
                content: text,
                timestamp: new Date()
            }));
        }
        return [];
    }

    private processInstructions(iteration: number, maxIterations: number): string {
        const isLastIteration = iteration === maxIterations;
        
        return `
## Iterative Mode Instructions

You are operating in iterative mode with the following rules:

**Current Status:**
- You are on iteration ${iteration} of ${maxIterations} maximum iterations
${isLastIteration ? '- ⚠️ THIS IS YOUR FINAL ITERATION - You must complete your task now' : ''}

**How Iterations Work:**
- Each iteration processes your previous output as new input
- Your response from this iteration will be included in the conversation history for the next iteration
- The iteration will finish automatically if you reach the maximum limit (${maxIterations})
- The iteration will finish early if you send no output AND make no tool calls
- Each iteration builds upon the previous one - use this to break complex tasks into steps

**Efficiency Guidelines:**
- Make the most of your limited iterations - be strategic about what you do each round
- If you need multiple steps, plan them across iterations rather than trying to do everything at once
- Use tool calls when you need external information or actions
- Provide meaningful output in each iteration to continue the process
- If you've completed your task, you can end early by sending no output and making no tool calls

${isLastIteration ? 
'**FINAL ITERATION:** This is your last chance to complete the task. Provide your final response now.' : 
'**Next Steps:** Plan what you want to accomplish in this iteration and what might be needed in subsequent iterations.'}
        `;
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
