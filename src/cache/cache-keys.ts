/**
 * Centralized cache key management and TTL configuration
 *
 * This file defines all cache key patterns and their associated TTL values
 * to ensure consistency across the application and make cache management easier.
 */

export class CacheKeys {
  // TTL Constants (in seconds)
  static readonly TTL = {
    // Short-lived cache (5 minutes)
    SHORT: 300,

    // Medium-lived cache (10 minutes)
    MEDIUM: 600,

    // Long-lived cache (30 minutes)
    LONG: 1800,

    // Very long-lived cache (1 hour)
    VERY_LONG: 3600,

    // Specific TTLs for different data types
    SECRETS: 600, // 10 minutes - balance security vs performance
    FLOWS: 300, // 5 minutes - flows change frequently during development
    TOOLS: 300, // 5 minutes - tool metadata is fairly stable
    TOOL_META: 600, // 10 minutes - individual tool metadata
    CONFIG: 1800, // 30 minutes - platform config changes rarely
    USER_SESSIONS: 3600, // 1 hour - user session data
  } as const;

  // Cache Key Patterns

  /**
   * Generate cache key for tool secrets
   * @param orgId Organization ID
   * @param toolName Tool name
   * @returns Cache key: secrets:{orgId}:{toolName}
   */
  static secrets(orgId: string, toolName: string): string {
    return `secrets:${orgId}:${toolName}`;
  }

  /**
   * Generate cache key for flow definitions
   * @param orgId Organization ID
   * @param flowId Flow ID
   * @returns Cache key: flow:{orgId}:{flowId}
   */
  static flow(orgId: string, flowId: string): string {
    return `flow:${orgId}:${flowId}`;
  }

  /**
   * Generate cache key for organization's flow list
   * @param orgId Organization ID
   * @returns Cache key: flows:{orgId}
   */
  static flowList(orgId: string): string {
    return `flows:${orgId}`;
  }

  /**
   * Generate cache key for organization's tool list
   * @param orgId Organization ID
   * @returns Cache key: tools:{orgId}
   */
  static toolList(orgId: string): string {
    return `tools:${orgId}`;
  }

  /**
   * Generate cache key for individual tool metadata
   * @param orgId Organization ID
   * @param toolId Tool ID
   * @returns Cache key: tool-meta:{orgId}:{toolId}
   */
  static toolMeta(orgId: string, toolId: string): string {
    return `tool-meta:${orgId}:${toolId}`;
  }

  /**
   * Generate cache key for tool credentials existence check
   * @param orgId Organization ID
   * @param toolId Tool ID
   * @returns Cache key: tool-creds:{orgId}:{toolId}
   */
  static toolCredentials(orgId: string, toolId: string): string {
    return `tool-creds:${orgId}:${toolId}`;
  }

  /**
   * Generate cache key for platform configuration
   * @param service Service name
   * @param key Configuration key
   * @returns Cache key: config:{service}:{key}
   */
  static config(service: string, key: string): string {
    return `config:${service}:${key}`;
  }

  /**
   * Generate cache key for AWS Secrets Manager data
   * @param secretId AWS Secret ID
   * @param key Optional specific key within secret
   * @returns Cache key: aws-secret:{secretId} or aws-secret:{secretId}:{key}
   */
  static awsSecret(secretId: string, key?: string): string {
    return key ? `aws-secret:${secretId}:${key}` : `aws-secret:${secretId}`;
  }

  /**
   * Generate cache key for user sessions
   * @param userId User ID
   * @param sessionId Session ID
   * @returns Cache key: session:{userId}:{sessionId}
   */
  static userSession(userId: string, sessionId: string): string {
    return `session:${userId}:${sessionId}`;
  }

  /**
   * Generate cache key for organization metadata
   * @param orgId Organization ID
   * @returns Cache key: org:{orgId}
   */
  static organization(orgId: string): string {
    return `org:${orgId}`;
  }

  // Utility methods for cache key patterns

  /**
   * Get all cache keys matching a pattern
   * @param pattern Redis pattern (supports * wildcard)
   * @returns Pattern for scanning keys
   */
  static pattern(pattern: string): string {
    return pattern;
  }

  /**
   * Generate cache key for invalidation groups
   * Useful for bulk cache invalidation
   * @param group Group name
   * @param identifier Group identifier
   * @returns Cache key: group:{group}:{identifier}
   */
  static group(group: string, identifier: string): string {
    return `group:${group}:${identifier}`;
  }

  // Common invalidation patterns

  /**
   * Get pattern to invalidate all secrets for an organization
   * @param orgId Organization ID
   * @returns Pattern: secrets:{orgId}:*
   */
  static secretsPattern(orgId: string): string {
    return `secrets:${orgId}:*`;
  }

  /**
   * Get pattern to invalidate all flows for an organization
   * @param orgId Organization ID
   * @returns Pattern: flow*:{orgId}*
   */
  static flowsPattern(orgId: string): string {
    return `flow*:${orgId}*`;
  }

  /**
   * Get pattern to invalidate all tools for an organization
   * @param orgId Organization ID
   * @returns Pattern: tool*:{orgId}*
   */
  static toolsPattern(orgId: string): string {
    return `tool*:${orgId}*`;
  }
}

export default CacheKeys;
