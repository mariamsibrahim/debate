import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TopicsModule } from "./topics/topics.module";
import { RatingsModule } from "./ratings/ratings.module";
import { AiModule } from "./ai/ai.module";
import { DebatesModule } from "./debates/debates.module";
import { MatchmakingModule } from "./matchmaking/matchmaking.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TopicsModule,
    RatingsModule,
    AiModule,
    DebatesModule,
    MatchmakingModule,
  ],
})
export class AppModule {}
