import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandDispatcherService } from '../../../src/application/services/command-dispatcher-service.js';
import { CommandProvider, CommandResult } from '../../../src/application/interfaces/command-provider.js';
import { CommandDefinition } from '../../../src/presentation/view-models/console/console-use-case.js';
import { MessageWriter } from '../../../src/application/interfaces/message-store.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

/**
 * Mock CommandProvider for testing
 */
class MockCommandProvider implements CommandProvider {
  public executeCalled = false;
  public lastCommand = '';
  public lastArgs: string[] = [];
  public mockResult: CommandResult = { success: true, message: 'Mock provider executed' };
  public mockCommands: CommandDefinition[] = [];
  
  async execute(command: string, args: string[]): Promise<CommandResult> {
    this.executeCalled = true;
    this.lastCommand = command;
    this.lastArgs = args || []; // Handle undefined args
    return this.mockResult;
  }
  
  getCommands(): CommandDefinition[] {
    return this.mockCommands;
  }
  
  supports(command: string): boolean {
    return this.mockCommands.some(cmd => cmd.name === command);
  }
  
  reset(): void {
    this.executeCalled = false;
    this.lastCommand = '';
    this.lastArgs = [];
    this.mockResult = { success: true, message: 'Mock provider executed' };
  }
}

/**
 * Mock MessageWriter for testing
 */
class MockMessageWriter implements MessageWriter {
  public storedMessages: DomainMessage[] = [];
  public storeMessageCalled = false;
  public lastStoredMessage: DomainMessage | null = null;
  
  async storeMessage(message: DomainMessage): Promise<void> {
    this.storeMessageCalled = true;
    this.lastStoredMessage = message;
    this.storedMessages.push(message);
  }
  
  async storeMessages(messages: DomainMessage[]): Promise<void> {
    for (const message of messages) {
      await this.storeMessage(message);
    }
  }
  
  async updateMessage(messageId: string, updates: Partial<DomainMessage>): Promise<void> {
    const index = this.storedMessages.findIndex(msg => msg.id === messageId);
    if (index >= 0) {
      this.storedMessages[index] = { ...this.storedMessages[index], ...updates } as DomainMessage;
    }
  }
  
  async clearHistory(): Promise<void> {
    this.storedMessages = [];
  }
  
  reset(): void {
    this.storedMessages = [];
    this.storeMessageCalled = false;
    this.lastStoredMessage = null;
  }
}

describe('CommandDispatcher', () => {
  let dispatcher: CommandDispatcherService;
  let mockProvider1: MockCommandProvider;
  let mockProvider2: MockCommandProvider;
  let mockMessageWriter: MockMessageWriter;
  
  beforeEach(() => {
    mockProvider1 = new MockCommandProvider();
    mockProvider1.mockCommands = [
      { name: 'init', description: 'Initialize project' },
      { name: 'build', description: 'Build project', aliases: ['b'] }
    ];
    
    mockProvider2 = new MockCommandProvider();
    mockProvider2.mockCommands = [
      { name: 'deploy', description: 'Deploy application' },
      { name: 'test', description: 'Run tests', aliases: ['t'] }
    ];
    
    mockMessageWriter = new MockMessageWriter();
    
    dispatcher = new CommandDispatcherService(
      [mockProvider1, mockProvider2],
      mockMessageWriter
    );
  });
  
  afterEach(() => {
    mockProvider1.reset();
    mockProvider2.reset();
    mockMessageWriter.reset();
  });
  
  describe('Command Routing', () => {
    it('should route commands to appropriate provider', async () => {
      const result = await dispatcher.execute('init', ['my-project']);
      
      expect(result.success).toBe(true);
      expect(mockProvider1.executeCalled).toBe(true);
      expect(mockProvider1.lastCommand).toBe('init');
      expect(mockProvider1.lastArgs).toEqual(['my-project']);
      expect(mockProvider2.executeCalled).toBe(false);
    });
    
    it('should route to second provider when appropriate', async () => {
      await dispatcher.execute('deploy', ['staging']);
      
      expect(mockProvider2.executeCalled).toBe(true);
      expect(mockProvider2.lastCommand).toBe('deploy');
      expect(mockProvider2.lastArgs).toEqual(['staging']);
      expect(mockProvider1.executeCalled).toBe(false);
    });
    
    it('should handle unknown commands', async () => {
      const result = await dispatcher.execute('unknown', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown command: unknown. Use 'help' to see available commands.");
      expect(mockProvider1.executeCalled).toBe(false);
      expect(mockProvider2.executeCalled).toBe(false);
    });
    
    it('should store error message for unknown commands', async () => {
      await dispatcher.execute('invalid', []);
      
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
      expect(mockMessageWriter.lastStoredMessage?.type).toBe('system');
      expect(mockMessageWriter.lastStoredMessage?.content).toContain('Unknown command: invalid');
    });
  });
  
  describe('Help Command', () => {
    it('should handle help command without arguments', async () => {
      const result = await dispatcher.execute('help', []);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Available commands:');
      expect(result.message).toContain('help - Show available commands');
      expect(result.message).toContain('init - Initialize project');
      expect(result.message).toContain('deploy - Deploy application');
    });
    
    it('should handle help for specific command', async () => {
      const result = await dispatcher.execute('help', ['init']);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Command: init');
      expect(result.message).toContain('Description: Initialize project');
    });
    
    it('should handle help for command with aliases', async () => {
      const result = await dispatcher.execute('help', ['build']);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Command: build');
      expect(result.message).toContain('Description: Build project');
      expect(result.message).toContain('Aliases: b');
    });
    
    it('should handle help for non-existent command', async () => {
      const result = await dispatcher.execute('help', ['nonexistent']);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No help available for command: nonexistent');
    });
    
    it('should store help messages in MessageWriter', async () => {
      await dispatcher.execute('help', []);
      
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
      expect(mockMessageWriter.lastStoredMessage?.type).toBe('system');
      expect(mockMessageWriter.lastStoredMessage?.content).toContain('Available commands:');
    });
  });
  
  describe('Command Aggregation', () => {
    it('should aggregate commands from all providers', () => {
      const commands = dispatcher.getCommands();
      
      expect(commands).toHaveLength(5); // help + 4 from providers
      expect(commands.find(c => c.name === 'help')).toBeDefined();
      expect(commands.find(c => c.name === 'init')).toBeDefined();
      expect(commands.find(c => c.name === 'build')).toBeDefined();
      expect(commands.find(c => c.name === 'deploy')).toBeDefined();
      expect(commands.find(c => c.name === 'test')).toBeDefined();
    });
    
    it('should support command checking', () => {
      expect(dispatcher.supports('help')).toBe(true);
      expect(dispatcher.supports('init')).toBe(true);
      expect(dispatcher.supports('deploy')).toBe(true);
      expect(dispatcher.supports('unknown')).toBe(false);
    });
  });
  
  describe('Message Handling', () => {
    it('should store success messages from providers', async () => {
      mockProvider1.mockResult = { success: true, message: 'Command completed successfully' };
      
      await dispatcher.execute('init', []);
      
      expect(mockMessageWriter.storedMessages).toHaveLength(1);
      expect(mockMessageWriter.lastStoredMessage?.type).toBe('system');
      expect(mockMessageWriter.lastStoredMessage?.content).toBe('Command completed successfully');
    });
    
    it('should not store messages for successful commands without message', async () => {
      mockProvider1.mockResult = { success: true }; // No message
      
      await dispatcher.execute('init', []);
      
      expect(mockMessageWriter.storeMessageCalled).toBe(false);
    });
    
    it('should handle provider execution errors', async () => {
      mockProvider1.execute = vi.fn().mockRejectedValue(new Error('Provider failed'));
      
      const result = await dispatcher.execute('init', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Error executing command \'init\': Provider failed');
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
      expect(mockMessageWriter.lastStoredMessage?.type).toBe('system');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty command providers array', () => {
      const emptyDispatcher = new CommandDispatcherService([], mockMessageWriter);
      const commands = emptyDispatcher.getCommands();
      
      expect(commands).toHaveLength(1); // Only help command
      expect(commands[0].name).toBe('help');
    });
    
    it('should handle commands with no arguments', async () => {
      await dispatcher.execute('init', []);
      
      expect(mockProvider1.executeCalled).toBe(true);
      expect(mockProvider1.lastArgs).toEqual([]);
    });
    
    it('should handle commands with empty args array', async () => {
      await dispatcher.execute('init', []);
      
      expect(mockProvider1.executeCalled).toBe(true);
      expect(mockProvider1.lastArgs).toEqual([]);
    });
    
    it('should handle multiple providers with same command name gracefully', async () => {
      // Add same command to both providers
      mockProvider1.mockCommands.push({ name: 'shared', description: 'Shared command' });
      mockProvider2.mockCommands.push({ name: 'shared', description: 'Also shared command' });
      
      // Should route to first provider that supports it
      await dispatcher.execute('shared', []);
      
      expect(mockProvider1.executeCalled).toBe(true);
      expect(mockProvider2.executeCalled).toBe(false);
    });
  });
  
  describe('Integration', () => {
    it('should work end-to-end with realistic scenario', async () => {
      // Execute a command
      mockProvider1.mockResult = { success: true, message: 'Project initialized successfully' };
      
      const result = await dispatcher.execute('init', ['my-app', '--template=react']);
      
      // Verify command execution
      expect(result.success).toBe(true);
      expect(mockProvider1.executeCalled).toBe(true);
      expect(mockProvider1.lastCommand).toBe('init');
      expect(mockProvider1.lastArgs).toEqual(['my-app', '--template=react']);
      
      // Verify message storage
      expect(mockMessageWriter.storeMessageCalled).toBe(true);
      expect(mockMessageWriter.lastStoredMessage?.content).toBe('Project initialized successfully');
      expect(mockMessageWriter.lastStoredMessage?.type).toBe('system');
      expect(mockMessageWriter.lastStoredMessage?.timestamp).toBeInstanceOf(Date);
      
      // Verify commands are aggregated
      const commands = dispatcher.getCommands();
      expect(commands.length).toBeGreaterThan(1);
      expect(dispatcher.supports('init')).toBe(true);
    });
  });
});