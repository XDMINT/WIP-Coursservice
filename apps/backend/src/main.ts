import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { RequestLoggingInterceptor } from './common/request-logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';

  logger.log(
    JSON.stringify({
      level: 'info',
      event: 'backend_starting',
      appEnv,
    }),
  );

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port, '0.0.0.0');

  logger.log(
    JSON.stringify({
      level: 'info',
      event: 'backend_started',
      appEnv,
      port,
    }),
  );
}

bootstrap();
