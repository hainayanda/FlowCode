# Agents Architecture

This directory contains the agent system that handles AI model interactions and text processing.

## Structure

- **Base Components**
  - `base-worker.ts` - Abstract base class for all agent workers with common functionality
  - `agent-factory.ts` - Factory for creating agent instances based on configuration
  - `summarizer-worker.ts` - Specialized worker for text summarization tasks

- **Provider-Specific Workers**
  - `anthropic/` - Claude/Anthropic AI integration
  - `azure/` - Azure OpenAI integration  
  - `gemini/` - Google Gemini integration
  - `local/` - Local embedding models (Nomic)
  - `moonshot/` - Moonshot AI integration
  - `openai/` - OpenAI and OpenAI-compatible APIs
  - `openrouter/` - OpenRouter integration
  - `qwen/` - Qwen model integration
  - `together/` - Together AI integration

- **Core Abstractions**
  - `interfaces/` - Agent and factory interface definitions
  - `models/` - Agent model data structures

## Key Concepts

- **Worker Pattern**: Each provider has a worker that implements the base agent interface
- **Factory Pattern**: Factories create configured worker instances for each provider
- **Message Streaming**: All workers support streaming responses via async generators
- **Tool Integration**: Workers can execute tools and handle tool-based workflows
- **Context Management**: Handles conversation context, summarization, and memory limits
