import { JwtService } from "@nestjs/jwt";
import { Socket } from "socket.io";
import { AuthenticatedUser } from "./guards/jwt-auth.guard";

/**
 * Sockets authenticate with the same JWT issued by REST /auth/login, sent
 * as `socket.handshake.auth.token`. Returns null (and disconnects the
 * socket) if the token is missing or invalid.
 */
export function authenticateSocket(client: Socket, jwt: JwtService): AuthenticatedUser | null {
  const token = client.handshake.auth?.token as string | undefined;
  if (!token) {
    client.disconnect();
    return null;
  }
  try {
    const payload = jwt.verify(token);
    return { id: payload.sub, email: payload.email, username: payload.username };
  } catch {
    client.disconnect();
    return null;
  }
}
