import { Agent, AgentConfig, AgentInput, AgentResponse } from '../interfaces/agent.js';
import { Toolbox } from '../interfaces/toolbox.js';
import { Observable } from 'rxjs';

/**
 * Abstract base agent implementation with common functionality
 */
export abstract class BaseAgent implements Agent {
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
}