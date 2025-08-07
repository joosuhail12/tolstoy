import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Tool } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class ToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createToolDto: CreateToolDto, tenant: TenantContext): Promise<Tool> {
    return this.prisma.tool.create({
      data: {
        ...createToolDto,
        orgId: tenant.orgId,
      },
    });
  }

  async findAll(tenant: TenantContext): Promise<Tool[]> {
    return this.prisma.tool.findMany({
      where: { orgId: tenant.orgId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        _count: {
          select: { actions: true },
        },
      },
    });
  }

  async findOne(id: string, tenant: TenantContext): Promise<Tool> {
    const tool = await this.prisma.tool.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        actions: true,
      },
    });

    if (!tool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }

    if (tool.orgId !== tenant.orgId) {
      throw new ForbiddenException('Access denied: Tool belongs to different organization');
    }

    return tool;
  }

  async update(id: string, updateToolDto: UpdateToolDto, tenant: TenantContext): Promise<Tool> {
    await this.findOne(id, tenant);

    try {
      return await this.prisma.tool.update({
        where: { id },
        data: updateToolDto,
      });
    } catch (error) {
      if (error instanceof Error && (error as any).code === 'P2025') {
        throw new NotFoundException(`Tool with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string, tenant: TenantContext): Promise<Tool> {
    await this.findOne(id, tenant);

    try {
      return await this.prisma.tool.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Error && (error as any).code === 'P2025') {
        throw new NotFoundException(`Tool with ID ${id} not found`);
      }
      throw error;
    }
  }
}
