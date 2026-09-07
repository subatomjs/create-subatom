import {
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

export default userRouter;