import { Injectable } from '@nestjs/common';

@Injectable()
export class ReviewsService {
  /**
   * Stub: will be implemented in Day 4 (agent pipeline).
   * For now, returns a placeholder after quota check passes.
   */
  async runReview(
    _userId: string,
    _repoFullName: string,
    _prNumber: number,
  ): Promise<{ id: string; status: string }> {
    return {
      id: 'stub',
      status: 'pending',
    };
  }
}
