import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import fastifyMultipart from '@fastify/multipart';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const adapter = new FastifyAdapter();

  await adapter.register(fastifyMultipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1024 * 1024,
      fields: 10,
      fileSize: 100 * 1024 * 1024,
      files: 10,
      headerPairs: 2000,
    },
    attachFieldsToBody: true,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { logger: ['log', 'error', 'warn', 'debug', 'verbose'] },
  );

  const config = new DocumentBuilder()
    .setTitle('Equipment API')
    .setDescription('API для модуля учета оборудования HelpDesk')
    .setVersion('1.0')
    // .addTag('cats')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('swagger', app, document);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  app.enableCors({
    origin: '*', // фронтенд URL в production
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
