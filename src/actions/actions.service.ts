import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Action } from '@prisma/client';
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

    return this.prisma.action.create({
      data: {
        ...createActionDto,
        orgId: tenant.orgId,
      },
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

  async update(id: string, updateActionDto: UpdateActionDto, tenant: TenantContext): Promise<Action> {
    const action = await this.findOne(id, tenant);

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
      return await this.prisma.action.update({
        where: { id },
        data: updateActionDto,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Action with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string, tenant: TenantContext): Promise<Action> {
    const action = await this.findOne(id, tenant);

    try {
      return await this.prisma.action.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Action with ID ${id} not found`);
      }
      throw error;
    }
  }
}