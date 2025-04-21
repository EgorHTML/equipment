import { Module, Global } from '@nestjs/common';
import { databaseProvider, PG_CONNECTION } from './database.provider';

@Global()
@Module({
  providers: [databaseProvider],
  exports: [PG_CONNECTION],
})
export class DatabaseModule {}
