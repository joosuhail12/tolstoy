import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConditionEvaluatorService, ConditionContext } from './condition-evaluator.service';
import { PinoLogger } from 'nestjs-pino';

describe('ConditionEvaluatorService', () => {
  let service: ConditionEvaluatorService;
  let mockLogger: any;

  const mockContext: ConditionContext = {
    inputs: {
      priority: 'high',
      count: 10,
      status: 'active',
      tags: ['urgent', 'customer'],
      email: 'user@example.com',
      amount: 150.75,
    },
    variables: {
      orgType: 'enterprise',
      feature: 'premium',
      region: 'us-east',
    },
    stepOutputs: {
      'fetch-data': { records: 25, success: true },
      'validate': { isValid: true, score: 0.85 },
    },
    currentStep: {
      id: 'current-step',
      name: 'Process Data',
    },
    orgId: 'org-123',
    userId: 'user-456',
    meta: {
      flowId: 'flow-789',
      executionId: 'exec_123',
      stepId: 'step-1',
    },
  };

  beforeEach(async () => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConditionEvaluatorService,
        {
          provide: `PinoLogger:${ConditionEvaluatorService.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get(ConditionEvaluatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('JSONLogic Rules', () => {
    it('should evaluate simple equality conditions', () => {
      const rule = { '==': [{ var: 'inputs.priority' }, 'high'] };
      expect(service.evaluate(rule, mockContext)).toBe(true);

      const rule2 = { '==': [{ var: 'inputs.priority' }, 'low'] };
      expect(service.evaluate(rule2, mockContext)).toBe(false);
    });

    it('should evaluate comparison conditions', () => {
      const rule1 = { '>': [{ var: 'inputs.count' }, 5] };
      expect(service.evaluate(rule1, mockContext)).toBe(true);

      const rule2 = { '<': [{ var: 'inputs.count' }, 5] };
      expect(service.evaluate(rule2, mockContext)).toBe(false);

      const rule3 = { '>=': [{ var: 'inputs.amount' }, 150] };
      expect(service.evaluate(rule3, mockContext)).toBe(true);
    });

    it('should evaluate logical AND/OR conditions', () => {
      const andRule = {
        and: [
          { '==': [{ var: 'inputs.priority' }, 'high'] },
          { '>': [{ var: 'inputs.count' }, 5] },
        ],
      };
      expect(service.evaluate(andRule, mockContext)).toBe(true);

      const orRule = {
        or: [
          { '==': [{ var: 'inputs.priority' }, 'low'] },
          { '>': [{ var: 'inputs.count' }, 5] },
        ],
      };
      expect(service.evaluate(orRule, mockContext)).toBe(true);
    });

    it('should evaluate NOT conditions', () => {
      const notRule = { '!': { '==': [{ var: 'inputs.priority' }, 'low'] } };
      expect(service.evaluate(notRule, mockContext)).toBe(true);
    });

    it('should evaluate IN conditions', () => {
      const inRule = { in: [{ var: 'inputs.priority' }, ['high', 'medium']] };
      expect(service.evaluate(inRule, mockContext)).toBe(true);

      const notInRule = { in: [{ var: 'inputs.priority' }, ['low', 'medium']] };
      expect(service.evaluate(notInRule, mockContext)).toBe(false);
    });

    it('should handle nested variable access', () => {
      const rule = { '==': [{ var: 'stepOutputs.fetch-data.success' }, true] };
      expect(service.evaluate(rule, mockContext)).toBe(true);
    });

    it('should handle missing variables gracefully', () => {
      const rule = { '==': [{ var: 'inputs.nonexistent' }, null] };
      expect(service.evaluate(rule, mockContext)).toBe(true);
    });
  });

  describe('Simple Comparison Rules', () => {
    it('should evaluate simple equality', () => {
      const rule = { field: 'inputs.priority', operator: '==', value: 'high' };
      expect(service.evaluate(rule, mockContext)).toBe(true);
    });

    it('should evaluate numeric comparisons', () => {
      const rule1 = { field: 'inputs.count', operator: '>', value: 5 };
      expect(service.evaluate(rule1, mockContext)).toBe(true);

      const rule2 = { field: 'inputs.count', operator: '<=', value: 15 };
      expect(service.evaluate(rule2, mockContext)).toBe(true);
    });

    it('should evaluate string operations', () => {
      const containsRule = { 
        field: 'inputs.email', 
        operator: 'contains', 
        value: '@example.com' 
      };
      expect(service.evaluate(containsRule, mockContext)).toBe(true);

      const startsWithRule = { 
        field: 'inputs.email', 
        operator: 'startsWith', 
        value: 'user' 
      };
      expect(service.evaluate(startsWithRule, mockContext)).toBe(true);
    });

    it('should evaluate array operations', () => {
      const inRule = { 
        field: 'inputs.priority', 
        operator: 'in', 
        value: ['high', 'medium'] 
      };
      expect(service.evaluate(inRule, mockContext)).toBe(true);

      const notInRule = { 
        field: 'inputs.priority', 
        operator: 'notIn', 
        value: ['low', 'urgent'] 
      };
      expect(service.evaluate(notInRule, mockContext)).toBe(true);
    });

    it('should evaluate existence checks', () => {
      const existsRule = { 
        field: 'inputs.priority', 
        operator: 'exists' 
      };
      expect(service.evaluate(existsRule, mockContext)).toBe(true);

      const notExistsRule = { 
        field: 'inputs.nonexistent', 
        operator: 'notExists' 
      };
      expect(service.evaluate(notExistsRule, mockContext)).toBe(true);
    });

    it('should throw error for unknown operators', () => {
      const rule = { field: 'inputs.priority', operator: 'unknown', value: 'high' };
      expect(() => service.evaluate(rule, mockContext)).toThrow(BadRequestException);
    });
  });

  describe('Custom Operations', () => {
    it('should handle custom exists operation', () => {
      const rule = { exists: ['inputs.priority'] };
      expect(service.evaluate(rule, mockContext)).toBe(true);

      const rule2 = { exists: ['inputs.nonexistent'] };
      expect(service.evaluate(rule2, mockContext)).toBe(false);
    });

    it('should handle custom isEmpty operation', () => {
      const contextWithEmpty = {
        ...mockContext,
        inputs: {
          ...mockContext.inputs,
          emptyString: '',
          emptyArray: [],
          emptyObject: {},
          nullValue: null,
        },
      };

      expect(service.evaluate({ isEmpty: ['inputs.emptyString'] }, contextWithEmpty)).toBe(true);
      expect(service.evaluate({ isEmpty: ['inputs.emptyArray'] }, contextWithEmpty)).toBe(true);
      expect(service.evaluate({ isEmpty: ['inputs.emptyObject'] }, contextWithEmpty)).toBe(true);
      expect(service.evaluate({ isEmpty: ['inputs.nullValue'] }, contextWithEmpty)).toBe(true);
      expect(service.evaluate({ isEmpty: ['inputs.priority'] }, contextWithEmpty)).toBe(false);
    });

    it('should handle custom regex operation', () => {
      const emailRule = { regex: ['^[^@]+@[^@]+\\.[^@]+$', { var: 'inputs.email' }] };
      expect(service.evaluate(emailRule, mockContext)).toBe(true);

      const invalidEmailRule = { regex: ['^\\d+$', { var: 'inputs.email' }] };
      expect(service.evaluate(invalidEmailRule, mockContext)).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should return true for null/undefined rules', () => {
      expect(service.evaluate(null, mockContext)).toBe(true);
      expect(service.evaluate(undefined, mockContext)).toBe(true);
    });

    it('should handle complex nested conditions', () => {
      const complexRule = {
        and: [
          { '==': [{ var: 'inputs.status' }, 'active'] },
          {
            or: [
              { '>': [{ var: 'stepOutputs.fetch-data.records' }, 20] },
              { '==': [{ var: 'variables.orgType' }, 'enterprise'] },
            ],
          },
        ],
      };
      expect(service.evaluate(complexRule, mockContext)).toBe(true);
    });

    it('should throw meaningful errors for invalid rules', () => {
      const invalidRule = { invalidOperator: 'test' };
      expect(() => service.evaluate(invalidRule, mockContext)).toThrow(BadRequestException);
    });

    it('should log debug information during evaluation', () => {
      const rule = { '==': [{ var: 'inputs.priority' }, 'high'] };
      service.evaluate(rule, mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          rule,
          contextKeys: expect.any(Array),
          orgId: 'org-123',
          executionId: 'exec_123',
        }),
        'Evaluating executeIf condition'
      );
    });

    it('should log errors for failed evaluations', () => {
      const invalidRule = { invalidOperator: 'test' };
      
      expect(() => service.evaluate(invalidRule, mockContext)).toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          rule: invalidRule,
          error: expect.any(String),
          orgId: 'org-123',
          executionId: 'exec_123',
        }),
        'Failed to evaluate executeIf condition'
      );
    });
  });

  describe('Rule Validation', () => {
    it('should validate correct rules', () => {
      const validRule = { '==': [{ var: 'inputs.priority' }, 'high'] };
      const result = service.validateRule(validRule);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect invalid rules', () => {
      const invalidRule = { invalidOperator: 'test' };
      const result = service.validateRule(invalidRule);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle null rules in validation', () => {
      const result = service.validateRule(null);
      expect(result.valid).toBe(true);
    });
  });

  describe('Helper Methods', () => {
    it('should return available variables', () => {
      const variables = service.getAvailableVariables();
      expect(variables).toContain('inputs.*');
      expect(variables).toContain('variables.*');
      expect(variables).toContain('stepOutputs.*');
      expect(variables).toContain('meta.executionId');
    });

    it('should correctly identify rule types', () => {
      // Test private methods through evaluation behavior
      const jsonLogicRule = { '==': [{ var: 'test' }, 'value'] };
      expect(() => service.evaluate(jsonLogicRule, mockContext)).not.toThrow();

      const simpleRule = { field: 'inputs.priority', operator: '==', value: 'high' };
      expect(() => service.evaluate(simpleRule, mockContext)).not.toThrow();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle user access control scenarios', () => {
      const adminRule = { '==': [{ var: 'variables.orgType' }, 'enterprise'] };
      expect(service.evaluate(adminRule, mockContext)).toBe(true);
    });

    it('should handle data quality checks', () => {
      const dataQualityRule = {
        and: [
          { exists: ['stepOutputs.validate.score'] },
          { '>': [{ var: 'stepOutputs.validate.score' }, 0.8] },
        ],
      };
      expect(service.evaluate(dataQualityRule, mockContext)).toBe(true);
    });

    it('should handle business rules', () => {
      const businessRule = {
        or: [
          { '==': [{ var: 'inputs.priority' }, 'high'] },
          {
            and: [
              { '>=': [{ var: 'inputs.amount' }, 100] },
              { 'in': [{ var: 'inputs.status' }, ['active', 'pending']] },
            ],
          },
        ],
      };
      expect(service.evaluate(businessRule, mockContext)).toBe(true);
    });

    it('should handle feature flags', () => {
      const featureFlagRule = {
        and: [
          { '==': [{ var: 'variables.feature' }, 'premium'] },
          { '!=': [{ var: 'variables.region' }, 'restricted'] },
        ],
      };
      expect(service.evaluate(featureFlagRule, mockContext)).toBe(true);
    });
  });
});