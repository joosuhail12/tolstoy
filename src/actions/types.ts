/**
 * Enhanced Input Schema Types
 *
 * Provides rich UI/validation metadata for action input parameters
 */

export interface ActionInputParam {
  /** Machine-readable parameter name */
  name: string;

  /** Human-readable UI label */
  label?: string;

  /** Help text describing the parameter */
  description?: string;

  /** Data type for validation and UI rendering */
  type: 'string' | 'number' | 'boolean' | 'enum' | 'date';

  /** Whether this parameter is required */
  required: boolean;

  /** UI control type for rendering */
  control: 'text' | 'number' | 'checkbox' | 'select' | 'date-picker' | 'textarea';

  /** Available options for enum/select types */
  options?: string[];

  /** Default value if not provided */
  default?: string | number | boolean | string[];

  /** JSONLogic predicate determining field visibility */
  visibleIf?: Record<string, unknown>;

  /** Additional validation constraints */
  validation?: {
    /** Minimum length for strings or minimum value for numbers */
    min?: number;
    /** Maximum length for strings or maximum value for numbers */
    max?: number;
    /** Regex pattern for string validation */
    pattern?: string;
    /** Custom error message */
    message?: string;
    /** Array of valid values (alternative to options) */
    enum?: string[];
    /** Date format validation */
    format?: 'date' | 'date-time' | 'email' | 'url';
  };

  /** UI-specific metadata */
  ui?: {
    /** Placeholder text */
    placeholder?: string;
    /** Input hint or example */
    hint?: string;
    /** Whether to show as multiline textarea */
    multiline?: boolean;
    /** Step value for number inputs */
    step?: number;
    /** CSS classes for styling */
    className?: string;
  };
}

/**
 * Legacy input schema format (for backward compatibility)
 */
export interface LegacyInputParam {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  options?: string[];
  validation?: {
    pattern?: string;
    enum?: string[];
    minimum?: number;
    maximum?: number;
  };
  default?: string | number | boolean | string[];
}

/**
 * Union type supporting both legacy and enhanced formats
 */
export type InputParam = ActionInputParam | LegacyInputParam;

/**
 * Type guard to check if param is enhanced format
 */
export function isEnhancedInputParam(param: InputParam): param is ActionInputParam {
  return 'control' in param;
}

/**
 * Type guard to check if param is legacy format
 */
export function isLegacyInputParam(param: InputParam): param is LegacyInputParam {
  return !('control' in param);
}

/**
 * Convert legacy format to enhanced format
 */
export function migrateToEnhancedParam(legacy: LegacyInputParam): ActionInputParam {
  const enhanced: ActionInputParam = {
    name: legacy.name,
    label: legacy.name.charAt(0).toUpperCase() + legacy.name.slice(1).replace(/_/g, ' '),
    description: legacy.description,
    type: mapLegacyType(legacy.type),
    required: legacy.required,
    control: mapToControl(legacy.type),
    default: legacy.default,
  };

  // Handle options field (for enum types)
  if (legacy.options) {
    enhanced.options = legacy.options;
  }

  // Map legacy validation to new format
  if (legacy.validation) {
    enhanced.validation = {
      pattern: legacy.validation.pattern,
      min: legacy.validation.minimum,
      max: legacy.validation.maximum,
    };

    // Convert enum validation to options
    if (legacy.validation.enum) {
      enhanced.options = legacy.validation.enum;
    }
  }

  return enhanced;
}

/**
 * Map legacy type strings to standardized types
 */
function mapLegacyType(legacyType: string): ActionInputParam['type'] {
  switch (legacyType.toLowerCase()) {
    case 'string':
    case 'text':
      return 'string';
    case 'number':
    case 'integer':
    case 'float':
      return 'number';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'enum':
    case 'select':
      return 'enum';
    case 'date':
    case 'datetime':
      return 'date';
    default:
      return 'string';
  }
}

/**
 * Map type to appropriate UI control
 */
function mapToControl(type: string): ActionInputParam['control'] {
  switch (type.toLowerCase()) {
    case 'string':
    case 'text':
      return 'text';
    case 'number':
    case 'integer':
    case 'float':
      return 'number';
    case 'boolean':
    case 'bool':
      return 'checkbox';
    case 'enum':
    case 'select':
      return 'select';
    case 'date':
    case 'datetime':
      return 'date-picker';
    default:
      return 'text';
  }
}
