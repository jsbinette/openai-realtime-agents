// src/lib/socketClient.ts
"use client";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("Socket client must run in the browser");
  }
  if (!socket) {
    socket = io({ path: "/api/socket", withCredentials: false });
    socket.on("connect", () => console.log("[socket] connected", socket?.id));
    socket.on("disconnect", () => console.log("[socket] disconnected"));
  }
  return socket;
}