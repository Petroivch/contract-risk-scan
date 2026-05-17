import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRepository } from '../repository/auth.repository';
import { AuthService } from '../services/auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
  exports: [AuthService]
})
export class AuthModule {}
