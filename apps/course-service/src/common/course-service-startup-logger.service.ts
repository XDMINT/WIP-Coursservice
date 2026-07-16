import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class CourseServiceStartupLogger implements OnApplicationBootstrap {
  private readonly logger = new Logger(CourseServiceStartupLogger.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const appEnv =
      this.configService.get<string>('APP_ENV') ??
      process.env.NODE_ENV ??
      'development';

    this.logger.log(
      JSON.stringify({
        level: 'info',
        event: 'course_service_environment',
        appEnv,
        nodeEnv: process.env.NODE_ENV ?? null,
      }),
    );

    if (!this.configService.get<string>('DATABASE_PASSWORD')) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          event: 'missing_configuration',
          key: 'DATABASE_PASSWORD',
          message: 'DATABASE_PASSWORD is not set; the configured default is used.',
        }),
      );
    }

    if (!this.dataSource.isInitialized) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          event: 'database_connection_unavailable',
        }),
      );
      return;
    }

    this.logger.log(
      JSON.stringify({
        level: 'info',
        event: 'database_connection_ready',
        database: this.dataSource.options.database,
        migrationsRun: this.configService.get<string>('DATABASE_MIGRATIONS_RUN') ?? 'true',
      }),
    );

    await this.logMigrationStatus();
  }

  private async logMigrationStatus(): Promise<void> {
    try {
      const migrations = await this.dataSource.query(
        'SELECT "name", "timestamp" FROM "migrations" ORDER BY "timestamp" ASC',
      );
      const latestMigration = migrations[migrations.length - 1];

      this.logger.log(
        JSON.stringify({
          level: 'info',
          event: 'database_migrations_status',
          executedMigrations: migrations.length,
          latestMigration: latestMigration?.name ?? null,
        }),
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          event: 'database_migrations_status_unavailable',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }
}
