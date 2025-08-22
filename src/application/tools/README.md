# Tools Architecture

This directory contains the tool system that provides AI agents with capabilities to interact with files and workspaces.

## Structure

- **Permission System**
  - `tool-with-permission.ts` - Base tool wrapper with permission checking
  - `toolbox-with-permission.ts` - Toolbox wrapper with permission management

- **File Operations**
  - `file/file-toolbox.ts` - Comprehensive file manipulation toolbox
  - `file/tools/` - Individual file operation tools:
    - `append-file-tool.ts` - Append content to files
    - `delete-file-tool.ts` - Delete files and directories
    - `insert-file-tool.ts` - Insert content at specific positions
    - `read-file-tool.ts` - Read file contents
    - `replace-all-file-tool.ts` - Replace all occurrences in files
    - `replace-file-tool.ts` - Replace file content sections
    - `replace-first-file-tool.ts` - Replace first occurrence in files
    - `search-file-tool.ts` - Search file contents with patterns

- **Workspace Tools**
  - `workspace/workspace-toolbox.ts` - Workspace-level operations

- **Core Abstractions**
  - `interfaces/` - Tool and toolbox interface definitions

## Key Concepts

- **Permission-Based Access**: All tools check user permissions before execution
- **Toolbox Pattern**: Tools are organized into logical groups (file, workspace)
- **Granular Tool Design**: Each file operation is a separate tool for fine-grained permission control
- **Tool Composition**: Individual tools are composed into toolboxes for logical grouping
- **Permission Wrapper Pattern**: Tools are wrapped with permission checking capabilities
- **Workspace Context**: Tools understand and operate within workspace boundaries
- **Safe Operations**: Built-in safeguards prevent dangerous file operations
