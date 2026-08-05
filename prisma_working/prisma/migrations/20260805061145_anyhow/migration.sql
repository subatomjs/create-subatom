-- CreateTable
CREATE TABLE "subatom" (
    "id" TEXT NOT NULL,
    "application" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "author" TEXT,
    "framework" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subatom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subatom_id_key" ON "subatom"("id");
