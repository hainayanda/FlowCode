import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom, filter, take, toArray, timeout } from 'rxjs';
import { ToolboxService } from '../../../src/application/services/toolbox-service.js';
import { PermissionLevel } from '../../../src/application/interfaces/toolbox.js';
import { DomainOption } from '../../../src/presentation/view-models/console/console-use-case.js';
import {
  MockToolbox,
  MockSettingsStore,
  createTestToolDefinition,
  createTestToolCall
} from './toolbox-service.mocks.js';

describe('ToolboxService', () => {
  let toolboxService: ToolboxService;
  let mockFileToolbox: MockToolbox;
  let mockWorkspaceToolbox: MockToolbox;
  let mockBashToolbox: MockToolbox;
  let mockSettingsStore: MockSettingsStore;

  beforeEach(() => {
    mockFileToolbox = new MockToolbox('file_tools', 'File operations');
    mockWorkspaceToolbox = new MockToolbox('workspace_tools', 'Workspace operations');
    mockBashToolbox = new MockToolbox('bash_tools', 'Bash operations');
    mockSettingsStore = new MockSettingsStore();

    toolboxService = new ToolboxService(
      [mockFileToolbox, mockWorkspaceToolbox, mockBashToolbox],
      mockSettingsStore
    );
  });

  afterEach(() => {
    mockFileToolbox.reset();
    mockWorkspaceToolbox.reset();
    mockBashToolbox.reset();
    mockSettingsStore.reset();
  });

  describe('Initialization', () => {
    it('should initialize with correct id and description', () => {
      expect(toolboxService.id).toBe('toolbox_service');
      expect(toolboxService.description).toBe('Aggregates multiple toolboxes with unified permission handling');
    });

    it('should expose options observable', () => {
      expect(toolboxService.options$).toBeDefined();
    });

    it('should expose messages observable', () => {
      expect(toolboxService.domainMessages$).toBeDefined();
    });
  });

  describe('Tool Aggregation', () => {
    it('should aggregate tools from all toolboxes with prefixed names', () => {
      mockFileToolbox.setTools([
        createTestToolDefinition('append_to_file', 'loose'),
        createTestToolDefinition('read_file', 'none')
      ]);
      
      mockWorkspaceToolbox.setTools([
        createTestToolDefinition('create_file', 'loose'),
        createTestToolDefinition('list_directory', 'none')
      ]);

      const tools = toolboxService.getTools();

      expect(tools).toHaveLength(4);
      expect(tools.map(t => t.name)).toContain('file_tools.append_to_file');
      expect(tools.map(t => t.name)).toContain('file_tools.read_file');
      expect(tools.map(t => t.name)).toContain('workspace_tools.create_file');
      expect(tools.map(t => t.name)).toContain('workspace_tools.list_directory');
    });

    it('should support tools from all toolboxes', () => {
      mockFileToolbox.setTools([createTestToolDefinition('append_to_file')]);
      mockWorkspaceToolbox.setTools([createTestToolDefinition('create_file')]);

      expect(toolboxService.supportsTool('file_tools.append_to_file')).toBe(true);
      expect(toolboxService.supportsTool('workspace_tools.create_file')).toBe(true);
      expect(toolboxService.supportsTool('nonexistent_tools.fake_tool')).toBe(false);
      expect(toolboxService.supportsTool('file_tools.nonexistent_tool')).toBe(false);
    });
  });

  describe('Permission Handling - None Permission', () => {
    it('should execute tools with no permission required immediately', async () => {
      mockFileToolbox.setTools([createTestToolDefinition('read_file', 'none')]);
      mockFileToolbox.setResult({ success: true, data: 'file content' });

      const result = await toolboxService.executeTool(
        createTestToolCall('file_tools.read_file', { filePath: '/test/file.txt' })
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('file content');
      expect(mockFileToolbox.executeToolCalled).toBe(true);
      expect(mockFileToolbox.lastToolCall?.name).toBe('read_file'); // Original name passed to toolbox
      expect(mockSettingsStore.isPermissionAllowedCalled).toBe(false);
    });
  });

  describe('Permission Handling - Loose Permission', () => {
    it('should execute tools with loose permission when already allowed', async () => {
      mockFileToolbox.setTools([createTestToolDefinition('append_to_file', 'loose')]);
      mockFileToolbox.setResult({ success: true, message: 'File updated' });
      mockSettingsStore.setPermissionResult(true);

      const result = await toolboxService.executeTool(
        createTestToolCall('file_tools.append_to_file', { filePath: '/test/file.txt', content: 'new content' })
      );

      expect(result.success).toBe(true);
      expect(mockFileToolbox.executeToolCalled).toBe(true);
      expect(mockSettingsStore.lastCheckedPermission).toBe('file_tools.append_to_file(*)');
    });

    it('should request permission for loose tools when not allowed', async () => {
      mockFileToolbox.setTools([createTestToolDefinition('append_to_file', 'loose')]);
      mockSettingsStore.setPermissionResult(false);

      // Start execution (will be pending for permission)
      const executionPromise = toolboxService.executeTool(
        createTestToolCall('file_tools.append_to_file', { filePath: '/test/file.txt' })
      );

      // Check that options are published
      const option = await firstValueFrom(
        toolboxService.options$.pipe(
          filter(opt => opt !== null),
          take(1)
        )
      ) as DomainOption;

      expect(option.message).toContain('file_tools.append_to_file');
      expect(option.message).toContain('for all future calls');
      expect(option.choices).toEqual(['Allow', 'Deny']);
      expect(option.defaultIndex).toBe(1); // Default to deny

      // User allows the permission
      await toolboxService.respondToPermissionChoice(0);

      const result = await executionPromise;
      expect(result.success).toBe(true);
      expect(mockSettingsStore.writeSettingsCalled).toBe(true);
    });

    it('should deny execution when user denies loose permission', async () => {
      mockFileToolbox.setTools([createTestToolDefinition('append_to_file', 'loose')]);
      mockSettingsStore.setPermissionResult(false);

      const executionPromise = toolboxService.executeTool(
        createTestToolCall('file_tools.append_to_file', { filePath: '/test/file.txt' })
      );

      // Wait for options to be published
      await firstValueFrom(
        toolboxService.options$.pipe(
          filter(opt => opt !== null),
          take(1)
        )
      );

      // User denies the permission
      await toolboxService.respondToPermissionChoice(1);

      const result = await executionPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
      expect(mockFileToolbox.executeToolCalled).toBe(false);
      expect(mockSettingsStore.writeSettingsCalled).toBe(false);
    });
  });

  describe('Permission Handling - Strict Permission', () => {
    it('should generate specific permission patterns for strict tools', async () => {
      mockBashToolbox.setTools([createTestToolDefinition('execute_command', 'strict')]);
      mockSettingsStore.setPermissionResult(false);

      const executionPromise = toolboxService.executeTool(
        createTestToolCall('bash_tools.execute_command', { command: 'npm run build', timeout: 30000 })
      );

      await firstValueFrom(
        toolboxService.options$.pipe(
          filter(opt => opt !== null),
          take(1)
        )
      );

      expect(mockSettingsStore.lastCheckedPermission).toBe(
        'bash_tools.execute_command(command:npm run build, timeout:30000)'
      );

      // User allows
      await toolboxService.respondToPermissionChoice(0);
      await executionPromise;

      expect(mockSettingsStore.writeSettingsCalled).toBe(true);
      expect(mockSettingsStore.lastWrittenSettings?.permissions.allow).toContain(
        'bash_tools.execute_command(command:npm run build, timeout:30000)'
      );
    });
  });

  describe('Permission Handling - Always Permission', () => {
    it('should always request permission and never save for always tools', async () => {
      mockWorkspaceToolbox.setTools([createTestToolDefinition('delete_file_or_directory', 'always')]);
      mockSettingsStore.setPermissionResult(true); // Even if allowed, should still ask

      const executionPromise = toolboxService.executeTool(
        createTestToolCall('workspace_tools.delete_file_or_directory', { path: '/test/file.txt' })
      );

      const option = await firstValueFrom(
        toolboxService.options$.pipe(
          filter(opt => opt !== null),
          take(1)
        )
      ) as DomainOption;

      expect(option.message).toContain('asking every time');
      
      // User allows
      await toolboxService.respondToPermissionChoice(0);
      const result = await executionPromise;

      expect(result.success).toBe(true);
      expect(mockSettingsStore.writeSettingsCalled).toBe(false); // Should not save for 'always'
    });
  });

  describe('Error Handling', () => {
    it('should return error for unknown toolbox', async () => {
      const result = await toolboxService.executeTool(
        createTestToolCall('unknown_toolbox.some_tool')
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Toolbox not found: unknown_toolbox');
    });

    it('should return error for unknown tool in known toolbox', async () => {
      mockFileToolbox.setTools([createTestToolDefinition('read_file')]);

      const result = await toolboxService.executeTool(
        createTestToolCall('file_tools.unknown_tool')
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool not found: unknown_tool in toolbox file_tools');
    });

    it('should handle malformed tool names', async () => {
      await expect(
        toolboxService.executeTool(createTestToolCall('malformed_name'))
      ).rejects.toThrow('Invalid tool name format: malformed_name');
    });
  });

  describe('Tool Name Parsing', () => {
    it('should correctly parse toolbox id and tool name', () => {
      mockFileToolbox.setTools([createTestToolDefinition('nested.tool.name', 'none')]);

      expect(toolboxService.supportsTool('file_tools.nested.tool.name')).toBe(true);
    });
  });

  describe('Permission Response Handling', () => {
    it('should clear options after responding to permission request', async () => {
      mockFileToolbox.setTools([createTestToolDefinition('append_to_file', 'loose')]);
      mockSettingsStore.setPermissionResult(false);

      const executionPromise = toolboxService.executeTool(
        createTestToolCall('file_tools.append_to_file')
      );

      // Options should be published
      await firstValueFrom(
        toolboxService.options$.pipe(
          filter(opt => opt !== null),
          take(1)
        )
      );

      // Respond to permission
      await toolboxService.respondToPermissionChoice(0);
      await executionPromise;

      // Options should be cleared
      const currentOptions = await firstValueFrom(toolboxService.options$);
      expect(currentOptions).toBeNull();
    });

    it('should handle responding to permission when no request is pending', async () => {
      // Should not throw error
      await expect(toolboxService.respondToPermissionChoice(0)).resolves.toBeUndefined();
    });
  });

});