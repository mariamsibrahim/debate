import { Controller, Get, Query } from "@nestjs/common";
import { RatingsService } from "./ratings.service";
import { TopicCategory } from "@debate/shared";

@Controller("leaderboard")
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get()
  leaderboard(@Query("category") category?: TopicCategory) {
    return this.ratingsService.leaderboard(category);
  }
}
