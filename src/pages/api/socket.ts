// pages/api/socket.ts
import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import type { Socket as NetSocket } from "net";
import { Server as IOServer } from "socket.io";

export const config = { api: { bodyParser: false } };

type NextResWithSocket = NextApiResponse & {
  socket: NetSocket & { server: HTTPServer & { io?: IOServer } };
};

export default function handler(req: NextApiRequest, res: NextResWithSocket) {
  if (!res.socket?.server) {
    res.status(503).end("No server");
    return;
  }
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, {
      path: "/api/socket",
      cors: { origin: "*", methods: ["GET", "POST"] },
    });
    io.on("connection", (socket) => {
      console.log("[socket] connected", socket.id);
      socket.on("push", (msg) => io.emit("push", msg));
    });
    res.socket.server.io = io;
    console.log("[socket] server started");
  }
  res.end(); // 200 OK
}