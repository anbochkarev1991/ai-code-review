import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './user.decorator';
import type { User } from '@supabase/supabase-js';

@Controller('auth')
export class AuthController {
  @Get('protected')
  @UseGuards(JwtAuthGuard)
  protectedRoute(@CurrentUser() user: User): { ok: boolean; sub: string } {
    return { ok: true, sub: user.id };
  }
}
