import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@Controller("debates")
export class DebatesController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  myHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.debate.findMany({
      where: { participants: { some: { userId: user.id } } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { topic: true, participants: true, scores: true },
    });
  }

  @Get(":id")
  async getOne(@Param("id") id: string) {
    return this.prisma.debate.findUnique({
      where: { id },
      include: {
        topic: true,
        participants: { include: { user: { include: { profile: true } } } },
        scores: true,
        events: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  @Get()
  list(@Query("status") status?: "WAITING" | "ACTIVE" | "COMPLETED" | "ABANDONED") {
    return this.prisma.debate.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { topic: true },
    });
  }
}
