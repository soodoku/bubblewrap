---
layout: default
title: Security Guide
---

# Security Guide

## Overview

Bubblewrap implements defense-in-depth security using multiple layers of protection.

## Security Layers

### 1. Filesystem Isolation

Uses OS-level sandboxing:

- **Linux**: bubblewrap with namespaces
- **macOS**: sandbox-exec with profiles

**Protection:**

- Working directory is the only writable location
- System directories mounted read-only
- Sensitive paths automatically blocked

**Blocked Paths:**

- `~/.ssh` - SSH keys
- `~/.aws` - AWS credentials
- `~/.config/gcloud` - Google Cloud credentials
- `~/.gnupg` - GPG keys
- `~/.kube` - Kubernetes config
- `~/.docker` - Docker credentials
- `/etc/passwd`, `/etc/shadow`, `/etc/sudoers`

### 2. Network Control

All network traffic routes through a controlled proxy.

**Features:**

- Domain allowlisting
- Domain blocklisting
- User approval for new domains
- Request logging

**Default Allowed Domains:**

- github.com
- raw.githubusercontent.com
- npmjs.com
- registry.npmjs.org
- pypi.org
- api.github.com

### 3. Permission System

Granular permission types with user approval:

- `fs:read` - File reads
- `fs:write` - File writes
- `net:access` - Network access
- `proc:spawn` - Process execution

**Features:**

- Auto-approval configuration
- Time-limited permissions (1 hour default)
- Permission revocation
- Event-driven approval flow

### 4. Resource Limiting

CPU and memory limits to prevent resource exhaustion:

```typescript
const wrapper = new CommandWrapper({
  cpuLimit: 2,        // Max 2 CPU cores
  memoryLimit: 1024,  // Max 1GB RAM
});
```

## Best Practices

### For Development

1. **Use read auto-approval** for convenience:

```typescript
const wrapper = new CommandWrapper({
  autoApproveRead: true,
  autoApproveWrite: false,  // Still require approval for writes
});
```

2. **Allowlist trusted domains**:

```typescript
const wrapper = new CommandWrapper({
  allowedDomains: ['github.com', 'npmjs.com', 'myapi.com'],
  requireApprovalForNewDomains: true,
});
```

### For Production/CI

1. **Disable all auto-approval**:

```typescript
const wrapper = new CommandWrapper({
  autoApproveRead: false,
  autoApproveWrite: false,
});
```

2. **Use strict domain allowlist**:

```typescript
const wrapper = new CommandWrapper({
  allowedDomains: ['github.com'],
  blockedDomains: ['*'],  // Block all others
  requireApprovalForNewDomains: false,
});
```

3. **Set resource limits**:

```typescript
const wrapper = new CommandWrapper({
  cpuLimit: 1,
  memoryLimit: 512,
  timeout: 300000,  // 5 minutes
});
```

## Threat Model

### What We Protect Against ✓

- Accidental credential exposure
- Unauthorized file access outside working directory
- Malicious network connections
- Data exfiltration
- System file tampering

### What We DON'T Protect Against ✗

- Malicious code within working directory
- Kernel exploits
- Side-channel attacks
- Advanced persistent threats targeting the sandbox itself

## Performance

Typical overhead per command:

- Permission check: <1ms
- Sandbox spawn: 5-10ms
- Network proxy: 2-5ms
- **Total: ~10-20ms** per command

## Security Disclosure

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Open a GitHub Security Advisory
3. Or contact maintainers directly

## Compliance

Bubblewrap helps meet security requirements for:

- Code review processes
- CI/CD pipeline security
- Untrusted code execution
- Educational environments
- Defense-in-depth strategies
