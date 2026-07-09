// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkflowModule} from "./module/workflow.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WorkflowModule,
  ],
})
export class AppModule {}