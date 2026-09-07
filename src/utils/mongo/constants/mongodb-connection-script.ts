import { Language } from "../../../types.js";

const mongoDbConnectionScript = (fileType: Language): string => {
  if (fileType === "ts") {
    return `import mongoose from 'mongoose';
import envConfig from './envConfig.js';

const connectDB = async (): Promise<void> => {
  try {
    // Assert the string exists or let Mongoose throw if undefined
    const connectionString = envConfig.MONGO_CONNECTION_STRING as string;

    const conn = await mongoose.connect(connectionString, {
      autoIndex: envConfig.NODE_ENV !== 'production', // Disable autoIndex in production
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

 console.log("MongoDB Connected:", conn.connection.host);
  } catch (error) {
    const err = error as Error;
     console.error("Error connecting to MongoDB:", err.message);
    process.exit(1);
  }
};

// Connection Lifecycle Event Listeners
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB connection lost. Attempting to reconnect...');
});

mongoose.connection.on('error', (err: Error) => {
 console.error("MongoDB connection error:", err);
});

export default connectDB;
  `;
  } else {
    return `import envConfig from "./envConfig.js"
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Replace with your MongoDB connection string or use an environment variable
    const conn = await mongoose.connect(envConfig.MONGO_CONNECTION_STRING, {
      // Optional configuration options:
      autoIndex: true, // Set to false in production to prevent performance hits
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log("MongoDB Connected:", conn.connection.host);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1); // Exit process with failure
  }
};

// Event Listeners for Connection Lifecycle
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB connection lost. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  console.error("MongoDB connection error:", err);
});

export default connectDB;

`;
  }
};

export default mongoDbConnectionScript;
