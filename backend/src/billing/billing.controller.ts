import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
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

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  async getUsage(@CurrentUser() user: User, @Req() req: AuthenticatedRequest) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    return this.billingService.getUsage(user.id, token);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: boolean }> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new BadRequestException('Stripe webhook secret not configured');
    }

    const event = this.billingService.verifyWebhook(rawBody, signature, secret);
    await this.billingService.handleWebhookEvent(event);
    return { received: true };
  }
}
