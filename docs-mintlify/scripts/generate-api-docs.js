#!/usr/bin/env node

/**
 * Auto-generate API documentation from OpenAPI specification
 * This script fetches the OpenAPI spec and generates Mintlify-compatible MDX files
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  openApiUrl: 'https://tolstoy.getpullse.com/api/openapi.json',
  localOpenApiPath: './openapi.json',
  outputDir: './api/endpoints',
  templateDir: './scripts/templates',
  
  // Override mappings for better organization
  pathMappings: {
    '/actions': 'actions',
    '/tools': 'tools', 
    '/flows': 'flows',
    '/users': 'users',
    '/organizations': 'organizations',
    '/webhooks': 'webhooks',
    '/execution-logs': 'execution-logs',
    '/health': 'health'
  }
};

class ApiDocGenerator {
  constructor() {
    this.openApiSpec = null;
    this.generatedFiles = [];
  }

  async run() {
    try {
      console.log('🚀 Starting API documentation generation...');
      
      await this.fetchOpenApiSpec();
      await this.loadTemplates();
      await this.generateEndpointDocs();
      await this.updateNavigation();
      
      console.log(`✅ Generated ${this.generatedFiles.length} API documentation files`);
      this.generatedFiles.forEach(file => console.log(`   📄 ${file}`));
      
    } catch (error) {
      console.error('❌ Error generating API docs:', error.message);
      process.exit(1);
    }
  }

  async fetchOpenApiSpec() {
    console.log('📥 Fetching OpenAPI specification...');
    
    try {
      // Try to fetch from API first
      const response = await fetch(CONFIG.openApiUrl);
      if (response.ok) {
        this.openApiSpec = await response.json();
        await fs.writeFile(CONFIG.localOpenApiPath, JSON.stringify(this.openApiSpec, null, 2));
        console.log('   ✓ Fetched from API and cached locally');
        return;
      }
    } catch (error) {
      console.log('   ⚠️ Could not fetch from API, trying local cache...');
    }

    // Fallback to local cache
    try {
      const localSpec = await fs.readFile(CONFIG.localOpenApiPath, 'utf8');
      this.openApiSpec = JSON.parse(localSpec);
      console.log('   ✓ Using local cached specification');
    } catch (error) {
      throw new Error('Could not load OpenAPI specification from API or local cache');
    }
  }

  async loadTemplates() {
    console.log('📋 Loading documentation templates...');
    
    this.templates = {
      endpoint: await fs.readFile(path.join(CONFIG.templateDir, 'endpoint.mdx'), 'utf8'),
      index: await fs.readFile(path.join(CONFIG.templateDir, 'index.mdx'), 'utf8')
    };
    
    console.log('   ✓ Templates loaded');
  }

  async generateEndpointDocs() {
    console.log('📝 Generating endpoint documentation...');
    
    const paths = this.openApiSpec.paths || {};
    const groupedPaths = this.groupPathsByResource(paths);
    
    for (const [resource, endpoints] of Object.entries(groupedPaths)) {
      await this.generateResourceDocs(resource, endpoints);
    }
  }

  groupPathsByResource(paths) {
    const grouped = {};
    
    for (const [pathPattern, methods] of Object.entries(paths)) {
      const resource = this.getResourceFromPath(pathPattern);
      
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      
      for (const [method, spec] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
          grouped[resource].push({
            path: pathPattern,
            method: method.toUpperCase(),
            spec,
            operationId: spec.operationId
          });
        }
      }
    }
    
    return grouped;
  }

  getResourceFromPath(pathPattern) {
    // Extract resource from path pattern
    const segments = pathPattern.split('/').filter(Boolean);
    const firstSegment = segments[0];
    
    return CONFIG.pathMappings[`/${firstSegment}`] || firstSegment || 'misc';
  }

  async generateResourceDocs(resource, endpoints) {
    console.log(`   📁 Generating docs for ${resource}...`);
    
    const resourceDir = path.join(CONFIG.outputDir, resource);
    await fs.mkdir(resourceDir, { recursive: true });
    
    // Generate index file for resource
    await this.generateResourceIndex(resource, endpoints, resourceDir);
    
    // Generate individual endpoint files
    for (const endpoint of endpoints) {
      await this.generateEndpointDoc(endpoint, resourceDir);
    }
  }

  async generateResourceIndex(resource, endpoints, resourceDir) {
    const indexPath = path.join(resourceDir, 'index.mdx');
    
    const content = this.templates.index
      .replace(/{{RESOURCE_NAME}}/g, this.capitalize(resource))
      .replace(/{{RESOURCE_DESCRIPTION}}/g, this.getResourceDescription(resource))
      .replace(/{{ENDPOINT_LIST}}/g, this.generateEndpointList(endpoints, resource));
    
    await fs.writeFile(indexPath, content);
    this.generatedFiles.push(path.relative('.', indexPath));
  }

  async generateEndpointDoc(endpoint, resourceDir) {
    const filename = this.getEndpointFilename(endpoint);
    const filePath = path.join(resourceDir, `${filename}.mdx`);
    
    const content = this.templates.endpoint
      .replace(/{{TITLE}}/g, this.getEndpointTitle(endpoint))
      .replace(/{{API_METHOD_PATH}}/g, `${endpoint.method} ${endpoint.path}`)
      .replace(/{{DESCRIPTION}}/g, endpoint.spec.description || endpoint.spec.summary || '')
      .replace(/{{PARAMETERS}}/g, this.generateParameters(endpoint.spec))
      .replace(/{{REQUEST_BODY}}/g, this.generateRequestBody(endpoint.spec))
      .replace(/{{RESPONSES}}/g, this.generateResponses(endpoint.spec))
      .replace(/{{EXAMPLES}}/g, this.generateExamples(endpoint));
    
    await fs.writeFile(filePath, content);
    this.generatedFiles.push(path.relative('.', filePath));
  }

  getEndpointFilename(endpoint) {
    if (endpoint.operationId) {
      return endpoint.operationId.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '');
    }
    
    // Fallback to method + path
    const pathPart = endpoint.path
      .split('/')
      .filter(Boolean)
      .join('-')
      .replace(/[{}]/g, '');
    
    return `${endpoint.method.toLowerCase()}-${pathPart}`;
  }

  getEndpointTitle(endpoint) {
    if (endpoint.spec.summary) {
      return endpoint.spec.summary;
    }
    
    // Generate title from operation ID or path
    const title = endpoint.operationId || 
                  `${endpoint.method} ${endpoint.path}`.replace(/[{}]/g, '');
    
    return title.replace(/([A-Z])/g, ' $1')
               .replace(/^./, str => str.toUpperCase())
               .trim();
  }

  generateParameters(spec) {
    const parameters = spec.parameters || [];
    if (parameters.length === 0) return '';
    
    return parameters.map(param => {
      const required = param.required ? ' required' : '';
      const paramType = param.schema?.type || 'string';
      const description = param.description || '';
      
      return `<ParamField ${param.in}="${param.name}" type="${paramType}"${required}>
  ${description}
</ParamField>`;
    }).join('\n\n');
  }

  generateRequestBody(spec) {
    if (!spec.requestBody) return '';
    
    const content = spec.requestBody.content;
    if (!content || !content['application/json']) return '';
    
    const schema = content['application/json'].schema;
    if (!schema || !schema.properties) return '';
    
    return Object.entries(schema.properties).map(([name, prop]) => {
      const required = schema.required?.includes(name) ? ' required' : '';
      const type = prop.type || 'string';
      const description = prop.description || '';
      
      return `<ParamField body="${name}" type="${type}"${required}>
  ${description}
</ParamField>`;
    }).join('\n\n');
  }

  generateResponses(spec) {
    const responses = spec.responses || {};
    
    return Object.entries(responses).map(([code, response]) => {
      const description = response.description || '';
      const content = response.content?.['application/json'];
      
      if (!content || !content.schema) {
        return `### ${code} ${this.getStatusText(code)}\n\n${description}`;
      }
      
      const schema = content.schema;
      const example = content.example || this.generateExampleFromSchema(schema);
      
      return `<ResponseExample>
\`\`\`json ${code} ${this.getStatusText(code)}
${JSON.stringify(example, null, 2)}
\`\`\`
</ResponseExample>`;
    }).join('\n\n');
  }

  generateExamples(endpoint) {
    const examples = [];
    
    // cURL example
    examples.push(`\`\`\`bash cURL
curl -X ${endpoint.method} "${this.openApiSpec.servers?.[0]?.url || 'https://api.tolstoy.com'}${endpoint.path}" \\
  -H "Content-Type: application/json" \\
  -H "x-org-id: org_abc123def456" \\
  -H "x-user-id: user_xyz789abc"${endpoint.method !== 'GET' ? ' \\\n  -d \'{}\'': ''}
\`\`\``);
    
    // JavaScript example
    examples.push(`\`\`\`javascript JavaScript SDK
import { TolstoyClient } from '@tolstoy/sdk';

const tolstoy = new TolstoyClient({
  orgId: 'org_abc123def456',
  userId: 'user_xyz789abc'
});

const result = await tolstoy.${this.getSDKMethodCall(endpoint)};
console.log(result);
\`\`\``);
    
    return `<CodeGroup>\n${examples.join('\n\n')}\n</CodeGroup>`;
  }

  getSDKMethodCall(endpoint) {
    const resource = this.getResourceFromPath(endpoint.path);
    const method = this.getSDKMethodName(endpoint);
    
    return `${resource}.${method}()`;
  }

  getSDKMethodName(endpoint) {
    if (endpoint.operationId) {
      return endpoint.operationId.replace(/([A-Z])/g, (match, p1, offset) => 
        offset > 0 ? match.toLowerCase() : p1.toLowerCase()
      );
    }
    
    const methodMap = {
      'GET': 'get',
      'POST': 'create',
      'PUT': 'update', 
      'PATCH': 'update',
      'DELETE': 'delete'
    };
    
    return methodMap[endpoint.method] || 'execute';
  }

  generateExampleFromSchema(schema) {
    if (schema.example) return schema.example;
    
    if (schema.type === 'object' && schema.properties) {
      const example = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        example[key] = this.generateExampleValue(prop);
      }
      return example;
    }
    
    return this.generateExampleValue(schema);
  }

  generateExampleValue(schema) {
    if (schema.example !== undefined) return schema.example;
    
    switch (schema.type) {
      case 'string':
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'uuid') return 'abc123def456';
        if (schema.format === 'date-time') return '2024-01-15T10:30:00.000Z';
        return 'example string';
      case 'number':
      case 'integer':
        return 123;
      case 'boolean':
        return true;
      case 'array':
        return [this.generateExampleValue(schema.items || { type: 'string' })];
      case 'object':
        return {};
      default:
        return null;
    }
  }

  generateEndpointList(endpoints, resource) {
    return endpoints.map(endpoint => {
      const filename = this.getEndpointFilename(endpoint);
      const title = this.getEndpointTitle(endpoint);
      const description = endpoint.spec.description || endpoint.spec.summary || '';
      
      return `  <Card title="${title}" icon="api" href="/api/endpoints/${resource}/${filename}">
    ${description}
  </Card>`;
    }).join('\n');
  }

  getResourceDescription(resource) {
    const descriptions = {
      actions: 'Create and manage reusable API operations',
      tools: 'Configure external API integrations and authentication',
      flows: 'Build and execute complex multi-step workflows',
      users: 'Manage users and permissions within your organization',
      organizations: 'Organization settings, team management, and billing',
      webhooks: 'Configure webhook endpoints for event-driven automation',
      'execution-logs': 'View detailed execution history and logs',
      health: 'System health checks and status monitoring'
    };
    
    return descriptions[resource] || `Manage ${resource} resources`;
  }

  getStatusText(code) {
    const statusTexts = {
      '200': 'OK',
      '201': 'Created',
      '204': 'No Content',
      '400': 'Bad Request',
      '401': 'Unauthorized', 
      '403': 'Forbidden',
      '404': 'Not Found',
      '409': 'Conflict',
      '422': 'Unprocessable Entity',
      '429': 'Too Many Requests',
      '500': 'Internal Server Error'
    };
    
    return statusTexts[code] || '';
  }

  async updateNavigation() {
    console.log('📋 Updating navigation configuration...');
    
    try {
      const docsJsonPath = './docs.json';
      const docsConfig = JSON.parse(await fs.readFile(docsJsonPath, 'utf8'));
      
      // Find the API Reference dropdown
      const apiDropdown = docsConfig.navigation.dropdowns.find(d => 
        d.dropdown === 'API Reference'
      );
      
      if (apiDropdown) {
        // Auto-generate navigation from generated files
        const apiGroups = await this.generateApiNavigation();
        apiDropdown.groups = apiGroups;
        
        await fs.writeFile(docsJsonPath, JSON.stringify(docsConfig, null, 2));
        console.log('   ✓ Updated docs.json navigation');
      }
    } catch (error) {
      console.log('   ⚠️ Could not update navigation:', error.message);
    }
  }

  async generateApiNavigation() {
    const groups = [
      {
        group: 'Overview',
        pages: ['api/index']
      }
    ];
    
    const resourceDirs = await fs.readdir(CONFIG.outputDir);
    
    for (const resource of resourceDirs) {
      const resourcePath = path.join(CONFIG.outputDir, resource);
      const stat = await fs.stat(resourcePath);
      
      if (stat.isDirectory()) {
        const files = await fs.readdir(resourcePath);
        const pages = files
          .filter(file => file.endsWith('.mdx'))
          .map(file => `api/endpoints/${resource}/${file.replace('.mdx', '')}`);
        
        groups.push({
          group: this.capitalize(resource),
          pages
        });
      }
    }
    
    return groups;
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Template content for generated files
async function createTemplates() {
  const templateDir = path.join(__dirname, 'templates');
  await fs.mkdir(templateDir, { recursive: true });
  
  // Endpoint template
  const endpointTemplate = `---
title: "{{TITLE}}"
api: "{{API_METHOD_PATH}}"
description: "{{DESCRIPTION}}"
---

# {{TITLE}}

{{DESCRIPTION}}

## Authentication

<ParamField header="x-org-id" type="string" required>
  Your organization ID
</ParamField>

<ParamField header="x-user-id" type="string" required>
  Your user ID
</ParamField>

{{PARAMETERS}}

{{REQUEST_BODY}}

## Examples

{{EXAMPLES}}

## Responses

{{RESPONSES}}

---

<Snippet file="api-footer.mdx" />
`;

  // Index template
  const indexTemplate = `---
title: "{{RESOURCE_NAME}} API"
description: "{{RESOURCE_DESCRIPTION}}"
---

# {{RESOURCE_NAME}} API

{{RESOURCE_DESCRIPTION}}

## Endpoints

<CardGroup cols={2}>
{{ENDPOINT_LIST}}
</CardGroup>

---

<Snippet file="api-footer.mdx" />
`;

  await fs.writeFile(path.join(templateDir, 'endpoint.mdx'), endpointTemplate);
  await fs.writeFile(path.join(templateDir, 'index.mdx'), indexTemplate);
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'init':
      await createTemplates();
      console.log('✅ Templates created');
      break;
    case 'generate':
    default:
      const generator = new ApiDocGenerator();
      await generator.run();
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ApiDocGenerator };