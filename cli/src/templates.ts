import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

export interface TemplateMetadata {
  name: string;
  description: string;
  version: number;
  category: string;
  author: string;
  tags: string[];
  file: string;
}

export interface FlowTemplate {
  name: string;
  description: string;
  version: number;
  category?: string;
  author?: string;
  tags?: string[];
  inputs?: Array<{
    name: string;
    type: string;
    required?: boolean;
    default?: any;
    description?: string;
  }>;
  trigger?: any;
  schedule?: any;
  steps: any[];
}

export class TemplateManager {
  private templatesDir: string;

  constructor(templatesDir?: string) {
    // Default to templates directory relative to project root
    this.templatesDir = templatesDir || join(__dirname, '../../templates');
  }

  /**
   * List all available flow templates
   */
  listTemplates(): TemplateMetadata[] {
    if (!existsSync(this.templatesDir)) {
      throw new Error(`Templates directory not found: ${this.templatesDir}`);
    }

    return readdirSync(this.templatesDir)
      .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
      .map(file => {
        try {
          const filePath = join(this.templatesDir, file);
          const content = readFileSync(filePath, 'utf-8');
          
          // Parse YAML with front matter - split by --- separator
          const parts = content.split(/^---$/m);
          let frontMatter: any = {};
          let body: any = {};
          
          if (parts.length >= 3) {
            // Has front matter: ---, front matter, ---, content
            frontMatter = parseYaml(parts[1].trim()) || {};
            body = parseYaml(parts[2].trim()) || {};
          } else if (parts.length === 2) {
            // Only front matter or only content
            try {
              frontMatter = parseYaml(parts[1].trim()) || {};
            } catch {
              body = parseYaml(content) || {};
            }
          } else {
            // No front matter separators, parse as single document
            body = parseYaml(content) || {};
          }
          
          // Merge front matter and body
          const doc = { ...frontMatter, ...body };
          
          if (!doc || typeof doc !== 'object') {
            throw new Error(`Invalid YAML structure in ${file}`);
          }

          // Skip templates without required fields or with invalid structure
          if (!doc.name || !doc.description || !doc.steps || !Array.isArray(doc.steps) || doc.steps.length === 0) {
            return null; // Will be filtered out
          }

          return {
            name: doc.name || file.replace(/\.(yaml|yml)$/, ''),
            description: doc.description || 'No description provided',
            version: doc.version || 1,
            category: doc.category || 'General',
            author: doc.author || 'Unknown',
            tags: doc.tags || [],
            file
          };
        } catch (error) {
          console.warn(`Warning: Failed to parse template ${file}:`, error.message);
          return null;
        }
      })
      .filter((template): template is TemplateMetadata => template !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Load a specific template by name or filename
   */
  loadTemplate(nameOrFile: string): FlowTemplate {
    const templates = this.listTemplates();
    
    // Find template by name or file
    let template = templates.find(t => 
      t.name === nameOrFile || 
      t.file === nameOrFile ||
      t.name.toLowerCase() === nameOrFile.toLowerCase()
    );

    if (!template) {
      // Try exact file match if not found by name
      const possibleFiles = [`${nameOrFile}.yaml`, `${nameOrFile}.yml`];
      for (const fileName of possibleFiles) {
        if (existsSync(join(this.templatesDir, fileName))) {
          template = { file: fileName } as TemplateMetadata;
          break;
        }
      }
    }

    if (!template) {
      throw new Error(`Template "${nameOrFile}" not found. Available templates: ${templates.map(t => t.name).join(', ')}`);
    }

    const filePath = join(this.templatesDir, template.file);
    const content = readFileSync(filePath, 'utf-8');
    
    // Parse YAML with front matter - split by --- separator
    const parts = content.split(/^---$/m);
    let frontMatter: any = {};
    let body: any = {};
    
    if (parts.length >= 3) {
      // Has front matter: ---, front matter, ---, content
      frontMatter = parseYaml(parts[1].trim()) || {};
      body = parseYaml(parts[2].trim()) || {};
    } else if (parts.length === 2) {
      // Only front matter or only content
      try {
        frontMatter = parseYaml(parts[1].trim()) || {};
      } catch {
        body = parseYaml(content) || {};
      }
    } else {
      // No front matter separators, parse as single document
      body = parseYaml(content) || {};
    }
    
    // Merge front matter and body
    const flowDef = { ...frontMatter, ...body } as FlowTemplate;

    if (!flowDef.steps || !Array.isArray(flowDef.steps)) {
      throw new Error(`Invalid template structure in ${template.file}: steps array is required`);
    }

    return flowDef;
  }

  /**
   * Get template by category
   */
  getTemplatesByCategory(category: string): TemplateMetadata[] {
    return this.listTemplates().filter(t => 
      t.category.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Search templates by tags
   */
  searchTemplatesByTags(tags: string[]): TemplateMetadata[] {
    const searchTags = tags.map(tag => tag.toLowerCase());
    return this.listTemplates().filter(t =>
      t.tags.some(tag => searchTags.includes(tag.toLowerCase()))
    );
  }

  /**
   * Get all available categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.listTemplates().forEach(t => categories.add(t.category));
    return Array.from(categories).sort();
  }

  /**
   * Get all available tags
   */
  getTags(): string[] {
    const tags = new Set<string>();
    this.listTemplates().forEach(t => 
      t.tags.forEach(tag => tags.add(tag))
    );
    return Array.from(tags).sort();
  }

  /**
   * Validate template structure
   */
  validateTemplate(template: FlowTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.name) {
      errors.push('Template must have a name');
    }

    if (!template.description) {
      errors.push('Template must have a description');
    }

    if (!template.steps || !Array.isArray(template.steps)) {
      errors.push('Template must have a steps array');
    } else if (template.steps.length === 0) {
      errors.push('Template must have at least one step');
    } else {
      // Validate each step
      template.steps.forEach((step, index) => {
        if (!step.key) {
          errors.push(`Step ${index + 1} must have a key`);
        }
        if (!step.action) {
          errors.push(`Step ${index + 1} must have an action`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Default export for convenience
export const templateManager = new TemplateManager();