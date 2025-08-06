import { Injectable, NotFoundException } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrganizationDto: CreateOrganizationDto): Promise<Organization> {
    return this.prisma.organization.create({
      data: createOrganizationDto,
    });
  }

  async findAll(): Promise<Organization[]> {
    return this.prisma.organization.findMany({
      include: {
        _count: {
          select: {
            users: true,
            tools: true,
            flows: true,
            executionLogs: true,
          },
        },
      },
    });
  }

  async findOne(id: string): Promise<Organization> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            tools: true,
            flows: true,
            executionLogs: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return organization;
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto): Promise<Organization> {
    try {
      return await this.prisma.organization.update({
        where: { id },
        data: updateOrganizationDto,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Organization with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Organization> {
    try {
      return await this.prisma.organization.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Organization with ID ${id} not found`);
      }
      throw error;
    }
  }
}