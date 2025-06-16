// MongoDB initialization script
// This script will be executed when the MongoDB container starts for the first time

db = db.getSiblingDB('kolocollect');

// Create application user with read/write permissions
db.createUser({
  user: 'kolocollect_user',
  pwd: 'kolocollect_password',
  roles: [
    {
      role: 'readWrite',
      db: 'kolocollect'
    }
  ]
});

// Create indexes for better performance (optional)
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.communities.createIndex({ name: 1 });
db.communities.createIndex({ createdBy: 1 });
db.contributions.createIndex({ userId: 1 });
db.contributions.createIndex({ communityId: 1 });
db.contributions.createIndex({ payoutDate: 1 });

print('Database initialized successfully');
