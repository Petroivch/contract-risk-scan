import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config.type';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const apiPrefix = configService.get('http.apiPrefix', { infer: true });
  app.setGlobalPrefix(apiPrefix);

  const swaggerConfig = configService.get('swagger', { infer: true });
  if (swaggerConfig.enabled) {
    const documentBuilder = new DocumentBuilder()
      .setTitle(swaggerConfig.title)
      .setDescription(swaggerConfig.description)
      .setVersion(swaggerConfig.version)
      .addBearerAuth();

    const document = SwaggerModule.createDocument(app, documentBuilder.build());
    SwaggerModule.setup(swaggerConfig.path, app, document);
  }

  const port = configService.get('http.port', { infer: true });
  await app.listen(port);
}

bootstrap();