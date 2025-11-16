/**
 * Generic command execution example
 * Shows how to run ANY command in the sandbox
 */

import { CommandWrapper } from '../src/index.js';

async function main() {
  // Create a generic command wrapper
  const wrapper = new CommandWrapper({
    workingDir: process.cwd(),
    autoApproveRead: true,  // Auto-approve reads for convenience
    autoApproveWrite: false, // Require approval for writes
  });

  // Handle permission requests
  wrapper.on('permission-required', (data) => {
    console.log(`\n🔐 Permission Request:`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Resource: ${data.resource}`);

    // For this example, auto-approve
    // In production, you'd want user interaction here
    console.log(`   ✓ Approved\n`);
    data.approve();
  });

  // Handle network approval requests
  wrapper.on('network-approval-required', (data) => {
    console.log(`\n🌐 Network Access Request:`);
    console.log(`   Domain: ${data.domain}`);

    // Approve common safe domains
    const safeDomains = ['github.com', 'npmjs.com', 'pypi.org'];
    if (safeDomains.some((d) => data.domain.includes(d))) {
      console.log(`   ✓ Approved (safe domain)\n`);
      data.approve();
    } else {
      console.log(`   ✗ Denied (unknown domain)\n`);
      data.deny();
    }
  });

  try {
    console.log('🔒 Initializing sandbox...');
    await wrapper.initialize();
    console.log('✓ Sandbox initialized\n');

    // Example 1: List files
    console.log('📁 Listing files...');
    let result = await wrapper.execute(['ls', '-la']);
    console.log(result.stdout);

    // Example 2: Run a Python script (if Python is installed)
    console.log('\n🐍 Checking Python version...');
    result = await wrapper.execute(['python3', '--version']);
    console.log(result.stdout || result.stderr);

    // Example 3: Run npm command
    console.log('\n📦 Checking npm version...');
    result = await wrapper.execute(['npm', '--version']);
    console.log(result.stdout);

    // Example 4: Git status
    console.log('\n🔧 Git status...');
    result = await wrapper.execute(['git', 'status', '--short']);
    console.log(result.stdout || 'No changes');

    // Example 5: Environment variables work
    console.log('\n🌍 Checking environment...');
    result = await wrapper.execute(['env']);
    const envLines = result.stdout.split('\n').slice(0, 5);
    console.log(envLines.join('\n') + '\n...');

    console.log('\n✓ All commands executed successfully');
  } catch (error) {
    console.error('Error:', (error as Error).message);
  } finally {
    // Always clean up
    await wrapper.shutdown();
    console.log('\n🔒 Sandbox shut down');
  }
}

main();
