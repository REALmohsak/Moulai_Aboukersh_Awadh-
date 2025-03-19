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
    return db;
}

// Register a new user
async function registerUser(userData) {  // userData is the input object containing user details
    try {
        const db = await connectDatabase();
        const usersCollection = db.collection('UserAccounts');

        const newUser = {
            name: userData.name,
            email: userData.email, 
            password: userData.password,
            program: userData.program,
            isVerified: false,   // add function to verify email and return true or false to this value
            createdAt: new Date()
        };

        await usersCollection.insertOne(newUser);
    } catch (e) {
        console.error(`An error occurred while inserting a new user: ${e}`);
    }
}

// Login a user
async function loginUser(userData) {
    try {
        const db = await connectDatabase();
        const usersCollection = db.collection('UserAccounts');

        const user = await usersCollection.findOne({
            email: userData.email,
            password: userData.password
        });

        return user;
    } catch (e) {
        console.error(`An error occurred while logging in: ${e}`);
    }
}

// Example usage
(async () => {
    await connectDatabase();

    // Registering a user
    await registerUser({
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        program: "Computer Science"
    });

    // Logging in a user
    const user = await loginUser({
        email: "john@example.com",
        password: "password123"
    });

    if (user) {
        console.log("Login successful:", user);
    } else {
        console.log("Login failed");
    }

    // Close the database connection when done
    await client.close();
})();
