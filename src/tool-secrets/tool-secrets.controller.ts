import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { ToolSecretsService, StoredCredentials } from './tool-secrets.service';
import { StoreCredentialsDto, CredentialResponseDto } from './dto/store-credentials.dto';
import { Tenant } from '../common/decorators/tenant.decorator';

@Controller('tools/:toolId/secrets')
export class ToolSecretsController {
  constructor(
    private readonly toolSecretsService: ToolSecretsService,
    @InjectPinoLogger(ToolSecretsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async storeCredentials(
    @Param('toolId') toolId: string,
    @Body() storeCredentialsDto: StoreCredentialsDto,
    @Tenant('orgId') orgId: string,
  ): Promise<CredentialResponseDto> {
    this.logger.info(
      { toolId, orgId, credentialKeys: Object.keys(storeCredentialsDto.credentials) },
      'Storing tool credentials',
    );

    const result = await this.toolSecretsService.storeCredentials(
      orgId,
      toolId,
      storeCredentialsDto.credentials,
    );

    this.logger.info(
      { toolId, orgId, toolName: result.toolName },
      'Tool credentials stored successfully',
    );

    return {
      toolId: result.toolId,
      toolName: result.toolName,
      maskedCredentials: result.maskedCredentials,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  @Get()
  async getCredentials(
    @Param('toolId') toolId: string,
    @Tenant('orgId') orgId: string,
    @Query('unmask') unmask?: string,
  ): Promise<CredentialResponseDto | StoredCredentials> {
    const shouldUnmask = unmask === 'true';
    this.logger.debug({ toolId, orgId, shouldUnmask }, 'Retrieving tool credentials');

    const result = await this.toolSecretsService.getCredentials(
      orgId,
      toolId,
      !shouldUnmask, // maskValues = !shouldUnmask
    );

    this.logger.debug(
      { toolId, orgId, toolName: result.toolName, masked: !shouldUnmask },
      'Tool credentials retrieved',
    );

    if (shouldUnmask) {
      // Return full credentials (be careful with this in production)
      return result;
    }

    return {
      toolId: result.toolId,
      toolName: result.toolName,
      maskedCredentials: result.maskedCredentials,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCredentials(
    @Param('toolId') toolId: string,
    @Tenant('orgId') orgId: string,
  ): Promise<void> {
    this.logger.warn({ toolId, orgId }, 'Deleting tool credentials');

    await this.toolSecretsService.deleteCredentials(orgId, toolId);

    this.logger.info({ toolId, orgId }, 'Tool credentials deleted successfully');
  }
}

@Controller('tools/secrets')
export class ToolSecretsListController {
  constructor(
    private readonly toolSecretsService: ToolSecretsService,
    @InjectPinoLogger(ToolSecretsListController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get()
  async listToolsWithCredentials(@Tenant('orgId') orgId: string) {
    this.logger.debug({ orgId }, 'Listing tools with credential status');

    const tools = await this.toolSecretsService.listToolsWithCredentials(orgId);

    this.logger.debug(
      {
        orgId,
        toolCount: tools.length,
        toolsWithCredentials: tools.filter(t => t.hasCredentials).length,
      },
      'Tools with credential status retrieved',
    );

    return tools;
  }
}
