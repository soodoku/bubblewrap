/**
 * Main entry point for the Safe Coding Assistant Sandbox
 * Generic sandboxing for any coding assistant or command-line tool
 */

// Core sandbox components
export { SandboxManager } from './sandbox-manager.js';
export { FilesystemSandbox } from './filesystem-sandbox.js';
export { MacOSSandbox } from './macos-sandbox.js';
export { PlatformSandbox } from './platform-sandbox.js';
export { NetworkProxy } from './network-proxy.js';
export { PermissionManager } from './permission-manager.js';
export { getDefaultConfig, validateConfig } from './config.js';

// Generic command wrapper (use this for any tool)
export { CommandWrapper } from './command-wrapper.js';
export type { CommandWrapperOptions } from './command-wrapper.js';

// Tool-specific wrappers (optional, for convenience)
export { AiderWrapper } from './wrappers/aider.js';
export type { AiderOptions } from './wrappers/aider.js';
export { CodePuppyWrapper } from './wrappers/code-puppy.js';
export type { CodePuppyOptions } from './wrappers/code-puppy.js';
export { GenericToolWrapper } from './wrappers/generic.js';

// Types
export * from './types.js';

// Legacy export for backwards compatibility
export { AiderWrapper as AiderWrapper_Legacy } from './aider-wrapper.js';
