const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { spawn } = require("child_process");
const zlib = require("zlib");
const stream = require("stream");
const { promisify } = require("util");
const pipeline = promisify(stream.pipeline);

/**
 * Tolstoy Database Backup Lambda Function
 * Sprint 5 Task 5.5: Automated Neon PostgreSQL Backup to S3
 * 
 * This function:
 * 1. Retrieves database credentials from AWS Secrets Manager
 * 2. Creates a pg_dump backup of the Neon PostgreSQL database
 * 3. Compresses the backup using gzip
 * 4. Uploads to S3 with timestamped filename
 * 5. Handles errors and provides detailed logging
 */

// Initialize AWS SDK clients
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

// Configuration
const BACKUP_BUCKET = process.env.BACKUP_BUCKET;
const PRIMARY_SECRET = "conductor-db-secret";
const FALLBACK_SECRET = "tolstoy/env";
const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes timeout

/**
 * Retrieve database URL from AWS Secrets Manager
 * Tries primary secret first, then fallback
 */
async function getDatabaseUrl() {
  const secrets = [PRIMARY_SECRET, FALLBACK_SECRET];
  
  for (const secretId of secrets) {
    try {
      console.log(`Attempting to retrieve secret: ${secretId}`);
      
      const command = new GetSecretValueCommand({ SecretId: secretId });
      const response = await secretsClient.send(command);
      
      if (!response.SecretString) {
        console.log(`Secret ${secretId} has no SecretString`);
        continue;
      }
      
      const secretData = JSON.parse(response.SecretString);
      
      // Try different possible key names for database URL
      const possibleKeys = ['DATABASE_URL', 'DIRECT_URL', 'database_url', 'connectionString'];
      
      for (const key of possibleKeys) {
        if (secretData[key]) {
          console.log(`Found database URL in ${secretId} under key: ${key}`);
          return secretData[key];
        }
      }
      
      console.log(`No database URL found in ${secretId}`);
    } catch (error) {
      console.log(`Failed to retrieve ${secretId}: ${error.message}`);
    }
  }
  
  throw new Error('Unable to retrieve database URL from any secret');
}

/**
 * Create database backup using pg_dump
 */
async function createBackup(databaseUrl) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    console.log(`Starting backup at ${timestamp}`);
    
    // Parse database URL to extract components for pg_dump
    const dbUrl = new URL(databaseUrl);
    const pgDumpArgs = [
      '--no-password',
      '--verbose',
      '--clean',
      '--if-exists',
      '--format=custom',
      '--compress=9',
      '--host', dbUrl.hostname,
      '--port', dbUrl.port || '5432',
      '--username', decodeURIComponent(dbUrl.username),
      '--dbname', dbUrl.pathname.slice(1) // Remove leading slash
    ];
    
    // Set password via environment variable
    const env = {
      ...process.env,
      PGPASSWORD: decodeURIComponent(dbUrl.password)
    };
    
    console.log(`Running pg_dump with host: ${dbUrl.hostname}, database: ${dbUrl.pathname.slice(1)}`);
    
    const pgDump = spawn('pg_dump', pgDumpArgs, { 
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    const chunks = [];
    let errorOutput = '';
    
    pgDump.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    pgDump.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log(`pg_dump stderr: ${data.toString().trim()}`);
    });
    
    pgDump.on('close', (code) => {
      if (code !== 0) {
        console.error(`pg_dump exited with code ${code}`);
        console.error(`pg_dump stderr: ${errorOutput}`);
        reject(new Error(`pg_dump failed with exit code ${code}: ${errorOutput}`));
      } else {
        console.log(`pg_dump completed successfully, ${chunks.length} chunks captured`);
        const backupData = Buffer.concat(chunks);
        resolve(backupData);
      }
    });
    
    pgDump.on('error', (error) => {
      console.error(`pg_dump process error: ${error.message}`);
      reject(error);
    });
    
    // Set timeout
    setTimeout(() => {
      pgDump.kill('SIGTERM');
      reject(new Error('pg_dump timeout after 15 minutes'));
    }, TIMEOUT_MS);
  });
}

/**
 * Upload backup to S3
 */
async function uploadToS3(backupData, timestamp) {
  try {
    console.log(`Compressing backup data (${backupData.length} bytes)`);
    
    // Create gzip stream
    const gzipStream = zlib.createGzip({ level: 9 });
    const chunks = [];
    
    // Compress the backup data
    await pipeline(
      stream.Readable.from(backupData),
      gzipStream,
      new stream.Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      })
    );
    
    const compressedData = Buffer.concat(chunks);
    console.log(`Compressed ${backupData.length} bytes to ${compressedData.length} bytes`);
    
    // Generate S3 key with timestamp
    const s3Key = `backups/neon-backup-${timestamp}.sql.gz`;
    
    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: BACKUP_BUCKET,
      Key: s3Key,
      Body: compressedData,
      ContentType: 'application/gzip',
      ContentEncoding: 'gzip',
      Metadata: {
        'backup-timestamp': timestamp,
        'database-type': 'postgresql',
        'source': 'neon',
        'compression': 'gzip',
        'format': 'custom'
      },
      Tags: `Environment=${process.env.ENVIRONMENT || 'prod'}&Purpose=database-backup&Source=neon-postgresql`
    });
    
    console.log(`Uploading to S3: s3://${BACKUP_BUCKET}/${s3Key}`);
    await s3Client.send(uploadCommand);
    
    console.log(`Backup uploaded successfully to S3: ${s3Key}`);
    return s3Key;
  } catch (error) {
    console.error('Failed to upload backup to S3:', error);
    throw error;
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  console.log('='.repeat(50));
  console.log('Tolstoy Database Backup Lambda Started');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Event:`, JSON.stringify(event, null, 2));
  console.log(`Environment: ${process.env.ENVIRONMENT || 'unknown'}`);
  console.log(`Backup Bucket: ${BACKUP_BUCKET}`);
  console.log('='.repeat(50));
  
  try {
    // Validate environment
    if (!BACKUP_BUCKET) {
      throw new Error('BACKUP_BUCKET environment variable not set');
    }
    
    // Step 1: Get database URL
    console.log('\n📡 Retrieving database credentials...');
    const databaseUrl = await getDatabaseUrl();
    console.log('✅ Database credentials retrieved successfully');
    
    // Step 2: Create backup
    console.log('\n🗄️  Creating database backup...');
    const backupData = await createBackup(databaseUrl);
    console.log(`✅ Database backup created (${backupData.length} bytes)`);
    
    // Step 3: Upload to S3
    console.log('\n☁️  Uploading backup to S3...');
    const s3Key = await uploadToS3(backupData, timestamp);
    console.log('✅ Backup uploaded to S3 successfully');
    
    // Calculate execution time
    const executionTime = Date.now() - startTime;
    
    // Success response
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      s3Key: s3Key,
      s3Bucket: BACKUP_BUCKET,
      backupSize: backupData.length,
      executionTimeMs: executionTime,
      message: 'Database backup completed successfully'
    };
    
    console.log('\n🎉 Backup completed successfully!');
    console.log(`📊 Execution time: ${executionTime}ms`);
    console.log(`📦 Backup size: ${backupData.length} bytes`);
    console.log(`🔗 S3 location: s3://${BACKUP_BUCKET}/${s3Key}`);
    console.log('='.repeat(50));
    
    return result;
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    console.error('\n❌ Backup failed!');
    console.error(`Error: ${error.message}`);
    console.error(`Stack trace:`, error.stack);
    console.error(`⏱️  Execution time: ${executionTime}ms`);
    console.error('='.repeat(50));
    
    // Error response
    const errorResult = {
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
      executionTimeMs: executionTime,
      message: 'Database backup failed'
    };
    
    // Re-throw error to trigger Lambda failure and CloudWatch alarms
    throw new Error(JSON.stringify(errorResult));
  }
};