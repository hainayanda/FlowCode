import {
    Toolbox,
    ToolDefinition,
    ToolCallParameter,
} from '../../../src/application/interfaces/toolbox';
import {
    AsyncControl,
    AsyncControlResponse,
} from '../../../src/application/models/async-control';
import { Message } from '../../../src/application/models/messages';

export class MockToolbox implements Toolbox {
    public tools: ToolDefinition[] = [
        {
            name: 'test-tool',
            description: 'A test tool',
            parameters: { param1: 'string' },
            permission: 'always',
        },
    ];

    public mockMessages: Message[] = [];
    public mockUsage = { inputTokens: 10, outputTokens: 20, toolsUsed: 1 };
    public mockCompletedReason: 'completed' | 'aborted' = 'completed';
    public shouldYieldMessages: Message[] = [];

    async *callTool(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        // Yield any intermediate messages if configured
        for (const message of this.shouldYieldMessages) {
            yield message;
        }

        return {
            messages: this.mockMessages,
            completedReason: this.mockCompletedReason,
            usage: this.mockUsage,
        };
    }

    // Helper methods for testing
    setMockMessages(messages: Message[]) {
        this.mockMessages = messages;
    }

    setMockUsage(inputTokens: number, outputTokens: number, toolsUsed: number) {
        this.mockUsage = { inputTokens, outputTokens, toolsUsed };
    }

    setMockCompletedReason(reason: 'completed' | 'aborted') {
        this.mockCompletedReason = reason;
    }

    setShouldYieldMessages(messages: Message[]) {
        this.shouldYieldMessages = messages;
    }
}
