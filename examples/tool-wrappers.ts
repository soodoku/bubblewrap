/**
 * Example using tool-specific wrappers
 * Shows convenience wrappers for common tools
 */

import { GenericToolWrapper, AiderWrapper, CodePuppyWrapper } from '../src/index.js';

async function demonstrateGenericWrapper() {
  console.log('=== Generic Tool Wrapper ===\n');

  const tool = new GenericToolWrapper({
    workingDir: process.cwd(),
    autoApproveRead: true,
  });

  tool.on('permission-required', (data) => {
    console.log(`Permission: ${data.type} - Auto-approved`);
    data.approve();
  });

  await tool.initialize();

  try {
    // npm commands
    console.log('📦 Running npm commands...');
    let result = await tool.runNpm('--version');
    console.log(`npm version: ${result.stdout.trim()}`);

    // git commands
    console.log('\n🔧 Running git commands...');
    result = await tool.runGit(['status', '--short']);
    console.log(result.stdout || 'No changes');

    // Python
    console.log('\n🐍 Running Python...');
    result = await tool.runPython('--version');
    console.log(result.stdout || result.stderr);

    // Node
    console.log('\n🟢 Running Node...');
    result = await tool.runNode('--version');
    console.log(result.stdout.trim());

  } finally {
    await tool.shutdown();
  }
}

async function demonstrateAiderWrapper() {
  console.log('\n\n=== Aider Wrapper ===\n');

  const aider = new AiderWrapper({
    workingDir: process.cwd(),
    model: 'gpt-4',
    autoCommit: false,
    autoApproveRead: true,
  });

  aider.on('permission-required', (data) => {
    console.log(`Aider permission: ${data.type}`);
    data.approve();
  });

  await aider.initialize();

  try {
    console.log('📝 Running Aider (will fail if not installed)...');
    const result = await aider.runMessage(
      'Add a comment to this file',
      ['examples/tool-wrappers.ts']
    );
    console.log(result.stdout || result.stderr);
  } catch (error) {
    console.log(`Note: Aider not installed - ${(error as Error).message}`);
  } finally {
    await aider.shutdown();
  }
}

async function demonstrateCodePuppyWrapper() {
  console.log('\n\n=== Code Puppy Wrapper ===\n');

  const codePuppy = new CodePuppyWrapper({
    workingDir: process.cwd(),
    model: 'claude-3-5-sonnet',
    provider: 'anthropic',
    autoApproveRead: true,
  });

  codePuppy.on('permission-required', (data) => {
    console.log(`code-puppy permission: ${data.type}`);
    data.approve();
  });

  await codePuppy.initialize();

  try {
    console.log('🐕 Running code-puppy (will fail if not installed)...');
    const result = await codePuppy.runPrompt(
      'Add documentation',
      ['examples/tool-wrappers.ts']
    );
    console.log(result.stdout || result.stderr);
  } catch (error) {
    console.log(`Note: code-puppy not installed - ${(error as Error).message}`);
  } finally {
    await codePuppy.shutdown();
  }
}

async function main() {
  try {
    await demonstrateGenericWrapper();
    await demonstrateAiderWrapper();
    await demonstrateCodePuppyWrapper();

    console.log('\n\n✓ Demo complete');
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

main();
