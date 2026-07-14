import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AiProxyService } from './ai-proxy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

/**
 * Most AI-proxy methods (classify, duplicate-check, draft) are invoked
 * internally by IncidentsService as part of the incident lifecycle. The
 * Hotspot Predictor is the one AI feature queried directly by the frontend
 * (SupervisorDash / AdminDash analytics views), so it gets its own endpoint.
 */
@ApiTags('ai-proxy')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERVISOR, Role.ADMIN)
@Controller('ai/hotspots')
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  @Get()
  @ApiOperation({ summary: '[SUPERVISOR/ADMIN] AI-generated incident hotspot grid + summary' })
  getHotspots(@Query('daysBack') daysBack?: string) {
    return this.aiProxyService.predictHotspots(daysBack ? parseInt(daysBack, 10) : undefined);
  }
}
