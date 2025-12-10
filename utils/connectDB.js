import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        // Check if MONGO_URI is set
        if (!process.env.MONGO_URI) {
            console.warn('⚠️  MONGO_URI not found in environment variables. Skipping MongoDB connection.');
            return;
        }

        // Set connection timeout to avoid hanging
        const connectionOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // 5 seconds timeout
            connectTimeoutMS: 5000,
        };

        const conn = await mongoose.connect(process.env.MONGO_URI, connectionOptions);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`❌ Error connecting to MongoDB: ${error.message}`);
        // Don't exit - let server continue running
        // process.exit(1);
        throw error; // Re-throw to allow caller to handle
    }
}

export default connectDB;