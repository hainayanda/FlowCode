import { BaseWorker } from "../../../src/application/agents/base-worker";
import { AgentExecutionParameters } from "../../../src/application/interfaces/agents";
import { AsyncControl, AsyncControlResponse } from "../../../src/application/models/async-control";
import { Message } from "../../../src/application/models/messages";
import { AgentModelConfig } from "../../../src/application/models/config";
import { generateUniqueId } from "../../../src/utils/id-generator";

export class TestWorker extends BaseWorker {
    public mockMessages: Message[] = [];
    public mockUsage = { inputTokens: 5, outputTokens: 15, toolsUsed: 0 };
    public shouldYieldMessages: Message[] = [];
    public processedPrompts: string[] = [];

    public async* singleProcess(parameters: AgentExecutionParameters): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        // Store the processed prompt for testing
        this.processedPrompts.push(parameters.prompt);

        // Yield any intermediate messages if configured
        for (const message of this.shouldYieldMessages) {
            yield message;
        }

        return {
            messages: this.mockMessages,
            usage: this.mockUsage
        };
    }

    // Helper methods for testing
    setMockMessages(messages: Message[]) {
        this.mockMessages = messages;
    }

    setMockUsage(inputTokens: number, outputTokens: number, toolsUsed: number) {
        this.mockUsage = { inputTokens, outputTokens, toolsUsed };
    }

    setShouldYieldMessages(messages: Message[]) {
        this.shouldYieldMessages = messages;
    }

    getProcessedPrompts(): string[] {
        return this.processedPrompts;
    }

    clearProcessedPrompts() {
        this.processedPrompts = [];
    }
}

export function createMockMessage(overrides: Partial<Message> = {}): Message {
    return {
        id: generateUniqueId('test'),
        content: 'Test message content',
        type: 'agent',
        sender: 'test-worker',
        timestamp: new Date(),
        ...overrides
    };
}

export function createMockConfig(overrides: Partial<AgentModelConfig> = {}): AgentModelConfig {
    return {
        model: 'test-model',
        provider: 'test-provider',
        apiKey: 'test-key',
        maxTokens: 4096,
        ...overrides
    };
}