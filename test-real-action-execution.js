const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module.js');
const { ActionsService } = require('./dist/actions/actions.service.js');
const { PrismaService } = require('./dist/prisma.service.js');

async function testRealActionExecution() {
  console.log('🎯 Testing Real Action Execution with Daytona...\n');

  let app;
  try {
    // Create NestJS application
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    console.log('✅ Application context created\n');

    // Get services
    const actionsService = app.get(ActionsService);
    const prismaService = app.get(PrismaService);

    console.log('🏗️  Setting up test data...');

    // Create a test organization
    const testOrg = await prismaService.organization.create({
      data: {
        name: 'Test Organization for Daytona',
      },
    });
    console.log(`✅ Created test organization: ${testOrg.id}`);

    // Create a test tool
    const testTool = await prismaService.tool.create({
      data: {
        name: 'HTTPBin Test Tool',
        baseUrl: 'https://httpbin.org',
        authType: 'none',
        orgId: testOrg.id,
      },
    });
    console.log(`✅ Created test tool: ${testTool.id}`);

    // Create a test action
    const testAction = await prismaService.action.create({
      data: {
        name: 'Get JSON Data',
        key: 'get-json-data',
        method: 'GET',
        endpoint: '/json',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Tolstoy-Daytona-Test/1.0',
        },
        inputSchema: [],
        orgId: testOrg.id,
        toolId: testTool.id,
      },
    });
    console.log(`✅ Created test action: ${testAction.id} (${testAction.key})`);

    console.log('\n🚀 Executing action through ActionsService...');
    const startTime = Date.now();
    
    try {
      const result = await actionsService.executeAction(
        testOrg.id,
        'test-user-123',
        testAction.key,
        {} // No inputs needed for this GET request
      );

      const duration = Date.now() - startTime;
      
      console.log('📊 Action Execution Results:');
      console.log(`   Success: ${result.success ? '✅' : '❌'}`);
      console.log(`   Execution ID: ${result.executionId}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Data Type: ${typeof result.data}`);
      console.log(`   Status Code: ${result.outputs?.statusCode || 'N/A'}`);
      console.log(`   Executed in Sandbox: ${result.outputs?.executedInSandbox ? '✅ YES' : '❌ NO'}`);
      
      if (result.outputs?.sandboxDuration) {
        console.log(`   Sandbox Duration: ${result.outputs.sandboxDuration}ms`);
      }

      if (result.data && typeof result.data === 'object') {
        console.log(`   Response Keys: ${Object.keys(result.data).join(', ')}`);
      }

      // Test successful execution
      if (result.success) {
        console.log('\n✅ Action execution successful!');
        
        if (result.outputs?.executedInSandbox) {
          console.log('🎉 CONFIRMED: HTTP request executed in Daytona sandbox');
          console.log('🔒 Security isolation working correctly');
        } else {
          console.log('⚠️  Action executed via direct HTTP (fallback)');
          console.log('🔧 Check Daytona configuration and connectivity');
        }
      } else {
        console.log('\n❌ Action execution failed');
        console.log('🔧 Investigation needed');
      }

    } catch (actionError) {
      const duration = Date.now() - startTime;
      console.log('\n❌ Action execution threw error:');
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Error: ${actionError.message}`);
      console.log(`   Type: ${actionError.constructor.name}`);
      
      if (duration > 3000) {
        console.log('📊 Long duration suggests Daytona sandbox was attempted');
      }
    }

    // Test 2: Create a simple POST action
    console.log('\n🔄 Testing POST action execution...');
    
    const postAction = await prismaService.action.create({
      data: {
        name: 'Post Test Data',
        key: 'post-test-data',
        method: 'POST',
        endpoint: '/post',
        headers: {
          'Content-Type': 'application/json',
        },
        inputSchema: [
          {
            name: 'message',
            type: 'string',
            required: true,
            description: 'Test message to post',
          }
        ],
        orgId: testOrg.id,
        toolId: testTool.id,
      },
    });

    const postResult = await actionsService.executeAction(
      testOrg.id,
      'test-user-123',
      postAction.key,
      { message: 'Hello from Daytona sandbox test!' }
    );

    console.log('📊 POST Action Results:');
    console.log(`   Success: ${postResult.success ? '✅' : '❌'}`);
    console.log(`   Executed in Sandbox: ${postResult.outputs?.executedInSandbox ? '✅ YES' : '❌ NO'}`);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await prismaService.action.deleteMany({ where: { orgId: testOrg.id } });
    await prismaService.tool.deleteMany({ where: { orgId: testOrg.id } });
    await prismaService.organization.delete({ where: { id: testOrg.id } });
    console.log('✅ Test data cleaned up');

    // Final summary
    console.log('\n🎯 FINAL SUMMARY:');
    console.log('════════════════════════════════════════');
    if (result?.outputs?.executedInSandbox || postResult?.outputs?.executedInSandbox) {
      console.log('✅ SUCCESS: Actions are executing in Daytona sandboxes');
      console.log('🔒 HTTP calls are properly isolated and secure');
      console.log('🎉 Daytona integration is working correctly');
    } else if (result?.success || postResult?.success) {
      console.log('⚠️  PARTIAL: Actions executing but via direct HTTP fallback');
      console.log('🔧 Daytona available but may have connectivity/parsing issues');
      console.log('💡 Check Daytona API credentials and network access');
    } else {
      console.log('❌ FAILURE: Action execution failing');
      console.log('🔧 Check both Daytona configuration and application setup');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (app) {
      await app.close();
      console.log('\n🔄 Application context closed');
    }
  }
}

// Self-executing async function
testRealActionExecution().catch(console.error);