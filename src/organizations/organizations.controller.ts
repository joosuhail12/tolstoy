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
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Organization',
    description: 'Create a new organization',
  })
  @ApiBody({
    type: CreateOrganizationDto,
    description: 'Organization details',
  })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'org_abc123' },
        name: { type: 'string', example: 'Acme Corp' },
        description: { type: 'string', example: 'Leading technology company' },
        settings: { type: 'object', example: { timezone: 'UTC' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid organization data',
  })
  create(@Body(ValidationPipe) createOrganizationDto: CreateOrganizationDto) {
    return this.organizationsService.create(createOrganizationDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List Organizations',
    description: 'Get all organizations',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved organizations',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'org_abc123' },
          name: { type: 'string', example: 'Acme Corp' },
          description: { type: 'string', example: 'Leading technology company' },
          settings: { type: 'object', example: { timezone: 'UTC' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Organization',
    description: 'Get a specific organization by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization ID',
    example: 'org_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved organization',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'org_abc123' },
        name: { type: 'string', example: 'Acme Corp' },
        description: { type: 'string', example: 'Leading technology company' },
        settings: { type: 'object', example: { timezone: 'UTC' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Organization not found',
  })
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update Organization',
    description: 'Update organization details',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization ID',
    example: 'org_abc123',
  })
  @ApiBody({
    type: UpdateOrganizationDto,
    description: 'Updated organization details',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization not found',
  })
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, updateOrganizationDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete Organization',
    description: 'Delete an organization permanently',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization ID',
    example: 'org_abc123',
  })
  @ApiResponse({
    status: 204,
    description: 'Organization deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization not found',
  })
  remove(@Param('id') id: string) {
    return this.organizationsService.remove(id);
  }
}
