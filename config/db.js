const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;

    // Auto-use in-memory MongoDB if URI is local or not a real Atlas URI
    const useInMemory = !uri || uri.includes('127.0.0.1') || uri.includes('localhost');

    if (useInMemory) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      console.log('⚡ Using MongoDB in-memory server (no Atlas needed)');

      // Seed demo data automatically
      process.env._MONGO_IN_MEMORY_URI = uri;
    }

    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    if (useInMemory) {
      // Auto-seed after connection
      setTimeout(() => {
        require('../utils/autoSeed').seed().catch(() => {});
      }, 500);
    }
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
