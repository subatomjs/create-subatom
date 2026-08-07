const subatomSchemaFileContent = (): string => {
  return `model subatom {
   id String @id @default(uuid()) @unique
   application String
   version String
   author String?
   framework String?

   createdAt      DateTime       @default(now())
   updatedAt      DateTime       @updatedAt
}
  `;
};

export default subatomSchemaFileContent;
