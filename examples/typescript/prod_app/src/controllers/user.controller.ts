import { type IController, uuid } from "subatom";
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
