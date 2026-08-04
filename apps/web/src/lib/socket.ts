import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "@debate/shared";
import { API_URL } from "./api";

export type DebateSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: DebateSocket | null = null;

/**
 * One shared socket per session. Matchmaking and Debate events both ride
 * this single connection — the API's MatchmakingGateway and DebatesGateway
 * are two Nest gateway classes on the same underlying namespace, so a
 * single client connection reaches both.
 */
export function getSocket(token: string): DebateSocket {
  if (socket && socket.connected) return socket;
  socket = io(API_URL, { auth: { token }, autoConnect: true, transports: ["websocket"] });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
