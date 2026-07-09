import { NestFactory } from '@nestjs/core';
import { CoursesModule } from './courses.module';

async function bootstrap() {
  const app = await NestFactory.create(CoursesModule);

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port, '0.0.0.0');
}

bootstrap();
