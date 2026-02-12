import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './user.decorator';
import { MeService } from './me.service';
import type { User } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from './jwt-auth.guard';

@Controller()
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(
    @CurrentUser() user: User,
    @Req() req: AuthenticatedRequest,
  ) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    return this.meService.getMe(user, token);
  }
}
