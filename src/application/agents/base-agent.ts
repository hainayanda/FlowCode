import { Agent, AgentConfig, AgentInput, AgentResponse, AgentMessage, SummaryMessage } from '../interfaces/agent.js';
import { SummarizerAgent, SummaryResult } from '../interfaces/summarizer-agent.js';
import { Toolbox } from '../interfaces/toolbox.js';
import { Observable, Observer } from 'rxjs';
import { firstValueFrom } from 'rxjs';

/**
 * Abstract base agent implementation with common functionality
 */
export abstract class BaseAgent implements Agent, SummarizerAgent {

  protected config: AgentConfig;
  protected toolbox: Toolbox;
  private _isInIteration = false;
  private pendingInputs: AgentInput[] = [];

  /**
   * Check if currently in an iteration
   */
  get isInIteration(): boolean {
    return this._isInIteration;
  }

  constructor(config: AgentConfig, toolbox: Toolbox) {
    this.config = config;
    this.toolbox = toolbox;
  }

  abstract processStream(input: AgentInput): Observable<AgentResponse>;

  /**
   * Process with multi-message iteration until summary or max iterations reached
   */
  processStreamWithIteration(input: AgentInput): Observable<AgentResponse> {
    return new Observable((observer) => {
      this._isInIteration = true;
      
      this.runIterativeProcess(input, observer)
        .then(() => {
          observer.complete();
        })
        .catch(error => {
          observer.error(error);
        })
        .finally(() => {
          this._isInIteration = false;
        });
    });
  }

  /**
   * Queue an input for later processing when iteration completes
   */
  queueProcess(input: AgentInput): void {
    this.pendingInputs.push(input);
  }

  /**
   * Get all queued inputs and optionally clear the queue
   */
  getQueuedInputs(clear = false): AgentInput[] {
    const inputs = [...this.pendingInputs];
    if (clear) {
      this.pendingInputs = [];
    }
    return inputs;
  }

  async validateConfig(): Promise<boolean> {
    // Basic validation - subclasses can override for provider-specific validation
    return !!(this.config.apiKey && this.config.model && this.config.provider);
  }

  getProvider(): string {
    return this.config.provider;
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

  /**
   * Merge multiple AgentInputs into one, combining messages and updating configuration
   */
  mergeInputs(inputs: AgentInput[]): AgentInput {
    if (inputs.length === 0) {
      throw new Error('No inputs to merge');
    }
    
    if (inputs.length === 1) {
      return inputs[0];
    }
    
    // Start with the first input
    let mergedInput = inputs[0];
    
    // Merge all subsequent inputs
    for (let i = 1; i < inputs.length; i++) {
      mergedInput = this.mergeAgentInputs(mergedInput, inputs[i]);
    }
    
    return mergedInput;
  }

  protected generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  protected getCurrentTimestamp(): Date {
    return new Date();
  }

  protected getMultiMessagePrompt(): string {
    return `
ITERATIVE MULTI-MESSAGE MODE:
You are in iterative mode where you can send multiple responses before completing the task.

HOW THIS WORKS:
1. You respond with your current progress using the message markers below
2. If you don't end with --SUMMARY--, the system will call you AGAIN with your previous response added to the conversation
3. This continues until you provide a --SUMMARY-- or reach maximum iterations
4. Use this to break complex tasks into multiple steps

MESSAGE MARKERS:

--MESSAGE--
Use for regular assistant messages that should be displayed to the user.
Each message should be complete and self-contained.

--THINKING--
Use for internal reasoning, planning, or analysis that shows your thought process.
This helps users understand how you're approaching the task.

--SUMMARY--
Use ONLY when you have completely finished the task.
Text after --SUMMARY-- will be sent to caller to indicate task completion.

ITERATIVE EXAMPLE:

Response 1:
--MESSAGE--
I'll help you implement this feature. Let me first analyze the existing codebase to understand the current structure.

(System calls you again with this response added to conversation history)

Response 2:
--THINKING--
I found the main components in src/components/. The authentication system uses JWT tokens and the database layer follows repository pattern. Now I'll create the new user registration component.

(System calls you again...)

Response 3:
--MESSAGE--
Here's the implementation:
[code here]

(System calls you again...)

Response 4:
--SUMMARY--
Task completed successfully. Created user registration component with form validation and API integration.

IMPORTANT RULES:
- Send ONLY ONE message marker per response (either --MESSAGE--, --THINKING--, or --SUMMARY--)
- You can send partial progress without --SUMMARY-- and continue in next iteration
- Only use --SUMMARY-- when the entire task is 100% complete
- The system will automatically call you again if no --SUMMARY-- is provided
- Use --THINKING-- to show your step-by-step reasoning across iterations
- Each iteration sees the full conversation history including your previous responses
    `.trim();
  }

  protected parseMultiMessages(content: string): {
    messages: Array<{ type: 'assistant' | 'thinking'; content: string }>;
    summaryData?: string;
    isComplete: boolean;
    remainingContent: string;
  } {
    const markers = ['--MESSAGE--', '--THINKING--', '--SUMMARY--'];
    const messages: Array<{ type: 'assistant' | 'thinking'; content: string }> = [];
    let summaryData: string | undefined;
    let isComplete = false;

    // Find all marker positions
    const markerPositions: Array<{ position: number; type: string }> = [];
    
    markers.forEach(marker => {
      let position = content.indexOf(marker);
      while (position !== -1) {
        markerPositions.push({ position, type: marker });
        position = content.indexOf(marker, position + 1);
      }
    });

    // Sort by position
    markerPositions.sort((a, b) => a.position - b.position);

    if (markerPositions.length === 0) {
      // No markers found, treat as partial content
      return {
        messages: [],
        isComplete: false,
        remainingContent: content
      };
    }

    // Handle content before first marker
    let pendingContent = '';
    if (markerPositions.length > 0 && markerPositions[0].position > 0) {
      pendingContent = content.substring(0, markerPositions[0].position).trim();
    }

    for (let i = 0; i < markerPositions.length; i++) {
      const marker = markerPositions[i];
      const nextMarker = markerPositions[i + 1];
      
      // Get content after this marker until next marker (or end)
      const startPos = marker.position + marker.type.length;
      const endPos = nextMarker ? nextMarker.position : content.length;
      const markerContent = content.substring(startPos, endPos).trim();

      if (marker.type === '--SUMMARY--') {
        // Summary marker - task is complete
        summaryData = markerContent;
        isComplete = true;
        break;
      } else if (marker.type === '--MESSAGE--' || marker.type === '--THINKING--') {
        // Add any pending content before first marker as assistant message
        if (pendingContent.trim() && i === 0) {
          messages.push({
            type: 'assistant',
            content: pendingContent.trim()
          });
          pendingContent = '';
        }

        // Add the marked content if it exists
        if (markerContent) {
          messages.push({
            type: marker.type === '--MESSAGE--' ? 'assistant' : 'thinking',
            content: markerContent
          });
        }
      }
    }

    // Calculate remaining content for incomplete streams
    let remainingContent = '';
    if (!isComplete) {
      const lastMarker = markerPositions[markerPositions.length - 1];
      const startPos = lastMarker.position + lastMarker.type.length;
      remainingContent = content.substring(startPos).trim();
    }

    return {
      messages,
      summaryData,
      isComplete,
      remainingContent
    };
  }

  private mergeAgentInputs(currentInput: AgentInput, newInput: AgentInput): AgentInput {
    // Deduplicate messages by ID to prevent duplicates
    const existingMessageIds = new Set(currentInput.messages.map(m => m.id));
    const newMessages = newInput.messages.filter(m => !existingMessageIds.has(m.id));
    
    return {
      // Append only new, non-duplicate messages
      messages: [...currentInput.messages, ...newMessages],
      
      // Use new systemPrompt if provided, otherwise keep current
      systemPrompt: newInput.systemPrompt ?? currentInput.systemPrompt,
      
      // Use new temperature if provided, otherwise keep current
      temperature: newInput.temperature ?? currentInput.temperature,
      
      // Use new maxTokens if provided, otherwise keep current
      maxTokens: newInput.maxTokens ?? currentInput.maxTokens,
      
      // Use new tools if provided, otherwise keep current
      tools: newInput.tools ?? currentInput.tools,
      
      // Keep other properties from new input
      maxMessages: newInput.maxMessages ?? currentInput.maxMessages,
      disableMultiMessage: newInput.disableMultiMessage ?? currentInput.disableMultiMessage
    };
  }

  private async runIterativeProcess(input: AgentInput, observer: Observer<AgentResponse>): Promise<void> {
    const maxIterations = this.config.maxIterations || 5;
    const accumulatedMessages = [...input.messages];
    let iteration = 0;
    let isComplete = false;

    // Add multi-message prompt to system prompt unless disabled
    const enhancedInput: AgentInput = {
      ...input,
      systemPrompt: input.disableMultiMessage 
        ? input.systemPrompt
        : `${input.systemPrompt || ''}\n\n${this.getMultiMessagePrompt()}`
    };

    while (!isComplete && iteration < maxIterations) {
      iteration++;
      
      // Update input with accumulated messages
      const currentInput: AgentInput = {
        ...enhancedInput,
        messages: accumulatedMessages
      };

      // Collect all responses from this iteration
      const iterationResponses: AgentResponse[] = [];
      
      await new Promise<void>((resolve, reject) => {
        this.processStream(currentInput).subscribe({
          next: (response) => {
            iterationResponses.push(response);
            observer.next(response);
          },
          complete: () => resolve(),
          error: (error) => reject(error)
        });
      });

      // Process accumulated content from this iteration
      const iterationContent = iterationResponses
        .map(r => r.message.content)
        .join('');

      const parseResult = this.parseMultiMessages(iterationContent);
      
      // Check for summary (completion)
      if (parseResult.isComplete && parseResult.summaryData) {
        // Emit final response with summary data
        const summaryMessage: SummaryMessage = {
          id: this.generateMessageId(),
          type: 'summary',
          content: parseResult.summaryData,
          timestamp: this.getCurrentTimestamp(),
          taskStatus: 'completed',
          summaryData: parseResult.summaryData
        };
        const summaryResponse: AgentResponse = {
          message: summaryMessage,
          summaryData: parseResult.summaryData,
          finishReason: 'stop'
        };
        observer.next(summaryResponse);
        isComplete = true;
      } else {
        // Add iteration output to accumulated messages for next iteration
        if (iterationContent.trim()) {
          accumulatedMessages.push({
            id: this.generateMessageId(),
            type: 'assistant',
            content: iterationContent,
            timestamp: this.getCurrentTimestamp()
          });
        }
      }
    }

    // If we exit the loop without completion (max iterations reached)
    if (!isComplete) {
      const partialSummaryMessage: SummaryMessage = {
        id: this.generateMessageId(),
        type: 'summary',
        content: `Task partially completed. Reached maximum iterations (${maxIterations}).`,
        timestamp: this.getCurrentTimestamp(),
        taskStatus: 'partial',
        summaryData: `Partial completion after ${iteration} iterations`
      };
      const partialSummaryResponse: AgentResponse = {
        message: partialSummaryMessage,
        summaryData: `Partial completion after ${iteration} iterations`,
        finishReason: 'length'
      };
      observer.next(partialSummaryResponse);
    }
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