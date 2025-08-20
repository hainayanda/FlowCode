import { AgentExecutionParameters, AgentWorker } from '../interfaces/agent';
import { Toolbox, ToolCallParameter } from '../interfaces/toolbox';
import { AsyncControl, AsyncControlResponse } from '../models/async-control';
import { AgentModelConfig } from '../models/config';
import { Message } from '../models/messages';

/**
 * Abstract base class for agent workers that provides common iteration and message handling logic.
 * Concrete implementations must provide the singleProcess method for their specific agent behavior.
 */
export abstract class BaseWorker implements AgentWorker {
    protected name: string;
    protected config: AgentModelConfig;
    protected toolbox: Toolbox | undefined;

    /**
     * Creates a new BaseWorker instance.
     * @param name - The name identifier for this worker
     * @param config - Configuration for the agent model
     * @param toolbox - Optional toolbox for tool execution capabilities
     */
    constructor(name: string, config: AgentModelConfig, toolbox?: Toolbox) {
        this.name = name;
        this.toolbox = toolbox;
        this.config = config;
    }

    /**
     * Processes multiple iterations of the agent workflow until completion or max iterations.
     * Handles message accumulation, abort signals, and conversation history management.
     *
     * @param parameters - The execution parameters containing prompt and message history
     * @param maxIterations - Maximum number of iterations to run (defaults to 25)
     * @returns AsyncGenerator that yields intermediate messages and returns final accumulated response
     */
    async *process(
        parameters: AgentExecutionParameters,
        maxIterations?: number
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const iterations = maxIterations || 25;
        let originalPrompt = parameters.prompt;

        let outputMessages: Message[] = [];
        let inputTokens: number = 0;
        let outputTokens: number = 0;
        let toolsUsed: number = 0;
        let input: AsyncControl = { type: 'continue' };
        let completedReason: `completed` | `aborted` = 'completed';
        let canContinue: boolean = true;

        for (let i = 0; i < iterations && canContinue; i++) {
            parameters.prompt = `${originalPrompt}\n\n${this.processInstructions(i + 1, iterations)}`;
            const process = this.singleProcess(parameters);
            while (true) {
                const { done, value } = await process.next(input);
                if (done) {
                    if (input.summarizedMessages) {
                        parameters.messages = [...input.summarizedMessages];
                    } else {
                        parameters.messages.push(...value.messages);
                    }
                    if (input.queuedMessages) {
                        parameters.messages.push(...input.queuedMessages);
                    }
                    outputMessages.push(...value.messages);
                    inputTokens += value.usage.inputTokens;
                    outputTokens += value.usage.outputTokens;
                    toolsUsed += value.usage.toolsUsed;
                    completedReason = value.completedReason;
                    // Check if the singleProcess was force-stopped
                    if (completedReason === 'aborted') {
                        canContinue = false;
                        break;
                    } else {
                        canContinue =
                            value.messages.length > 0 ||
                            value.usage.toolsUsed > 0;
                    }

                    input = { type: 'continue' };
                    break;
                } else {
                    input = yield value;
                    if (input.type === 'abort') {
                        outputMessages.push(value);
                        completedReason = 'aborted';
                        canContinue = false;
                        break;
                    }
                }
            }
        }
        return {
            messages: outputMessages,
            completedReason,
            usage: { inputTokens, outputTokens, toolsUsed },
        };
    }

    /**
     * Abstract method that concrete implementations must provide to handle a single iteration.
     * This method should contain the core agent logic for processing one round of interaction.
     *
     * @param parameters - The execution parameters containing prompt and message history
     * @returns AsyncGenerator that yields intermediate messages and returns single iteration response
     */
    abstract singleProcess(
        parameters: AgentExecutionParameters
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;

    /**
     * Finalizes the agent process by executing any pending tool calls.
     * Handles tool execution, message accumulation, and abort signal propagation.
     *
     * @param accumulatedMessages - Messages collected so far in the process
     * @param toolCalls - Array of tool calls to execute
     * @returns AsyncGenerator that yields tool messages and returns final response with all results
     */
    protected async *finalizeProcess(
        accumulatedMessages: Message[],
        toolCalls: ToolCallParameter[]
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        if (!this.toolbox) {
            return {
                messages: accumulatedMessages,
                completedReason: 'completed',
                usage: {
                    inputTokens: 0,
                    outputTokens: 0,
                    toolsUsed: 0,
                },
            };
        }

        let allMessages: Message[] = accumulatedMessages;
        let inputTokens: number = 0;
        let outputTokens: number = 0;
        let toolsUsed: number = 0;
        let completedReason: `completed` | `aborted` = 'completed';

        for (const toolCall of toolCalls) {
            const toolResult = yield* this.toolbox.callTool(toolCall);
            allMessages.push(...toolResult.messages);
            inputTokens += toolResult.usage.inputTokens;
            outputTokens += toolResult.usage.outputTokens;
            toolsUsed += 1 + toolResult.usage.toolsUsed;
            completedReason = toolResult.completedReason;
            if (toolResult.completedReason === 'aborted') {
                break;
            }
        }

        return {
            messages: allMessages,
            completedReason,
            usage: {
                inputTokens,
                outputTokens,
                toolsUsed,
            },
        };
    }

    private processInstructions(
        iteration: number,
        maxIterations: number
    ): string {
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

${
    isLastIteration
        ? '**FINAL ITERATION:** This is your last chance to complete the task. Provide your final response now.'
        : '**Next Steps:** Plan what you want to accomplish in this iteration and what might be needed in subsequent iterations.'
}
        `;
    }
}
