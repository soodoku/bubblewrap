---
layout: default
title: API Reference
---

# API Reference

## CommandWrapper

Generic wrapper for executing any command in a sandbox.

### Constructor

```typescript
new CommandWrapper(options: CommandWrapperOptions)
```

**Options:**

- `workingDir: string` - Working directory (default: `process.cwd()`)
- `autoApproveRead: boolean` - Auto-approve file reads (default: `false`)
- `autoApproveWrite: boolean` - Auto-approve file writes (default: `false`)
- `allowedDomains: string[]` - Allowed network domains
- `blockedDomains: string[]` - Blocked network domains

### Methods

#### initialize()

Initialize the sandbox environment.

```typescript
await wrapper.initialize();
```

#### execute(command: string[])

Execute a command in the sandbox.

```typescript
const result = await wrapper.execute(['ls', '-la']);
console.log(result.stdout);
console.log(result.exitCode);
```

**Returns:** `Promise<CommandResult>`

#### shutdown()

Clean up and shut down the sandbox.

```typescript
await wrapper.shutdown();
```

### Events

#### permission-required

Emitted when a permission is needed.

```typescript
wrapper.on('permission-required', (data) => {
  console.log(`Type: ${data.type}`);
  console.log(`Resource: ${data.resource}`);
  data.approve(); // or data.deny()
});
```

#### network-approval-required

Emitted when network access to a new domain is requested.

```typescript
wrapper.on('network-approval-required', (data) => {
  console.log(`Domain: ${data.domain}`);
  data.approve(); // or data.deny()
});
```

## AiderWrapper

Convenience wrapper for Aider.

### Constructor

```typescript
new AiderWrapper(options: AiderOptions)
```

**Options:**

- Inherits all `CommandWrapperOptions`
- `model: string` - AI model to use
- `autoCommit: boolean` - Enable auto-commits

### Methods

#### runMessage(message: string, files: string[])

Run Aider with a message.

```typescript
await aider.runMessage('Add validation', ['src/validator.ts']);
```

## CodePuppyWrapper

Convenience wrapper for code-puppy.

### Constructor

```typescript
new CodePuppyWrapper(options: CodePuppyOptions)
```

**Options:**

- Inherits all `CommandWrapperOptions`
- `model: string` - AI model to use
- `provider: string` - AI provider (openai, anthropic, google)

### Methods

#### runPrompt(prompt: string, files: string[])

Run code-puppy with a prompt.

```typescript
await codePuppy.runPrompt('Implement auth', ['src/auth.ts']);
```

## GenericToolWrapper

Wrapper with convenience methods for common tools.

### Methods

#### runNpm(script: string, args?: string[])

```typescript
await tool.runNpm('test');
await tool.runNpm('install', ['package-name']);
```

#### runGit(args: string[])

```typescript
await tool.runGit(['status']);
await tool.runGit(['commit', '-m', 'message']);
```

#### runPython(script: string, args?: string[])

```typescript
await tool.runPython('script.py', ['--arg', 'value']);
```

#### runNode(script: string, args?: string[])

```typescript
await tool.runNode('app.js');
```

## SandboxManager

Low-level sandbox management (advanced usage).

### Constructor

```typescript
new SandboxManager(workingDir: string, config?: SandboxConfig)
```

### Methods

#### setAutoApprove(permissions: PermissionType[])

Configure auto-approval for specific permission types.

```typescript
sandbox.setAutoApprove([PermissionType.FILESYSTEM_READ]);
```

## Types

### CommandResult

```typescript
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

### PermissionType

```typescript
enum PermissionType {
  FILESYSTEM_READ = 'fs:read',
  FILESYSTEM_WRITE = 'fs:write',
  NETWORK_ACCESS = 'net:access',
  PROCESS_SPAWN = 'proc:spawn'
}
```
