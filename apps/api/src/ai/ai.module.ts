import { Module } from "@nestjs/common";
import { ModeratorService } from "./moderator.service";
import { JudgeService } from "./judge.service";
import { DebaterService } from "./debater.service";

@Module({
  providers: [ModeratorService, JudgeService, DebaterService],
  exports: [ModeratorService, JudgeService, DebaterService],
})
export class AiModule {}
