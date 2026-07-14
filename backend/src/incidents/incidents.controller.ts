import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-status.dto';
import { AssignIncidentDto } from './dto/assign-incident.dto';
import { DraftResolutionDto } from './dto/draft-resolution.dto';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('incidents')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard) // JwtAuthGuard is also applied globally; explicit here for clarity + Swagger
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @Roles(Role.CITIZEN, Role.ADMIN)
  @ApiOperation({ summary: '[CITIZEN] Submit a new incident report (runs AI duplicate check + classification)' })
  create(@Body() dto: CreateIncidentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List incidents, scoped by role and optional filters (dept/status/priority/date range)' })
  findAll(@Query() query: QueryIncidentsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single incident with full timeline history' })
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }

  @Patch(':id/assign')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  @ApiOperation({ summary: '[SUPERVISOR/ADMIN] Assign an incident to a worker' })
  assign(@Param('id') id: string, @Body() dto: AssignIncidentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.assign(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(Role.WORKER, Role.SUPERVISOR, Role.ADMIN)
  @ApiOperation({ summary: '[WORKER/SUPERVISOR/ADMIN] Advance incident status (En Route/On Site/Resolved/...)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.incidentsService.updateStatus(id, dto, user);
  }

  @Post(':id/draft-response')
  @Roles(Role.WORKER, Role.SUPERVISOR, Role.ADMIN)
  @ApiOperation({ summary: '[WORKER/SUPERVISOR] Generate an AI-drafted, empathetic citizen-facing resolution message' })
  draftResponse(@Param('id') id: string, @Body() dto: DraftResolutionDto) {
    return this.incidentsService.draftResolutionResponse(id, dto);
  }
}
