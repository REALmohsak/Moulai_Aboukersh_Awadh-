const persistence = require('./data.js');

async function registerUser(name,Uemail,passwordU,programU) {
    await persistence.registerUser(name,Uemail,passwordU,programU);
}

async function loginUser(userData) {
    return await persistence.loginUser(userData);
}
async function checkEmail(email) {
    if(email == null || email == ""){
        return null;
    }
    if(email.includes("@udst.edu.qa") == false){
        return null;
    }
    if(persistence.getUseremail(email) == null){
        return null
    }
    return true;
}
async function terminateSession(session) {
    return await persistence.terminateSession(session)
}
async function getUseremail(Email) {
    return await persistence.getUseremail(Email)
}
async function createResetPassword(resetKey, resetExpiry, email) {
    return await persistence.createResetPassword(resetKey, resetExpiry, email)
}
async function checkKey(resetKey,resetExpiry) {
    return await persistence.checkKey(resetKeyresetExpiry)
}
async function resetPassword(newPassword,username) {
    return await persistence.resetPassword(newPassword,username)
}
module.exports = {
    registerUser,
    loginUser,
    checkEmail,
    terminateSession,
    getUseremail,
    createResetPassword,
    checkKey,
    resetPassword
}
