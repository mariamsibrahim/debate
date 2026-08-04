import { Module } from "@nestjs/common";
import { MatchmakingService } from "./matchmaking.service";
import { MatchmakingGateway } from "./matchmaking.gateway";
import { AuthModule } from "../auth/auth.module";
import { DebatesModule } from "../debates/debates.module";

@Module({
  imports: [AuthModule, DebatesModule],
  providers: [MatchmakingService, MatchmakingGateway],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
