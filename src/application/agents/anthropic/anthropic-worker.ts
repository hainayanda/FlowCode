import { AgentExecutionParameters, AgentSummarizer, AgentWorker } from '../../interfaces/agents.js';
import { AsyncControl, AsyncControlResponse } from '../../models/async-control.js';
import { ErrorMessage, Message } from '../../models/messages.js';
import { Toolbox, ToolDefinition } from '../../interfaces/toolbox.js';
import { AgentModelConfig } from '../../models/config.js';
import Anthropic from '@anthropic-ai/sdk';
import { ToolUseBlock } from '@anthropic-ai/sdk/resources';
import { generateUniqueId } from '../../../utils/id-generator.js';
import { BaseWorker } from '../base-worker.js';

export class AnthropicWorker extends BaseWorker {

    private client: Anthropic;

    constructor(name: string, config: AgentModelConfig, toolbox?: Toolbox, summarizer?: AgentSummarizer) {
        super(name, config, toolbox, summarizer);
        this.client = new Anthropic({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
        });
    }

    async* singleProcess(parameters: AgentExecutionParameters): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const stream = await this.client.messages.create({
            model: this.config.model,
            max_tokens: this.config.maxTokens || 4096,
            system: parameters.prompt,
            messages: this.convertToAnthropicMessages(parameters.messages),
            tools: this.convertToAnthropicTools(this.toolbox?.tools ?? []),
            stream: true
        });

        const processStarted: Date = new Date();
        // same message id for chunk so the caller know it was for the same message.
        const messageId = generateUniqueId(this.name);
        let accumulatedText = '';
        let currentToolUse: ToolUseBlock | null = null;
        let toolUses: ToolUseBlock[] = [];
        const allMessages: Message[] = [];

        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta') {
                if (chunk.delta.type === 'text_delta') {
                    accumulatedText += chunk.delta.text;
                    yield this.textMessageFrom(accumulatedText, messageId);
                }
                else if (chunk.delta.type === 'input_json_delta' && currentToolUse) {
                    currentToolUse.input += chunk.delta.partial_json;
                }
            }
            else if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
                currentToolUse = {
                    type: 'tool_use',
                    id: chunk.content_block.id,
                    name: chunk.content_block.name,
                    input: ''
                };
            }
            else if (chunk.type === 'content_block_stop' && currentToolUse) {
                toolUses.push(currentToolUse);
                currentToolUse = null;
            }
        }

        if (accumulatedText) {
            const message = this.textMessageFrom(accumulatedText, messageId, processStarted);
            yield message;
            allMessages.push(message);
        }
        return yield* this.finalizeProcess(allMessages, toolUses);
    }

    private async* finalizeProcess(accumulatedMessages: Message[], toolUses: ToolUseBlock[]): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        if (!this.toolbox) {
            return { 
                messages: accumulatedMessages,
                usage: { 
                    inputTokens: 0,
                    outputTokens: 0,
                    toolsUsed: 0
                }
            };
        }

        let allMessages: Message[] = accumulatedMessages
        let inputTokens: number = 0;
        let outputTokens: number = 0;
        let toolsUsed: number = 0;
        let input: AsyncControl = { type: 'continue' };

        for (const toolUse of toolUses) {
            let parsedInput: Record<string, any>;
            try {
                parsedInput = JSON.parse(toolUse.input as string);
            } catch (error) {
                const errorMessage = this.errorMessageFrom(error as Error, `Error occurred while using tool ${toolUse.name}`);
                yield errorMessage;
                allMessages.push(errorMessage);
                continue;
            }
            const toolResult = this.toolbox.callTool(toolUse.name, parsedInput);
            while (true) {
                const { done, value } = await toolResult.next(input);
                if (done) {
                    allMessages.push(...value.messages);
                    toolsUsed += 1 + value.usage.toolsUsed;
                    inputTokens += value.usage.inputTokens;
                    outputTokens += value.usage.outputTokens;
                    break;
                } else {
                    input = yield value;
                }
            }
        }
        return {
            messages: allMessages,
            usage: {
                inputTokens,
                outputTokens,
                toolsUsed
            }
        };
    }

    private errorMessageFrom(error: Error, message: string): ErrorMessage {
        return {
            id: generateUniqueId('error'),
            type: 'system',
            sender: this.name,
            content: `${message}: ${error.message}`,
            timestamp: new Date(),
            metadata: {
                error: error
            }
        };
    }

    private textMessageFrom(accumulatedText: string, id: string, date?: Date): Message {
        return {
            id: id,
            type: 'agent',
            sender: this.name,
            content: accumulatedText,
            timestamp: date || new Date()
        };
    }

    private convertToAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
        return messages.map(msg => {
            switch (msg.type) {
                case 'user':
                case 'file_operation':
                case 'user_interaction':
                case 'system':
                    return { role: 'user', content: JSON.stringify(msg.content) };
                case 'agent':
                case 'taskmaster':
                    return { role: 'assistant', content: JSON.stringify(msg.content) };
            }
        });
    }

    private convertToAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters as Anthropic.Tool.InputSchema
        }));
    }
}