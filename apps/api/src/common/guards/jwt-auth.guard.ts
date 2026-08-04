import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = extractToken(request.headers?.authorization);
    if (!token) throw new UnauthorizedException("Missing bearer token");

    try {
      const payload = this.jwt.verify(token);
      request.user = { id: payload.sub, email: payload.email, username: payload.username } as AuthenticatedUser;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}

export function extractToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  return scheme === "Bearer" && token ? token : null;
}
