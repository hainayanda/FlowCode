import {
    AsyncControl,
    AsyncControlResponse,
} from '../../../common/models/async-control';
import {
    formatMergedFileOperations,
    mergeFileOperations,
} from '../../../common/utils/diff-utils';
import { generateUniqueId } from '../../../common/utils/id-generator';
import {
    ErrorMessage,
    FileOperationMessage,
    Message,
} from '../../stores/models/messages';
import {
    Tool,
    Toolbox,
    ToolboxPromptSource,
    ToolCallParameter,
    ToolDefinition,
    ToolPromptSource,
} from '../interfaces/toolbox';
import { AppendFileTool } from './tools/append-file-tool';
import { DeleteFileTool } from './tools/delete-file-tool';
import { InsertFileTool } from './tools/insert-file-tool';
import { ReadFileTool } from './tools/read-file-tool';
import { ReplaceAllFileTool } from './tools/replace-all-file-tool';
import { ReplaceFileTool } from './tools/replace-file-tool';
import { ReplaceFirstFileTool } from './tools/replace-first-file-tool';
import { SearchFileTool } from './tools/search-file-tool';

/**
 * Toolbox for file operations and content manipulation.
 *
 * Provides a comprehensive set of file manipulation tools with permission management.
 * Handles reading, writing, editing, and regex-based operations on files with proper
 * line-based pagination and content management.
 */
export class FileToolbox implements Toolbox, ToolboxPromptSource {
    private underlyingTools: Tool[];

    constructor() {
        this.underlyingTools = [
            new AppendFileTool(),
            new DeleteFileTool(),
            new InsertFileTool(),
            new ReadFileTool(),
            new ReplaceAllFileTool(),
            new ReplaceFileTool(),
            new ReplaceFirstFileTool(),
            new SearchFileTool(),
        ];
    }

    /**
     * Gets the available file tools with their definitions.
     *
     * @returns Array of tool definitions including parameters, permissions, and descriptions
     */
    get tools(): ToolDefinition[] {
        return this.underlyingTools.map((tool) => tool.definition);
    }

    /**
     * Executes a file tool with the provided parameters.
     *
     * @param parameter - Tool call parameters including name and arguments
     * @returns AsyncGenerator yielding messages and returning execution response
     * @throws Yields error messages for unknown tools or permission denials
     */
    async *callTool(
        parameter: ToolCallParameter
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        const tool = this.underlyingTools.find(
            (t) => t.definition.name === parameter.name
        );
        if (!tool) {
            const errorMessage: ErrorMessage = {
                id: generateUniqueId('error'),
                content: `Unknown tool: ${parameter.name}`,
                type: 'error',
                sender: 'file-toolbox',
                timestamp: new Date(),
                metadata: {
                    error: new Error(`Tool not found: ${parameter.name}`),
                },
            };
            yield errorMessage;
            return {
                messages: [errorMessage],
                completedReason: 'completed',
                usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 1 },
            };
        }
        return yield* tool.call(parameter);
    }

    /**
     * Executes multiple file tools, grouping file operations for batched permission requests.
     *
     * @param parameters - Array of tool call parameters
     * @returns AsyncGenerator yielding messages and returning execution response
     */
    async *callTools(
        parameters: ToolCallParameter[]
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
        if (parameters.length === 0) {
            return this.createEmptyResponse();
        }

        if (parameters.length === 1) {
            const firstParam = parameters[0];
            if (firstParam) {
                return yield* this.callTool(firstParam);
            }
        }

        const { fileOperations, otherTools } =
            this.groupToolParameters(parameters);
        const {
            allMessages,
            totalInputTokens,
            totalOutputTokens,
            totalToolsUsed,
        } = yield* this.executeOtherTools(otherTools);

        if (fileOperations.length === 0) {
            return this.createUsageResponse(
                allMessages,
                totalInputTokens,
                totalOutputTokens,
                totalToolsUsed
            );
        }

        const { fileOpMessages, fileOpUsage } =
            await this.executeFileOperations(fileOperations);
        yield* this.yieldFileOperationMessages(
            fileOpMessages.fileOperationMessages
        );

        allMessages.push(...fileOpMessages.errorMessages);
        allMessages.push(...fileOpMessages.fileOperationMessages);

        return this.createUsageResponse(
            allMessages,
            totalInputTokens + fileOpUsage.inputTokens,
            totalOutputTokens + fileOpUsage.outputTokens,
            totalToolsUsed + fileOpUsage.toolsUsed
        );
    }

    /**
     * Groups tool parameters into file operations and other tools.
     */
    private groupToolParameters(parameters: ToolCallParameter[]): {
        fileOperations: ToolCallParameter[];
        otherTools: ToolCallParameter[];
    } {
        const fileOperationTools = [
            'append_file',
            'delete_at_line',
            'insert_at_line',
            'replace_at_line',
            'replace_all',
            'replace_first',
        ];
        return {
            fileOperations: parameters.filter((p) =>
                fileOperationTools.includes(p.name)
            ),
            otherTools: parameters.filter(
                (p) => !fileOperationTools.includes(p.name)
            ),
        };
    }

    /**
     * Executes non-file-operation tools sequentially, yielding their messages.
     */
    private async *executeOtherTools(
        otherTools: ToolCallParameter[]
    ): AsyncGenerator<
        Message,
        {
            allMessages: Message[];
            totalInputTokens: number;
            totalOutputTokens: number;
            totalToolsUsed: number;
        },
        AsyncControl
    > {
        const allMessages: Message[] = [];
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalToolsUsed = 0;

        for (const param of otherTools) {
            const result = yield* this.callTool(param);
            allMessages.push(...result.messages);
            totalInputTokens += result.usage.inputTokens;
            totalOutputTokens += result.usage.outputTokens;
            totalToolsUsed += result.usage.toolsUsed;
        }

        return {
            allMessages,
            totalInputTokens,
            totalOutputTokens,
            totalToolsUsed,
        };
    }

    /**
     * Executes file operations and collects their results without yielding individual messages.
     */
    private async executeFileOperations(
        fileOperations: ToolCallParameter[]
    ): Promise<{
        fileOpMessages: {
            fileOperationMessages: FileOperationMessage[];
            errorMessages: ErrorMessage[];
        };
        fileOpUsage: {
            inputTokens: number;
            outputTokens: number;
            toolsUsed: number;
        };
    }> {
        const fileOperationMessages: FileOperationMessage[] = [];
        const errorMessages: ErrorMessage[] = [];
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalToolsUsed = 0;

        for (const param of fileOperations) {
            const toolResult = await this.executeToolSilently(param);

            if (
                toolResult.messages.length > 0 &&
                toolResult.messages[0]?.type === 'error'
            ) {
                errorMessages.push(
                    ...(toolResult.messages.filter(
                        (m) => m.type === 'error'
                    ) as ErrorMessage[])
                );
            } else {
                const fileOpMessage = toolResult.messages.find(
                    (m) => m.type === 'file_operation'
                ) as FileOperationMessage;
                if (fileOpMessage) {
                    fileOperationMessages.push(fileOpMessage);
                }
            }

            totalInputTokens += toolResult.usage.inputTokens;
            totalOutputTokens += toolResult.usage.outputTokens;
            totalToolsUsed += toolResult.usage.toolsUsed;
        }

        return {
            fileOpMessages: { fileOperationMessages, errorMessages },
            fileOpUsage: {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                toolsUsed: totalToolsUsed,
            },
        };
    }

    /**
     * Executes a tool and consumes all its yielded messages without yielding them.
     */
    private async executeToolSilently(
        param: ToolCallParameter
    ): Promise<AsyncControlResponse> {
        const toolGenerator = this.callTool(param);
        let toolResult: AsyncControlResponse;
        let done = false;

        while (!done) {
            const next = await toolGenerator.next();
            if (next.done) {
                toolResult = next.value;
                done = true;
            }
            // Intentionally ignore intermediate messages - they are consumed silently
        }

        return toolResult!;
    }

    /**
     * Yields file operation messages (single or batch summary).
     */
    private async *yieldFileOperationMessages(
        fileOperationMessages: FileOperationMessage[]
    ): AsyncGenerator<Message, void, AsyncControl> {
        if (fileOperationMessages.length === 0) {
            return;
        }

        if (fileOperationMessages.length === 1 && fileOperationMessages[0]) {
            yield fileOperationMessages[0];
        } else {
            const summaryMessage = this.createBatchSummaryMessage(
                fileOperationMessages
            );
            yield summaryMessage;
        }
    }

    /**
     * Creates a summary message for batch file operations.
     * Merges file operations by file and creates a formatted diff message.
     */
    private createBatchSummaryMessage(
        fileOperationMessages: FileOperationMessage[]
    ): FileOperationMessage {
        // Merge file operations and create formatted message
        const mergedOperations = mergeFileOperations(fileOperationMessages);
        const formattedContent = formatMergedFileOperations(mergedOperations);

        return {
            id: generateUniqueId('file-operation'),
            content: formattedContent,
            type: 'file_operation',
            sender: 'file-toolbox',
            timestamp: new Date(),
            metadata: {
                filePath: 'batch-operation',
                diffs: fileOperationMessages.flatMap(
                    (msg) => msg.metadata.diffs
                ),
            },
        };
    }

    /**
     * Creates an empty response for when no tools are provided.
     */
    private createEmptyResponse(): AsyncControlResponse {
        return {
            messages: [],
            completedReason: 'completed',
            usage: { inputTokens: 0, outputTokens: 0, toolsUsed: 0 },
        };
    }

    /**
     * Creates a usage response with the provided metrics.
     */
    private createUsageResponse(
        messages: Message[],
        inputTokens: number,
        outputTokens: number,
        toolsUsed: number
    ): AsyncControlResponse {
        return {
            messages,
            completedReason: 'completed',
            usage: { inputTokens, outputTokens, toolsUsed },
        };
    }

    /**
     * Generates a batch permission prompt for multiple loose permission file tools.
     * @param parameters - Array of tool call parameters for loose permission tools
     * @returns A human-readable prompt asking for permission to execute these file operations
     */
    getBatchLoosePermissionPrompt(parameters: ToolCallParameter[]): string {
        // Filter out tools with 'none' permission - they don't need permission prompts
        const toolsNeedingPermission = parameters.filter((p) => {
            const tool = this.underlyingTools.find(
                (t) => t.definition.name === p.name
            );
            return tool && tool.definition.permission !== 'none';
        });

        if (toolsNeedingPermission.length === 0) {
            return 'Allow agent to perform file operations?';
        }

        if (toolsNeedingPermission.length === 1 && toolsNeedingPermission[0]) {
            // Single tool, delegate to individual prompt
            return this.getPermissionPrompt(toolsNeedingPermission[0]);
        }

        // Multiple tools - categorize operations (only those needing permission)
        const readOps = toolsNeedingPermission.filter((p) =>
            ['read_file', 'search_file'].includes(p.name)
        );
        const writeOps = toolsNeedingPermission.filter(
            (p) => !['read_file', 'search_file'].includes(p.name)
        );

        const parts: string[] = [];

        if (readOps.length > 0) {
            parts.push(
                `read ${readOps.length} file${readOps.length > 1 ? 's' : ''}`
            );
        }

        if (writeOps.length > 0) {
            parts.push(
                `modify ${writeOps.length} file${writeOps.length > 1 ? 's' : ''}`
            );
        }

        if (parts.length === 0) {
            return 'Allow agent to perform file operations?';
        }

        return `Allow agent to ${parts.join(' and ')}?`;
    }

    /**
     * Generates a permission prompt for an individual file tool by delegating to the underlying tool.
     * @param parameter - The tool call parameters for context
     * @returns A human-readable prompt asking for permission to execute this file tool
     */
    getPermissionPrompt(parameter: ToolCallParameter): string {
        // Delegate to the underlying tool if it implements ToolPromptSource
        const tool = this.underlyingTools.find(
            (t) => t.definition.name === parameter.name
        );
        if (tool && this.implementsToolPromptSource(tool)) {
            return tool.getPermissionPrompt(parameter);
        }

        // Generic fallback prompt for tools that don't implement ToolPromptSource
        const filePath = parameter.parameters?.['filePath'] as string;
        const fileName = filePath ? ` "${filePath}"` : '';
        return `Allow agent to perform ${parameter.name} operation${fileName}?`;
    }

    /**
     * Type guard to check if a tool implements ToolPromptSource.
     */
    private implementsToolPromptSource(
        tool: Tool
    ): tool is Tool & ToolPromptSource {
        return typeof (tool as any).getPermissionPrompt === 'function';
    }
}
