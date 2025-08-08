import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Action, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { InputValidatorService } from '../common/services/input-validator.service';
import { AuthConfigService } from '../auth/auth-config.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inputValidator: InputValidatorService,
    private readonly authConfig: AuthConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async create(createActionDto: CreateActionDto, tenant: TenantContext): Promise<Action> {
    // Verify the tool belongs to the organization
    const tool = await this.prisma.tool.findUnique({
      where: { id: createActionDto.toolId },
    });

    if (!tool || tool.orgId !== tenant.orgId) {
      throw new ForbiddenException('Tool not found or access denied');
    }

    const createData: Prisma.ActionUncheckedCreateInput = {
      name: createActionDto.name,
      key: createActionDto.key,
      toolId: createActionDto.toolId,
      method: createActionDto.method,
      endpoint: createActionDto.endpoint,
      headers: createActionDto.headers as unknown as Prisma.InputJsonValue,
      inputSchema: createActionDto.inputSchema as unknown as Prisma.InputJsonValue,
      executeIf: createActionDto.executeIf as unknown as Prisma.InputJsonValue,
      orgId: tenant.orgId,
    };

    if (createActionDto.version !== undefined) {
      createData.version = createActionDto.version;
    }

    return this.prisma.action.create({
      data: createData,
    });
  }

  async findAll(tenant: TenantContext): Promise<Action[]> {
    return this.prisma.action.findMany({
      where: {
        tool: {
          orgId: tenant.orgId,
        },
      },
      include: {
        tool: {
          select: { id: true, name: true, orgId: true },
        },
      },
    });
  }

  async findOne(id: string, tenant: TenantContext): Promise<Action> {
    const action = await this.prisma.action.findUnique({
      where: { id },
      include: {
        tool: {
          select: { id: true, name: true, orgId: true },
        },
      },
    });

    if (!action) {
      throw new NotFoundException(`Action with ID ${id} not found`);
    }

    if (action.tool.orgId !== tenant.orgId) {
      throw new ForbiddenException('Access denied: Action belongs to different organization');
    }

    return action;
  }

  async update(
    id: string,
    updateActionDto: UpdateActionDto,
    tenant: TenantContext,
  ): Promise<Action> {
    await this.findOne(id, tenant);

    // If toolId is being updated, verify the new tool belongs to the organization
    if (updateActionDto.toolId) {
      const tool = await this.prisma.tool.findUnique({
        where: { id: updateActionDto.toolId },
      });

      if (!tool || tool.orgId !== tenant.orgId) {
        throw new ForbiddenException('Tool not found or access denied');
      }
    }

    try {
      const updateData: Prisma.ActionUncheckedUpdateInput = {};

      if (updateActionDto.name !== undefined) {
        updateData.name = updateActionDto.name;
      }
      if (updateActionDto.key !== undefined) {
        updateData.key = updateActionDto.key;
      }
      if (updateActionDto.toolId !== undefined) {
        updateData.toolId = updateActionDto.toolId;
      }
      if (updateActionDto.method !== undefined) {
        updateData.method = updateActionDto.method;
      }
      if (updateActionDto.endpoint !== undefined) {
        updateData.endpoint = updateActionDto.endpoint;
      }
      if (updateActionDto.headers !== undefined) {
        updateData.headers = updateActionDto.headers as unknown as Prisma.InputJsonValue;
      }
      if (updateActionDto.inputSchema !== undefined) {
        updateData.inputSchema = updateActionDto.inputSchema as unknown as Prisma.InputJsonValue;
      }
      if (updateActionDto.executeIf !== undefined) {
        updateData.executeIf = updateActionDto.executeIf as unknown as Prisma.InputJsonValue;
      }
      if (updateActionDto.version !== undefined) {
        updateData.version = updateActionDto.version;
      }

      return await this.prisma.action.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException(`Action with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string, tenant: TenantContext): Promise<Action> {
    await this.findOne(id, tenant);

    try {
      return await this.prisma.action.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException(`Action with ID ${id} not found`);
      }
      throw error;
    }
  }

  async executeAction(
    orgId: string,
    userId: string | undefined,
    actionKey: string,
    inputs: Record<string, unknown>,
  ) {
    const startTime = Date.now();

    try {
      // 1. Load Action + Tool
      const action = await this.prisma.action.findFirst({
        where: { orgId, key: actionKey },
        include: { tool: true },
      });

      if (!action) {
        throw new NotFoundException(`Action "${actionKey}" not found`);
      }

      const toolName = action.tool.name;

      // Increment counter metric
      this.metrics.actionExecutionCounter.inc({
        orgId,
        toolKey: toolName,
        actionKey,
        status: 'started',
      });

      // 2. Validate inputs against enhanced schema
      const validInputs = await this.inputValidator.validateEnhanced(
        action.inputSchema as InputParam[],
        inputs,
        {
          orgId,
          actionKey,
          contextType: 'action-execution',
        },
      );

      // 3. Resolve auth headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((action.headers as Record<string, string>) || {}),
      };

      try {
        const orgAuth = await this.authConfig.getOrgAuthConfig(orgId, toolName);

        if (orgAuth?.type === 'apiKey') {
          const headerName = orgAuth.config.headerName || 'Authorization';
          const headerValue = orgAuth.config.headerValue || orgAuth.config.apiKey;
          headers[headerName] = headerValue;
        } else if (orgAuth?.type === 'oauth2') {
          if (userId) {
            const cred = await this.authConfig.getUserCredentials(orgId, userId, toolName);
            if (cred) {
              const token = await this.authConfig.refreshUserToken(cred);
              headers['Authorization'] = `Bearer ${token}`;
            }
          }
        }
      } catch (authError) {
        this.logger.warn(`Auth config not found for org ${orgId}, tool ${toolName}`, authError);
        // Continue execution without auth headers
      }

      // 4. Execute HTTP request
      this.logger.log(`Executing single action: ${actionKey} for org: ${orgId}`);

      // Construct URL - handle both absolute and relative endpoints
      let url = action.endpoint;
      if (!url.startsWith('http')) {
        url = action.tool.baseUrl + (url.startsWith('/') ? url : '/' + url);
      }

      // Replace template variables in URL with validated inputs
      url = this.replaceTemplateVariables(url, validInputs);

      // Prepare request options
      const requestOptions: RequestInit = {
        method: action.method,
        headers,
      };

      // Add body for non-GET requests
      if (action.method !== 'GET') {
        requestOptions.body = JSON.stringify(validInputs);
      }

      // Make HTTP request
      const response = await fetch(url, requestOptions);
      const responseText = await response.text();

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      const duration = Date.now() - startTime;

      if (response.ok) {
        // Update metrics with success
        this.metrics.actionExecutionCounter.inc({
          orgId,
          toolKey: toolName,
          actionKey,
          status: 'success',
        });

        this.metrics.actionExecutionDuration.observe(
          { orgId, toolKey: toolName, actionKey },
          duration / 1000,
        );

        // 5. Return result
        return {
          success: true,
          executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          duration,
          data: responseData,
          outputs: {
            orgId,
            actionKey,
            toolKey: toolName,
            timestamp: new Date().toISOString(),
            statusCode: response.status,
            url,
          },
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      // Update metrics with error
      this.metrics.actionExecutionCounter.inc({
        orgId,
        toolKey: actionKey, // fallback if tool not found
        actionKey,
        status: 'error',
      });

      this.metrics.actionExecutionDuration.observe(
        { orgId, toolKey: actionKey, actionKey },
        duration / 1000,
      );

      this.logger.error(`Action execution failed: ${actionKey}`, error);
      throw error;
    }
  }

  private replaceTemplateVariables(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = variables[key.trim()];
      return value !== undefined ? String(value) : match;
    });
  }
}
