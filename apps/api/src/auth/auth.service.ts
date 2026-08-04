import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { TOPIC_CATEGORIES, TopicCategory } from "@debate/shared";
import { SignupDto } from "./dto/signup.dto";
import { LoginDto } from "./dto/login.dto";

const STARTING_ELO = 1000;
// Global/uncategorized debates don't get their own competitive ladder.
const RATED_CATEGORIES: TopicCategory[] = TOPIC_CATEGORIES.filter((c) => c !== "GENERAL");

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const [existingEmail, existingUsername] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.profile.findUnique({ where: { username: dto.username } }),
    ]);
    if (existingEmail) throw new ConflictException("An account with that email already exists");
    if (existingUsername) throw new ConflictException("That username is taken");

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        profile: { create: { username: dto.username } },
        trustScore: { create: {} },
        ratings: { create: RATED_CATEGORIES.map((category) => ({ category, elo: STARTING_ELO })) },
      },
      include: { profile: true },
    });

    return this.issueToken(user.id, user.email, user.profile!.username);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });
    if (!user || !user.profile) throw new UnauthorizedException("Invalid email or password");

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid email or password");

    return this.issueToken(user.id, user.email, user.profile.username);
  }

  private issueToken(userId: string, email: string, username: string) {
    const accessToken = this.jwt.sign({ sub: userId, email, username });
    return { accessToken, user: { id: userId, email, username } };
  }
}
