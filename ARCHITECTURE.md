# Architecture Documentation

## Overview

Bubblewrap implements a multi-layered security approach for running **any** command-line tool or AI coding agent safely. This includes Aider, code-puppy, npm, git, or any other CLI tool. The architecture is inspired by [Anthropic's Claude Code sandboxing](https://www.anthropic.com/research/claude-code-sandboxing).

## Core Components

### 1. Filesystem Sandbox (`filesystem-sandbox.ts`)

**Purpose**: Isolate filesystem access using Linux namespaces

**Key Technologies**:
- **bubblewrap**: Setuid sandbox that creates new namespaces
- **Mount namespaces**: Isolate filesystem view
- **PID namespaces**: Isolate process tree

**How it works**:
```typescript
bwrap --unshare-all \           // Create new namespaces
      --share-net \             // Share network (controlled separately)
      --ro-bind /usr /usr \     // Mount /usr read-only
      --bind $PWD $PWD \        // Mount working dir read-write
      --die-with-parent \       // Kill if parent dies
      -- <command>              // Execute command
```

**Security Features**:
- All system directories mounted read-only
- Only working directory has write access
- Sensitive paths (`.ssh`, `.aws`, etc.) automatically blocked
- Path validation before execution

### 2. Network Proxy (`network-proxy.ts`)

**Purpose**: Control all outbound network connections

**Architecture**:
```
Sandboxed Process → Unix Socket → Proxy → Internet
                         ↓
                   Domain Filter
                   Approval System
```

**How it works**:
1. Proxy creates Unix domain socket at `/tmp/bubblewrap-proxy.sock`
2. Sandboxed processes configured with `HTTP_PROXY=unix:///tmp/bubblewrap-proxy.sock`
3. Proxy intercepts all requests, validates domains
4. Approved requests forwarded to actual destination

**Security Features**:
- Domain allowlisting (default: github.com, npmjs.com, pypi.org)
- Domain blocklisting
- User approval for new domains
- Request logging and monitoring

**Limitations**:
- Currently HTTP/HTTPS only
- Some protocols may bypass (SSH, git://, etc.)
- DNS resolution happens outside sandbox

### 3. Permission Manager (`permission-manager.ts`)

**Purpose**: Centralized permission system with user approval

**Permission Types**:
- `fs:read` - Read file access
- `fs:write` - Write file access
- `net:access` - Network access
- `proc:spawn` - Process execution

**How it works**:
```typescript
1. Component requests permission
2. Check if auto-approved
3. If not, emit approval-required event
4. UI handles user interaction
5. Grant or deny permission
6. Cache decision (with expiration)
```

**Features**:
- Auto-approval configuration
- Time-limited permissions (1 hour default)
- Permanent permissions option
- Permission revocation
- Event-driven architecture

### 4. Sandbox Manager (`sandbox-manager.ts`)

**Purpose**: Integrate all components and provide unified interface

**Responsibilities**:
- Initialize filesystem sandbox
- Start network proxy
- Coordinate permission requests
- Execute commands with full sandboxing
- Manage lifecycle (init, shutdown)

**Integration Flow**:
```
User Command
     ↓
SandboxManager.executeCommand()
     ↓
Permission Check (PermissionManager)
     ↓
Filesystem Sandbox (bubblewrap)
     ↓
Network Proxy (if network needed)
     ↓
Command Execution
     ↓
Result + Logging
```

### 5. CommandWrapper (`command-wrapper.ts`)

**Purpose**: Generic wrapper for any command-line tool

**Features**:
- Execute any command in the sandbox
- Permission management integration
- Event system for approvals
- Lifecycle management (init, shutdown)

### 6. Tool-Specific Wrappers (Optional)

**Purpose**: Convenience wrappers for popular tools

**Available Wrappers**:
- `AiderWrapper` - For Aider AI coding assistant
- `CodePuppyWrapper` - For code-puppy
- `GenericToolWrapper` - Convenience methods (npm, git, python, etc.)

**Features**:
- Tool-specific CLI argument building
- Interactive mode support
- Event forwarding
- Simplified API

## Data Flow

### Command Execution Flow

```
┌─────────────────┐
│  User/Agent     │
└────────┬────────┘
         │ executeCommand(['ls', '-la'])
         ↓
┌─────────────────┐
│ SandboxManager  │
└────────┬────────┘
         │ 1. Check permission
         ↓
┌─────────────────┐
│ PermissionMgr   │───→ Auto-approve or
└────────┬────────┘      request user approval
         │ 2. Permission granted
         ↓
┌─────────────────┐
│ FilesystemSbox  │
└────────┬────────┘
         │ 3. Build bwrap args
         ↓
┌─────────────────┐
│   bubblewrap    │
└────────┬────────┘
         │ 4. Execute in isolated environment
         ↓
┌─────────────────┐
│   Command       │
└────────┬────────┘
         │ 5. Return result
         ↓
┌─────────────────┐
│  User/Agent     │
└─────────────────┘
```

### Network Request Flow

```
Sandboxed Process
       │ HTTP request to github.com
       ↓
Unix Socket Proxy
       │ Parse request, extract domain
       ↓
Network Proxy
       │ Check allowlist/blocklist
       ↓
Domain in allowlist? ──No──→ Require approval? ──Yes──→ User Approval
       │                                                       │
       │ Yes                                                  │
       ↓                                                      │
Allowed domains set ←────────────────────────────────────────┘
       │
       ↓
Forward to destination
       │
       ↓
Return response
```

## Security Model

### Threat Model

**What we protect against**:
- ✓ Accidental credential exposure
- ✓ Unauthorized file access
- ✓ Malicious code execution
- ✓ Data exfiltration via network
- ✓ Filesystem tampering outside working dir

**What we DON'T protect against**:
- ✗ Malicious code within working directory
- ✗ Resource exhaustion (CPU, memory, disk)
- ✗ Side-channel attacks
- ✗ Kernel exploits

### Defense in Depth

```
Layer 1: Permission System
  ↓ Approve actions before execution

Layer 2: Filesystem Sandbox
  ↓ Namespace isolation via bubblewrap

Layer 3: Network Proxy
  ↓ Control outbound connections

Layer 4: Path Validation
  ↓ Block sensitive paths

Layer 5: Monitoring & Logging
  ↓ Track all actions
```

## Performance Characteristics

### Overhead Analysis

| Operation | Overhead | Impact |
|-----------|----------|--------|
| Permission check | <1ms | Negligible |
| Bubblewrap spawn | 5-10ms | Low |
| Network proxy | 2-5ms | Low |
| Total per command | ~10-20ms | Acceptable |

### Optimization Strategies

1. **Permission Caching**: Cache approved permissions for 1 hour
2. **Auto-approval**: Pre-approve safe operations (reading files)
3. **Connection Pooling**: Reuse network connections in proxy
4. **Lazy Initialization**: Only start proxy if network needed

## Platform Support

### Linux (Full Support)
- ✓ Filesystem isolation via bubblewrap
- ✓ Network proxy via Unix sockets
- ✓ All features available

### macOS (Partial Support)
- ⚠ Would need sandbox-exec with Seatbelt profiles
- ⚠ Unix socket proxy would work
- ⚠ Requires additional implementation

### Windows (Not Supported)
- ✗ No bubblewrap equivalent
- ⚠ Could use WSL2 with Linux approach
- ⚠ Or App Containers (complex)

## Extension Points

### Adding New Permission Types

```typescript
export enum PermissionType {
  // ... existing types
  DATABASE_ACCESS = 'db:access',
  API_CALL = 'api:call',
}
```

### Custom Network Protocols

```typescript
class CustomProxy extends NetworkProxy {
  handleSSH(client: Socket) {
    // Handle SSH protocol
  }
}
```

### Platform-Specific Sandboxes

```typescript
class MacOSSandbox extends FilesystemSandbox {
  protected buildSandboxArgs() {
    // Use sandbox-exec instead of bwrap
  }
}
```

## Future Enhancements

### Planned Features
1. **Resource Limits**: CPU, memory, disk quotas
2. **macOS Support**: Sandbox-exec integration
3. **Windows Support**: WSL2 or App Container
4. **Advanced Network**: SSH, git:// protocol support
5. **Monitoring Dashboard**: Real-time permission visualization
6. **Policy Engine**: Rule-based auto-approval

### Research Areas
1. **Zero-overhead Sandboxing**: eBPF-based filtering
2. **Hardware Isolation**: SGX enclaves
3. **Distributed Sandboxing**: Remote execution
4. **AI-driven Policies**: Learn user preferences

## References

- [Anthropic Claude Code Sandboxing](https://www.anthropic.com/research/claude-code-sandboxing)
- [Bubblewrap Documentation](https://github.com/containers/bubblewrap)
- [Linux Namespaces](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [macOS Sandbox](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AppSandboxDesignGuide/)
