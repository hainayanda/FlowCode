# Common Architecture

This directory contains shared utilities, models, and interfaces used across the entire application.

## Structure

- **Shared Interfaces**
  - `interfaces/` - Core interface definitions (embedder, summarizer)

- **Data Models**
  - `models/` - Common data structures and types
    - `async-control.ts` - Async operation control structures
    - `diff.ts` - Diff and change tracking models
    - `summary.ts` - Text summarization models
    - `web-search.ts` - Web search result models

- **Utility Functions**
  - `utils/` - Shared utility functions
    - `diff-utils.ts` - Text diffing and comparison
    - `flowcode-directory.ts` - Directory path utilities
    - `id-generator.ts` - Unique identifier generation
    - `permission-utils.ts` - Permission checking utilities
    - `vector-similarity.ts` - Vector similarity calculations

## Key Concepts

- **Shared Contracts**: Interfaces that multiple modules depend on
- **Cross-Cutting Utilities**: Functions used throughout the application
- **Data Models**: Common data structures for consistency
- **Permission System**: Centralized permission checking logic
- **Vector Operations**: Reusable vector math for embeddings
