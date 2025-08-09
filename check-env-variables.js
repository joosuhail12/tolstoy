const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function checkTolstoyEnvVariables() {
  console.log('🔍 Checking all environment variables in tolstoy/env...\n');

  try {
    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
      maxAttempts: 3,
      retryMode: 'adaptive',
    });

    const command = new GetSecretValueCommand({ SecretId: 'tolstoy/env' });
    const response = await client.send(command);

    if (!response.SecretString) {
      console.error('❌ No SecretString found in tolstoy/env');
      return;
    }

    const secrets = JSON.parse(response.SecretString);
    const envVars = Object.keys(secrets).sort();

    console.log(`📋 Found ${envVars.length} environment variables in tolstoy/env:\n`);

    // Categorize environment variables
    const categories = {
      database: [],
      redis: [],
      ably: [],
      daytona: [],
      inngest: [],
      oauth: [],
      aws: [],
      security: [],
      monitoring: [],
      misc: []
    };

    envVars.forEach(key => {
      const keyLower = key.toLowerCase();
      if (keyLower.includes('database') || keyLower.includes('db') || keyLower.includes('postgres') || keyLower.includes('direct_url')) {
        categories.database.push(key);
      } else if (keyLower.includes('redis') || keyLower.includes('upstash')) {
        categories.redis.push(key);
      } else if (keyLower.includes('ably')) {
        categories.ably.push(key);
      } else if (keyLower.includes('daytona')) {
        categories.daytona.push(key);
      } else if (keyLower.includes('inngest')) {
        categories.inngest.push(key);
      } else if (keyLower.includes('oauth') || keyLower.includes('client_id') || keyLower.includes('client_secret') || keyLower.includes('github') || keyLower.includes('google') || keyLower.includes('slack')) {
        categories.oauth.push(key);
      } else if (keyLower.includes('aws') || keyLower.includes('s3') || keyLower.includes('region')) {
        categories.aws.push(key);
      } else if (keyLower.includes('secret') || keyLower.includes('key') || keyLower.includes('token') || keyLower.includes('auth')) {
        categories.security.push(key);
      } else if (keyLower.includes('sentry') || keyLower.includes('monitoring') || keyLower.includes('log') || keyLower.includes('metric')) {
        categories.monitoring.push(key);
      } else {
        categories.misc.push(key);
      }
    });

    // Display categorized variables
    for (const [category, vars] of Object.entries(categories)) {
      if (vars.length > 0) {
        console.log(`🏷️  ${category.toUpperCase()}:`);
        vars.forEach(key => {
          const value = secrets[key];
          const maskedValue = typeof value === 'string' && value.length > 10 
            ? value.substring(0, 8) + '***' 
            : '***';
          console.log(`   ${key}: ${maskedValue}`);
        });
        console.log('');
      }
    }

    console.log('📊 Summary:');
    console.log(`   Total variables: ${envVars.length}`);
    Object.entries(categories).forEach(([category, vars]) => {
      if (vars.length > 0) {
        console.log(`   ${category}: ${vars.length} variables`);
      }
    });

    // Return the full list for further processing
    return { secrets, envVars, categories };

  } catch (error) {
    console.error('❌ Failed to fetch tolstoy/env secrets:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('   - AWS credentials configured');
    console.log('   - Proper IAM permissions for SecretsManager:GetSecretValue');
    console.log('   - Access to the tolstoy/env secret');
    return null;
  }
}

// Self-executing async function
(async () => {
  await checkTolstoyEnvVariables();
})().catch(console.error);