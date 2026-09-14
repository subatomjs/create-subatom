import { type IRouter, Router, file, type IRouteMiddleware } from "subatom";
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
