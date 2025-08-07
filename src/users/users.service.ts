import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, tenant: TenantContext): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...createUserDto,
        orgId: tenant.orgId,
      },
    });
  }

  async findAll(tenant: TenantContext): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { orgId: tenant.orgId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        _count: {
          select: { executionLogs: true },
        },
      },
    });
  }

  async findOne(id: string, tenant: TenantContext): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        _count: {
          select: { executionLogs: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.orgId !== tenant.orgId) {
      throw new ForbiddenException('Access denied: User belongs to different organization');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, tenant: TenantContext): Promise<User> {
    const user = await this.findOne(id, tenant);

    try {
      return await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });
    } catch (error) {
      if (error instanceof Error && (error as any).code === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string, tenant: TenantContext): Promise<User> {
    const user = await this.findOne(id, tenant);

    try {
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Error && (error as any).code === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }
}