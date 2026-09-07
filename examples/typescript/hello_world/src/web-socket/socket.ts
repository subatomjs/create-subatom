/// <reference types="node" />
/**
 * WebSocket Initialization & One-to-One Messaging
 *
 * This file configures the real-time WebSocket server using "subatom-pulse".
 * It attaches to your HTTP server, authenticates incoming connections,
 * and sets up direct (1-on-1) private messaging between users.
 */

import type { Server as HttpServer } from "node:http";
import { URL } from "node:url";
import { LocalAdapter, subatomPulse } from "subatom-pulse";

export type SubatomPulseInstance = ReturnType<typeof subatomPulse>;

let io: SubatomPulseInstance | null = null;

export function initSocket(httpServer: HttpServer): SubatomPulseInstance {
  if (io) return io;

  io = subatomPulse({
    // Attach to the existing Node.js HTTP server
    server: httpServer,

    // The URL path where clients establish the WebSocket connection (e.g., ws://localhost:3000/ws)
    path: "/ws",

    // In-memory message routing; swap with RedisAdapter for multi-server scaling
    adapter: new LocalAdapter(),

    // Production safeguards: payload size, concurrency limits, rate limiting, and heartbeats
    maxPayloadBytes: 64 * 1024,      // Limits incoming payload to 64 KB
    maxConnections: 10_000,          // Maximum concurrent client connections
    rateLimitPerSec: 50,             // Max incoming messages per client per second
    heartbeatIntervalMs: 15_000,     // Ping interval to verify active connections
    heartbeatTimeoutMs: 5_000,       // Max time to wait for pong before disconnecting

    // Authenticates connection requests before opening the socket
    authenticator: async (req) => {
      try {
        const url = new URL(req.url ?? "/", "http://" + (req.headers.host ?? "localhost"));
        const token = url.searchParams.get("token") ?? req.headers.authorization;
        const userId = url.searchParams.get("user");

        // Starter check: replace with your actual JWT or session verification logic
        if (!token || !userId) {
          return { authenticated: false };
        }

        return {
          authenticated: true,
          userId,
          metadata: { userId },
        };
      } catch {
        return { authenticated: false };
      }
    },
  });

  // Client connection lifecycle
  io.onConnection((socket) => {
    const userId = String(socket.metadata.userId);

    // Automatically join the user's private channel for receiving direct messages
    socket.join("user:" + userId);

    // Listen for direct messages sent to another user
    socket.on("chat.send", (data: { to?: string; text?: string }, ack) => {
      if (!data?.to || !data?.text) {
        return ack?.({ ok: false, error: "Both 'to' and 'text' are required" });
      }

      // Forward message exclusively to the recipient's private channel
      socket.to("user:" + data.to).emit("chat.receive", {
        from: userId,
        text: data.text,
        timestamp: Date.now(),
      });

      // Confirm receipt back to the sender
      ack?.({ ok: true });
    });
  });

  return io;
}

/**
 * Access the active WebSocket instance from any route, controller, or service.
 */
export function getIO(): SubatomPulseInstance {
  if (!io) {
    throw new Error("Socket subsystem accessed before initialization.");
  }
  return io;
}