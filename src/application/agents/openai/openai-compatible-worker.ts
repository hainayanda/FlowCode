import OpenAI from 'openai';
import { generateUniqueId } from '../../../utils/id-generator';
import { AgentExecutionParameters } from '../../interfaces/agent';
import {
    Toolbox,
    ToolCallParameter,
    ToolDefinition,
} from '../../interfaces/toolbox';
import { AsyncControl, AsyncControlResponse } from '../../models/async-control';
import { AgentModelConfig } from '../../models/config';
import { Message } from '../../models/messages';
import { BaseWorker } from '../base-worker';

/**
 * Abstract base class for OpenAI-compatible API workers.
 * Provides common functionality for OpenAI API and compatible services (Azure OpenAI, etc.).
 */
export abstract class OpenAICompatibleWorker extends BaseWorker {
    private client: OpenAI;

    /**
     * Creates a new OpenAICompatibleWorker instance.
     * @param name - The name identifier for this worker
     * @param config - Configuration including API key, model, and endpoints
     * @param toolbox - Optional toolbox for tool execution capabilities
     */
    constructor(name: string, config: AgentModelConfig, toolbox?: Toolbox) {
        super(name, config, toolbox);
        this.client = this.createClient(config);
    }

    /**
     * Abstract method for creating the OpenAI client instance.
     * Concrete implementations provide specific configuration for different OpenAI-compatible services.
     *
     * @param config - Configuration containing API credentials and endpoints
     * @returns Configured OpenAI client instance
     */
    protected abstract createClient(config: AgentModelConfig): OpenAI;

    /**
     * Processes a single iteration using OpenAI-compatible streaming API.
     * Handles real-time text generation and tool usage through the chat completions interface.
     *
     * @param parameters - The execution parameters containing prompt and message history
     * @returns AsyncGenerator that yields text deltas and tool calls, returning final response
     */
    async *singleProcess(
        parameters: AgentExecutionParameters
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const messages = this.convertToOpenAIMessages(
            parameters.messages,
            parameters.prompt
        );
        const tools = this.convertToOpenAITools(this.toolbox?.tools ?? []);

        const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming =
            {
                model: this.config.model,
                max_tokens: this.config.maxTokens || 4096,
                messages: messages,
                stream: true,
            };

        if (tools.length > 0) {
            requestParams.tools = tools;
            requestParams.tool_choice = 'auto';
        }

        const stream = await this.client.chat.completions.create(requestParams);

        const processStarted: Date = new Date();
        const messageId = generateUniqueId(this.name);
        let accumulatedText = '';
        let toolCalls: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[] =
            [];
        const allMessages: Message[] = [];

        for await (const chunk of stream) {
            for (const choice of chunk.choices) {
                const delta = choice.delta;
                if (delta.content) {
                    accumulatedText += delta.content;
                    yield this.textMessageFrom(accumulatedText, messageId);
                }
                if (delta.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                        const index = toolCall.index;
                        if (!toolCalls[index]) {
                            toolCalls[index] = {
                                index: index,
                                id: toolCall.id || '',
                                type: 'function',
                                function: {
                                    name: toolCall.function?.name || '',
                                    arguments: '',
                                },
                            };
                        }
                        if (toolCall.function?.arguments) {
                            toolCalls[index].function!.arguments +=
                                toolCall.function.arguments;
                        }
                    }
                }
            }
        }

        if (accumulatedText) {
            const message = this.textMessageFrom(
                accumulatedText,
                messageId,
                processStarted
            );
            yield message;
            allMessages.push(message);
        }

        return yield* this.finalizeProcess(
            allMessages,
            this.convertToToolCallParameters(toolCalls)
        );
    }

    private textMessageFrom(
        accumulatedText: string,
        id: string,
        date?: Date
    ): Message {
        return {
            id: id,
            type: 'agent',
            sender: this.name,
            content: accumulatedText,
            timestamp: date || new Date(),
        };
    }

    private convertToToolCallParameters(
        toolCalls: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[]
    ): ToolCallParameter[] {
        return toolCalls
            .map((openAIToolCall) => {
                if (!openAIToolCall.function?.name) {
                    return null;
                }
                if (!openAIToolCall.function?.arguments) {
                    return null;
                }
                let parsedArguments: Record<string, any>;
                try {
                    parsedArguments = JSON.parse(
                        openAIToolCall.function.arguments
                    );
                } catch {
                    return null;
                }
                return {
                    name: openAIToolCall.function.name,
                    parameters: parsedArguments,
                };
            })
            .filter((tc): tc is ToolCallParameter => tc !== null);
    }

    private convertToOpenAIMessages(
        messages: Message[],
        systemPrompt: string
    ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
        const openAIMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
            [];

        if (systemPrompt) {
            openAIMessages.push({ role: 'system', content: systemPrompt });
        }

        return openAIMessages.concat(
            messages.map((msg) => {
                switch (msg.type) {
                    case 'user':
                    case 'file_operation':
                    case 'user-input':
                    case 'user-choice':
                    case 'prompt':
                    case 'choice':
                    case 'error':
                    case 'system':
                        return { role: 'user', content: msg.content };
                    case 'summary':
                    case 'agent':
                    case 'taskmaster':
                        return { role: 'assistant', content: msg.content };
                }
            })
        );
    }

    private convertToOpenAITools(
        tools: ToolDefinition[]
    ): OpenAI.Chat.Completions.ChatCompletionTool[] {
        return tools.map((tool) => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));
    }
}
