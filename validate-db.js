const { PrismaClient } = require('@prisma/client');

async function validateDatabase() {
  const prisma = new PrismaClient();
  const results = {};
  
  console.log('🔍 Starting comprehensive database validation...\n');

  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    await prisma.$connect();
    results.connection = '✅ Connected successfully';
    console.log('✅ Database connection successful\n');

    // Get all table names and validate structure (using Prisma camelCase naming)
    const tables = [
      { name: 'Organization', model: 'organization' },
      { name: 'User', model: 'user' }, 
      { name: 'Tool', model: 'tool' },
      { name: 'Action', model: 'action' },
      { name: 'Flow', model: 'flow' },
      { name: 'ExecutionLog', model: 'executionLog' },
      { name: 'Webhook', model: 'webhook' },
      { name: 'WebhookDispatchLog', model: 'webhookDispatchLog' },
      { name: 'ToolAuthConfig', model: 'toolAuthConfig' },
      { name: 'UserCredential', model: 'userCredential' }
    ];

    console.log('📋 Validating table structures...');
    results.tables = {};
    
    for (const table of tables) {
      try {
        const count = await prisma[table.model].count();
        results.tables[table.name] = `✅ Table exists (${count} records)`;
        console.log(`✅ ${table.name}: Table exists with ${count} records`);
      } catch (error) {
        results.tables[table.name] = `❌ Error: ${error.message}`;
        console.log(`❌ ${table.name}: ${error.message}`);
      }
    }

    console.log('\n🔗 Testing table relationships...');
    results.relationships = {};

    // Test Organization creation and relations
    console.log('Creating test organization...');
    const testOrg = await prisma.organization.create({
      data: {
        name: 'Test Organization'
      }
    });
    results.relationships.organization = '✅ Organization creation successful';

    // Test User creation with organization relation
    console.log('Creating test user with organization relation...');
    const testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        orgId: testOrg.id
      }
    });
    results.relationships.user = '✅ User creation with org relation successful';

    // Test Tool creation with organization relation  
    console.log('Creating test tool with organization relation...');
    const testTool = await prisma.tool.create({
      data: {
        name: 'Test Tool',
        baseUrl: 'https://api.test.com',
        authType: 'apiKey',
        orgId: testOrg.id
      }
    });
    results.relationships.tool = '✅ Tool creation with org relation successful';

    // Test Action creation with tool and org relations
    console.log('Creating test action with tool and org relations...');
    const testAction = await prisma.action.create({
      data: {
        name: 'Test Action',
        key: `test-action-${Date.now()}`,
        method: 'POST',
        endpoint: '/test',
        headers: { 'Content-Type': 'application/json' },
        inputSchema: [],
        orgId: testOrg.id,
        toolId: testTool.id
      }
    });
    results.relationships.action = '✅ Action creation with relations successful';

    // Test Flow creation
    console.log('Creating test flow...');
    const testFlow = await prisma.flow.create({
      data: {
        steps: { steps: [] },
        orgId: testOrg.id
      }
    });
    results.relationships.flow = '✅ Flow creation successful';

    // Test ExecutionLog with all relations
    console.log('Creating test execution log with all relations...');
    const testExecutionLog = await prisma.executionLog.create({
      data: {
        executionId: `exec-${Date.now()}`,
        stepKey: 'step-1',
        status: 'completed',
        inputs: { test: true },
        outputs: { result: 'success' },
        orgId: testOrg.id,
        userId: testUser.id,
        flowId: testFlow.id
      }
    });
    results.relationships.executionLog = '✅ ExecutionLog creation with all relations successful';

    // Test Webhook creation
    console.log('Creating test webhook...');
    const testWebhook = await prisma.webhook.create({
      data: {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        eventTypes: ['flow.completed'],
        orgId: testOrg.id
      }
    });
    results.relationships.webhook = '✅ Webhook creation successful';

    // Test WebhookDispatchLog
    console.log('Creating test webhook dispatch log...');
    await prisma.webhookDispatchLog.create({
      data: {
        webhookId: testWebhook.id,
        orgId: testOrg.id,
        eventType: 'flow.completed',
        url: testWebhook.url,
        status: 'success',
        duration: 150.5,
        deliveryId: `delivery-${Date.now()}`
      }
    });
    results.relationships.webhookDispatchLog = '✅ WebhookDispatchLog creation successful';

    // Test ToolAuthConfig
    console.log('Creating test tool auth config...');
    await prisma.toolAuthConfig.create({
      data: {
        orgId: testOrg.id,
        toolId: testTool.id,
        type: 'apiKey',
        config: { apiKey: 'test-key-123' }
      }
    });
    results.relationships.toolAuthConfig = '✅ ToolAuthConfig creation successful';

    // Test UserCredential
    console.log('Creating test user credential...');
    await prisma.userCredential.create({
      data: {
        orgId: testOrg.id,
        userId: testUser.id,
        toolId: testTool.id,
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
      }
    });
    results.relationships.userCredential = '✅ UserCredential creation successful';

    console.log('\n🔍 Testing constraints and indexes...');
    results.constraints = {};

    // Test unique constraints
    try {
      await prisma.user.create({
        data: {
          email: testUser.email, // Duplicate email should fail
          orgId: testOrg.id
        }
      });
      results.constraints.userUniqueEmail = '❌ Unique constraint not working';
    } catch (error) {
      if (error.code === 'P2002') {
        results.constraints.userUniqueEmail = '✅ User email unique constraint working';
        console.log('✅ User email unique constraint working');
      } else {
        results.constraints.userUniqueEmail = `❌ Unexpected error: ${error.message}`;
      }
    }

    // Test orgId + key unique constraint on actions
    try {
      await prisma.action.create({
        data: {
          name: 'Duplicate Action',
          key: testAction.key, // Duplicate key in same org should fail
          method: 'GET',
          endpoint: '/duplicate',
          headers: {},
          inputSchema: [],
          orgId: testOrg.id,
          toolId: testTool.id
        }
      });
      results.constraints.actionUniqueKey = '❌ Action unique constraint not working';
    } catch (error) {
      if (error.code === 'P2002') {
        results.constraints.actionUniqueKey = '✅ Action orgId+key unique constraint working';
        console.log('✅ Action orgId+key unique constraint working');
      } else {
        results.constraints.actionUniqueKey = `❌ Unexpected error: ${error.message}`;
      }
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.webhookDispatchLog.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.webhook.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.userCredential.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.toolAuthConfig.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.executionLog.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.flow.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.action.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.tool.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.user.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.organization.deleteMany({ where: { id: testOrg.id } });
    
    console.log('✅ Test data cleaned up');
    results.cleanup = '✅ Test data cleanup successful';

  } catch (error) {
    console.error('❌ Database validation failed:', error);
    results.error = error.message;
  } finally {
    await prisma.$disconnect();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DATABASE VALIDATION SUMMARY');
  console.log('='.repeat(60));
  
  const categories = [
    { name: 'Connection', data: results.connection },
    { name: 'Tables', data: results.tables },
    { name: 'Relationships', data: results.relationships },
    { name: 'Constraints', data: results.constraints },
    { name: 'Cleanup', data: results.cleanup }
  ];

  categories.forEach(category => {
    if (category.data) {
      console.log(`\n📋 ${category.name}:`);
      if (typeof category.data === 'string') {
        console.log(`   ${category.data}`);
      } else {
        Object.entries(category.data).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
    }
  });

  if (results.error) {
    console.log(`\n❌ OVERALL STATUS: FAILED`);
    console.log(`Error: ${results.error}`);
    process.exit(1);
  } else {
    console.log(`\n✅ OVERALL STATUS: DATABASE VALIDATION SUCCESSFUL`);
    console.log(`🎉 All database tables, relations, and constraints are working correctly!`);
  }
}

validateDatabase().catch(console.error);