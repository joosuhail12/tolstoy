import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ToolsService } from './tools.service';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('Tools')
@ApiSecurity('x-org-id')
@ApiSecurity('x-user-id')
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Tool',
    description: 'Register a new external tool for use in workflows',
  })
  @ApiBody({
    type: CreateToolDto,
    description: 'Tool configuration',
  })
  @ApiResponse({
    status: 201,
    description: 'Tool created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'cme3zjbwc0000uppplgvx1hse' },
        name: { type: 'string', example: 'Slack Notifier' },
        baseUrl: { type: 'string', example: 'https://hooks.slack.com/services' },
        authType: { type: 'string', example: 'apiKey' },
        orgId: { type: 'string', example: 'org_123' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid tool configuration',
  })
  create(@Body(ValidationPipe) createToolDto: CreateToolDto, @Tenant() tenant: TenantContext) {
    return this.toolsService.create(createToolDto, tenant);
  }

  @Get()
  @ApiOperation({
    summary: 'List Tools',
    description: 'Get all registered tools for the organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved tools',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'tool_abc123' },
          name: { type: 'string', example: 'Slack Notifier' },
          type: { type: 'string', example: 'notification' },
          configuration: { type: 'object', example: { baseUrl: 'https://hooks.slack.com' } },
          description: { type: 'string', example: 'Send notifications to Slack channels' },
          version: { type: 'string', example: '1.0.0' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  findAll(@Tenant() tenant: TenantContext) {
    return this.toolsService.findAll(tenant);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Tool',
    description: 'Get a specific tool by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Tool ID',
    example: 'tool_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved tool',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'tool_abc123' },
        name: { type: 'string', example: 'Slack Notifier' },
        type: { type: 'string', example: 'notification' },
        configuration: { type: 'object', example: { baseUrl: 'https://hooks.slack.com' } },
        description: { type: 'string', example: 'Send notifications to Slack channels' },
        version: { type: 'string', example: '1.0.0' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Tool not found',
  })
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.toolsService.findOne(id, tenant);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update Tool',
    description: 'Update tool configuration',
  })
  @ApiParam({
    name: 'id',
    description: 'Tool ID',
    example: 'tool_abc123',
  })
  @ApiBody({
    type: UpdateToolDto,
    description: 'Updated tool configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Tool updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Tool not found',
  })
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateToolDto: UpdateToolDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.toolsService.update(id, updateToolDto, tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete Tool',
    description: 'Delete a tool permanently (will affect workflows using this tool)',
  })
  @ApiParam({
    name: 'id',
    description: 'Tool ID',
    example: 'tool_abc123',
  })
  @ApiResponse({
    status: 204,
    description: 'Tool deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Tool not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Tool is being used by active workflows and cannot be deleted',
  })
  remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.toolsService.remove(id, tenant);
  }
}
