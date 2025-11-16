/**
 * Example with custom sandbox configuration
 */

import { SandboxManager, PermissionType } from '../src/index.js';

async function main() {
  // Create sandbox with custom configuration
  const sandbox = new SandboxManager(process.cwd(), {
    // Custom allowed domains
    allowedDomains: [
      'github.com',
      '*.githubusercontent.com',
      'npmjs.com',
      'pypi.org',
      'api.openai.com',
      'api.anthropic.com',
    ],

    // Blocked domains
    blockedDomains: [
      'suspicious-site.com',
      'malware-domain.net',
    ],

    // Don't require approval for known domains
    requireApprovalForNewDomains: true,

    // Additional allowed read paths
    allowedReadPaths: [
      '/usr',
      '/lib',
      '/lib64',
      '/etc/ssl',
      '/home/user/shared-data', // Custom shared path
    ],

    // Additional denied paths
    deniedPaths: [
      '/home/user/.ssh',
      '/home/user/.aws',
      '/home/user/.config/gcloud',
      '/home/user/sensitive-project', // Custom denied path
    ],
  });

  // Enable auto-approval for filesystem reads
  // This reduces permission prompts significantly
  sandbox.setAutoApprove([
    PermissionType.FILESYSTEM_READ,
  ]);

  // Set up event listeners
  sandbox.on('permission-required', (data) => {
    console.log(`🔐 Permission required: ${data.type} for ${data.resource}`);
    // You would show a UI prompt here
    data.approve();
  });

  sandbox.on('network-approval-required', (data) => {
    console.log(`🌐 Network access requested: ${data.domain}`);
    // You would show a UI prompt here
    data.approve();
  });

  sandbox.on('command-executed', (data) => {
    console.log(`⚡ Executed: ${data.command.join(' ')}`);
    console.log(`   Exit code: ${data.result.exitCode}`);
    console.log(`   Duration: ${data.result.duration}ms`);
  });

  try {
    console.log('🔒 Initializing sandbox with custom config...');
    await sandbox.initialize();
    console.log('✓ Sandbox initialized\n');

    // Test file read permission
    console.log('Testing filesystem access...');
    const canReadPackage = sandbox.canRead('package.json');
    const canReadSsh = sandbox.canRead('/home/user/.ssh/id_rsa');

    console.log(`Can read package.json: ${canReadPackage ? '✓' : '✗'}`);
    console.log(`Can read SSH key: ${canReadSsh ? '✗ (good!)' : '✓'}`);

    // Execute a safe command
    console.log('\nExecuting command in sandbox...');
    const result = await sandbox.executeCommand(['echo', 'Hello from sandbox!']);
    console.log(`Output: ${result.stdout.trim()}`);

    // Try to access a denied path (should fail)
    console.log('\nTrying to access denied path...');
    const deniedResult = await sandbox.executeCommand([
      'cat',
      '/home/user/.ssh/id_rsa',
    ]);

    if (deniedResult.exitCode !== 0) {
      console.log('✓ Access correctly denied to .ssh/id_rsa');
    }

  } catch (error) {
    console.error('Error:', (error as Error).message);
  } finally {
    await sandbox.shutdown();
    console.log('\n🔒 Sandbox shut down');
  }
}

main();
