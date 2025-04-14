// ===== MongoDB Setup =====
const mongodb = require('mongodb');
const { ObjectId } = require('mongodb');

let client;
let db;

// Establish connection to the MongoDB database (singleton style)
async function connectDatabase() {
    if (!client) {
        client = new mongodb.MongoClient('mongodb+srv://60102562:12class34@cluster0.ps18e.mongodb.net/');
        await client.connect();
        db = client.db('project'); // Change 'project' to your DB name if needed
    }
    return db;
}

// ===== USER FUNCTIONS ===== //

// Adds a new user document to the UserAccounts collection
async function addUser(userData) {
    const db = await connectDatabase();
    return db.collection('UserAccounts').insertOne(userData);
}

// Retrieves a user document based on email
async function getUserByEmail(email) {
    const db = await connectDatabase();
    return db.collection('UserAccounts').findOne({ email });
}

// Retrieves a user document based on name
async function getUserByName(name) {
    const db = await connectDatabase();
    return db.collection('UserAccounts').findOne({ name });
}

// Updates a user's password and clears any reset-related fields
async function updateUserPassword(email, newPassword) {
    const db = await connectDatabase();
    const user = db.collection('UserAccounts');
    await user.updateOne({ email }, { $set: { resetExpiry: "", resetKey: "" } });
    return user.updateOne({ email }, { $set: { password: newPassword } });
}

// ===== PASSWORD RESET FUNCTIONS ===== //

// Stores a reset key and expiry for a given user email
async function updateResetPassword(email, resetKey, resetExpiry) {
    const db = await connectDatabase();
    return db.collection('UserAccounts').updateOne(
        { email },
        { $set: { resetKey, resetExpiry } }
    );
}

// Retrieves user info based on reset key
async function getResetPasswordEntry(resetKey) {
    const db = await connectDatabase();
    return db.collection('UserAccounts').findOne({ resetKey });
}

// ===== SESSION FUNCTIONS ===== //

// Stores a new session document
async function addSession(sessionData) {
    const db = await connectDatabase();
    return db.collection('SessionData').insertOne(sessionData);
}

// Fetches a session by its session key
async function getSessionByKey(sessionKey) {
    const db = await connectDatabase();
    return db.collection('SessionData').findOne({ key: sessionKey });
}

// Deletes a session by session key
async function deleteSession(sessionKey) {
    const db = await connectDatabase();
    return db.collection('SessionData').deleteOne({ key: sessionKey });
}

// ===== FORM REQUEST FUNCTIONS ===== //

// Adds a new request and updates its status and timestamp
async function addRequest(requestData, id) {
    const db = await connectDatabase();
    await db.collection('forms').insertOne(requestData);
    db.collection('forms').updateOne(
        { _id: new ObjectId(id) },
        {
            $set: {
                status: '',               // Resets status field
                createdAt: new Date()    // Sets current timestamp
            }
        }
    );
}

// Retrieves form requests for a specific student and semester
async function getRequestsByStudent(studentId, semester) {
    const db = await connectDatabase();
    return db.collection('forms').find({ studentId, semester }).toArray();
}

// Processes a form by changing its status and timestamp
async function processRequest(requestId, status) {
    const db = await connectDatabase();
    const result = await db.collection('forms').updateOne(
        { _id: new ObjectId(requestId) },
        { $set: { status, processedAt: new Date() } }
    );

    if (result.modifiedCount > 0) {
        const request = await db.collection('forms').findOne({ _id: new ObjectId(requestId) });
        console.log(`Email notification for request ${requestId}: Status changed to ${status}`);
    }

    return result;
}

// Retrieves all forms
async function getForms() {
    const db = await connectDatabase();
    return db.collection('forms').find().toArray();
}

// Retrieves a form by its ID
async function getRequestById(id) {
    const db = await connectDatabase();
    return db.collection('forms').findOne({ _id: new ObjectId(id) });
}

// ===== CANCELED FORM FUNCTIONS ===== //

// Retrieves a canceled form by ID
async function getCanceledById(id) {
    const db = await connectDatabase();
    return db.collection('canceled').findOne({ _id: new ObjectId(id) });
}

// Deletes a canceled form by ID
async function deleteCanceled(id) {
    const db = await connectDatabase();
    db.collection('canceled').deleteOne({ _id: new ObjectId(id) });
}

// Deletes a form by ID
async function deleteForm(id) {
    const db = await connectDatabase();
    db.collection('forms').deleteOne({ _id: new ObjectId(id) });
}

// ===== FORM STATUS FUNCTIONS ===== //

// Retrieves all rejected forms
async function getRejected() {
    const db = await connectDatabase();
    return db.collection('Rejected').find().toArray();
}

// Retrieves all pending forms
async function getPending() {
    const db = await connectDatabase();
    return db.collection('Pending').find().toArray();
}

// Retrieves all approved forms
async function getApproved() {
    const db = await connectDatabase();
    return db.collection('Approved').find().toArray();
}

// Retrieves canceled forms by user full name
async function getCanceled(name) {
    const db = await connectDatabase();
    return db.collection('canceled').find({ "Full Name": name }).toArray();
}

// Adds a rejected form entry
async function addRejected(rejectedData) {
    const db = await connectDatabase();
    return db.collection('Rejected').insertOne(rejectedData);
}

// Adds a pending form entry
async function addPending(pendingData) {
    const db = await connectDatabase();
    return db.collection('Pending').insertOne(pendingData);
}

// Adds an approved form entry
async function addApproved(approvedData) {
    const db = await connectDatabase();
    return db.collection('Approved').insertOne(approvedData);
}

// Adds a canceled form and updates its status
async function addcanceled(canceledData, id) {
    const db = await connectDatabase();
    await db.collection('canceled').insertOne(canceledData);
    db.collection('canceled').updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'canceled', cancelledAt: new Date() } }
    );
}

// ===== EMAIL VERIFICATION FUNCTIONS ===== //

// Stores an email verification token
async function addVerificationToken(user, token, expiresAt) {
    const db = await connectDatabase();
    return db.collection('VerificationTokens').insertOne({
        user,
        token,
        expiresAt,
        createdAt: new Date()
    });
}

// Verifies the token, adds user, and deletes the token
async function verifyToken(token) {
    const db = await connectDatabase();
    const record = await db.collection('VerificationTokens').findOne({ token });

    if (record) {
        addUser(record.user); // Automatically creates user upon token validation
        await db.collection('VerificationTokens').deleteOne({ token });
        return true;
    }

    return false;
}

// ===== MODULE EXPORTS ===== //

module.exports = {
    // User management
    addUser,
    getUserByEmail,
    getUserByName,
    updateUserPassword,

    // Password reset
    updateResetPassword,
    getResetPasswordEntry,

    // Sessions
    addSession,
    getSessionByKey,
    deleteSession,

    // Forms
    addRequest,
    getRequestsByStudent,
    processRequest,
    getForms,
    getRequestById,
    deleteForm,
    addcanceled,
    getCanceled,
    getCanceledById,
    deleteCanceled,

    // Form status groups
    getRejected,
    getPending,
    getApproved,
    addRejected,
    addPending,
    addApproved,

    // Verification
    addVerificationToken,
    verifyToken
};
