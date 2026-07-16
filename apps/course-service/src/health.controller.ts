import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async getHealth() {
    await this.dataSource.query('select 1');

    return {
      status: 'ok',
      database: 'ok',
    };
  }
}
