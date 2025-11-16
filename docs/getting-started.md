---
layout: default
title: Getting Started
---

# Getting Started

## Installation

### From npm (Recommended)

```bash
npm install -g bubblewrap
```

### From Source

```bash
git clone https://github.com/soodoku/bubblewrap.git
cd bubblewrap
npm install
npm run build
npm link
```

### Prerequisites

#### Linux

Install bubblewrap:

```bash
# Debian/Ubuntu
sudo apt-get install bubblewrap

# Fedora
sudo dnf install bubblewrap

# Arch
sudo pacman -S bubblewrap
```

#### macOS

sandbox-exec is included by default:

```bash
which sandbox-exec  # Verify it's available
```

## Basic Usage

### Execute Any Command

```bash
sandbox exec <command> [args...]
```

Examples:

```bash
sandbox exec ls -la
sandbox exec python script.py
sandbox exec node app.js
```

### Run AI Coding Assistants

```bash
# Aider
sandbox aider run "Add error handling to login" -f src/auth.ts

# code-puppy
sandbox code-puppy run "Implement authentication" -f src/auth.ts
```

### Common Commands

```bash
# npm commands
sandbox npm test
sandbox npm install package-name

# git commands
sandbox git status
sandbox git diff
```

## Programmatic Usage

```typescript
import { CommandWrapper } from 'bubblewrap';

const wrapper = new CommandWrapper({
  workingDir: process.cwd(),
  autoApproveRead: false,
});

wrapper.on('permission-required', (data) => {
  console.log(`Permission requested: ${data.type}`);
  data.approve(); // or data.deny()
});

await wrapper.initialize();
const result = await wrapper.execute(['ls', '-la']);
console.log(result.stdout);
await wrapper.shutdown();
```

## Next Steps

- [API Reference](./api-reference.md)
- [Security Guide](./security.md)
- [Examples](./examples.md)
