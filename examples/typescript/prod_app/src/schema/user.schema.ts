import infer from "subatom-infer";



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
