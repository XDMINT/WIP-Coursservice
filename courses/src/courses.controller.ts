import { Controller, Get } from '@nestjs/common';
import { CoursesService } from './courses.service';

@Controller()
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  getHello(): string {
    return this.coursesService.getHello();
  }
}
