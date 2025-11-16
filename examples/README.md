# Examples

This directory contains usage examples for Bubblewrap.

## Running Examples

```bash
# Build first
npm run build

# Run an example
npm run dev examples/generic-command.ts
# or
node --loader tsx examples/generic-command.ts
```

## Available Examples

### 1. Generic Command Execution (`generic-command.ts`)

Shows how to run **any** command in the sandbox.

```bash
npm run dev examples/generic-command.ts
```

Examples of running:
- ls, ls -la
- python scripts
- npm commands
- git commands
- Any other CLI tool

### 2. Tool-Specific Wrappers (`tool-wrappers.ts`)

Demonstrates convenience wrappers for common tools:
- `GenericToolWrapper` - npm, git, python, node
- `AiderWrapper` - Aider-specific wrapper
- `CodePuppyWrapper` - code-puppy-specific wrapper

```bash
npm run dev examples/tool-wrappers.ts
```

### 3. Basic Usage (`basic.ts`)

Original example showing Aider-specific usage.

```bash
npm run dev examples/basic.ts
```

Note: Requires Aider to be installed (`pip install aider-chat`).

### 4. Custom Configuration (`custom-config.ts`)

Shows advanced configuration:
- Custom allowed/denied domains
- Custom allowed/denied paths
- Auto-approval settings
- Event listeners

```bash
npm run dev examples/custom-config.ts
```

### 5. Permission Handling (`permissions.ts`)

Demonstrates the permission system:
- Different permission types
- Approval flows
- Time-limited permissions
- Permission revocation

```bash
npm run dev examples/permissions.ts
```

## Example Patterns

### Generic Command Execution

```typescript
import { CommandWrapper } from 'bubblewrap';

const wrapper = new CommandWrapper({ workingDir: process.cwd() });
await wrapper.initialize();
const result = await wrapper.execute(['ls', '-la']);
console.log(result.stdout);
await wrapper.shutdown();
```

### Tool-Specific Wrapper

```typescript
import { GenericToolWrapper } from 'bubblewrap';

const tool = new GenericToolWrapper({ workingDir: process.cwd() });
await tool.initialize();
await tool.runNpm('test');
await tool.runGit(['status']);
await tool.shutdown();
```

### Event Handling

```typescript
wrapper.on('permission-required', (data) => {
  console.log(`Permission: ${data.type} for ${data.resource}`);
  data.approve(); // or data.deny()
});

wrapper.on('network-approval-required', (data) => {
  console.log(`Network: ${data.domain}`);
  data.approve(); // or data.deny()
});
```

## Creating Your Own Example

1. Create a new `.ts` file in this directory
2. Import from `'../src/index.js'`
3. Use CommandWrapper or tool-specific wrappers
4. Handle events (permission-required, network-approval-required)
5. Always call `shutdown()` in finally block

## See Also

- [Main README](../README.md)
- [API Reference](https://soodoku.github.io/bubblewrap/api-reference.html)
- [Documentation](https://soodoku.github.io/bubblewrap/)
