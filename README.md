# Bubblewrap

[![Build](https://github.com/soodoku/bubblewrap/actions/workflows/build.yml/badge.svg)](https://github.com/soodoku/bubblewrap/actions/workflows/build.yml)
[![Security Tests](https://github.com/soodoku/bubblewrap/actions/workflows/security-tests.yml/badge.svg)](https://github.com/soodoku/bubblewrap/actions/workflows/security-tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A secure, generic sandboxing wrapper for **any** AI coding assistant or command-line tool. Works with [Aider](https://github.com/paul-gauthier/aider), [code-puppy](https://github.com/code-puppy/code-puppy), Cursor, Copilot, or any other tool. Cross-platform support (Linux + macOS), inspired by [Claude Code's sandboxing approach](https://www.anthropic.com/research/claude-code-sandboxing).

**Tested on:** Linux (Ubuntu) ✓ | macOS ✓ | Windows ✗

## Features

- **Filesystem Isolation**: Uses bubblewrap (Linux) or sandbox-exec (macOS) to restrict file access to working directory only
- **Cross-Platform**: Works on both Linux and macOS with platform-specific sandboxing
- **Network Proxy**: Routes all network traffic through a controlled proxy with domain allowlisting
- **Permission System**: User approval required for sensitive operations
- **Sensitive Path Protection**: Automatically blocks access to:
  - SSH keys (`~/.ssh`)
  - AWS credentials (`~/.aws`)
  - Google Cloud credentials (`~/.config/gcloud`)
  - Kubernetes config (`~/.kube`)
  - GPG keys (`~/.gnupg`)
  - Docker credentials (`~/.docker`)
- **Minimal Overhead**: ~5-10ms per command execution

## Installation

### From npm (recommended)

```bash
npm install -g bubblewrap
# or
npm install bubblewrap
```

### From source

```bash
git clone https://github.com/soodoku/bubblewrap.git
cd bubblewrap
npm install
npm run build
npm link  # Optional: for global CLI access
```

### Prerequisites

```bash
# Linux: Install bubblewrap
sudo apt-get install bubblewrap  # Debian/Ubuntu
sudo dnf install bubblewrap      # Fedora
sudo pacman -S bubblewrap        # Arch

# macOS: sandbox-exec is included by default (no installation needed)
which sandbox-exec  # Verify it's available

# Install your preferred AI coding assistant (optional)
pip install aider-chat        # For Aider
npm install -g code-puppy     # For code-puppy
# or use Cursor, Copilot, etc.
```

## Quick Start

### CLI Usage

```bash
# Execute any command in the sandbox
sandbox exec ls -la
sandbox exec python script.py
sandbox exec node app.js

# Run Aider with a message (if installed)
sandbox aider run "Add error handling to the login function" -f src/auth.ts

# Run code-puppy (if installed)
sandbox code-puppy run "Implement user authentication" -f src/auth.ts

# Run npm/git commands in sandbox
sandbox npm test
sandbox git status

# Or use the safe-code CLI
safe-code exec your-command
```

### Installed Globally

If you installed globally with `npm install -g bubblewrap`, use:

```bash
sandbox exec <command>
safe-code exec <command>
```

### Local Installation

If installed locally, use via npm scripts or npx:

```bash
npx sandbox exec <command>
# or add to package.json scripts
```

### Programmatic Usage

#### Generic Command Wrapper (Works with ANY tool)

```typescript
import { CommandWrapper } from 'bubblewrap';

// Create a sandboxed command wrapper
const wrapper = new CommandWrapper({
  workingDir: process.cwd(),
  autoApproveRead: false,
  autoApproveWrite: false,
});

// Set up event handlers for permission requests
wrapper.on('permission-required', (data) => {
  console.log(`Permission requested: ${data.type} for ${data.resource}`);
  data.approve(); // or data.deny()
});

wrapper.on('network-approval-required', (data) => {
  console.log(`Network access requested to: ${data.domain}`);
  data.approve(); // or data.deny()
});

// Initialize the sandbox
await wrapper.initialize();

// Execute any command
const result = await wrapper.execute(['python', 'script.py']);
console.log(result.stdout);

// Clean up
await wrapper.shutdown();
```

#### Tool-Specific Wrappers (Optional Convenience)

```typescript
import { AiderWrapper, CodePuppyWrapper, GenericToolWrapper } from 'bubblewrap';

// For Aider
const aider = new AiderWrapper({
  workingDir: process.cwd(),
  model: 'gpt-4',
  autoCommit: false,
});
await aider.initialize();
await aider.runMessage('Add validation', ['src/validator.ts']);
await aider.shutdown();

// For code-puppy
const codePuppy = new CodePuppyWrapper({
  workingDir: process.cwd(),
  model: 'claude-3-5-sonnet',
  provider: 'anthropic',
});
await codePuppy.initialize();
await codePuppy.runPrompt('Implement auth', ['src/auth.ts']);
await codePuppy.shutdown();

// Generic tool wrapper with convenience methods
const tool = new GenericToolWrapper({ workingDir: process.cwd() });
await tool.initialize();
await tool.runNpm('test');
await tool.runGit(['status']);
await tool.shutdown();
```

## Architecture

```
┌─────────────────────────────────────────────┐
│ Any Tool (Aider, code-puppy, npm, git...)  │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│ CommandWrapper / SandboxManager             │
│ - Permission system                         │
│ - Domain allowlist/blocklist                │
│ - Filesystem path restrictions              │
└─────────┬───────────────────┬───────────────┘
          │                   │
┌─────────▼──────────┐ ┌─────▼──────────────┐
│ Filesystem Sandbox │ │ Network Proxy      │
│ (bubblewrap/macOS) │ │ (Unix socket)      │
│                    │ │                    │
│ - Unshare all      │ │ - Domain filter    │
│ - Bind mounts      │ │ - User approval    │
│ - Read-only /usr   │ │ - Traffic logging  │
└────────────────────┘ └────────────────────┘
```

## Security Features

### Filesystem Isolation

Uses Linux namespaces via bubblewrap to:
- Restrict write access to working directory only
- Block access to sensitive files (SSH keys, cloud credentials)
- Mount system directories as read-only
- Isolate process tree

### Network Control

- All network traffic routed through Unix socket proxy
- Domain allowlisting (github.com, npmjs.com, pypi.org by default)
- User approval required for new domains
- Blocked domain list support

### Permission Management

- Granular permission types:
  - `fs:read` - Read file access
  - `fs:write` - Write file access
  - `net:access` - Network access
  - `proc:spawn` - Process execution
- Time-limited permissions (1 hour default)
- Auto-approval configuration
- Permission revocation

## Configuration

### Default Configuration

```typescript
{
  workingDir: process.cwd(),
  allowedReadPaths: ['/usr', '/lib', '/lib64', '/bin', '/etc/ssl'],
  allowedWritePaths: [process.cwd()],
  deniedPaths: [
    '~/.ssh',
    '~/.aws',
    '~/.config/gcloud',
    '~/.gnupg',
    '~/.kube',
    '~/.docker',
    '/etc/passwd',
    '/etc/shadow',
    '/etc/sudoers',
  ],
  enableNetworkProxy: true,
  allowedDomains: [
    'github.com',
    'raw.githubusercontent.com',
    'npmjs.com',
    'pypi.org',
    'registry.npmjs.org',
    'api.github.com',
  ],
  requireApprovalForNewDomains: true,
}
```

### Custom Configuration

```typescript
import { SandboxManager, CommandWrapper, PermissionType } from 'bubblewrap';

// Using SandboxManager directly
const sandbox = new SandboxManager(process.cwd(), {
  allowedDomains: ['*.example.com', 'api.myservice.com'],
  blockedDomains: ['evil.com'],
  requireApprovalForNewDomains: false,
});

// Enable auto-approval for file reads
sandbox.setAutoApprove([PermissionType.FILESYSTEM_READ]);
await sandbox.initialize();

// Or using CommandWrapper with custom config
const wrapper = new CommandWrapper({
  workingDir: process.cwd(),
  allowedDomains: ['github.com', 'npmjs.com'],
  autoApproveRead: true,
  autoApproveWrite: false,
});
await wrapper.initialize();
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Security Tests

The test suite includes security validation:
- ✓ Blocks access to SSH keys
- ✓ Blocks access to AWS credentials
- ✓ Blocks access to GCloud credentials
- ✓ Allows access to working directory
- ✓ Network traffic routes through proxy
- ✓ Permission system enforces approvals

## Performance

Based on testing:
- Command execution overhead: **~5-10ms**
- Memory overhead: **~2-5MB**
- Permission check latency: **<1ms**

## Limitations

### Platform Support
- **Linux**: Full support with bubblewrap ✓
- **macOS**: Full support with sandbox-exec ✓
- **Windows**: Not supported (would need WSL2 or App Containers)

### Interactive Mode
Interactive Aider sessions bypass some sandbox protections for usability. Use non-interactive mode for maximum security.

### Network Proxy
- Unix socket proxy currently supports HTTP/HTTPS
- Some protocols may not be fully supported
- DNS resolution happens outside sandbox

## Comparison with Claude Code

This implementation is inspired by [Claude Code's sandboxing approach](https://www.anthropic.com/research/claude-code-sandboxing):

| Feature | Claude Code | Bubblewrap |
|---------|-------------|------------|
| Filesystem Isolation | ✓ | ✓ |
| Network Proxy | ✓ | ✓ |
| Permission System | ✓ | ✓ |
| Sensitive Path Protection | ✓ | ✓ |
| Platform | Linux/macOS | Linux/macOS |
| Tool Support | Claude only | Any tool (Aider, code-puppy, etc.) |
| Implementation | Proprietary | Open Source |
| Automated Testing | Unknown | GitHub Actions (both platforms) |
| Resource Limiting | Unknown | CPU/RAM limits ✓ |

## Documentation

Full documentation is available at: **https://soodoku.github.io/bubblewrap/**

- [Getting Started](https://soodoku.github.io/bubblewrap/getting-started.html)
- [API Reference](https://soodoku.github.io/bubblewrap/api-reference.html)
- [Security Guide](https://soodoku.github.io/bubblewrap/security.html)
- [Examples](https://soodoku.github.io/bubblewrap/examples.html)
- [Architecture](https://soodoku.github.io/bubblewrap/architecture.html)

## Examples

See the [examples](./examples) directory for more usage examples:
- [Generic Command](./examples/generic-command.ts) - Run any command in sandbox
- [Tool Wrappers](./examples/tool-wrappers.ts) - Use convenience wrappers
- [Basic Usage](./examples/basic.ts) - Aider-specific example
- [Custom Configuration](./examples/custom-config.ts) - Advanced config
- [Permission Handling](./examples/permissions.ts) - Permission system

## Contributing

Contributions welcome! Please read our contributing guidelines.

## License

MIT

## Use Cases

- **AI Coding Assistants**: Run Aider, code-puppy, or similar tools safely
- **CI/CD Pipelines**: Sandbox untrusted build scripts
- **Code Review**: Execute untrusted code changes in isolation
- **Development**: Test tools without risking your system
- **Education**: Teach coding in a safe environment

## Acknowledgments

- Inspired by [Anthropic's Claude Code sandboxing approach](https://www.anthropic.com/research/claude-code-sandboxing)
- Works great with [Aider](https://github.com/paul-gauthier/aider), [code-puppy](https://github.com/code-puppy/code-puppy), and other AI coding assistants
- Uses [bubblewrap](https://github.com/containers/bubblewrap) for Linux sandboxing
- Uses [sandbox-exec](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AppSandboxDesignGuide/) for macOS sandboxing

## Security Disclosure

If you discover a security vulnerability, please open a GitHub issue or contact the maintainers directly.
