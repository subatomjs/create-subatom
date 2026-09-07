import { Subatom, setupApiDocs, type IRequest, type IResponse , serveStatic } from "subatom";
import { getIO } from "./web-socket/socket.js";
import userRouter from "./routes/user.route.js";

const server = new Subatom();

// Server static file from public directory
server.use(serveStatic("public"))


// Root route
server.get("/", async (_req:IRequest, res:IResponse) => {
  return res.status(200).json({ message: "Subatom API is running" });
});

// Real-time socket metrics
server.get("/metrics", async (_req:IRequest, res:IResponse) => {
  try {
    const io = getIO();
    return res.status(200).json(io.getMetrics());
  } catch {
    return res.status(503).json({ error: "Socket engine not ready" });
  }
});

// API Routes
server.use("/api/v1", userRouter);

// API Documentation at /docs
setupApiDocs(server, {
  path: "/docs",
  title: "Subatom Pulse API",
  version: "1.0.0",
});

export default server;