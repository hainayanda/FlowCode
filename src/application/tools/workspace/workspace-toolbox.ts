// import {
//     Toolbox,
//     ToolCallParameter,
//     ToolDefinition,
// } from '../../interfaces/toolbox';
// import { AsyncControl, AsyncControlResponse } from '../../models/async-control';
// import { Message } from '../../models/messages';

// /**
//  * Toolbox for workspace and filesystem operations.
//  *
//  * Provides a complete set of file and directory manipulation tools with permission management.
//  * Handles creation, listing, and existence checking of files and directories in the workspace.
//  */
// export class WorkspaceToolbox implements Toolbox {

//     /**
//      * Gets the available workspace tools with their definitions.
//      *
//      * @returns Array of tool definitions including parameters, permissions, and descriptions
//      */
//     get tools(): ToolDefinition[] {
//         return [
//             {
//                 name: 'list_directory',
//                 description: 'Get list of files and folders in given path',
//                 parameters: {
//                     type: 'object',
//                     properties: {
//                         path: {
//                             type: 'string',
//                             description: 'Directory path to list',
//                         },
//                         includeHidden: {
//                             type: 'boolean',
//                             description: 'Include hidden files and folders',
//                             default: false,
//                         },
//                     },
//                     required: ['path'],
//                 },
//                 permission: 'none',
//             },
//             {
//                 name: 'workspace_path',
//                 description: 'Get current working directory',
//                 parameters: {
//                     type: 'object',
//                     properties: {},
//                     required: [],
//                 },
//                 permission: 'none',
//             },
//             {
//                 name: 'create_file',
//                 description: 'Create new file with optional content',
//                 parameters: {
//                     type: 'object',
//                     properties: {
//                         filePath: {
//                             type: 'string',
//                             description: 'File path to create',
//                         },
//                         content: {
//                             type: 'string',
//                             description: 'Initial file content',
//                             default: '',
//                         },
//                     },
//                     required: ['filePath'],
//                 },
//                 permission: 'loose',
//             },
//             {
//                 name: 'create_directory',
//                 description: 'Create new directory',
//                 parameters: {
//                     type: 'object',
//                     properties: {
//                         directoryPath: {
//                             type: 'string',
//                             description: 'Directory path to create',
//                         },
//                         recursive: {
//                             type: 'boolean',
//                             description: 'Create parent directories if needed',
//                             default: false,
//                         },
//                     },
//                     required: ['directoryPath'],
//                 },
//                 permission: 'loose',
//             },
//             {
//                 name: 'exists',
//                 description: 'Check if file or directory exists',
//                 parameters: {
//                     type: 'object',
//                     properties: {
//                         path: {
//                             type: 'string',
//                             description: 'Path to check',
//                         },
//                     },
//                     required: ['path'],
//                 },
//                 permission: 'none',
//             },
//             {
//                 name: 'search_workspace',
//                 description: 'Search workspace files using regex pattern, returns matching lines with file paths and line numbers',
//                 parameters: {
//                     type: 'object',
//                     properties: {
//                         pattern: {
//                             type: 'string',
//                             description: 'Regex pattern to search for in file contents',
//                         },
//                         filePattern: {
//                             type: 'string',
//                             description: 'Optional glob pattern to filter files (e.g., "*.ts", "**/*.js")',
//                         },
//                         caseSensitive: {
//                             type: 'boolean',
//                             description: 'Whether search should be case sensitive',
//                             default: true,
//                         },
//                         maxResults: {
//                             type: 'number',
//                             description: 'Maximum number of matching lines to return',
//                             default: 100,
//                         },
//                     },
//                     required: ['pattern'],
//                 },
//                 permission: 'none',
//             },
//         ];
//     }

//     /**
//      * Executes a workspace tool with the provided parameters.
//      *
//      * @param parameter - Tool call parameters including name and arguments
//      * @returns AsyncGenerator yielding messages and returning execution response
//      * @throws Yields error messages for unknown tools or permission denials
//      */
//     async *callTool(
//         parameter: ToolCallParameter
//     ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl> {
//     }
// }
