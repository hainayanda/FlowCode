import Anthropic from '@anthropic-ai/sdk';
import { Observable, Observer } from 'rxjs';
import { BaseAgent } from '../base-agent.js';
import { AgentInput, AgentResponse, ToolCall, ToolDefinition } from '../../interfaces/agent.js';
import { Toolbox } from '../../interfaces/toolbox.js';

export class AnthropicAgent extends BaseAgent {
  private client: Anthropic;

  constructor(config: any, toolbox: Toolbox) {
    super(config, toolbox);
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
  }

  processStream(input: AgentInput): Observable<AgentResponse> {
    return new Observable((observer: Observer<AgentResponse>) => {
      this.streamProcess(input, observer).catch(error => {
        observer.error(error);
      });
    });
  }

  private async streamProcess(input: AgentInput, observer: Observer<AgentResponse>): Promise<void> {
    try {
      const messages = this.convertMessages(input.messages);
      const tools = input.tools ? this.convertTools(input.tools) : undefined;

      const stream = await this.client.messages.create({
        model: this.config.model,
        max_tokens: input.maxTokens || 4096,
        temperature: input.temperature || this.config.temperature || 0.7,
        system: input.systemPrompt,
        messages,
        tools,
        stream: true
      });

      let currentMessage = '';
      const toolCalls: ToolCall[] = [];

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_start') {
          if (chunk.content_block.type === 'text') {
            // Start of text content
          } else if (chunk.content_block.type === 'tool_use') {
            // Start of tool use
            const toolCall: ToolCall = {
              id: chunk.content_block.id,
              name: chunk.content_block.name,
              parameters: (chunk.content_block.input as Record<string, unknown>) || {}
            };
            toolCalls.push(toolCall);
          }
        } else if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            currentMessage += chunk.delta.text;
            
            // Emit partial assistant message
            const response: AgentResponse = {
              message: {
                id: this.generateMessageId(),
                type: 'assistant',
                content: currentMessage,
                timestamp: this.getCurrentTimestamp()
              }
            };
            observer.next(response);
          }
        } else if (chunk.type === 'message_delta') {
          // Handle usage info if available
          if (chunk.usage) {
            // Will be included in final response
          }
        }
      }

      // Execute tool calls if any (toolbox handles status messages)
      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          // Execute the tool - toolbox will emit status messages
          await this.toolbox.executeTool({
            name: toolCall.name,
            parameters: toolCall.parameters
          });
        }
      }

      // Complete the stream
      observer.complete();
    } catch (error) {
      observer.error(error);
    }
  }

  private convertMessages(messages: any[]): Anthropic.MessageParam[] {
    return messages
      .filter(msg => msg.type === 'user' || msg.type === 'assistant')
      .map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
  }

  private convertTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters,
        required: []
      }
    }));
  }


  async validateConfig(): Promise<boolean> {
    if (!await super.validateConfig()) {
      return false;
    }

    try {
      // Test the API key by making a simple request
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch {
      return false;
    }
  }
}