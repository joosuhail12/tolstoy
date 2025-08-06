import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Flow } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class FlowsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createFlowDto: CreateFlowDto, tenant: TenantContext): Promise<Flow> {
    return this.prisma.flow.create({
      data: {
        ...createFlowDto,
        orgId: tenant.orgId,
      },
    });
  }

  async findAll(tenant: TenantContext): Promise<Flow[]> {
    return this.prisma.flow.findMany({
      where: { orgId: tenant.orgId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        _count: {
          select: { executionLogs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenant: TenantContext): Promise<Flow> {
    const flow = await this.prisma.flow.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        executionLogs: {
          select: {
            id: true,
            stepId: true,
            status: true,
            createdAt: true,
            user: {
              select: { id: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // Latest 10 execution logs
        },
      },
    });

    if (!flow) {
      throw new NotFoundException(`Flow with ID ${id} not found`);
    }

    if (flow.orgId !== tenant.orgId) {
      throw new ForbiddenException('Access denied: Flow belongs to different organization');
    }

    return flow;
  }

  async update(id: string, updateFlowDto: UpdateFlowDto, tenant: TenantContext): Promise<Flow> {
    const flow = await this.findOne(id, tenant);

    try {
      return await this.prisma.flow.update({
        where: { id },
        data: updateFlowDto,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Flow with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string, tenant: TenantContext): Promise<Flow> {
    const flow = await this.findOne(id, tenant);

    try {
      return await this.prisma.flow.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Flow with ID ${id} not found`);
      }
      throw error;
    }
  }
}