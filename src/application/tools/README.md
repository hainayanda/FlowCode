# Tools Architecture

This directory contains the tool system that provides AI agents with capabilities to interact with files and workspaces.

## Structure

- **Permission System**
  - `tool-with-permission.ts` - Base tool wrapper with permission checking
  - `toolbox-with-permission.ts` - Toolbox wrapper with permission management

- **File Operations**
  - `file/file-toolbox.ts` - File manipulation toolbox
  - `file/tools/` - Individual file operation tools (read, write, search, etc.)

- **Workspace Tools**
  - `workspace/workspace-toolbox.ts` - Workspace-level operations

- **Core Abstractions**
  - `interfaces/` - Tool and toolbox interface definitions

## Key Concepts

- **Permission-Based Access**: All tools check user permissions before execution
- **Toolbox Pattern**: Tools are organized into logical groups (file, workspace)
- **Individual Tools**: Each operation is a separate tool for granular control
- **Workspace Context**: Tools understand and operate within workspace boundaries
- **Safe Operations**: Built-in safeguards prevent dangerous file operations
