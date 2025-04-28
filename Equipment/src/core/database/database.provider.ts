import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const PG_CONNECTION = 'PG_CONNECTION';

export const databaseProvider: Provider = {
  provide: PG_CONNECTION,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const pool = new Pool({
      host: configService.get<string>('POSTGRES_HOST'),
      port: configService.get<number>('POSTGRES_PORT'),
      user: configService.get<string>('POSTGRES_USER'),
      password: configService.get<string>('POSTGRES_PASSWORD'),
      database: configService.get<string>('POSTGRES_DB'),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    try {
      await pool.connect();
      console.log('PostgreSQL Connected');
      return pool;
    } catch (error) {
      console.error('PostgreSQL Connection Error:', error);
      throw error;
    }
  },
};
