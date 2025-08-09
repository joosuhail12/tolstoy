const { PrismaClient } = require('@prisma/client');

async function testDatabasePerformance() {
  const prisma = new PrismaClient();
  console.log('🚀 Testing database connection performance...\n');

  try {
    // Test connection speed
    const start = Date.now();
    await prisma.$connect();
    const connectionTime = Date.now() - start;
    console.log(`✅ Database connection time: ${connectionTime}ms`);

    // Test query performance
    const queryStart = Date.now();
    const count = await prisma.organization.count();
    const queryTime = Date.now() - queryStart;
    console.log(`✅ Simple query time: ${queryTime}ms (${count} organizations)`);

    // Test concurrent connections
    console.log('\n🔄 Testing concurrent query performance...');
    const concurrentStart = Date.now();
    const promises = [];
    
    for (let i = 0; i < 10; i++) {
      promises.push(prisma.organization.count());
    }
    
    await Promise.all(promises);
    const concurrentTime = Date.now() - concurrentStart;
    console.log(`✅ 10 concurrent queries time: ${concurrentTime}ms`);
    console.log(`✅ Average per query: ${(concurrentTime / 10).toFixed(2)}ms`);

    // Test transaction performance
    console.log('\n💾 Testing transaction performance...');
    const txStart = Date.now();
    await prisma.$transaction(async (tx) => {
      await tx.organization.count();
      await tx.user.count();
      await tx.tool.count();
    });
    const txTime = Date.now() - txStart;
    console.log(`✅ Transaction with 3 queries: ${txTime}ms`);

    console.log('\n' + '='.repeat(50));
    console.log('📊 PERFORMANCE SUMMARY');
    console.log('='.repeat(50));
    console.log(`Connection: ${connectionTime}ms`);
    console.log(`Single Query: ${queryTime}ms`);
    console.log(`Concurrent Queries (10): ${concurrentTime}ms avg ${(concurrentTime / 10).toFixed(2)}ms`);
    console.log(`Transaction (3 queries): ${txTime}ms`);
    
    if (connectionTime < 1000 && queryTime < 100 && concurrentTime < 500) {
      console.log('\n✅ DATABASE PERFORMANCE: EXCELLENT');
    } else if (connectionTime < 2000 && queryTime < 500 && concurrentTime < 1000) {
      console.log('\n✅ DATABASE PERFORMANCE: GOOD');
    } else {
      console.log('\n⚠️  DATABASE PERFORMANCE: NEEDS OPTIMIZATION');
    }

  } catch (error) {
    console.error('❌ Database performance test failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabasePerformance().catch(console.error);