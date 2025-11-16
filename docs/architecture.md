---
layout: default
title: Architecture
---

# Architecture

## Overview

Bubblewrap uses a multi-layered security architecture inspired by [Anthropic's Claude Code sandboxing approach](https://www.anthropic.com/research/claude-code-sandboxing).

## System Diagram

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

## Core Components

### 1. CommandWrapper

Entry point for executing commands in the sandbox.

**Responsibilities:**
- Accept command and arguments
- Initialize sandbox environment
- Coordinate with SandboxManager
- Handle events and approvals
- Return execution results

### 2. SandboxManager

Orchestrates all security components.

**Responsibilities:**
- Manage filesystem sandbox
- Control network proxy
- Coordinate permission system
- Execute commands with full isolation
- Lifecycle management

### 3. Filesystem Sandbox

Platform-specific filesystem isolation.

**Linux (bubblewrap):**
```bash
bwrap --unshare-all \
      --share-net \
      --ro-bind /usr /usr \
      --bind $PWD $PWD \
      --die-with-parent \
      -- <command>
```

**macOS (sandbox-exec):**
```scheme
(version 1)
(allow default)
(deny file-write*
  (subpath "/")
  (literal "/etc/passwd"))
(allow file-write*
  (subpath "/working/directory"))
```

### 4. Network Proxy

Controls all network access via Unix socket.

**Flow:**
1. Proxy listens on `/tmp/bubblewrap-proxy.sock`
2. Sandboxed process uses `HTTP_PROXY=unix:///tmp/bubblewrap-proxy.sock`
3. Proxy validates domain against allowlist/blocklist
4. If not approved, requests user permission
5. Forwards approved requests to destination

### 5. Permission Manager

Centralized permission approval system.

**Permission Types:**
- `fs:read` - File system reads
- `fs:write` - File system writes
- `net:access` - Network access
- `proc:spawn` - Process spawning

**Flow:**
1. Component requests permission
2. Check auto-approval rules
3. If not auto-approved, emit event
4. Wait for user decision
5. Grant or deny based on response
6. Cache decision (time-limited)

## Execution Flow

### Command Execution

```
User calls execute()
        ↓
CommandWrapper validates input
        ↓
SandboxManager checks permissions
        ↓
PermissionManager approves/denies
        ↓
[If approved]
        ↓
FilesystemSandbox builds isolation
        ↓
NetworkProxy configured
        ↓
Command executed in isolation
        ↓
Results captured and returned
        ↓
Cleanup and resource release
```

### Network Request Flow

```
Sandboxed process makes HTTP request
        ↓
Request intercepted by Unix socket proxy
        ↓
NetworkProxy extracts domain
        ↓
Check allowlist ──Yes──> Forward to destination
        │                         ↓
        No                  Return response
        ↓
Check blocklist ──Yes──> Deny request
        │
        No
        ↓
Require user approval? ──No──> Forward request
        │
        Yes
        ↓
Emit approval-required event
        ↓
Wait for user decision
        ↓
[If approved] Forward request
[If denied] Return error
```

## Security Layers

### Layer 1: Permission System
User approval before sensitive operations

### Layer 2: Filesystem Sandbox
OS-level namespace isolation

### Layer 3: Network Proxy
Domain filtering and approval

### Layer 4: Path Validation
Block access to sensitive files

### Layer 5: Resource Limits
CPU, memory, and time quotas

## Platform Differences

### Linux
- Uses bubblewrap for namespaces
- Full isolation support
- Mature, well-tested

### macOS
- Uses sandbox-exec with Seatbelt profiles
- Good isolation, some limitations
- Native macOS tool

### Windows
- Not currently supported
- Could use WSL2 + Linux approach
- Or Windows App Containers (complex)

## Performance

| Operation | Overhead | Notes |
|-----------|----------|-------|
| Permission check | <1ms | Cached after first approval |
| Sandbox spawn | 5-10ms | OS-dependent |
| Network proxy | 2-5ms | Per request |
| Total | ~10-20ms | Per command |

## Extension Points

### Custom Sandboxes

```typescript
class CustomSandbox extends FilesystemSandbox {
  protected buildSandboxArgs() {
    // Custom implementation
  }
}
```

### Custom Proxies

```typescript
class CustomProxy extends NetworkProxy {
  handleCustomProtocol(socket: Socket) {
    // Handle non-HTTP protocols
  }
}
```

### Tool-Specific Wrappers

```typescript
class MyToolWrapper extends CommandWrapper {
  async runMyTool(args: string[]) {
    return this.execute(['mytool', ...args]);
  }
}
```

## Future Enhancements

- Windows support via WSL2
- SSH and git:// protocol support
- eBPF-based filtering for zero overhead
- Distributed sandboxing
- AI-driven policy learning

## References

- [Anthropic Claude Code Sandboxing](https://www.anthropic.com/research/claude-code-sandboxing)
- [bubblewrap](https://github.com/containers/bubblewrap)
- [Linux Namespaces](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [macOS Sandbox](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AppSandboxDesignGuide/)
