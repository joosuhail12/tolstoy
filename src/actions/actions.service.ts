import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Action, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class ActionsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
