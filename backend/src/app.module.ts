import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IncidentsModule } from './incidents/incidents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiProxyModule } from './ai-proxy/ai-proxy.module';
import { DepartmentsModule } from './departments/departments.module';

@Module({
  imports: [
    // Loads .env into process.env; isGlobal makes ConfigService injectable anywhere
    ConfigModule.forRoot({ isGlobal: true }),
    // Enables @Cron() decorators used by the SLA monitor
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    AiProxyModule,
    NotificationsModule,
    IncidentsModule,
  ],
})
export class AppModule {}
