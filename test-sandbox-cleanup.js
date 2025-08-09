const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module.js');
const { DaytonaService } = require('./dist/daytona/daytona.service.js');

async function testSandboxCleanup() {
  console.log('🧪 Testing Sandbox Cleanup and Lifecycle Management\n');

  let app;
  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    const daytonaService = app.get(DaytonaService);

    console.log('📊 Initial Daytona Status:');
    const initialStatus = await daytonaService.getStatus();
    console.log(`  Available: ${initialStatus.available}`);
    console.log(`  Active Sandboxes: ${initialStatus.activeSandboxes}`);

    if (!initialStatus.available) {
      console.log('❌ Daytona not available - cannot test cleanup');
      return;
    }

    console.log('\n🚀 Testing simple HTTP execution...');
    
    const request = {
      url: 'https://httpbin.org/json',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    };

    const result = await daytonaService.executeHttpRequest(request);
    
    console.log('📊 Execution Results:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Executed in Sandbox: ${result.executedInSandbox}`);
    console.log(`  Sandbox ID: ${result.sandboxId || 'N/A'}`);
    console.log(`  Status Code: ${result.statusCode}`);
    console.log(`  Duration: ${result.duration}ms`);

    const finalStatus = await daytonaService.getStatus();
    console.log('\n📊 Final Daytona Status:');
    console.log(`  Available: ${finalStatus.available}`);
    console.log(`  Active Sandboxes: ${finalStatus.activeSandboxes}`);

    if (finalStatus.activeSandboxes === 0) {
      console.log('✅ SUCCESS: Sandbox properly cleaned up!');
    } else {
      console.log(`⚠️  Warning: ${finalStatus.activeSandboxes} sandboxes still active`);
    }

    console.log('\n🎯 Cleanup Test Results:');
    console.log(`✅ Sandbox creation: ${result.executedInSandbox ? 'WORKING' : 'FAILED'}`);
    console.log(`✅ Sandbox execution: ${result.success ? 'WORKING' : 'FAILED'}`);
    console.log(`✅ Sandbox cleanup: ${finalStatus.activeSandboxes === 0 ? 'WORKING' : 'NEEDS INVESTIGATION'}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (app) {
      await app.close();
      console.log('\n🔄 Application closed');
    }
  }
}

testSandboxCleanup().catch(console.error);