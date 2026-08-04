import { Module } from "@nestjs/common";
import { DebatesService } from "./debates.service";
import { DebatesGateway } from "./debates.gateway";
import { DebatesController } from "./debates.controller";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { RatingsModule } from "../ratings/ratings.module";

@Module({
  imports: [AuthModule, AiModule, RatingsModule],
  providers: [DebatesService, DebatesGateway],
  controllers: [DebatesController],
  exports: [DebatesService, DebatesGateway],
})
export class DebatesModule {}
