import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [],
  controllers: [AuthController, MeController],
  providers: [MeService],
  exports: [],
})
export class AuthModule {}
