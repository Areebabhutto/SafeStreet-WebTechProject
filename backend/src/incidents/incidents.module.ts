import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { AiProxyModule } from '../ai-proxy/ai-proxy.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AiProxyModule, NotificationsModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
