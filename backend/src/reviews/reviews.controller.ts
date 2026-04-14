import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '@supabase/supabase-js';
import type { PostReviewsBody, GenerateIssueBody } from 'shared';
import { BillingService } from '../billing/billing.service';
import { ReviewsService } from './reviews.service';
import { IssueGeneratorService } from './issue-generator.service';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly billingService: BillingService,
    private readonly reviewsService: ReviewsService,
    private readonly issueGeneratorService: IssueGeneratorService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe)
    offset: number,
  ) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    return this.reviewsService.findAll(limit, offset, token);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    const review = await this.reviewsService.findOne(id, token);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  @Post('generate-issue')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async generateIssue(@Body() body: GenerateIssueBody) {
    const { finding, pr_metadata } = body ?? {};
    if (!finding?.title || !finding?.severity) {
      throw new BadRequestException(
        'finding with title and severity is required',
      );
    }
    const issue_text = await this.issueGeneratorService.generate(
      finding,
      pr_metadata,
    );
    return { issue_text };
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
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

    const usage = await this.billingService.getUsage(
      user.id,
      token,
      user.email ?? undefined,
    );
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

    await this.billingService.incrementUsage(user.id, token);

    const result = await this.reviewsService.runReview(
      user.id,
      token,
      repo_full_name,
      prNum,
    );

    const updatedUsage = await this.billingService.getUsage(
      user.id,
      token,
      user.email ?? undefined,
    );
    return { ...result, usage: updatedUsage };
  }
}
