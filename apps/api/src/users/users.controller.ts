import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":username")
  getProfile(@Param("username") username: string) {
    return this.usersService.getPublicProfile(username);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me")
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { bio?: string; country?: string; interests?: string[]; favoriteTopics?: string[] },
  ) {
    return this.usersService.updateMyProfile(user.id, body);
  }
}
