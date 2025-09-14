// migration.js - Run this once to add new fields to existing users
const mongoose = require('mongoose');
const User = require('./models/User'); // Adjust path as needed

const runMigration = async () => {
  try {
    // Connect to your MongoDB database
    await mongoose.connect('your_mongodb_connection_string', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Update all existing users to add the new fields
    const result = await User.updateMany(
      {}, // Empty filter to update all users
      {
        $set: {
          dateOfBirth: "",
          location: "",
          bio: "",
          gender: "",
          profileImage: null,
          website: ""
        }
      }
    );

    console.log(`Migration completed! Updated ${result.modifiedCount} users.`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the migration
runMigration();