# Aider Sandbox

[![Build](https://github.com/soodoku/bubblewrap/actions/workflows/build.yml/badge.svg)](https://github.com/soodoku/bubblewrap/actions/workflows/build.yml)
[![Security Tests](https://github.com/soodoku/bubblewrap/actions/workflows/security-tests.yml/badge.svg)](https://github.com/soodoku/bubblewrap/actions/workflows/security-tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A secure sandboxing wrapper for [Aider](https://github.com/paul-gauthier/aider) AI coding agent with cross-platform support (Linux + macOS), inspired by Claude Code's sandboxing approach.

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

### Prerequisites

```bash
# Linux: Install bubblewrap
sudo apt-get install bubblewrap  # Debian/Ubuntu
sudo dnf install bubblewrap      # Fedora
sudo pacman -S bubblewrap        # Arch

# macOS: sandbox-exec is included by default (no installation needed)
which sandbox-exec  # Verify it's available

# Install Aider
pip install aider-chat

# Install this package
npm install
npm run build
```

## Quick Start

### CLI Usage

```bash
# Run Aider with a message in sandbox mode
npm run sandbox -- run "Add error handling to the login function" -f src/auth.ts

# Start interactive mode
npm run sandbox -- interactive -f src/app.ts

# Execute a command in the sandbox
npm run sandbox -- exec ls -la
```

### Programmatic Usage

```typescript
import { AiderWrapper } from 'aider-sandbox';

// Create a sandboxed Aider instance
const aider = new AiderWrapper(process.cwd(), {
  model: 'gpt-4',
  autoCommit: false,
});

// Set up event handlers for permission requests
aider.on('permission-required', (data) => {
  console.log(`Permission requested: ${data.type} for ${data.resource}`);
  // User approves or denies
  data.approve(); // or data.deny()
});

aider.on('network-approval-required', (data) => {
  console.log(`Network access requested to: ${data.domain}`);
  data.approve(); // or data.deny()
});

// Initialize the sandbox
await aider.initialize();

// Run Aider with a message
const result = await aider.runMessage(
  'Add validation to the user input',
  ['src/validator.ts']
);

console.log(result.stdout);

// Clean up
await aider.shutdown();
```

## Architecture

```
┌─────────────────────────────────────────────┐
│ Aider AI Agent                              │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│ Sandbox Manager                             │
│ - Permission system                         │
│ - Domain allowlist/blocklist                │
│ - Filesystem path restrictions              │
└─────────┬───────────────────┬───────────────┘
          │                   │
┌─────────▼──────────┐ ┌─────▼──────────────┐
│ Filesystem Sandbox │ │ Network Proxy      │
│ (bubblewrap)       │ │ (Unix socket)      │
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
import { SandboxManager, PermissionType } from 'aider-sandbox';

const sandbox = new SandboxManager(process.cwd(), {
  allowedDomains: ['*.example.com', 'api.myservice.com'],
  blockedDomains: ['evil.com'],
  requireApprovalForNewDomains: false,
});

// Enable auto-approval for file reads
sandbox.setAutoApprove([PermissionType.FILESYSTEM_READ]);

await sandbox.initialize();
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

| Feature | Claude Code | Aider Sandbox |
|---------|-------------|---------------|
| Filesystem Isolation | ✓ | ✓ |
| Network Proxy | ✓ | ✓ |
| Permission System | ✓ | ✓ |
| Sensitive Path Protection | ✓ | ✓ |
| Platform | Linux/macOS | Linux/macOS |
| Implementation | Proprietary | Open Source |
| Automated Testing | Unknown | GitHub Actions (both platforms) |

## Examples

See the [examples](./examples) directory for more usage examples:
- [Basic Usage](./examples/basic.ts)
- [Custom Configuration](./examples/custom-config.ts)
- [Permission Handling](./examples/permissions.ts)

## Contributing

Contributions welcome! Please read our contributing guidelines.

## License

MIT

## Acknowledgments

- Inspired by [Anthropic's Claude Code sandboxing approach](https://www.anthropic.com/research/claude-code-sandboxing)
- Built for [Aider](https://github.com/paul-gauthier/aider) by Paul Gauthier
- Uses [bubblewrap](https://github.com/containers/bubblewrap) for Linux sandboxing
- Uses [sandbox-exec](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AppSandboxDesignGuide/) for macOS sandboxing

## Security Disclosure

If you discover a security vulnerability, please email security@example.com instead of using the issue tracker.
