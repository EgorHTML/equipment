import { Module, Global } from '@nestjs/common';
import { databaseProvider } from './database.provider';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule.forRoot()],
  providers: [databaseProvider],
  exports: [databaseProvider],
})
export class DatabaseModule {}
