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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Tenant } from '../common/decorators/tenant.decorator';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@ApiTags('Users')
@ApiSecurity('x-org-id')
@ApiSecurity('x-user-id')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create User',
    description: 'Create a new user in the organization',
  })
  @ApiBody({
    description: 'User details',
    schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
          description: 'User email address',
          example: 'john.doe@example.com',
        },
        name: {
          type: 'string',
          description: 'User full name',
          example: 'John Doe',
        },
        role: {
          type: 'string',
          description: 'User role',
          enum: ['admin', 'member', 'viewer'],
          example: 'member',
        },
        profile: {
          type: 'object',
          description: 'User profile information',
          example: { department: 'Engineering', title: 'Software Engineer' },
        },
      },
      required: ['email', 'name'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'user_abc123' },
        email: { type: 'string', example: 'john.doe@example.com' },
        name: { type: 'string', example: 'John Doe' },
        role: { type: 'string', example: 'member' },
        profile: { type: 'object', example: { department: 'Engineering' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid user data',
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  create(@Body(ValidationPipe) createUserDto: CreateUserDto, @Tenant() tenant: TenantContext) {
    return this.usersService.create(createUserDto, tenant);
  }

  @Get()
  @ApiOperation({
    summary: 'List Users',
    description: 'Get all users in the organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved users',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'user_abc123' },
          email: { type: 'string', example: 'john.doe@example.com' },
          name: { type: 'string', example: 'John Doe' },
          role: { type: 'string', example: 'member' },
          profile: { type: 'object', example: { department: 'Engineering' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  findAll(@Tenant() tenant: TenantContext) {
    return this.usersService.findAll(tenant);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get User',
    description: 'Get a specific user by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: 'user_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved user',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'user_abc123' },
        email: { type: 'string', example: 'john.doe@example.com' },
        name: { type: 'string', example: 'John Doe' },
        role: { type: 'string', example: 'member' },
        profile: { type: 'object', example: { department: 'Engineering' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.usersService.findOne(id, tenant);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update User',
    description: 'Update user details',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: 'user_abc123',
  })
  @ApiBody({
    description: 'Updated user details',
    schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
          description: 'User email address',
          example: 'john.doe@example.com',
        },
        name: {
          type: 'string',
          description: 'User full name',
          example: 'John Doe',
        },
        role: {
          type: 'string',
          description: 'User role',
          enum: ['admin', 'member', 'viewer'],
          example: 'member',
        },
        profile: {
          type: 'object',
          description: 'User profile information',
          example: { department: 'Engineering', title: 'Senior Software Engineer' },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
    @Tenant() tenant: TenantContext,
  ) {
    return this.usersService.update(id, updateUserDto, tenant);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete User',
    description: 'Delete a user permanently',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: 'user_abc123',
  })
  @ApiResponse({
    status: 204,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.usersService.remove(id, tenant);
  }
}
