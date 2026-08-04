import { Controller, Get, Param, Query } from "@nestjs/common";
import { TopicsService } from "./topics.service";
import { TopicCategory } from "@debate/shared";

@Controller("topics")
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get()
  list(@Query("category") category?: TopicCategory, @Query("q") query?: string) {
    return this.topicsService.list({ category, query });
  }

  @Get("trending")
  trending() {
    return this.topicsService.trending();
  }

  @Get("suggest")
  suggest(@Query("text") text: string) {
    return this.topicsService.suggest(text ?? "");
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.topicsService.getById(id);
  }

  @Get(":id/related")
  getRelated(@Param("id") id: string) {
    return this.topicsService.getRelated(id);
  }
}
