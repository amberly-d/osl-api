import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { ProjectsModule } from './projects/projects.module.js';

@Module({
  imports: [AppConfigModule, DatabaseModule, ProjectsModule],
  controllers: [HealthController],
  providers: [
    {
      // Registered here (not in main.ts) so e2e tests get the same validation.
      // Unknown body fields are rejected, not silently dropped.
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
