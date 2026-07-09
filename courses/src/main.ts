import { NestFactory } from '@nestjs/core';
import { CoursesModule } from './courses.module';

async function bootstrap() {
  const app = await NestFactory.create(CoursesModule);
  await app.listen(process.env.port ?? 3001);
}
bootstrap();
