import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {SwaggerModule} from '@nestjs/swagger';
import * as yaml from 'yamljs';
import {join} from 'path';
import SwaggerParser from "@apidevtools/swagger-parser";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors();

    const yamlPath = join(__dirname, '../../../../api-contracts/workflow-api.yaml');
    try {
        const document = await SwaggerParser.bundle(yamlPath);
        SwaggerModule.setup('api', app, document as any);
        console.log('✅ Swagger UI is running on: http://localhost:3000/api');
    } catch (error) {
        console.error('❌ Error loading from Swagger YAML-File:', (error as Error).message);
        console.error('👉 Searched path was:', yamlPath);
    }

    await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();