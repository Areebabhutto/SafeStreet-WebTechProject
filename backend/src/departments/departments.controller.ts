import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class UpsertDepartmentDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Departments are the routing target for incidents (e.g. "Roads",
 * "Sanitation", "Water"). Only ADMIN can create/edit/delete; any
 * authenticated user can list them (needed for signup + filters).
 */
@ApiTags('departments')
@ApiBearerAuth('access-token')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all departments' })
  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: '[ADMIN] Create a department' })
  create(@Body() dto: UpsertDepartmentDto) {
    return this.prisma.department.create({ data: dto });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: '[ADMIN] Update a department' })
  update(@Param('id') id: string, @Body() dto: Partial<UpsertDepartmentDto>) {
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: '[ADMIN] Delete a department' })
  remove(@Param('id') id: string) {
    return this.prisma.department.delete({ where: { id } });
  }
}
