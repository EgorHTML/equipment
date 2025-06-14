import { registerAs } from '@nestjs/config';

export const configuration = registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),

  database: {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT ?? '80', 10),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL,
    reportQueue: process.env.RABBITMQ_REPORT_QUEUE,
    exportQueue: process.env.RABBITMQ_EXPORT_QUEUE,
    importQueue: process.env.RABBITMQ_IMPORT_QUEUE,
  },

  // apiKey: process.env.API_KEY,
  // jwt: {
  //   secret: process.env.JWT_SECRET,
  //   expiresIn: process.env.JWT_EXPIRES_IN || '60s',
  // },
}));

export type AppConfig = ReturnType<typeof configuration>;
export type DatabaseConfig = AppConfig['database'];
export type RabbitMQConfig = AppConfig['rabbitmq'];
