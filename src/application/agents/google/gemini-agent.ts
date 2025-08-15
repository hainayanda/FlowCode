import OpenAI from 'openai';
import { Observable, Observer } from 'rxjs';
import { BaseAgent } from '../base-agent.js';
import { AgentConfig, AgentInput, AgentResponse, ToolCall, ToolDefinition } from '../../interfaces/agent.js';
import { Toolbox } from '../../interfaces/toolbox.js';

export class GeminiAgent extends BaseAgent {
  private client: OpenAI;

  constructor(config: AgentConfig, toolbox: Toolbox) {
    super(config, toolbox);
    // Google Gemini uses OpenAI-compatible API
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai/'
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
      const messages = this.convertMessages(input);
      const tools = input.tools ? this.convertTools(input.tools) : undefined;

      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: input.maxTokens || 4096,
        temperature: input.temperature || this.config.temperature || 0.7,
        messages,
        tools,
        stream: true
      });

      let currentMessage = '';
      const toolCalls: ToolCall[] = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          currentMessage += delta.content;
          
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

        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            if (toolCall.function) {
              const call: ToolCall = {
                id: toolCall.id || this.generateMessageId(),
                name: toolCall.function.name || '',
                parameters: toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {}
              };
              toolCalls.push(call);
            }
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

  private convertMessages(input: AgentInput): OpenAI.ChatCompletionMessageParam[] {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    
    // Add system message if provided
    if (input.systemPrompt) {
      messages.push({
        role: 'system',
        content: input.systemPrompt
      });
    }

    // Convert input messages
    for (const msg of input.messages) {
      if (msg.type === 'user') {
        messages.push({
          role: 'user',
          content: msg.content
        });
      } else if (msg.type === 'assistant') {
        messages.push({
          role: 'assistant',
          content: msg.content
        });
      }
    }

    return messages;
  }

  private convertTools(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters,
          required: []
        }
      }
    }));
  }

  async validateConfig(): Promise<boolean> {
    if (!await super.validateConfig()) {
      return false;
    }

    try {
      // Test the API key by making a simple request
      await this.client.chat.completions.create({
        model: 'gemini-2.5-flash-lite',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch {
      return false;
    }
  }
}