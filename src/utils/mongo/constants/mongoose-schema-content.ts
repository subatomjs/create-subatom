import { Language } from "../../../types.js";

const mongooseSchemaContent = (fileType: Language): string => {
  if (fileType === "js") {
    return `import { Schema, mongoose } from 'mongoose';

const SubatomSchema = new Schema(
  {
    application: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      unique: true,
    },
    framework: {
      type: String,
      required: true,
      default: "Subatom"
      
    },
  },
  { timestamps: true }
);

const subatom_model = mongoose.model(
  'subatom_js',
  SubatomSchema
);
export default subatom_model;
    
    `;
  } else {
    return `import mongoose, { Schema, Document, Model } from 'mongoose';

// 1. Interface representing the raw document structure
export interface ISubatom {
  application: string;
  version: string;
  author: string;
  framework?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Interface representing the Mongoose Document (includes _id, save(), etc.)
export interface ISubatomDocument extends ISubatom, Document {}

// 3. Schema definition with strong typing
const SubatomSchema: Schema<ISubatomDocument> = new Schema(
  {
    application: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      unique: true,
    },
    framework: {
      type: String,
      required: true,
      default: 'Subatom',
    },
  },
  { timestamps: true }
);

// 4. Model Creation with safeguards against re-compilation models in dev mode
const SubatomModel: Model<ISubatomDocument> =
  mongoose.models.subatom_js ||
  mongoose.model<ISubatomDocument>('subatom_js', SubatomSchema);

export default SubatomModel;
`;
  }
};

export default mongooseSchemaContent
