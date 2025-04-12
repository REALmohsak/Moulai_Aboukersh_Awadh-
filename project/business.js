// business.js - Business logic layer for the application
const db = require('./database'); // Database interaction module
const crypto = require('crypto'); // Node.js crypto module for hashing
const { v4: uuidv4 } = require('uuid'); // UUID generation for tokens

// ===== USER REGISTRATION & EMAIL VERIFICATION ===== //

/**
 * Register a new user in the system
 * @param {string} name - User's full name
 * @param {string} email - User's email address
 * @param {string} password - User's plain text password
 * @param {string} program - User's academic program
 * @returns {Promise<string|boolean>} Verification message or false if email exists
 */
async function registerUser(name, email, password, program) {
    // Check if user already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
        return false;
    }

    // Hash password for secure storage
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const normalizedEmail = email.toLowerCase().trim();

    // Create new user object
    const newUser = {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        program,
        type: 'basic', // Default user type
        createdAt: new Date(),
        resetKey: null,
        resetExpiry: null
    };

    // Start email verification process
    let message = await startVerification(newUser);
    return message;
}

/**
 * Generate and store a verification token (simulates email sending)
 * @param {object} newUser - The newly registered user object
 * @returns {Promise<string>} Simulated email verification message
 */
async function startVerification(newUser) {
    // Generate verification token (UUID without hyphens, first 10 chars)
    const token = uuidv4().replace(/-/g, '').slice(0, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    // Store verification token in database
    await db.addVerificationToken(newUser, token, expiresAt);

    // Simulate email content (in production, this would send a real email)
    let message =`\n=== EMAIL VERIFICATION (SIMULATED) ===
    To: ${newUser.name}
    Token: ${token}
    Expires: ${expiresAt}
    Click to verify: http://localhost:8000/verify?email=${newUser.email}&token=${token}
    ======================================\n`;

    return message;
}

/**
 * Complete email verification process
 * @param {string} email - User's email address
 * @param {string} token - Verification token
 * @returns {Promise<boolean>} True if verification succeeded
 */
async function completeVerification(email, token) {
    const isValid = await db.verifyToken(token);
    if (!isValid) throw new Error("Invalid or expired token");
    return true;
}

// ===== LOGIN & SESSION HANDLING ===== //

/**
 * Authenticate user and create session
 * @param {string} userName - User's username
 * @param {string} password - User's plain text password
 * @returns {Promise<object|undefined>} Session data or undefined if auth fails
 */
async function loginUser(userName, password) {
    // Get user from database
    const user = await db.getUserByName(userName);
    // Hash provided password for comparison
    const hashed = crypto.createHash('sha256').update(password).digest('hex');

    // Check credentials
    if (!user || user.password !== hashed) return undefined;

    // Create new session
    const sessionKey = crypto.randomUUID();
    const sessionData = {
        key: sessionKey,
        expiry: new Date(Date.now() + 1000 * 60 * 30), // 30 minute session
        data: {
            username: user.name,
            type: user.type // 'basic' or 'Admin'
        }
    };
    
    // Store session in database
    await db.addSession(sessionData);
    return sessionData;
}

/**
 * Get session data by session key
 * @param {string} sessionKey - The session identifier
 * @returns {Promise<object>} Session data
 */
async function getSessionData(sessionKey) {
    const session = await db.getSessionByKey(sessionKey);
    return session;
}

/**
 * Terminate a user session
 * @param {string} sessionKey - The session to terminate
 * @returns {Promise} Result of session deletion
 */
async function terminateSession(sessionKey) {
    const session = await db.getSessionByKey(sessionKey);
    if (!session) throw new Error("Session not found");
    return db.deleteSession(sessionKey);
}

/**
 * Get user by username
 * @param {string} username - The username to lookup
 * @returns {Promise<object>} User data
 */
async function getUserByName(username) {
    return await db.getUserByName(username);
}

// ===== PASSWORD RESET FLOW ===== //

/**
 * Check if email exists and is valid (UDST domain)
 * @param {string} email - Email address to check
 * @returns {Promise<boolean>} True if valid and exists
 */
async function checkEmail(email) {
    if (!email || !email.includes("@udst.edu.qa")) return false;
    const user = await db.getUserByEmail(email);
    return !!user; // Convert to boolean
}

/**
 * Create password reset token and store it
 * @param {string} email - User's email address
 * @returns {Promise<object>} Reset key and expiry
 */
async function createResetPassword(email) {
    const user = await db.getUserByEmail(email);
    if (!user) throw new Error("Email not found");
    
    // Generate reset token (UUID without hyphens, first 10 chars)
    const resetKey = uuidv4().replace(/-/g, '').slice(0, 10);
    const resetExpiry = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes expiry
    
    // Store reset token in database
    await db.updateResetPassword(email, resetKey, resetExpiry);
    return { resetKey, resetExpiry };
}

/**
 * Validate reset key and check expiry
 * @param {string} resetKey - The reset token to validate
 * @returns {Promise<boolean>} True if valid and not expired
 */
async function checkResetKey(resetKey) {
    const resetEntry = await db.getResetPasswordEntry(resetKey);
    return resetEntry && resetEntry.resetExpiry > new Date();
}

/**
 * Update user's password
 * @param {string} email - User's email address
 * @param {string} newPassword - New plain text password
 * @returns {Promise} Result of password update
 */
async function resetPassword(email, newPassword) {
    const user = await db.getUserByEmail(email);
    if (!user) throw new Error("User not found");
    
    // Hash new password before storage
    const hashed = crypto.createHash('sha256').update(newPassword).digest('hex');
    return db.updateUserPassword(email, hashed);
}

/**
 * Get reset password data by key
 * @param {string} key - The reset key
 * @returns {Promise<object>} Reset data including email and expiry
 */
async function getDateByKey(key) {
    const data = await db.getResetPasswordEntry(key);
    return {
        resetKey: data.resetKey,
        resetExpiry: data.resetExpiry,
        email: data.email
    };
}

// ===== FORM REQUEST HANDLING ===== //

/**
 * Get all form requests
 * @returns {Promise<Array>} Array of form requests
 */
async function getForms() {
    return await db.getForms();
}

/**
 * Get forms by user's name
 * @param {string} name - User's full name
 * @returns {Promise<Array>} Array of user's forms
 */
async function getFormsbYid(name) {
    let form = [];
    let forms = await getForms();
    
    // Filter forms by user's name
    for (f of forms) {
        if (name === f["Full Name"]) {
            form.push(f);
        }
    }
    return form;
}

/**
 * Cancel a request by moving it to canceled collection
 * @param {string} id - Request ID to cancel
 * @param {object} data - The request data to move
 */
async function cancelRequest(id, data) {
    await db.addcanceled(data, id);
    await db.deleteForm(id);
}

/**
 * Resubmit a canceled request
 * @param {string} id - Request ID to resubmit
 * @param {object} data - The request data to move back
 */
async function resubmitRequest(id, data) {
    await db.addRequest(data, id);
    await db.deleteCanceled(id);
}

/**
 * Get canceled requests by user name
 * @param {string} name - User's full name
 * @returns {Promise<Array>} Array of canceled requests
 */
async function getCanceled(name) {
    return await db.getCanceled(name);
}

/**
 * Get canceled request by ID
 * @param {string} id - Request ID
 * @returns {Promise<object>} Canceled request data
 */
async function getCanceledById(id) {
    return await db.getCanceledById(id);
}

/**
 * Get all approved requests
 * @returns {Promise<Array>} Array of approved requests
 */
async function getApproved() {
    return await db.getApproved();
}

/**
 * Get all rejected requests
 * @returns {Promise<Array>} Array of rejected requests
 */
async function getRejected() {
    return await db.getRejected();
}

/**
 * Get all pending requests
 * @returns {Promise<Array>} Array of pending requests
 */
async function getPending() {
    return await db.getPending();
}

/**
 * Get total count of all forms (including all statuses)
 * @returns {Promise<number>} Total form count
 */
async function getAllForms() {
    const forms = await getForms();
    const rejected = await getRejected();
    const pending = await getPending();
    const approved = await getApproved();
    return forms.length + rejected.length + pending.length + approved.length;
}

/**
 * Get request by ID
 * @param {string} id - Request ID
 * @returns {Promise<object>} Request data
 */
async function getRequestById(id) {
    return await db.getRequestById(id);
}

/**
 * Add new request
 * @param {object} requestData - The request data to add
 */
async function addRequest(requestData) {
    db.addRequest(requestData);
}

/**
 * Approve a request by moving it to approved collection
 * @param {string} id - Request ID to approve
 * @param {object} data - The request data to move
 */
async function addApproved(id, data) {
    await db.addApproved(data);
    await db.deleteForm(id);
}

/**
 * Set request status to pending by moving it to pending collection
 * @param {string} id - Request ID to set as pending
 * @param {object} data - The request data to move
 */
async function addPending(id, data) {
    await db.addPending(data);
    await db.deleteForm(id);
}

/**
 * Reject a request by moving it to rejected collection
 * @param {string} id - Request ID to reject
 * @param {object} data - The request data to move
 */
async function addRejected(id, data) {
    await db.addRejected(data);
    await db.deleteForm(id);
}

/**
 * Categorize forms by their type
 * @returns {Promise<object>} Object with arrays of forms by type:
 *   - dropCourse: Array of drop course requests
 *   - changeSection: Array of section change requests
 *   - register: Array of capped course registration requests
 */
async function getDifferentForms() {
    const forms = await getForms();
    const dropCourse = [], changeSection = [], register = [];

    // Categorize each form by its type
    for (const f of forms) {
        if (f["Request Type"] === "Drop Course") dropCourse.push(f);
        else if (f["Request Type"] === "Change Section") changeSection.push(f);
        else if (f["Request Type"] === "Register for Capped Course") register.push(f);
    }

    return { dropCourse, changeSection, register };
}

// ===== EXPORTS ===== //
module.exports = {
    // User & Auth
    registerUser,
    loginUser,
    startVerification,
    completeVerification,
    getUserByName,
    
    // Sessions
    getSessionData,
    terminateSession,
    
    // Password Reset
    checkEmail,
    createResetPassword,
    checkResetKey,
    resetPassword,
    getDateByKey,
    
    // Requests
    resubmitRequest,
    getFormsbYid,
    getForms,
    getApproved,
    getRejected,
    getPending,
    getAllForms,
    getRequestById,
    addRequest,
    addApproved,
    addPending,
    addRejected,
    getDifferentForms,
    cancelRequest,
    getCanceled,
    getCanceledById
};