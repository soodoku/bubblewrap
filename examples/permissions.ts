/**
 * Example demonstrating the permission system
 */

import { PermissionManager, PermissionType } from '../src/index.js';

async function main() {
  const manager = new PermissionManager();

  // Track permission events
  manager.on('granted', (data) => {
    console.log(`✓ Granted: ${data.type} for ${data.resource}`);
  });

  manager.on('denied', (data) => {
    console.log(`✗ Denied: ${data.type} for ${data.resource}`);
  });

  manager.on('revoked', (data) => {
    console.log(`⚠ Revoked: ${data.type} for ${data.resource}`);
  });

  // Set auto-approve for safe operations
  console.log('Configuring auto-approval...');
  manager.setAutoApprove([
    PermissionType.FILESYSTEM_READ,
  ]);

  // Test auto-approved permission
  console.log('\n1. Testing auto-approved permission...');
  const canRead = await manager.request(
    PermissionType.FILESYSTEM_READ,
    'package.json',
    'Read package.json to check dependencies'
  );
  console.log(`Result: ${canRead ? 'Approved' : 'Denied'}`);

  // Test manual permission (simulated)
  console.log('\n2. Testing manual permission...');
  manager.on('approval-required', (data) => {
    console.log(`\n🔐 Approval Required:`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Resource: ${data.resource}`);
    console.log(`   Details: ${data.details}`);
    console.log('   User decision: Approved');
    data.approve();
  });

  const canWrite = await manager.request(
    PermissionType.FILESYSTEM_WRITE,
    'output.txt',
    'Write results to output.txt'
  );
  console.log(`Result: ${canWrite ? 'Approved' : 'Denied'}`);

  // Check permission status
  console.log('\n3. Checking permission status...');
  console.log(
    `Can read package.json: ${manager.check(
      PermissionType.FILESYSTEM_READ,
      'package.json'
    )}`
  );
  console.log(
    `Can write output.txt: ${manager.check(
      PermissionType.FILESYSTEM_WRITE,
      'output.txt'
    )}`
  );

  // Revoke a permission
  console.log('\n4. Revoking permission...');
  manager.revoke(PermissionType.FILESYSTEM_WRITE, 'output.txt');
  console.log(
    `Can write output.txt: ${manager.check(
      PermissionType.FILESYSTEM_WRITE,
      'output.txt'
    )}`
  );

  // Get all permissions
  console.log('\n5. All active permissions:');
  const all = manager.getAll();
  all.forEach((p) => {
    console.log(
      `   - ${p.type}: ${p.resource} (${p.permanent ? 'permanent' : 'temporary'})`
    );
  });

  // Clear all permissions
  console.log('\n6. Clearing all permissions...');
  manager.clear();
  console.log(`Active permissions: ${manager.getAll().length}`);
}

main();
