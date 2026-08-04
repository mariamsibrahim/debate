import { Module } from "@nestjs/common";
import { ModeratorService } from "./moderator.service";
import { JudgeService } from "./judge.service";

@Module({
  providers: [ModeratorService, JudgeService],
  exports: [ModeratorService, JudgeService],
})
export class AiModule {}
