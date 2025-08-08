import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExecuteActionDto {
  @ApiProperty({
    description:
      "Inputs matching the action's enhanced inputSchema. Supports rich validation including types, formats, enums, visibility conditions, and default values.",
    example: {
      // String with validation
      title: 'My Task Title',

      // Number with range validation
      priority: 3,

      // Boolean
      urgent: true,

      // Enum/Select
      status: 'in-progress',

      // Date
      due_date: '2024-01-15',

      // Email format validation
      assignee_email: 'user@example.com',

      // Conditional field (only visible if urgent=true)
      escalation_note: 'This needs immediate attention',
    },
    additionalProperties: true,
    properties: {
      // Example enhanced schema properties
      title: {
        type: 'string',
        description: 'Task title with length validation',
        minLength: 1,
        maxLength: 100,
      },
      priority: {
        type: 'number',
        description: 'Priority level from 1-5',
        minimum: 1,
        maximum: 5,
      },
      urgent: {
        type: 'boolean',
        description: 'Whether this task is urgent',
      },
      status: {
        type: 'string',
        enum: ['todo', 'in-progress', 'done'],
        description: 'Current status of the task',
      },
      due_date: {
        type: 'string',
        format: 'date',
        description: 'Due date in YYYY-MM-DD format',
      },
      assignee_email: {
        type: 'string',
        format: 'email',
        description: 'Email address of the assignee',
      },
      escalation_note: {
        type: 'string',
        description: 'Note for urgent tasks (visible only when urgent=true)',
      },
    },
  })
  @IsObject()
  inputs: Record<string, unknown>;
}
