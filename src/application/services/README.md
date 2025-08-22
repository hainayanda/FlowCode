# Services Architecture

This directory contains application services that provide high-level business logic and coordinate between different system components.

## Structure

- **Core Services**
  - `embedder-service.ts` - Text embedding generation and management
  - `session-service.ts` - Session lifecycle and conversation management
  - `web-browser-service.ts` - Web browsing and content extraction

- **Service Interfaces**
  - `interfaces/` - Service contract definitions

## Key Concepts

- **Service Layer**: Orchestrates business logic between stores, agents, and external APIs
- **Session Management**: Handles conversation state, context switching, and memory
- **Embedding Pipeline**: Manages text vectorization for semantic search
- **Web Integration**: Provides controlled web browsing capabilities for agents
- **Dependency Injection**: Services depend on interfaces, not concrete implementations
