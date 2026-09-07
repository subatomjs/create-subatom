import { fileURLToPath } from "node:url";
import type { Database, Language, Orm } from "../types.js";

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
      dbConnectLogic = `console.log("⏳ Connecting to MongoDB (Mongoose)...");\n    await connectDB();\n    console.log("✅ Connected to MongoDB successfully");\n`;
      dbDisconnectLogic = `if (mongoose.connection.readyState !== 0) {\n        console.log("🗄️ [Shutdown] Disconnecting Mongoose...");\n        await mongoose.disconnect();\n      }`;
    } else if (orm === "prisma") {
      dbImports = `import prisma from "./prisma.js";\n`;
      dbConnectLogic = `console.log("⏳ Connecting to ${database} (Prisma)...");\n    await prisma.$connect();\n    console.log("✅ Connected to ${database} (Prisma) successfully");\n`;
      dbDisconnectLogic = `console.log("🗄️ [Shutdown] Disconnecting Prisma...");\n      await prisma.$disconnect();`;
    } else if (orm === "drizzle" && database === "sqlite") {
      dbImports = `import { checkDatabaseConnection, closeDatabase } from "./src/db/db_pool.js";\n`;
      dbConnectLogic = `console.log("⏳ Verifying SQLite (Drizzle) connection...");\n    const healthy = await checkDatabaseConnection();\n    if (!healthy) throw new Error("Database health check failed.");\n    console.log("✅ Connected to SQLite (Drizzle) successfully");\n`;
      dbDisconnectLogic = `console.log("🗄️ [Shutdown] Closing SQLite pool...");\n      closeDatabase();`;
    } else if (orm === "drizzle") {
      dbImports = `import { db } from "./src/db/db_pool.js";\nimport { sql } from "drizzle-orm";\n`;
      dbConnectLogic = `console.log("⏳ Verifying ${database} (Drizzle) connection...");\n    await db.execute(sql\`SELECT 1\`);\n    console.log("✅ Connected to ${database} (Drizzle) successfully");\n`;
      dbDisconnectLogic = `console.log("🗄️ [Shutdown] Releasing Drizzle connection pool...");`;
    }
  }

  // 4. Redis logic
  const redisImport = useRedis
    ? `import { bootstrapRedis } from "./src/redis/redis.bootstrap.js";\n`
    : "";
  const redisConnect = useRedis
    ? `console.log("⏳ Initializing Redis client...");\n    await bootstrapRedis();\n    console.log("✅ Redis initialized");\n`
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
    if (isDraining) return;
    isDraining = true;

    console.log(\`\\n🛑 [Shutdown] Received \${signal}. Starting coordinated teardown...\`);

    const forceExitTimer = setTimeout(() => {
      console.error("⚠️ [Shutdown] Draining timed out. Forcing process exit.");
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    try {
      // 1. Terminate WebSocket connections
      if (io) {
        console.log("🔌 [Shutdown] Closing WebSocket engine...");
        await io.close();
      }

      // 2. Stop HTTP listener
      if (httpServer && typeof httpServer.close === "function") {
        console.log("🌐 [Shutdown] Stopping HTTP listener...");
        await new Promise((resolve, reject) => {
          httpServer!.close((err) => (err ? reject(err) : resolve(undefined)));
        });
      }

      // 3. Disconnect database (if any)
      ${dbDisconnectLogic}

      console.log("✅ [Shutdown] Clean shutdown completed.");
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
    console.log("⏳ Starting Subatom HTTP engine...");
    httpServer = await server.start();
    console.log("✅ Subatom HTTP engine listening");

      // WebSocket mount
    if (!httpServer) {
      throw new Error("HTTP server failed to initialize before WebSocket mount.");
    }

    // WebSocket mount
    io = initSocket(httpServer);
    console.log("✅ Subatom Pulse mounted on /ws");
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
    console.log("⏳ Starting Subatom HTTP engine...");
    await server.start();
    console.log("✅ Subatom HTTP engine listening");
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
    return `import {Subatom, json, urlencoded, serveStatic, type IRequest, type IResponse, serveStatic} from 'subatom';
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
    return `import { Subatom, SubAtomDocs } from "subatom";
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

function userRouterFileContent(language: "ts" | "js"): string {
  if (language === "ts") {
    return `import {
  uuid,
  type IController,
  type IRouter,
  Router,
  file,
  IRouteMiddleware,
} from "subatom";
import { infer } from "subatom-infer";

// ==========================================
// 1. DATA MODEL & IN-MEMORY MOCK DATABASE
// ==========================================

export interface IUser {
  id: string;
  userName: string;
  emailId: string;
  fullName: string;
  age: number;
  avatar?: string | null;
}

// In-memory mock database for instant testing without an external DB
export const USERS_DB: IUser[] = [
  {
    id: "41434843-5e34-454b-82b8-57426e126556",
    userName: "kunal_14",
    emailId: "kunal@subatomjs.dev",
    fullName: "Kunal Chandra Das",
    age: 24,
    avatar: null,
  },
  {
    id: "51434843-5e34-454b-82b8-57426e126553",
    userName: "souvik_26",
    emailId: "souvik@gmail.com",
    fullName: "Souvik Sikder",
    age: 26,
    avatar: null,
  },
  {
    id: "11434843-5e34-454b-82b8-57426e126454",
    userName: "akash_26",
    emailId: "akash@gmail.com",
    fullName: "Akash Saha",
    age: 26,
    avatar: null,
  },
  {
    id: "89434843-5e34-454b-82b8-57426d126404",
    userName: "soubhadra_26",
    emailId: "soubhadra_26@gmail.com",
    fullName: "Soubhadra Mondal",
    age: 26,
    avatar: null,
  },
];

// ==========================================
// 2. VALIDATION SCHEMAS (subatom-infer)
// ==========================================

// Validates POST /users
export const createUserSchema = {
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
export const listUsersSchema = {
  query: {
    search: infer.string().optional(),
    page: infer.number().int().min(1).default(1).optional(),
    limit: infer.number().int().min(1).max(100).default(10).optional(),
  },
};

// Validates GET /users/:id & DELETE /users/:id
export const userIdParamSchema = {
  params: {
    id: infer.uuid(),
  },
};

// Validates PUT /users/:id and PATCH /users/:id
export const updateUserSchema = {
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

// ==========================================
// 3. CONTROLLERS
// ==========================================

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

// ==========================================
// 4. ROUTER SETUP
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

export default userRouter;`;
  } else {
    return `import {
  uuid,
  Router,
  file,
} from "subatom";
import { infer } from "subatom-infer";

// ==========================================
// 1. DATA MODEL & IN-MEMORY MOCK DATABASE
// ==========================================

// In-memory mock database for instant testing without an external DB
export const USERS_DB = [
  {
    id: "41434843-5e34-454b-82b8-57426e126556",
    userName: "kunal_14",
    emailId: "kunal@subatomjs.dev",
    fullName: "Kunal Chandra Das",
    age: 24,
    avatar: null,
  },
  {
    id: "51434843-5e34-454b-82b8-57426e126553",
    userName: "souvik_26",
    emailId: "souvik@gmail.com",
    fullName: "Souvik Sikder",
    age: 26,
    avatar: null,
  },
  {
    id: "11434843-5e34-454b-82b8-57426e126454",
    userName: "akash_26",
    emailId: "akash@gmail.com",
    fullName: "Akash Saha",
    age: 26,
    avatar: null,
  },
  {
    id: "89434843-5e34-454b-82b8-57426d126404",
    userName: "soubhadra_26",
    emailId: "soubhadra_26@gmail.com",
    fullName: "Soubhadra Mondal",
    age: 26,
    avatar: null,
  },
];

// ==========================================
// 2. VALIDATION SCHEMAS (subatom-infer)
// ==========================================

// Validates POST /users
export const createUserSchema = {
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
export const listUsersSchema = {
  query: {
    search: infer.string().optional(),
    page: infer.number().int().min(1).default(1).optional(),
    limit: infer.number().int().min(1).max(100).default(10).optional(),
  },
};

// Validates GET /users/:id & DELETE /users/:id
export const userIdParamSchema = {
  params: {
    id: infer.uuid(),
  },
};

// Validates PUT /users/:id and PATCH /users/:id
export const updateUserSchema = {
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

// ==========================================
// 3. CONTROLLERS
// ==========================================

/**
 * 1. CREATE USER
 * POST /users
 */
export const createUserController = async (ctx) => {
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
export const listUsersController = async (ctx) => {
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
export const getUserByIdController = async (ctx) => {
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
export const updateUserController = async (ctx) => {
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
export const deleteUserController = async (ctx) => {
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

// ==========================================
// 4. ROUTER SETUP
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

export default userRouter;`;
  }
}

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

export {
  subatomConfigContent,
  envConfigContentRelationalDb,
  mainFileContent,
  serverFileContent,
  dotEnvFileContent,
  userRouterFileContent,
  TEMPLATES_DIR,
  SNIPPET_FILENAME,
  SNIPPET_PATTERN,
};
