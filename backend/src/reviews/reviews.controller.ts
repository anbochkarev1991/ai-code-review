import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '@supabase/supabase-js';
import type { PostReviewsBody } from 'shared';
import { BillingService } from '../billing/billing.service';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly billingService: BillingService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: User,
    @Req() req: AuthenticatedRequest,
    @Body() body: PostReviewsBody,
  ) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    const usage = await this.billingService.getUsage(user.id, token);
    if (usage.review_count >= usage.limit) {
      throw new HttpException(
        { message: 'Review quota exceeded. Upgrade to Pro for more reviews.' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const { repo_full_name, pr_number } = body ?? {};
    if (!repo_full_name || pr_number == null) {
      throw new BadRequestException(
        'repo_full_name and pr_number are required',
      );
    }
    const prNum =
      typeof pr_number === 'number'
        ? pr_number
        : parseInt(String(pr_number), 10);
    if (Number.isNaN(prNum)) {
      throw new BadRequestException('pr_number must be a valid number');
    }

    const result = await this.reviewsService.runReview(
      user.id,
      token,
      repo_full_name,
      prNum,
    );
    if (result.status === 'completed') {
      await this.billingService.incrementUsage(user.id, token);
    }
    return result;
  }
}
