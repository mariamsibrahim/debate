import { Module } from "@nestjs/common";
import { EloService } from "./elo.service";
import { RatingsService } from "./ratings.service";
import { RatingsController } from "./ratings.controller";

@Module({
  providers: [EloService, RatingsService],
  controllers: [RatingsController],
  exports: [RatingsService, EloService],
})
export class RatingsModule {}
