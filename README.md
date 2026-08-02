create-subatom/
├── src/
│   ├── index.ts              # entry, parses args, kicks off prompts
│   ├── prompts.ts            # all the @clack/prompts questions
│   ├── helpers/
│   │   ├── copy-template.ts
│   │   ├── install-deps.ts
│   │   ├── merge-package-json.ts
│   │   ├── detect-package-manager.ts
│   │   └── git-init.ts
│   └── types.ts
├── templates/
│   ├── base/                 # common to every project
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── server.ts
│   │   │   ├── routes/Router.ts
│   │   │   ├── controllers/
│   │   │   ├── middleware/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── config/
│   │   │   └── utils/
│   │   └── .gitignore
│   ├── ts/                   # only added if TypeScript chosen
│   │   ├── tsconfig.json
│   │   └── src/types/
│   ├── orm/
│   │   ├── prisma/
│   │   ├── drizzle/
│   │   └── mongoose/
│   ├── redis/
│   ├── eslint/
│   └── vitest/
├── package.json               # bin field points to dist/index.js
└── tsconfig.json



<!-- 7dHQbLDnRZQG6_23RqdE -->

# Connect to Postgres via the shared session-mode pooler (used for migrations)
DATABASE_URL="postgresql://postgres.ozohztffqawsdfjyrmtf:7dHQbLDnRZQG6_23RqdE@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?schema=public"

# postgresql://postgres.ozohztffqawsdfjyrmtf:7dHQbLDnRZQG6_23RqdE@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true