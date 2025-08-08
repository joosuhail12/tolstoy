import { TolstoyClient } from '../src/client';
import { templateManager } from '../src/templates';
import { execSync } from 'child_process';
import { join } from 'path';

describe('CLI Integration Tests', () => {
  const cliPath = join(__dirname, '../dist/cli.js');

  describe('CLI Commands', () => {
    it('should list templates via CLI', () => {
      const output = execSync(`node ${cliPath} templates list --json`, { encoding: 'utf-8' });
      const templates = JSON.parse(output);
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('description');
      expect(templates[0]).toHaveProperty('category');
    });

    it('should show template details via CLI', () => {
      const output = execSync(`node ${cliPath} templates show "Hello World" --json`, { encoding: 'utf-8' });
      const template = JSON.parse(output);
      
      expect(template.name).toBe('Hello World');
      expect(template.steps).toBeDefined();
      expect(Array.isArray(template.steps)).toBe(true);
    });

    it('should filter templates by category via CLI', () => {
      const output = execSync(`node ${cliPath} templates list --category "Getting Started" --json`, { encoding: 'utf-8' });
      const templates = JSON.parse(output);
      
      expect(Array.isArray(templates)).toBe(true);
      templates.forEach(template => {
        expect(template.category).toBe('Getting Started');
      });
    });

    it('should filter templates by tag via CLI', () => {
      const output = execSync(`node ${cliPath} templates list --tag "simple" --json`, { encoding: 'utf-8' });
      const templates = JSON.parse(output);
      
      expect(Array.isArray(templates)).toBe(true);
      templates.forEach(template => {
        expect(template.tags).toContain('simple');
      });
    });
  });

  describe('Template Import Workflow', () => {
    it('should validate template before import', () => {
      const template = templateManager.loadTemplate('Hello World');
      const validation = templateManager.validateTemplate(template);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should prepare flow data for API call', () => {
      const template = templateManager.loadTemplate('Hello World');
      
      // This is what would be sent to the API
      const flowData = {
        name: template.name,
        description: template.description,
        steps: template.steps,
        trigger: template.trigger,
        schedule: template.schedule,
        inputs: template.inputs || [],
        metadata: {
          source: 'template',
          templateVersion: template.version,
          importedAt: new Date().toISOString()
        }
      };

      expect(flowData.name).toBe('Hello World');
      expect(flowData.steps).toHaveLength(2);
      expect(flowData.metadata.source).toBe('template');
      expect(flowData.metadata.templateVersion).toBe(1);
    });
  });

  describe('End-to-End Template Management', () => {
    it('should demonstrate complete template workflow', () => {
      // 1. List all templates
      const templates = templateManager.listTemplates();
      expect(templates.length).toBeGreaterThan(0);

      // 2. Get templates by category
      const startingTemplates = templateManager.getTemplatesByCategory('Getting Started');
      expect(startingTemplates.length).toBeGreaterThan(0);

      // 3. Load a specific template
      const helloWorldTemplate = templateManager.loadTemplate('Hello World');
      expect(helloWorldTemplate.name).toBe('Hello World');

      // 4. Validate the template
      const validation = templateManager.validateTemplate(helloWorldTemplate);
      expect(validation.valid).toBe(true);

      // 5. Prepare for API import (simulate)
      const flowData = {
        ...helloWorldTemplate,
        metadata: {
          source: 'template',
          templateVersion: helloWorldTemplate.version,
          importedAt: new Date().toISOString()
        }
      };

      expect(flowData.steps).toBeDefined();
      expect(flowData.steps.length).toBe(2);
      expect(flowData.metadata.source).toBe('template');
    });

    it('should handle all template categories and tags', () => {
      const categories = templateManager.getCategories();
      const tags = templateManager.getTags();

      expect(categories.length).toBeGreaterThan(0);
      expect(tags.length).toBeGreaterThan(0);

      // Ensure we can get templates for each category
      categories.forEach(category => {
        const categoryTemplates = templateManager.getTemplatesByCategory(category);
        expect(categoryTemplates.length).toBeGreaterThan(0);
      });

      // Test a few tag searches
      const commonTags = ['simple', 'notification', 'integration'];
      commonTags.forEach(tag => {
        if (tags.includes(tag)) {
          const tagTemplates = templateManager.searchTemplatesByTags([tag]);
          expect(tagTemplates.length).toBeGreaterThan(0);
        }
      });
    });
  });
});