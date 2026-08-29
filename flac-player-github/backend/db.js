import mongoose from 'mongoose';

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/karmaplay';
  
  mongoose.connection.on('error', err => {
    console.error('MongoDB connection error (background):', err.message);
  });

  mongoose.connection.on('connected', () => {
    console.log(`Connected to MongoDB`);
  });

  await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 }).catch(err => {
    console.error('Initial MongoDB connection error, Mongoose will retry in background:', err.message);
  });
};

export default connectDB;
