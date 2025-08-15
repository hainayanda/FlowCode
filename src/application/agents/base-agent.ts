import { Agent, AgentConfig, AgentInput, AgentResponse, AgentMessage } from '../interfaces/agent.js';
import { SummarizerAgent, SummaryResult } from '../interfaces/summarizer-agent.js';
import { Toolbox } from '../interfaces/toolbox.js';
import { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';

/**
 * Abstract base agent implementation with common functionality
 */
export abstract class BaseAgent implements Agent, SummarizerAgent {
  protected config: AgentConfig;
  protected toolbox: Toolbox;

  constructor(config: AgentConfig, toolbox: Toolbox) {
    this.config = config;
    this.toolbox = toolbox;
  }

  abstract processStream(input: AgentInput): Observable<AgentResponse>;

  async validateConfig(): Promise<boolean> {
    // Basic validation - subclasses can override for provider-specific validation
    return !!(this.config.apiKey && this.config.model && this.config.provider);
  }

  getProvider(): string {
    return this.config.provider;
  }

  protected generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  protected getCurrentTimestamp(): Date {
    return new Date();
  }

  async summarizeMessages(messages: AgentMessage[]): Promise<SummaryResult> {
    const systemPrompt = this.buildDetailedSummarizationPrompt();
    const summarizeInput: AgentInput = {
      messages,
      systemPrompt,
      temperature: 0.3, // Lower temperature for more consistent summaries
      maxTokens: 1000
    };

    const response = await firstValueFrom(this.processStream(summarizeInput));
    const summary = response.message.content;
    const timeSpan = this.extractTimeSpan(messages);
    
    return {
      summary,
      messageCount: messages.length,
      timeSpan,
      tokenUsage: response.usage
    };
  }

  private buildDetailedSummarizationPrompt(): string {
    return 'Please provide a detailed summary of the following conversation. ' +
           'Focus on key decisions, outcomes, important information discussed, ' +
           'and any action items or conclusions reached. Include context about ' +
           'the topics covered and maintain the logical flow of the discussion.';
  }

  private extractTimeSpan(messages: AgentMessage[]): { start: Date; end: Date } | undefined {
    if (messages.length === 0) return undefined;
    
    const timestamps = messages
      .map(msg => msg.timestamp)
      .filter(ts => ts instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (timestamps.length === 0) return undefined;
    
    return {
      start: timestamps[0],
      end: timestamps[timestamps.length - 1]
    };
  }
}