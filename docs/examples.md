---
layout: default
title: Examples
---

# Examples

## Basic Command Execution

Execute any command safely:

```bash
# List files
sandbox exec ls -la

# Run Python script
sandbox exec python script.py

# Run Node.js app
sandbox exec node app.js

# Execute with environment variables
sandbox exec env VAR=value python script.py
```

## AI Coding Assistants

### Aider

```bash
# Run with a message
sandbox aider run "Add error handling to login function" -f src/auth.ts

# Interactive mode
sandbox aider interactive -f src/app.ts

# With specific model
sandbox aider run "Refactor this code" -f src/utils.ts -m gpt-4
```

### code-puppy

```bash
# Run with a prompt
sandbox code-puppy run "Implement user authentication" -f src/auth.ts

# With Claude
sandbox code-puppy run "Add tests" -f src/app.ts -m claude-3-5-sonnet -p anthropic
```

## Development Tools

### npm

```bash
# Run tests
sandbox npm test

# Install packages
sandbox npm install package-name

# Run custom scripts
sandbox npm run build
```

### git

```bash
# Check status
sandbox git status

# View diff
sandbox git diff

# Commit (if approved)
sandbox git commit -m "message"
```

## Programmatic Usage

### Basic Wrapper

```typescript
import { CommandWrapper } from 'bubblewrap';

const wrapper = new CommandWrapper({
  workingDir: process.cwd(),
});

// Setup event handlers
wrapper.on('permission-required', (data) => {
  console.log(`Requesting ${data.type} for ${data.resource}`);
  data.approve();
});

await wrapper.initialize();

// Execute command
const result = await wrapper.execute(['ls', '-la']);
console.log(result.stdout);

await wrapper.shutdown();
```

### With Custom Configuration

```typescript
import { CommandWrapper } from 'bubblewrap';

const wrapper = new CommandWrapper({
  workingDir: process.cwd(),
  autoApproveRead: true,
  autoApproveWrite: false,
  allowedDomains: ['github.com', 'npmjs.com'],
  blockedDomains: ['evil.com'],
  cpuLimit: 2,
  memoryLimit: 1024,
});

await wrapper.initialize();

// Execute multiple commands
for (const cmd of ['npm test', 'npm run build']) {
  const result = await wrapper.execute(cmd.split(' '));
  console.log(result.stdout);
}

await wrapper.shutdown();
```

### Using Tool-Specific Wrappers

```typescript
import { AiderWrapper, GenericToolWrapper } from 'bubblewrap';

// Aider wrapper
const aider = new AiderWrapper({
  workingDir: process.cwd(),
  model: 'gpt-4',
  autoCommit: false,
});

await aider.initialize();
await aider.runMessage('Add validation', ['src/validator.ts']);
await aider.shutdown();

// Generic tool wrapper with convenience methods
const tool = new GenericToolWrapper({
  workingDir: process.cwd(),
  autoApproveRead: true,
});

await tool.initialize();
await tool.runNpm('test');
await tool.runGit(['status']);
await tool.runPython('script.py', ['--arg', 'value']);
await tool.shutdown();
```

### Advanced: Multiple Approvers

```typescript
import { CommandWrapper } from 'bubblewrap';

const wrapper = new CommandWrapper({
  workingDir: process.cwd(),
});

// Create approval queue
const approvals = new Map();

wrapper.on('permission-required', async (data) => {
  // Store approval request
  approvals.set(data.id, data);

  // Notify all clients (e.g., via websocket)
  notifyClients({
    type: 'approval-request',
    data: {
      id: data.id,
      type: data.type,
      resource: data.resource,
    },
  });
});

// Handle approval from any client
function handleApproval(id: string, approved: boolean) {
  const data = approvals.get(id);
  if (data) {
    approved ? data.approve() : data.deny();
    approvals.delete(id);
  }
}
```

### Integration with Express.js

```typescript
import express from 'express';
import { CommandWrapper } from 'bubblewrap';

const app = express();

app.post('/execute', async (req, res) => {
  const { command, args } = req.body;

  const wrapper = new CommandWrapper({
    workingDir: '/tmp/sandbox',
    autoApproveRead: true,
    autoApproveWrite: false,
  });

  try {
    await wrapper.initialize();
    const result = await wrapper.execute([command, ...args]);
    res.json({
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    await wrapper.shutdown();
  }
});

app.listen(3000);
```

## See Also

- [API Reference](./api-reference.md)
- [Security Guide](./security.md)
- [GitHub Examples](https://github.com/soodoku/bubblewrap/tree/main/examples)
