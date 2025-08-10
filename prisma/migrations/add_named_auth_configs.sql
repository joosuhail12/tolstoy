-- Migration: Add support for multiple named authentication configurations
-- This migration adds name and isDefault fields to ToolAuthConfig and updates unique constraints

-- Step 1: Add new columns to ToolAuthConfig table
ALTER TABLE "ToolAuthConfig" 
ADD COLUMN "name" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Update existing records to use "default" name and set isDefault = true
UPDATE "ToolAuthConfig" 
SET "isDefault" = true 
WHERE "id" IN (
  SELECT "id" FROM "ToolAuthConfig" 
  WHERE "name" = 'default'
);

-- Step 3: Drop the old unique constraint
ALTER TABLE "ToolAuthConfig" DROP CONSTRAINT IF EXISTS "ToolAuthConfig_orgId_toolId_key";

-- Step 4: Add new unique constraint that includes name
ALTER TABLE "ToolAuthConfig" ADD CONSTRAINT "ToolAuthConfig_orgId_toolId_name_key" UNIQUE ("orgId", "toolId", "name");

-- Step 5: Add performance index for finding all configs for a tool
CREATE INDEX IF NOT EXISTS "ToolAuthConfig_orgId_toolId_idx" ON "ToolAuthConfig"("orgId", "toolId");

-- Verify the changes
-- This query should show all existing auth configs with their new name field
-- SELECT "id", "orgId", "toolId", "name", "isDefault", "type" FROM "ToolAuthConfig" ORDER BY "orgId", "toolId", "name";