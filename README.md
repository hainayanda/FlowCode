# FlowCode

Intelligent CLI that routes your tasks to specialized AI workers using a hybrid configuration approach.

## Quick Start

```bash
# Install
npm install -g flowcode

# Initialize project
flowcode init

# Use FlowCode
flowcode "create user authentication with JWT tokens"
# → Routes to security-worker automatically

# Target specific worker
flowcode --worker ui-worker "create responsive dashboard"
```

## How It Works

FlowCode uses a **Taskmaster** that analyzes your tasks and routes them to specialized **Workers**:

```
User Task → Taskmaster → Best Worker → AI Response
```

### Built-in Workers

- **code-worker**: Write General programming and business logic
- **chore-worker**: Write simple rename, move files, and any chore tasks
- **api-worker**: Write Backend services and REST APIs  
- **ui-worker**: Write Frontend components and interfaces
- **unit-test-worker**: Write Testing and QA automation
- **performance-worker**: Write Optimization and bottlenecks
- **architect-worker**: Write System design and architecture

## Configuration

FlowCode uses a hybrid approach combining structured config with flexible prompts:

```
.flowcode/
├── config.json            # Routing rules and model
├── settings.json          # Flowcode settings
├── TASKMASTER.md          # Project context and custom guidelines
├── code-worker.md         # Custom prompts for each worker
├── security-worker.md    
└── ui-worker.md
```

### Basic Configuration

```json
{
  "version": "1.0",
  "taskmaster": {
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.2,
    "provider": "anthropic"
  },
  "summarizer": {
    "model": "claude-3-5-haiku-20241022",
    "temperature": 0.1,
    "enabled": true,
    "provider": "anthropic"
  },
  "embedding": {
    "model": "text-embedding-3-small",
    "enabled": true,
    "provider": "openai"
  },
  "workers": {
    "code-worker": {
      "description": "General programming and business logic",
      "model": "claude-3-5-sonnet-20241022",
      "provider": "anthropic",
      "enabled": true
    },
    "test-worker": {
      "description": "Testing and quality assurance",
      "model": "claude-3-5-sonnet-20241022",
      "provider": "anthropic",
      "enabled": true
    },
    "ui-worker": {
      "description": "Frontend components and user interfaces",
      "model": "claude-3-5-haiku-20241022",
      "provider": "anthropic",
      "enabled": true
    },
    "security-worker": {
      "description": "Frontend components and user interfaces",
      "model": "claude-3-5-haiku-20241022",
      "provider": "anthropic",
      "enabled": true
    }
  }
}
```

### Basic Settings

```json
"permissions": {
    "allow": [
      "execute_command(command:npm run build)",
      "execute_command(command:npm install)",
      "execute_command(command:npm run start)",
      "execute_command(command:npm run start)",
      "append_to_file(*)", // for any param
    ],
    "deny": [],
}
```

### Global Credentials

```json
{
  "openai": {
    "apiKey": "sk-proj-...",
    "lastUsed": "2025-08-11T06:50:41.652Z"
  },
  "moonshot": {
    "apiKey": "sk-...",
    "lastUsed": "2025-08-11T06:50:41.653Z"
  },
  "anthropic": {
    "apiKey": "sk-ant-...",
    "lastUsed": "2025-08-11T09:44:17.385Z"
  }
}
```

### Custom Worker Prompts

```markdown
<!-- .flowcode/security-worker.md -->
# Security Worker

You are SecurityWorker, an expert in application security.

## Your Expertise
- OWASP Top 10 vulnerabilities and mitigations
- Authentication and authorization patterns
- Cryptography and secure data handling

## Standards
- Never store plaintext passwords
- Use parameterized queries to prevent SQL injection
- Apply principle of least privilege

Always prioritize security over convenience.
```

## Operating Modes

### Flow Mode (Default)

Automatic worker selection with intelligent routing:

```bash
flowcode "optimize database queries"  # → performance-worker
flowcode "create login form"          # → ui-worker
```

### Single Mode  

Direct interaction bypassing routing (no workers):

```bash
flowcode --mode single
flowcode "help me with this code"  # → Direct interaction
```

## Commands

```bash
# Worker management
flowcode workers list
flowcode workers info security-worker
flowcode run --worker security-worker "review this auth code"

# Configuration & routing
flowcode config validate .flowcode/taskmaster.yml
flowcode routing test "create API endpoint" --json
```

## Examples

See [Examples.md](./docs/Examples.md) for complete project configurations including:

- E-commerce platform
- Enterprise SaaS  
- Mobile applications
- Machine learning projects

## Documentation

- **[Configuration.md](./docs/Configuration.md)** - Complete configuration guide
- **[Examples.md](./docs/Examples.md)** - Real-world project examples
- **[Commands.md](./docs/Commands.md)** - CLI commands reference

## Key Features

✅ **Automatic Routing** - Smart task analysis and worker selection  
✅ **Multiple Models** - Support for Anthropic, OpenAI, Moonshot  
✅ **Custom Workers** - Define domain-specific workers  
✅ **Hybrid Config** - Structured YAML + flexible markdown prompts  
✅ **Project Context** - TASKMASTER.md for project-specific knowledge  
✅ **Dual Formats** - YAML for humans, JSON for APIs
