import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { BillingService } from '../billing/billing.service';
import { IssueGeneratorService } from './issue-generator.service';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { HttpException } from '@nestjs/common';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let billingService: { getUsage: jest.Mock; incrementUsage: jest.Mock };
  let reviewsService: { runReview: jest.Mock };

  beforeEach(async () => {
    billingService = {
      getUsage: jest.fn(),
      incrementUsage: jest.fn(),
    };

    reviewsService = {
      runReview: jest.fn(),
    };

    const issueGeneratorService = {
      generate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: BillingService, useValue: billingService },
        { provide: ReviewsService, useValue: reviewsService },
        { provide: IssueGeneratorService, useValue: issueGeneratorService },
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  describe('POST /reviews', () => {
    const mockUser: User = { id: 'user-123' } as User;
    const mockReq: AuthenticatedRequest = {
      headers: { authorization: 'Bearer test-token' },
    } as AuthenticatedRequest;
    const mockBody = { repo_full_name: 'owner/repo', pr_number: 42 };

    it('should return updated usage in the response after a completed review', async () => {
      billingService.getUsage
        .mockResolvedValueOnce({ review_count: 3, limit: 10, plan: 'free' })
        .mockResolvedValueOnce({ review_count: 4, limit: 10, plan: 'free' });

      reviewsService.runReview.mockResolvedValue({
        id: 'review-1',
        status: 'complete',
        result_snapshot: { summary: 'ok', findings: [] },
      });

      billingService.incrementUsage.mockResolvedValue(undefined);

      const result = await controller.create(mockUser, mockReq, mockBody);

      expect(result.usage).toEqual({
        review_count: 4,
        limit: 10,
        plan: 'free',
      });
      expect(billingService.incrementUsage).toHaveBeenCalledWith(
        'user-123',
        'test-token',
      );
      expect(billingService.getUsage).toHaveBeenCalledTimes(2);
    });

    it('should increment usage for partial reviews too', async () => {
      billingService.getUsage
        .mockResolvedValueOnce({ review_count: 3, limit: 10, plan: 'free' })
        .mockResolvedValueOnce({ review_count: 4, limit: 10, plan: 'free' });

      reviewsService.runReview.mockResolvedValue({
        id: 'review-partial',
        status: 'partial',
        result_snapshot: { summary: 'ok', findings: [] },
      });

      billingService.incrementUsage.mockResolvedValue(undefined);

      const result = await controller.create(mockUser, mockReq, mockBody);

      expect(result.usage).toEqual({
        review_count: 4,
        limit: 10,
        plan: 'free',
      });
      expect(billingService.incrementUsage).toHaveBeenCalledWith(
        'user-123',
        'test-token',
      );
    });

    it('should return usage even when review fails (status !== complete)', async () => {
      billingService.getUsage.mockResolvedValue({
        review_count: 3,
        limit: 10,
        plan: 'free',
      });

      reviewsService.runReview.mockResolvedValue({
        id: 'review-2',
        status: 'failed',
        error_message: 'Pipeline error',
      });

      const result = await controller.create(mockUser, mockReq, mockBody);

      expect(result.usage).toEqual({
        review_count: 3,
        limit: 10,
        plan: 'free',
      });
      expect(billingService.incrementUsage).not.toHaveBeenCalled();
    });

    it('should throw PAYMENT_REQUIRED when quota is exceeded', async () => {
      billingService.getUsage.mockResolvedValue({
        review_count: 10,
        limit: 10,
        plan: 'free',
      });

      await expect(
        controller.create(mockUser, mockReq, mockBody),
      ).rejects.toThrow(HttpException);

      expect(reviewsService.runReview).not.toHaveBeenCalled();
    });
  });
});
