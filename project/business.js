const db = require('./database');
const crypto = require('crypto');

// Register a new user
async function registerUser(name, email, password, program) {
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) throw new Error("User already exists");

    const newUser = {
        name,
        email,
        password,
        program,
        isVerified: false,
        createdAt: new Date(),
        resetKey: null,
        resetExpiry: null
    };

    return db.insertUser(newUser);
}

// Login user
async function loginUser(userName,Password) {
    const details = await db.getUserByName(userName);
    let pshach = crypto.createHash('sha256').update(Password).digest('hex')

    if (details == undefined || details.password != pshach) {
        return undefined
    }   
    let sessionKey = crypto.randomUUID()
    let sd = {
        key: sessionKey,
        expiry: new Date(Date.now() + 1000*60*5),
        data: {
            username: details.name,
            type : details.type
           }
    }
    await db.addSession(sd)
    return sd

}

// Check if an email exists and belongs to the domain
async function checkEmail(email) {
    if (!email || !email.includes("@udst.edu.qa")) return false;
    const user = await db.getUserByEmail(email);
    return !!user;

}

// Create reset password request
async function createResetPassword(email) {
    const user = await db.getUserByEmail(email);
    if (!user) throw new Error("Email not found");
    const resetKey = Math.random().toString(36).substr(2, 8);
    const resetExpiry = new Date(Date.now() + 1000 * 60 * 30); // 30-minute expiry
    await db.updateResetPassword(email, resetKey, resetExpiry);
    return { resetKey, resetExpiry };
}

// Validate reset key
async function checkResetKey(resetKey) {
    const resetEntry = await db.getResetPasswordEntry(resetKey);
    if (!resetEntry || resetEntry.resetExpiry < new Date()) return false;
    return true;
}

// Reset password
async function resetPassword(email, newPassword) {
    const user = await db.getUserByEmail(email);
    if (!user) throw new Error("User not found");
    let pshach = crypto.createHash('sha256').update(newPassword).digest('hex')
    return db.updateUserPassword(email, pshach);
}
async function getSessionData(sessionKey) {
    const session = await db.getSessionByKey(sessionKey);
    if(session){
        let type = session.data.type
        return type
    }else{
        return undefined
    }
    
}
// Terminate session
async function terminateSession(sessionKey) {
    const session = await db.getSessionByKey(sessionKey);
    if (!session) throw new Error("Session not found");

    return db.deleteSession(sessionKey);
}
async function getDateByKey(key) {
    let data = await db.getResetPasswordEntry(key)
    let resetKey = data.resetKey 
    let resetExpiry =  data.resetExpiry
    let email = data.email
    return {resetKey , resetExpiry,email}

}

module.exports = {
    registerUser,
    loginUser,
    checkEmail,
    createResetPassword,
    checkResetKey,
    resetPassword,
    terminateSession,
    getSessionData,
    getDateByKey
};
