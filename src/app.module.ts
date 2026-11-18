import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database';
import { TasksModule } from './modules/v1/tasks';
import { RATE_LIMITER_OPTIONS, RateLimiterGuard } from './utils';

@Module({
  imports: [DatabaseModule, TasksModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: RATE_LIMITER_OPTIONS,
      useValue: {
        ttlMs: Number(process.env.RATE_LIMIT_TTL_MS ?? 60_000),
        max: Number(process.env.RATE_LIMIT_MAX ?? 100),
      },
    },
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
  ],
})
export class AppModule {}
