/** biome-ignore-all lint/complexity/noUselessStringRaw: explanation */
import { fileURLToPath } from "node:url";
import type { Database, Language, Orm, ProjectConfig } from "../types.js";

const TEMPLATES_DIR: string = fileURLToPath(
  new URL("../../templates", import.meta.url),
);

const SNIPPET_FILENAME = "package.snippet.json";

const SNIPPET_PATTERN = /^package\.snippet(?:\..+)?\.json$/;

const redisEnvironmentVariable: { key: string; value: string }[] = [
  { key: "REDIS_URL", value: "'redis://127.0.0.1:6379/'" },
  { key: "REDIS_KEY_PREFIX", value: "'subatom_app:'" },
  { key: "REDIS_REQUIRED", value: "false" },
  { key: "REDIS_CONNECT_TIMEOUT_MS", value: "10000" },
  { key: "REDIS_SHUTDOWN_TIMEOUT_MS", value: "5000" },
  { key: "REDIS_DEBUG", value: "false" },
];

// Generates valid `KEY: process.env.KEY || default,` lines,
// consistent with the rest of the environment object.
function redisEnvLines(isTs: boolean): string {
  return redisEnvironmentVariable
    .map(({ key, value }) => {
      const cast = isTs ? " as string" : "";
      return `  ${key}: process.env.${key}${cast} || ${value},`;
    })
    .join("\n");
}

// .env create
function dotEnvFileContent(): string {
  return `/// <reference types="node" />
import * as fs from "fs";

const source = ".env.requirements";
const destination = ".env";

if (!fs.existsSync(destination)) {
  fs.copyFileSync(source, destination);
  console.log("✅ Created .env from .env.requirements");
} else {
  console.log("ℹ️ .env already exists");
}`;
}

// main.js || main.ts
function mainFileContent(
  database: Database,
  orm: Orm,
  fileType: Language,
  useRedis: boolean,
  useSocket: boolean,
): string {
  const hasOrm = orm !== "none";
  const hasDb = database !== "none";
  const relationalDbs: Database[] = ["postgresql", "sqlite", "mysql"];

  // 1. Validate supported combinations only if an ORM is chosen
  if (hasOrm) {
    if (orm === "mongoose" && database !== "mongodb") {
      return "// Unsupported database configuration: Mongoose only supports MongoDB.";
    }
    if (
      (orm === "prisma" || orm === "drizzle") &&
      !relationalDbs.includes(database)
    ) {
      return `// Unsupported database configuration: ${orm} only supports relational databases (PostgreSQL, MySQL, SQLite).`;
    }
  }

  // 2. Language specifics
  const isTs = fileType === "ts";
  const returnType = isTs ? ": Promise<void>" : "";
  const logError = isTs ? "error as Error" : "error";
  const httpServerType = isTs ? ": HttpServer | null" : "";
  const ioType = isTs ? ": SubatomPulseInstance | null" : "";
  const signalType = isTs ? "signal: string" : "signal";

  // 3. Database imports, connections, and graceful disconnect logic
  let dbImports = "";
  let dbConnectLogic = "";
  let dbDisconnectLogic = "";

  if (hasOrm && hasDb) {
    if (orm === "mongoose") {
      dbImports = `import connectDB from "./src/config/mongoConnect.js";\nimport mongoose from "mongoose";\n`;
      dbConnectLogic = `console.info("⏳ Connecting to MongoDB (Mongoose)...");\n    await connectDB();\n    console.info("✅ Connected to MongoDB successfully");\n`;
      dbDisconnectLogic = `if (mongoose.connection.readyState !== 0) {\n        console.info("🗄️ [Shutdown] Disconnecting Mongoose...");\n        await mongoose.disconnect();\n      }`;
    } else if (orm === "prisma") {
      dbImports = `import prisma from "./prisma.js";\n`;
      dbConnectLogic = `console.info("⏳ Connecting to ${database} (Prisma)...");\n    await prisma.$connect();\n    console.info("✅ Connected to ${database} (Prisma) successfully");\n`;
      dbDisconnectLogic = `console.info("🗄️ [Shutdown] Disconnecting Prisma...");\n      await prisma.$disconnect();`;
    } else if (orm === "drizzle" && database === "sqlite") {
      dbImports = `import { checkDatabaseConnection, closeDatabase } from "./src/db/db_pool.js";\n`;
      dbConnectLogic = `console.info("⏳ Verifying SQLite (Drizzle) connection...");\n    const healthy = await checkDatabaseConnection();\n    if (!healthy) throw new Error("Database health check failed.");\n    console.info("✅ Connected to SQLite (Drizzle) successfully");\n`;
      dbDisconnectLogic = `console.info("🗄️ [Shutdown] Closing SQLite pool...");\n      closeDatabase();`;
    } else {
      dbImports = `import { db } from "./src/db/db_pool.js";\nimport { sql } from "drizzle-orm";\n`;
      dbConnectLogic = `console.info("⏳ Verifying ${database} (Drizzle) connection...");\n    await db.execute(sql\`SELECT 1\`);\n    console.info("✅ Connected to ${database} (Drizzle) successfully");\n`;
      dbDisconnectLogic = `console.info("🗄️ [Shutdown] Releasing Drizzle connection pool...");`;
    }
  }

  // 4. Redis logic
  const redisImport = useRedis
    ? `import { bootstrapRedis } from "./src/redis/redis.bootstrap.js";\n`
    : "";
  const redisConnect = useRedis
    ? `console.info("⏳ Initializing Redis client...");\n    await bootstrapRedis();\n    console.info("✅ Redis initialized");\n`
    : "";

  // 5. Build file content
  if (useSocket) {
    const socketImports = [
      isTs ? `import type { Server as HttpServer } from "node:http";` : "",
      `import { initSocket${isTs ? ", type SubatomPulseInstance" : ""} } from "./src/web-socket/socket.js";`,
    ]
      .filter(Boolean)
      .join("\n");

    return `//! Adjust path according to your project if mismatch..
${socketImports}
import server from "./src/server.js";
${redisImport}${dbImports}
async function main()${returnType} {
  let httpServer${httpServerType} = null;
  let io${ioType} = null;
  let isDraining = false;

  const gracefulShutdown = async (${signalType}) => {
    if (isDraining) {return};
    isDraining = true;

    console.warn(\`\\n🛑 [Shutdown] Received \${signal}. Starting coordinated teardown...\`);

    const forceExitTimer = setTimeout(() => {
      console.error("⚠️ [Shutdown] Draining timed out. Forcing process exit.");
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    try {
      // 1. Terminate WebSocket connections
      if (io) {
        console.info("🔌 [Shutdown] Closing WebSocket engine...");
        await io.close();
      }

      // 2. Stop HTTP listener
      if (httpServer && typeof httpServer.close === "function") {
        console.warn("🌐 [Shutdown] Stopping HTTP listener...");
        await new Promise((resolve, reject) => {
         ${isTs ? "httpServer!.close((err) => (err ? reject(err) : resolve(undefined)));" : "httpServer.close((err) => (err ? reject(err) : resolve(undefined)));"}
        });
      }

      // 3. Disconnect database (if any)
      ${dbDisconnectLogic}
      console.info("✅ [Shutdown] Clean shutdown completed.");
      process.exit(0);
    } catch (error) {
      console.error("❌ [Shutdown] Error during teardown:", error);
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => void gracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => void gracefulShutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("🚨 Unhandled Rejection at:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("🚨 Uncaught Exception thrown:", error);
    void gracefulShutdown("UNCAUGHT_EXCEPTION");
  });

  try {
    ${dbConnectLogic}${redisConnect}    // HTTP Engine
    console.info("⏳ Starting Subatom HTTP engine...");
    httpServer = await server.start();
    console.info("✅ Subatom HTTP engine listening");

      // WebSocket mount
    if (!httpServer) {
      throw new Error("HTTP server failed to initialize before WebSocket mount.");
    }

    // WebSocket mount
    io = initSocket(httpServer);
    console.info("✅ Subatom Pulse mounted on /ws");
  } catch (error) {
    console.error("❌ Startup sequence failed:", ${logError});
    await gracefulShutdown("STARTUP_FAILURE");
  }
}

await main();
`;
  }

  // 6. Minimal / Standard setup without WebSocket
  const isBare = !hasOrm && !useRedis;

  if (isBare) {
    return `import server from "./src/server.js";

async function main()${returnType} {
  try {
    await server.start();
  } catch (error) {
    console.error("❌ Failed to start application:", ${logError});
    process.exit(1);
  }
}

await main();
`;
  }

  return `//! Adjust path according to your project if mismatch..
import server from "./src/server.js";
${redisImport}${dbImports}
async function main()${returnType} {
  try {
    ${dbConnectLogic}${redisConnect}    // HTTP Engine
    console.info("⏳ Starting Subatom HTTP engine...");
    await server.start();
    console.info("✅ Subatom HTTP engine listening");
  } catch (error) {
    console.error("❌ Failed to start application:", ${logError});
    process.exit(1);
  }
}

${
  orm === "drizzle" && database === "sqlite"
    ? `process.on("SIGINT", () => { closeDatabase(); process.exit(0); });
process.on("SIGTERM", () => { closeDatabase(); process.exit(0); });\n\n`
    : ""
}await main();
`;
}

function serverFileContent(useSocket: boolean, language: "ts" | "js") {
  if (!useSocket && language === "ts") {
    return `import {Subatom, json, urlencoded, serveStatic, type IRequest, type IResponse} from 'subatom';
import userRouter from "./routes/user.route.js";

const server = new Subatom()

// Server static file from public directory
server.use(serveStatic("public"))



server.use(json({ limit: "500mb" }));
server.use(urlencoded({ limit: "50mb" }));



server.use("/api/v1", userRouter)

server.get("/", async(req:IRequest, res:IResponse) => {
    return res.status(200).json("Hello World.")
});


export default server`;
  } else if (!useSocket && language === "js") {
    return `import {Subatom, json, urlencoded, serveStatic} from 'subatom';
import userRouter from "./routes/user.route.js";

const server = new Subatom()

server.use(json({ limit: "500mb" }));
server.use(urlencoded({ limit: "50mb" }));

// Server static file from public directory
server.use(serveStatic("public"))



server.use("/api/v1", userRouter)

server.get("/", async(req, res) => {
    return res.status(200).json("Hello World.")
});



export default server
`;
  } else if (useSocket && language === "js") {
    return `import { Subatom, SubAtomDocs, serveStatic } from "subatom";
import { getIO } from "./web-socket/socket.js";
import userRouter from "./routes/user.route.js";

const server = new Subatom();


// Server static file from public directory
server.use(serveStatic("public"))

// Root route
server.get("/", async (_req, res) => {
  return res.status(200).json({ message: "Subatom API is running" });
});

// Real-time socket metrics
server.get("/metrics", async (_req, res) => {
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
SubAtomDocs(server, {
  path: "/docs",
  title: "Subatom Pulse API",
  version: "1.0.0",
});

export default server;`;
  } else {
    return `import { Subatom, SubAtomDocs, type ISubatom, type IRequest, type IResponse, serveStatic } from "subatom";
import { getIO } from "./web-socket/socket.js";
import userRouter from "./routes/user.route.js";

const server: ISubatom = new Subatom();

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
SubAtomDocs(server, {
  path: "/docs",
  title: "Subatom Pulse API",
  version: "1.0.0",
});

export default server;`;
  }
}

// src/user.routes.ts || src/user.routes.ts
function userRouterFileContent(language: "ts" | "js"): string {
  if (language === "ts") {
    return `import { type IRouter, Router, file, type IRouteMiddleware } from "subatom";
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  userIdParamSchema,
} from "../schema/user.schema.js";
import {
  createUserController,
  deleteUserController,
  getUserByIdController,
  listUsersController,
  updateUserController,
} from "../controllers/user.controller.js";

// ==========================================
//  USERS ROUTER SETUP
// ==========================================

const userRouter: IRouter = new Router();

// Reusable single file upload middleware
const avatarUpload = file.single("avatar", {
  storage: "memory",
  allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
});

// Method 1: Create a new user with optional avatar upload
userRouter.post("/users", {
  name: "users.create",
  tags: ["Users"],
  schema: createUserSchema,
  middleware: [avatarUpload as unknown as IRouteMiddleware],
  controller: createUserController,
});

// Method 2: List all users with pagination and search
userRouter.get("/users", {
  name: "users.list",
  tags: ["Users"],
  schema: listUsersSchema,
  controller: listUsersController,
});

// Method 3: Fetch a single user by UUID
userRouter.get("/users/:id", {
  name: "users.get_by_id",
  tags: ["Users"],
  schema: userIdParamSchema,
  controller: getUserByIdController,
});

// Method 4: Update user (PUT)
userRouter.put("/users/:id", {
  name: "users.update",
  tags: ["Users"],
  schema: updateUserSchema,
  middleware: [avatarUpload as unknown as IRouteMiddleware],
  controller: updateUserController,
});

// Method 5: Edit user (PATCH)
userRouter.patch("/users/:id", {
  name: "users.edit",
  tags: ["Users"],
  schema: updateUserSchema,
  middleware: [avatarUpload as unknown as IRouteMiddleware],
  controller: updateUserController,
});

// Method 6: Remove user
userRouter.delete("/users/:id", {
  name: "users.delete",
  tags: ["Users"],
  schema: userIdParamSchema,
  controller: deleteUserController,
});

export default userRouter;
`;
  } else {
    return `import { Router, file } from "subatom";
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  userIdParamSchema,
} from "../schema/user.schema";
import {
  createUserController,
  deleteUserController,
  getUserByIdController,
  listUsersController,
  updateUserController,
} from "../controllers/user.controller";

// ==========================================
//  ROUTER SETUP
// ==========================================

const userRouter = new Router();

// Reusable single file upload middleware
const avatarUpload = file.single("avatar", {
  storage: "memory",
  allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
});

// Method 1: Create a new user with optional avatar upload
userRouter.post("/users", {
  name: "users.create",
  tags: ["Users"],
  schema: createUserSchema,
  middleware: [avatarUpload],
  controller: createUserController,
});

// Method 2: List all users with pagination and search
userRouter.get("/users", {
  name: "users.list",
  tags: ["Users"],
  schema: listUsersSchema,
  controller: listUsersController,
});

// Method 3: Fetch a single user by UUID
userRouter.get("/users/:id", {
  name: "users.get_by_id",
  tags: ["Users"],
  schema: userIdParamSchema,
  controller: getUserByIdController,
});

// Method 4: Update user (PUT)
userRouter.put("/users/:id", {
  name: "users.update",
  tags: ["Users"],
  schema: updateUserSchema,
  middleware: [avatarUpload],
  controller: updateUserController,
});

// Method 5: Edit user (PATCH)
userRouter.patch("/users/:id", {
  name: "users.edit",
  tags: ["Users"],
  schema: updateUserSchema,
  middleware: [avatarUpload],
  controller: updateUserController,
});

// Method 6: Remove user
userRouter.delete("/users/:id", {
  name: "users.delete",
  tags: ["Users"],
  schema: userIdParamSchema,
  controller: deleteUserController,
});

export default userRouter;
`;
  }
}

// src/user.schema.ts || src/user.schema.ts
function userSchemaFileContent(): string {
  return `import infer from "subatom-infer";



// ==========================================
//  USERS SCHEMA SETUP
// ==========================================



// Validates POST /users
const createUserSchema = {
  body: {
    userName: infer.string().min(3),
    emailId: infer.string().email(),
    fullName: infer.string().min(2),
    age: infer.number().int().min(1).max(120),
  },
  files: {
    avatar: infer
      .file()
      .max(5 * 1024 * 1024, "Max avatar file size limit is 5MB")
      .optional(),
  },
};

// Validates GET /users (Query filtering and pagination)
const listUsersSchema = {
  query: {
    search: infer.string().optional(),
    page: infer.number().int().min(1).default(1).optional(),
    limit: infer.number().int().min(1).max(100).default(10).optional(),
  },
};

// Validates GET /users/:id & DELETE /users/:id
const userIdParamSchema = {
  params: {
    id: infer.uuid(),
  },
};

// Validates PUT /users/:id and PATCH /users/:id
const updateUserSchema = {
  params: {
    id: infer.uuid(),
  },
  body: {
    userName: infer.string().min(3).optional(),
    emailId: infer.string().email().optional(),
    fullName: infer.string().min(2).optional(),
    age: infer.number().int().min(1).max(120).optional(),
  },
  files: {
    avatar: infer
      .file()
      .max(5 * 1024 * 1024, "Max avatar file size limit is 5MB")
      .optional(),
  },
};

export {
  createUserSchema,
  listUsersSchema,
  userIdParamSchema,
  updateUserSchema,
};
`;
}

// src/user.controller.ts || src/user.controller.ts
function userControllerFileContent(language: "ts" | "js"): string {
  if (language === "ts") {
    return `import { type IController, uuid } from "subatom";
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  userIdParamSchema,
} from "../schema/user.schema.js";


// ==========================================
//  USER TYPE INTERFACE
// ==========================================

export interface IUser {
  id: string;
  userName: string;
  emailId: string;
  fullName: string;
  age: number;
  avatar?: string | null;
}


// ==========================================
//  USERS CONTROLLERS SETUP
// ==========================================


// In-memory mock database for instant testing without an external DB
export const USERS_DB: IUser[] = [
  {
    id: "7f3a8c21-6d45-4b92-a1e7-93c5f8d21460",
    userName: "alex_21",
    emailId: "alex@example.com",
    fullName: "Alex Morgan",
    age: 21,
    avatar: null,
  },
  {
    id: "2b91e547-83c6-4a15-b729-61f4d8e20395",
    userName: "emma_25",
    emailId: "emma@example.com",
    fullName: "Emma Wilson",
    age: 25,
    avatar: null,
  },
  {
    id: "c64e1298-5f73-4d21-8ab6-37e9c4521068",
    userName: "liam_28",
    emailId: "liam@example.com",
    fullName: "Liam Anderson",
    age: 28,
    avatar: null,
  },
  {
    id: "9a27f531-4c68-42de-b815-76f3e2095481",
    userName: "olivia_23",
    emailId: "olivia@example.com",
    fullName: "Olivia Bennett",
    age: 23,
    avatar: null,
  },
];

/**
 * 1. CREATE USER
 * POST /users
 */
export const createUserController: IController<
  typeof createUserSchema
> = async (ctx) => {
  const { userName, emailId, fullName, age } = ctx.body;
  const avatarFile = ctx.files?.avatar;

  const newUser: IUser = {
    id: uuid(),
    userName,
    emailId,
    fullName,
    age,
    avatar: avatarFile
      ? (avatarFile.filename ?? avatarFile.filename ?? "avatar.png")
      : null,
  };

  USERS_DB.push(newUser);

  return ctx.status(201).json({
    success: true,
    message: "User created successfully",
    data: newUser,
  });
};

/**
 * 2. LIST USERS (With search & pagination)
 * GET /users
 */
export const listUsersController: IController<typeof listUsersSchema> = async (
  ctx,
) => {
  const search = ctx.query?.search?.toLowerCase().trim();
  const page = Number(ctx.query?.page) || 1;
  const limit = Number(ctx.query?.limit) || 10;

  let results = USERS_DB;

  if (search) {
    results = results.filter(
      (user) =>
        user.userName.toLowerCase().includes(search) ||
        user.fullName.toLowerCase().includes(search) ||
        user.emailId.toLowerCase().includes(search),
    );
  }

  const total = results.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  const paginatedData = results.slice(offset, offset + limit);

  return ctx.status(200).json({
    success: true,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
    data: paginatedData,
  });
};

/**
 * 3. GET USER BY ID
 * GET /users/:id
 */
export const getUserByIdController: IController<
  typeof userIdParamSchema
> = async (ctx) => {
  const { id } = ctx.params;
  const user = USERS_DB.find((u) => u.id === id);

  if (!user) {
    return ctx.status(404).json({
      success: false,
      message: "User with ID '" + id + "' not found",
    });
  }

  return ctx.status(200).json({
    success: true,
    data: user,
  });
};

/**
 * 4. UPDATE USER (Complete or Partial)
 * PUT /users/:id & PATCH /users/:id
 */
export const updateUserController: IController<
  typeof updateUserSchema
> = async (ctx) => {
  const { id } = ctx.params;
  const userIndex = USERS_DB.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    return ctx.status(404).json({
      success: false,
      message: "User with ID '" + id + "' not found",
    });
  }

  const avatarFile = ctx.files?.avatar;

  const existing = USERS_DB[userIndex];
  const updatedUser: IUser = {
    ...existing,
    ...(ctx.body.userName !== undefined && { userName: ctx.body.userName }),
    ...(ctx.body.emailId !== undefined && { emailId: ctx.body.emailId }),
    ...(ctx.body.fullName !== undefined && { fullName: ctx.body.fullName }),
    ...(ctx.body.age !== undefined && { age: ctx.body.age }),
    ...(avatarFile && {
      avatar: avatarFile.filename ?? avatarFile.filename ?? "avatar.png",
    }),
  };

  USERS_DB[userIndex] = updatedUser;

  return ctx.status(200).json({
    success: true,
    message: "User '" + id + "' updated successfully",
    data: updatedUser,
  });
};

/**
 * 5. DELETE USER
 * DELETE /users/:id
 */
export const deleteUserController: IController<
  typeof userIdParamSchema
> = async (ctx) => {
  const { id } = ctx.params;
  const userIndex = USERS_DB.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    return ctx.status(404).json({
      success: false,
      message: "User with ID '" + id + "' not found",
    });
  }

  USERS_DB.splice(userIndex, 1);

  return ctx.status(200).json({
    success: true,
    message: "User '" + id + "' deleted successfully",
  });
};
`;
  } else {
    return `import { uuid } from "subatom";

// ==========================================
//  USERS CONTROLLERS SETUP
// ==========================================

// In-memory mock database for instant testing without an external DB
export const USERS_DB = [
  {
    id: "7f3a8c21-6d45-4b92-a1e7-93c5f8d21460",
    userName: "alex_21",
    emailId: "alex@example.com",
    fullName: "Alex Morgan",
    age: 21,
    avatar: null,
  },
  {
    id: "2b91e547-83c6-4a15-b729-61f4d8e20395",
    userName: "emma_25",
    emailId: "emma@example.com",
    fullName: "Emma Wilson",
    age: 25,
    avatar: null,
  },
  {
    id: "c64e1298-5f73-4d21-8ab6-37e9c4521068",
    userName: "liam_28",
    emailId: "liam@example.com",
    fullName: "Liam Anderson",
    age: 28,
    avatar: null,
  },
  {
    id: "9a27f531-4c68-42de-b815-76f3e2095481",
    userName: "olivia_23",
    emailId: "olivia@example.com",
    fullName: "Olivia Bennett",
    age: 23,
    avatar: null,
  },
];

/**
 * 1. CREATE USER
 * POST /users
 */
export const createUserController = (ctx) => {
  const { userName, emailId, fullName, age } = ctx.body;
  const avatarFile = ctx.files?.avatar;

  const newUser = {
    id: uuid(),
    userName,
    emailId,
    fullName,
    age,
    avatar: avatarFile
      ? (avatarFile.filename ?? avatarFile.filename ?? "avatar.png")
      : null,
  };

  USERS_DB.push(newUser);

  return ctx.status(201).json({
    success: true,
    message: "User created successfully",
    data: newUser,
  });
};

/**
 * 2. LIST USERS (With search & pagination)
 * GET /users
 */
export const listUsersController = (ctx) => {
  const search = ctx.query?.search?.toLowerCase().trim();
  const page = Number(ctx.query?.page) || 1;
  const limit = Number(ctx.query?.limit) || 10;

  let results = USERS_DB;

  if (search) {
    results = results.filter(
      (user) =>
        user.userName.toLowerCase().includes(search) ||
        user.fullName.toLowerCase().includes(search) ||
        user.emailId.toLowerCase().includes(search),
    );
  }

  const total = results.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  const paginatedData = results.slice(offset, offset + limit);

  return ctx.status(200).json({
    success: true,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
    data: paginatedData,
  });
};

/**
 * 3. GET USER BY ID
 * GET /users/:id
 */
export const getUserByIdController = (ctx) => {
  const { id } = ctx.params;
  const user = USERS_DB.find((u) => u.id === id);

  if (!user) {
    return ctx.status(404).json({
      success: false,
      message: "User with ID '" + id + "' not found",
    });
  }

  return ctx.status(200).json({
    success: true,
    data: user,
  });
};

/**
 * 4. UPDATE USER (Complete or Partial)
 * PUT /users/:id & PATCH /users/:id
 */
export const updateUserController = (ctx) => {
  const { id } = ctx.params;
  const userIndex = USERS_DB.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    return ctx.status(404).json({
      success: false,
      message: "User with ID '" + id + "' not found",
    });
  }

  const avatarFile = ctx.files?.avatar;

  const existing = USERS_DB[userIndex];
  const updatedUser = {
    ...existing,
    ...(ctx.body.userName !== undefined && { userName: ctx.body.userName }),
    ...(ctx.body.emailId !== undefined && { emailId: ctx.body.emailId }),
    ...(ctx.body.fullName !== undefined && { fullName: ctx.body.fullName }),
    ...(ctx.body.age !== undefined && { age: ctx.body.age }),
    ...(avatarFile && {
      avatar: avatarFile.filename ?? avatarFile.filename ?? "avatar.png",
    }),
  };

  USERS_DB[userIndex] = updatedUser;

  return ctx.status(200).json({
    success: true,
    message: "User '" + id + "' updated successfully",
    data: updatedUser,
  });
};

/**
 * 5. DELETE USER
 * DELETE /users/:id
 */
export const deleteUserController = (ctx) => {
  const { id } = ctx.params;
  const userIndex = USERS_DB.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    return ctx.status(404).json({
      success: false,
      message: "User with ID '" + id + "' not found",
    });
  }

  USERS_DB.splice(userIndex, 1);

  return ctx.status(200).json({
    success: true,
    message: "User '" + id + "' deleted successfully",
  });
};`;
  }
}

// subatom.config.ts || subatom.config.js
function subatomConfigContent(language: Language): string {
  if (language === "js") {
    return `import { defineConfig } from "subatom";

export default defineConfig({
      port: 8080,
      host: "localhost",
      outDir: "build",
      entry:"main.js",
      watch: {
          extensions: ["js", "jsx"],
          debounceMs: 0,
          ignore: ["**/logs/**"],
      }
});`;
  } else {
    return `import { defineConfig } from "subatom";

export default defineConfig({
      port: 8080,
      host: "localhost",
      outDir: "build",
      sourcemap: true,
      minify: true,
      entry:"main.ts",
      watch: {
          extensions: ["ts", "tsx", "js", "jsx"],
          debounceMs: 500,
          ignore: ["**/logs/**"],
      }
});`;
  }
}

// README.md
const readmeFileGenerator = (config: ProjectConfig) => {
  const { language, orm, database, useRedis, useEslint, useVitest, useSocket } =
    config;

  return String.raw`# Subatom + ${language === "js" ? "JavaScript" : "TypeScript"}

Build fast, reliable, and production-ready backend applications with **Subatom**.

## 🌐 Documentation

- **Subatom Documentation:** https://subatomjs.dev
- **Subatom Infer:** https://infer.subatomjs.dev
- **Subatom Pulse:** https://pulse.subatomjs.dev

---

## 🚀 Features

1. Auto-generated API documentation available at the ${`\`/docs\``} URL
2. Runtime schema validation
3. Fast TypeScript backend framework
4. Modern HTTP methods
5. Pre-configured Redis, ORM, database, Vitest, and ESLint support
6. Fast and reliable architecture

---

## 🛠️ Getting Started

### Install dependencies

${`\`\`\`bash
npm install
\`\`\``}

### Development

${
  language === "js"
    ? `\`\`\`bash
npm run dev
\`\`\``
    : `\`\`\`bash
npm run build
npm run dev
\`\`\``
}

### Start the application

${`\`\`\`bash
npm start
\`\`\``}

Or, if your project provides a preview script:

${`\`\`\`bash
npm run preview
\`\`\``}

---

## 🧪 Testing

Run the test suite with:

${`\`\`\`bash
npm run test
\`\`\``}

### Test Coverage

To generate test coverage:

${`\`\`\`bash
npm run test:coverage
\`\`\``}

---

## 🧰 Tech Stack

| Technology | Configuration |
|---|---|
| Language | ${language === "js" ? "JavaScript" : "TypeScript"} |
| ORM | ${orm === "none" ? "N/A" : orm} |
| Database | ${database === "none" ? "N/A" : database} |
| Framework | Subatom |
| Schema Validator | Subatom Infer |${
    useRedis
      ? `
| Caching | Redis |`
      : ""
  }${
    useEslint
      ? `
| Linting | ESLint |`
      : ""
  }${
    useVitest
      ? `
| Testing | Vitest + V8 |`
      : ""
  }${
    useSocket
      ? `
| WebSocket Connection | Subatom Pulse |`
      : ""
  }

---

## 📁 Ideal Folder Structure

${`\`\`\`text
Subatom_Server/
├── public/                 # Static assets served directly at runtime
├── scripts/                # Runtime scripts and shell files
├── tests/                  # Test cases
├── src/
│   ├── config/             # Server configuration files
│   ├── controllers/        # Route controllers
│   ├── routes/             # Route handlers
│   ├── schema/             # Runtime validation using Subatom Infer
│   ├── models/             # Database schemas
│   ├── redis/              # Redis cache configuration
│   ├── utils/              # Utility functions and helpers
│   ├── middlewares/        # Application middlewares
│   ├── web-socket/         # Subatom Pulse WebSocket connection
│   └── server.ts           # Register routes and middleware
├── .gitignore              # Git ignored files
├── main.ts                 # Main application entry point
├── eslint.config.mts       # ESLint configuration
├── package.json             # Project dependencies and scripts
├── subatom.config.ts       # Subatom server configuration
└── vitest.config.ts        # Vitest configuration
\`\`\``}

> **Note:** Some directories and configuration files may not be present depending on the options selected during project creation.

---

## 🌐 Deployment

To build the application for production, run:

${`\`\`\`bash
npm run build
\`\`\``}

This generates a production-ready ${`\`dist\``} folder.

You can deploy the resulting application using your preferred Node.js hosting platform.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

Please visit the project's GitHub repository to:

- Report bugs
- Request features
- Submit pull requests
- Improve documentation

---

## 📄 License

This project is licensed under the **MIT License**.

See the ${`\`LICENSE\``} file for more information.

---

## ⚡ Built with Subatom

This project was generated using **Subatom**.

- 🌐 https://subatomjs.dev
- 🧩 https://infer.subatomjs.dev
- ⚡ https://pulse.subatomjs.dev
`;
};

const envConfigContentRelationalDb = (
  fileType: Language,
  database: Database,
  orm: Orm,
  useRedis: boolean,
) => {
  if (fileType === "ts") {
    if (database === "sqlite" && orm === "drizzle") {
      return `/// <reference types="node" />
import { configEnv } from 'subatom';
configEnv();

export type DbConfig =
  | { kind: 'file'; url: string }
  | { kind: 'libsql'; url: string; authToken: string };

function resolveDbConfig(): DbConfig {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error('Fatal: DATABASE_URL is not defined in environment variables.');
  }

  // Parse the scheme, e.g. "file:./local.db" -> "file", "libsql:something" -> "libsql"
  const scheme = rawUrl.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)?.[1]?.toLowerCase();

  const isRemote = scheme === 'libsql' || scheme === 'https' || scheme === 'http';

  if (isRemote) {
    const authToken = process.env.DATABASE_AUTH_TOKEN;
    if (!authToken) {
      throw new Error(
        'Fatal: DATABASE_AUTH_TOKEN is required when DATABASE_URL uses the "libsql:", "https:" or "http:" scheme.'
      );
    }
    return { kind: 'libsql', url: rawUrl, authToken };
  }

  if (scheme === 'file' || !scheme) {
    return { kind: 'file', url: rawUrl };
  }

  throw new Error("Fatal: Unsupported DATABASE_URL scheme Use 'file:' or 'libsql:'.");
}

const environment = {
  DB: resolveDbConfig(),
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number.isFinite(Number(process.env.PORT)) && process.env.PORT ? Number(process.env.PORT) : 8080,
  HOST: process.env.HOST || 'localhost',
  ${useRedis === true ? redisEnvLines(true) : ""}
};

const envConfig = Object.freeze(environment);
export default envConfig;`;
    } else {
      return `/// <reference types="node" />
import {configEnv} from 'subatom'
configEnv()


const environment = {
    DATABASE_URL: process.env.DATABASE_URL as string || "",
    NODE_ENV: process.env.NODE_ENV as string || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST as string || "localhost",
    ${useRedis === true ? redisEnvLines(true) : ""}

}
const envConfig = Object.freeze(environment);
export default envConfig;`;
    }
  } else {
    if (database === "sqlite" && orm === "drizzle") {
      return `import { configEnv } from 'subatom';
configEnv();

function resolveDbConfig() {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error('Fatal: DATABASE_URL is not defined in environment variables.');
  }

  // Parse the scheme, e.g. "file:./local.db" -> "file", "libsql:something" -> "libsql"
  const scheme = rawUrl.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)?.[1]?.toLowerCase();

  const isRemote = scheme === 'libsql' || scheme === 'https' || scheme === 'http';

  if (isRemote) {
    const authToken = process.env.DATABASE_AUTH_TOKEN;
    if (!authToken) {
      throw new Error(
        'Fatal: DATABASE_AUTH_TOKEN is required when DATABASE_URL uses the "libsql:", "https:" or "http:" scheme.'
      );
    }
    return { kind: 'libsql', url: rawUrl, authToken };
  }

  if (scheme === 'file' || !scheme) {
    return { kind: 'file', url: rawUrl };
  }

  throw new Error("Fatal: Unsupported DATABASE_URL scheme", scheme, "Use 'file:' or 'libsql:'.");
}

const environment = {
  DB: resolveDbConfig(),
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number.isFinite(Number(process.env.PORT)) && process.env.PORT ? Number(process.env.PORT) : 8080,
  HOST: process.env.HOST || 'localhost',
  ${useRedis === true ? redisEnvLines(false) : ""}
};

const envConfig = Object.freeze(environment);
export default envConfig;
        `;
    } else {
      return `import {configEnv} from 'subatom'
configEnv()

const environment = {
    DATABASE_URL: process.env.DATABASE_URL || "",
    NODE_ENV: process.env.NODE_ENV || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST || "localhost",
    ${useRedis === true ? redisEnvLines(false) : ""}

}
const envConfig = Object.freeze(environment);
export default envConfig;`;
    }
  }
};

const GIT_IGNORE_CONTENT = `
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Diagnostic reports (https://nodejs.org/api/report.html)
report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Directory for instrumented libs generated by jscoverage/JSCover
lib-cov

# Coverage directory used by tools like istanbul
coverage
*.lcov

# nyc test coverage
.nyc_output

# Grunt intermediate storage (https://gruntjs.com/creating-plugins#storing-task-files)
.grunt

# Bower dependency directory (https://bower.io/)
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons (https://nodejs.org/api/addons.html)
build/Release

# Dependency directories
node_modules/
jspm_packages/

# Snowpack dependency directory (https://snowpack.dev/)
web_modules/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional stylelint cache
.stylelintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variable files
.env
.env.*
!.env.example

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# Nuxt.js build / generate output
.nuxt
dist
.output

# Gatsby files
.cache/
# Comment in the public line in if your project uses Gatsby and not Next.js
# https://nextjs.org/blog/next-9-1#public-directory-support
# public

# vuepress build output
.vuepress/dist

# vuepress v2.x temp directory
.temp

# Sveltekit cache directory
.svelte-kit/

# vitepress build output
**/.vitepress/dist

# vitepress cache directory
**/.vitepress/cache

# Docusaurus cache and generated files
.docusaurus

# Serverless directories
.serverless/

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# Firebase cache directory
.firebase/

# TernJS port file
.tern-port

# Stores Visual Studio Code versions used for testing Visual Studio Code extensions
.vscode-test

# pnpm
.pnpm-store

# yarn v3
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions

`;

export {
  subatomConfigContent,
  envConfigContentRelationalDb,
  mainFileContent,
  serverFileContent,
  dotEnvFileContent,
  userRouterFileContent,
  userSchemaFileContent,
  readmeFileGenerator,
  userControllerFileContent,
  TEMPLATES_DIR,
  SNIPPET_FILENAME,
  SNIPPET_PATTERN,
  GIT_IGNORE_CONTENT,
};
