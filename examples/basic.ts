/**
 * Basic usage example for Aider Sandbox
 */

import { AiderWrapper } from '../src/index.js';

async function main() {
  // Create a sandboxed Aider instance
  const aider = new AiderWrapper(process.cwd(), {
    model: 'gpt-4',
    autoCommit: false,
  });

  // Handle permission requests
  aider.on('permission-required', (data) => {
    console.log(`\n🔐 Permission Request:`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Resource: ${data.resource}`);
    console.log(`   Details: ${data.details || 'N/A'}`);

    // For this example, auto-approve all requests
    // In production, you'd want user interaction here
    console.log(`   ✓ Approved\n`);
    data.approve();
  });

  // Handle network approval requests
  aider.on('network-approval-required', (data) => {
    console.log(`\n🌐 Network Access Request:`);
    console.log(`   Domain: ${data.domain}`);

    // For this example, approve common domains
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
    await aider.initialize();
    console.log('✓ Sandbox initialized\n');

    // Run Aider with a simple task
    console.log('📝 Running Aider...');
    const result = await aider.runMessage(
      'Add a comment explaining what this file does',
      ['examples/basic.ts']
    );

    console.log('\n--- Output ---');
    console.log(result.stdout);

    if (result.exitCode === 0) {
      console.log('\n✓ Task completed successfully');
    } else {
      console.error(`\n✗ Task failed with exit code ${result.exitCode}`);
      if (result.stderr) {
        console.error(result.stderr);
      }
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
  } finally {
    // Always clean up
    await aider.shutdown();
    console.log('\n🔒 Sandbox shut down');
  }
}

main();
