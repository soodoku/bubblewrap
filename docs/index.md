---
layout: default
title: Home
---

# Bubblewrap

A secure, generic sandboxing wrapper for **any** AI coding assistant or command-line tool.

## Quick Links

- [Getting Started](./getting-started.md)
- [API Reference](./api-reference.md)
- [Security Guide](./security.md)
- [Examples](./examples.md)
- [Architecture](./architecture.md)

## Features

- **Filesystem Isolation**: Uses bubblewrap (Linux) or sandbox-exec (macOS) to restrict file access
- **Cross-Platform**: Works on both Linux and macOS
- **Network Proxy**: Routes all network traffic through a controlled proxy
- **Permission System**: User approval required for sensitive operations
- **Universal**: Works with Aider, code-puppy, npm, git, or any CLI tool

## Installation

```bash
npm install -g bubblewrap
```

## Quick Start

```bash
# Execute any command in the sandbox
sandbox exec ls -la

# Run Aider (if installed)
sandbox aider run "Add error handling" -f src/auth.ts

# Run npm commands safely
sandbox npm test
```

## Use Cases

- **AI Coding Assistants**: Run Aider, code-puppy, or similar tools safely
- **CI/CD Pipelines**: Sandbox untrusted build scripts
- **Code Review**: Execute untrusted code changes in isolation
- **Development**: Test tools without risking your system
- **Education**: Teach coding in a safe environment

## GitHub

[View on GitHub](https://github.com/soodoku/bubblewrap)
