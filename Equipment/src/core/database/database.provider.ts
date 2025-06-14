import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

export const PG_CONNECTION = 'PG_CONNECTION';

export const databaseProvider: Provider = {
  provide: PG_CONNECTION,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const AppDataSource = new DataSource({
      type: 'postgres',
      host: configService.get<string>('POSTGRES_HOST'),
      port: configService.get<number>('POSTGRES_PORT'),
      username: configService.get<string>('POSTGRES_USER'),
      password: configService.get<string>('POSTGRES_PASSWORD'),
      database: configService.get<string>('POSTGRES_DB'),
      synchronize: true,
      logging: true,
      entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
      subscribers: [],
      migrations: [],
    });
    try {
      await AppDataSource.initialize();
      console.log('PostgreSQL Connected');
      return AppDataSource;
    } catch (error) {
      console.error('PostgreSQL Connection Error:', error);
      throw error;
    }
  },
};
