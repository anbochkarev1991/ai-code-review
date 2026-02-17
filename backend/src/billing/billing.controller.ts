import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import type { User } from '@supabase/supabase-js';
import { BillingService } from './billing.service';
import type { CheckoutBody } from 'shared';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(
    @CurrentUser() user: User,
    @Body() body: CheckoutBody,
    @Req() req: AuthenticatedRequest,
  ) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    return this.billingService.createCheckoutSession(user, body, token);
  }
}
