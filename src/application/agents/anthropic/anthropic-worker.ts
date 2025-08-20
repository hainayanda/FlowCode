import { AgentExecutionParameters } from '../../interfaces/agents.js';
import { AsyncControl, AsyncControlResponse } from '../../models/async-control.js';
import { ErrorMessage, Message } from '../../models/messages.js';
import { Toolbox, ToolCallParameter, ToolDefinition } from '../../interfaces/toolbox.js';
import { AgentModelConfig } from '../../models/config.js';
import Anthropic from '@anthropic-ai/sdk';
import { ToolUseBlock } from '@anthropic-ai/sdk/resources';
import { generateUniqueId } from '../../../utils/id-generator.js';
import { BaseWorker } from '../base-worker.js';

export class AnthropicWorker extends BaseWorker {

    private client: Anthropic;

    constructor(name: string, config: AgentModelConfig, toolbox?: Toolbox) {
        super(name, config, toolbox);
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
        return yield* this.finalizeProcess(allMessages, this.convertToToolCallParameters(toolUses));
    }

    private convertToToolCallParameters(toolCalls: ToolUseBlock[]): ToolCallParameter[] {
        return toolCalls.map(antrhopicToolCall => {
            if (!antrhopicToolCall.name) { return null; }
            if (!antrhopicToolCall.input) { return null; }
            let parsedInput: Record<string, any>;
            try {
                parsedInput = JSON.parse(antrhopicToolCall.input as string);
            } catch {
                return null;
            }
            return {
                name: antrhopicToolCall.name,
                parameters: parsedInput
            };
        })
        .filter((tc): tc is ToolCallParameter => tc !== null);
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