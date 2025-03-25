const mongodb = require('mongodb');

let client;
let db;

// Connect to the database
async function connectDatabase() {
    if (!client) {
        client = new mongodb.MongoClient('mongodb+srv://60102562:12class34@cluster0.ps18e.mongodb.net/');
        await client.connect();
        db = client.db('project');
    }
    return db;
}

// Insert a new user
async function addUser(userData) {
    const db = await connectDatabase();
    return db.collection('UserAccounts').insertOne(userData);
}

// Get user by email
async function getUserByEmail(email) {
    const db = await connectDatabase();
    return db.collection('UserAccounts').findOne({ email });
}

// Get user by name
async function getUserByName(name) {
    const db = await connectDatabase();
    return db.collection('UserAccounts').findOne({ name :name });
}

// Update user password
async function updateUserPassword(email, newPassword) {
    const db = await connectDatabase();
    let user =  db.collection('UserAccounts')
    user.updateOne({ email }, { $set: { resetExpiry: ""} });
    user.updateOne({ email }, { $set: { resetKey: "" } });
    return user.updateOne({ email }, { $set: { password: newPassword } });
}

// Store reset key and expiry
async function updateResetPassword(email, resetKey, resetExpiry) {
    const db = await connectDatabase();
    return db.collection('UserAccounts').updateOne({ email }, { $set: { resetKey, resetExpiry } });
}

// Get reset password entry
async function getResetPasswordEntry(resetKey) {
    const db = await connectDatabase();
    return db.collection('UserAccounts').findOne({ resetKey });
}

// Insert session
async function addSession(sessionData) {
    const db = await connectDatabase();
    return db.collection('SessionData').insertOne(sessionData);
}

// Get session by key
async function getSessionByKey(sessionKey) {
    const db = await connectDatabase();
    return db.collection('SessionData').findOne({ key: sessionKey });
}

// Delete session by key
async function deleteSession(sessionKey) {
    const db = await connectDatabase();
    return db.collection('SessionData').deleteOne({ key: sessionKey });
}

module.exports = {
    addUser,
    getUserByEmail,
    getUserByName,
    updateUserPassword,
    updateResetPassword,
    getResetPasswordEntry,
    addSession,
    getSessionByKey,
    deleteSession
};
