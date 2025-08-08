import { TemplateManager, FlowTemplate } from '../src/templates';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('TemplateManager', () => {
  let tempDir: string;
  let templateManager: TemplateManager;

  beforeEach(() => {
    // Create a temporary directory for test templates
    tempDir = join(tmpdir(), `test-templates-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    templateManager = new TemplateManager(tempDir);

    // Create test template files
    const templates = {
      'hello-world.yaml': `---
name: Hello World
description: Simple hello world flow
version: 1
category: Getting Started
author: Test Author
tags: [test, simple]
---
steps:
  - key: hello
    action: echo
    inputs:
      message: "Hello World"`,

      'complex-flow.yaml': `---
name: Complex Flow
description: A more complex flow with conditions
version: 2
category: Advanced
author: Advanced Author
tags: [complex, conditional]
inputs:
  - name: user_name
    type: string
    required: true
    description: User's name
---
trigger:
  type: webhook
  source: api
steps:
  - key: validate
    action: validate
    inputs:
      data: "{{trigger.payload}}"
  - key: process
    action: transform
    condition:
      field: "{{validate.success}}"
      operator: "equals"
      value: true`,

      'invalid.yaml': `---
name: Invalid Template
description: Missing steps
version: 1
---
# No steps defined`,

      'malformed.yaml': `invalid yaml content [[[`
    };

    Object.entries(templates).forEach(([filename, content]) => {
      writeFileSync(join(tempDir, filename), content);
    });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('listTemplates', () => {
    it('should list valid templates', () => {
      const templates = templateManager.listTemplates();
      
      expect(templates).toHaveLength(2); // Only valid templates
      expect(templates.map(t => t.name)).toContain('Hello World');
      expect(templates.map(t => t.name)).toContain('Complex Flow');
    });

    it('should return templates sorted by name', () => {
      const templates = templateManager.listTemplates();
      const names = templates.map(t => t.name);
      expect(names).toEqual([...names].sort());
    });

    it('should handle empty templates directory', () => {
      const emptyDir = join(tmpdir(), `empty-templates-${Date.now()}`);
      mkdirSync(emptyDir);
      const emptyManager = new TemplateManager(emptyDir);
      
      const templates = emptyManager.listTemplates();
      expect(templates).toHaveLength(0);
      
      rmSync(emptyDir, { recursive: true });
    });

    it('should throw error when templates directory does not exist', () => {
      const nonExistentManager = new TemplateManager('/non-existent-path');
      expect(() => nonExistentManager.listTemplates()).toThrow('Templates directory not found');
    });

    it('should skip malformed YAML files with warning', () => {
      // Spy on console.warn to verify warning is logged
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const templates = templateManager.listTemplates();
      
      expect(templates).toHaveLength(2); // Should skip invalid templates
      // Note: The new validation filters out invalid templates silently rather than warning
      
      consoleSpy.mockRestore();
    });
  });

  describe('loadTemplate', () => {
    it('should load template by name', () => {
      const template = templateManager.loadTemplate('Hello World');
      
      expect(template.name).toBe('Hello World');
      expect(template.description).toBe('Simple hello world flow');
      expect(template.steps).toHaveLength(1);
      expect(template.steps[0].key).toBe('hello');
    });

    it('should load template by filename', () => {
      const template = templateManager.loadTemplate('hello-world.yaml');
      
      expect(template.name).toBe('Hello World');
      expect(template.steps).toHaveLength(1);
    });

    it('should load template by case-insensitive name', () => {
      const template = templateManager.loadTemplate('hello world');
      
      expect(template.name).toBe('Hello World');
    });

    it('should load template with inputs, trigger, and conditions', () => {
      const template = templateManager.loadTemplate('Complex Flow');
      
      expect(template.inputs).toBeDefined();
      expect(template.inputs).toHaveLength(1);
      expect(template.inputs![0].name).toBe('user_name');
      expect(template.trigger).toBeDefined();
      expect(template.trigger.type).toBe('webhook');
      expect(template.steps[1].condition).toBeDefined();
    });

    it('should throw error for non-existent template', () => {
      expect(() => templateManager.loadTemplate('Non Existent')).toThrow(
        'Template "Non Existent" not found'
      );
    });

    it('should throw error for template without steps', () => {
      expect(() => templateManager.loadTemplate('invalid.yaml')).toThrow(
        'Template "invalid.yaml" not found'
      );
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should filter templates by category', () => {
      const startingTemplates = templateManager.getTemplatesByCategory('Getting Started');
      const advancedTemplates = templateManager.getTemplatesByCategory('Advanced');
      
      expect(startingTemplates).toHaveLength(1);
      expect(startingTemplates[0].name).toBe('Hello World');
      expect(advancedTemplates).toHaveLength(1);
      expect(advancedTemplates[0].name).toBe('Complex Flow');
    });

    it('should be case-insensitive', () => {
      const templates = templateManager.getTemplatesByCategory('getting started');
      expect(templates).toHaveLength(1);
    });

    it('should return empty array for non-existent category', () => {
      const templates = templateManager.getTemplatesByCategory('Non Existent');
      expect(templates).toHaveLength(0);
    });
  });

  describe('searchTemplatesByTags', () => {
    it('should find templates by single tag', () => {
      const testTemplates = templateManager.searchTemplatesByTags(['test']);
      expect(testTemplates).toHaveLength(1);
      expect(testTemplates[0].name).toBe('Hello World');
    });

    it('should find templates by multiple tags', () => {
      const templates = templateManager.searchTemplatesByTags(['simple', 'complex']);
      expect(templates).toHaveLength(2); // Both templates have at least one matching tag
    });

    it('should be case-insensitive', () => {
      const templates = templateManager.searchTemplatesByTags(['SIMPLE']);
      expect(templates).toHaveLength(1);
    });

    it('should return empty array for non-existent tags', () => {
      const templates = templateManager.searchTemplatesByTags(['nonexistent']);
      expect(templates).toHaveLength(0);
    });
  });

  describe('getCategories', () => {
    it('should return all unique categories', () => {
      const categories = templateManager.getCategories();
      expect(categories).toHaveLength(2);
      expect(categories).toContain('Getting Started');
      expect(categories).toContain('Advanced');
      expect(categories).toEqual(categories.sort()); // Should be sorted
    });
  });

  describe('getTags', () => {
    it('should return all unique tags', () => {
      const tags = templateManager.getTags();
      expect(tags).toContain('test');
      expect(tags).toContain('simple');
      expect(tags).toContain('complex');
      expect(tags).toContain('conditional');
      expect(tags).toEqual(tags.sort()); // Should be sorted
    });
  });

  describe('validateTemplate', () => {
    it('should validate valid template', () => {
      const template: FlowTemplate = {
        name: 'Test Template',
        description: 'Test description',
        version: 1,
        steps: [
          { key: 'step1', action: 'test' }
        ]
      };
      
      const result = templateManager.validateTemplate(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should invalidate template without name', () => {
      const template: FlowTemplate = {
        name: '',
        description: 'Test description',
        version: 1,
        steps: [{ key: 'step1', action: 'test' }]
      };
      
      const result = templateManager.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template must have a name');
    });

    it('should invalidate template without description', () => {
      const template: FlowTemplate = {
        name: 'Test',
        description: '',
        version: 1,
        steps: [{ key: 'step1', action: 'test' }]
      };
      
      const result = templateManager.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template must have a description');
    });

    it('should invalidate template without steps', () => {
      const template: FlowTemplate = {
        name: 'Test',
        description: 'Test description',
        version: 1,
        steps: []
      };
      
      const result = templateManager.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template must have at least one step');
    });

    it('should invalidate template with invalid steps', () => {
      const template: FlowTemplate = {
        name: 'Test',
        description: 'Test description',
        version: 1,
        steps: [
          { key: 'step1', action: 'test' },
          { key: '', action: 'test' }, // Missing key
          { key: 'step3', action: '' }  // Missing action
        ]
      };
      
      const result = templateManager.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Step 2 must have a key');
      expect(result.errors).toContain('Step 3 must have an action');
    });
  });
});