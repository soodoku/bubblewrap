/**
 * Enhanced types for granular filesystem and network control
 */

export interface FilesystemIsolation {
  // Read permissions
  allowRead: string[];
  denyRead: string[];

  // Write permissions
  allowWrite: string[];
  denyWrite: string[];

  // Delete permissions (separate from write for granular control)
  allowDelete: string[];
  denyDelete: string[];

  // Execute permissions
  allowExecute: string[];
  denyExecute: string[];
}

export interface NetworkIsolation {
  // Domain-based filtering
  allowedDomains: string[];
  blockedDomains: string[];

  // IP-based filtering
  allowedIPs: string[];
  blockedIPs: string[];

  // Port-based filtering
  allowedPorts: number[];
  blockedPorts: number[];

  // Protocol restrictions
  allowedProtocols: ('http' | 'https' | 'ws' | 'wss' | 'ftp' | 'ssh')[];

  // Localhost/loopback control
  allowLocalhost: boolean;
  allowLoopback: boolean;

  // Network namespace isolation
  isolateNetwork: boolean;
}

export interface SandboxPolicy {
  filesystem: FilesystemIsolation;
  network: NetworkIsolation;

  // Process controls
  maxProcesses?: number;
  allowedCommands?: string[];
  blockedCommands?: string[];

  // Resource limits
  maxMemory?: string; // e.g., "512M"
  maxCPU?: number; // percentage
  maxDiskWrite?: string; // e.g., "1G"
}

/**
 * Preset policies for common use cases
 */
export const SANDBOX_PRESETS = {
  // Most restrictive - for untrusted code
  MAXIMUM_SECURITY: {
    filesystem: {
      allowRead: ['.'],
      denyRead: ['~/.ssh', '~/.aws', '~/.gnupg', '/etc'],
      allowWrite: ['.'],
      denyWrite: ['~/.ssh', '~/.aws', '~/.gnupg', '/etc'],
      allowDelete: ['.'],
      denyDelete: ['~/.ssh', '~/.aws', '~/.gnupg', '/etc', '.git'],
      allowExecute: [],
      denyExecute: ['rm', 'dd', 'mkfs', 'fdisk'],
    },
    network: {
      allowedDomains: [],
      blockedDomains: ['*'],
      allowedIPs: [],
      blockedIPs: ['*'],
      allowedPorts: [],
      blockedPorts: [22, 23, 3389], // Block SSH, Telnet, RDP
      allowedProtocols: ['https'],
      allowLocalhost: false,
      allowLoopback: false,
      isolateNetwork: true,
    },
  },

  // Default for AI coding assistants
  CODING_ASSISTANT: {
    filesystem: {
      allowRead: ['.', '/usr', '/lib', '/etc/ssl'],
      denyRead: ['~/.ssh', '~/.aws', '~/.gnupg', '~/.kube', '~/.docker'],
      allowWrite: ['.'],
      denyWrite: ['~/.ssh', '~/.aws', '~/.gnupg', '/etc'],
      allowDelete: ['.'],
      denyDelete: ['~/.ssh', '~/.aws', '.git/config'],
      allowExecute: ['/usr/bin', '/bin'],
      denyExecute: ['rm -rf /', 'mkfs'],
    },
    network: {
      allowedDomains: [
        'github.com',
        '*.githubusercontent.com',
        'npmjs.com',
        'pypi.org',
        'api.openai.com',
        'api.anthropic.com',
      ],
      blockedDomains: [],
      allowedIPs: [],
      blockedIPs: [],
      allowedPorts: [80, 443, 8080, 3000, 5000], // Common dev ports
      blockedPorts: [22, 23, 3389], // Block remote access
      allowedProtocols: ['http', 'https', 'ws', 'wss'],
      allowLocalhost: true, // Allow for local dev servers
      allowLoopback: true,
      isolateNetwork: false,
    },
  },

  // For reading/reviewing code only
  READ_ONLY: {
    filesystem: {
      allowRead: ['.', '/usr', '/lib'],
      denyRead: ['~/.ssh', '~/.aws', '~/.gnupg'],
      allowWrite: [],
      denyWrite: ['*'],
      allowDelete: [],
      denyDelete: ['*'],
      allowExecute: [],
      denyExecute: ['*'],
    },
    network: {
      allowedDomains: [],
      blockedDomains: ['*'],
      allowedIPs: [],
      blockedIPs: ['*'],
      allowedPorts: [],
      blockedPorts: ['*'],
      allowedProtocols: [],
      allowLocalhost: false,
      allowLoopback: false,
      isolateNetwork: true,
    },
  },

  // For local development with network access
  DEVELOPMENT: {
    filesystem: {
      allowRead: ['.', '/usr', '/lib', '/tmp'],
      denyRead: ['~/.ssh', '~/.aws', '~/.gnupg'],
      allowWrite: ['.', '/tmp'],
      denyWrite: ['~/.ssh', '~/.aws', '/etc'],
      allowDelete: ['.', '/tmp'],
      denyDelete: ['~/.ssh', '~/.aws', '.git'],
      allowExecute: ['/usr/bin', '/bin', '.'],
      denyExecute: ['rm -rf /', 'dd'],
    },
    network: {
      allowedDomains: ['*'],
      blockedDomains: [],
      allowedIPs: [],
      blockedIPs: [],
      allowedPorts: [],
      blockedPorts: [22, 23], // Only block SSH/Telnet
      allowedProtocols: ['http', 'https', 'ws', 'wss'],
      allowLocalhost: true,
      allowLoopback: true,
      isolateNetwork: false,
    },
  },
} as const;
