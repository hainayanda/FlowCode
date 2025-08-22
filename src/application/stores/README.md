# Stores Architecture

This directory contains the data persistence layer with repositories, stores, and data access patterns.

## Structure

- **Repository Layer**
  - `config-repository.ts` - Configuration data persistence
  - `credential-repository.ts` - Secure credential storage
  - `settings-repository.ts` - User settings persistence
  - `token-repository.ts` - API token management
  - `natural-message-repository.ts` - Natural language message storage

- **Store Implementations**
  - `messages/` - Message storage with caching and SQLite backend
  - `vectors/` - Vector embeddings storage with caching
  - `stores-factory.ts` - Factory for creating store instances

- **Core Abstractions**
  - `interfaces/` - Store interface definitions
  - `models/` - Data model definitions

## Key Concepts

- **Repository Pattern**: Abstracts data access behind clean interfaces
- **Caching Strategy**: Two-tier caching with memory and persistent storage
- **SQLite Backend**: Reliable local storage for messages and vectors
- **Factory Pattern**: Centralized store creation and configuration
- **Message Deduplication**: Handles duplicate message IDs for streaming scenarios
- **Vector Storage**: Efficient storage and retrieval of embeddings for semantic search
