const mongodb = require('mongodb');

let client;
let db;
let users;
let session;
let course;

// Connect to the database
async function connectDatabase() {
    if (!client) {
        client = new mongodb.MongoClient('mongodb+srv://user1:12class34@lab6.kit9y.mongodb.net/', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        await client.connect();
        db = client.db('project');
        users = db.collection('UserAccounts');
        session = db.collection('SessionData');
        course = db.collection('courses');
    }
    return db
}

// Register a new user
async function registerUser(name,Uemail,passwordU,programU) {  // userData is the input object containing user details
    try {
        const db = await connectDatabase();
        const usersCollection = db.collection('UserAccounts');

        const newUser = {
            name: name,
            email: Uemail,
            password: passwordU,
            program: programU,
            isVerified: false,   // add function to verify email and return true or false to this value
            createdAt: new Date(),
            resetKey: null,
            resetExpiry: null
        }

        await usersCollection.insertOne(newUser);
    } catch (e) {
        console.error(`An error occurred while inserting a new user: ${e}`);
    }
}
async function getUseremail(Useremail) {
    try {
        const db = await connectDatabase();
        const usersCollection = db.collection('UserAccounts')

        const user = await usersCollection.findOne({
            email: Useremail
        });

        return user.email
    } catch (e) {
        console.error(`No such Email found (sad face)`);
    }
}
// Login a user
async function loginUser(UserData,PasswordU) {
    try {
        const db = await connectDatabase();
        const usersCollection = db.collection('UserAccounts');

        const user = await usersCollection.findOne({
            email: userData.email,
            password: PasswordU
        });

        return createSession(user);
    } catch (e) {
        console.error(`An error occurred while logging in: ${e}`);
    }
}
//create a reset password
async function createResetPassword(resetKey, resetExpiry, email) {
        let db = await connectDatabase();
        let usersCollection = db.collection('UserAccounts');

        let user = await usersCollection.findOne({
            email: email
    
        })
        let resetPassword = {
            expiry: resetExpiry,
            key: resetKey
        }

    }
//check the reset key and expiry
async function checkResetKey(resetKey, resetExpiry) {
    try {
        const db = await connectDatabase();
        const usersCollection = db.collection('UserAccounts')
        const user = await usersCollection.findOne({
            resetKey: resetKey,
            resetExpiry: resetExpiry
        })
        if(resetExpiry < new Date()){
            return false
        }
        return true
    } catch (e) {
        console.error(`incorrect key!!!`)
        return false
    }
}
//reset the password
async function resetPassword(newPassword, username) {
    try {
        const db = await connectDatabase()
        const usersCollection = db.collection('UserAccounts')
        const user = await usersCollection.findOne({
            name: username
        })
        user.password = newPassword
        await usersCollection.updateOne({
            name: username
        }, {
            $set: {
                password: newPassword
            }
        })
        return true
    } catch (e) {
        console.error(`Error while resetting the password: ${e}`)
        return false
    }
}
// Create a new session
async function createSession(user) {
    try {
        const db = await connectDatabase()
        const sessionCollection = db.collection('session')

        const newSession = {
            user: user._id,
            expiry: new Date(new Date().getTime() + 1000 * 60 * 60 * 24),
            key: Math.floor(1000000000 + Math.random() * 9000000000).toString()
        }

        await sessionCollection.insertOne(newSession)

        return newSession;
    } catch (e) {
        console.error(`An error occurred while creating a new session: ${e}`);
    }
}

async function terminateSession(deleteSession) {
    let db = await connectDatabase();
    let sessionCollection = db.collection('session');
    let sessionSelected = await usersCollection.findOne({
        session: deleteSession
    });
    await sessionCollection.deleteOne(sessionSelected);
    return true;
}

// Example usage
// (async () => {
//     await connectDatabase();

//     // Registering a user
//     await registerUser({
//         name: "John Doe",
//         email: "john@example.com",
//         password: "password123",
//         program: "Computer Science"
//     });

//     // Logging in a user
//     const user = await loginUser({
//         email: "john@example.com",
//         password: "password123"
//     });

//     if (user) {
//         console.log("Login successful:", user);
//     } else {
//         console.log("Login failed");
//     }

//     // Close the database connection when done
//     await client.close();
// })()

module.exports={
    registerUser,
    loginUser,
    getUseremail,
    terminateSession
}
