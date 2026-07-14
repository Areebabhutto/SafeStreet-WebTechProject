import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Admin-only user management: list all users (filterable by role/department),
 * change roles, assign departments, or deactivate accounts. Used by
 * AdminDash's "Users" tab.
 */
@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERVISOR)
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '[ADMIN/SUPERVISOR] List users, optionally filtered by role/department' })
  findAll(@Query('role') role?: Role, @Query('departmentId') departmentId?: string) {
    return this.prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        departmentId: true,
        department: { select: { name: true, code: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: '[ADMIN] Update a user role, department, or active status' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        departmentId: true,
      },
    });
  }
}
