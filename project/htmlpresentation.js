const express = require('express');
const bodyParser = require('body-parser');
const handlebars = require('express-handlebars');
const cookieParser = require('cookie-parser');
const business = require('./business.js');
const { v4: uuidv4 } = require('uuid');

const app = express();

app.set('views', __dirname + "/templates");
app.use(express.static(__dirname + '/css'));
app.use(express.static(__dirname + '/public'));

app.set('view engine', 'handlebars');
app.engine('handlebars', handlebars.engine({ defaultLayout: 'main' }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());


// ===========================
//         ROUTES
// ===========================

// Render Login Page
app.get('/', (req, res) => {
    res.render('login', { layout: false });
});

// Handle Login Request
app.post('/login', async (req, res) => {
    let { Username, Password } = req.body;
    let session = await business.loginUser(Username,Password);
    console.log(Username,Password)
    if (session) {
        res.cookie('session', session.key, { expires: session.expiry });
        res.redirect('/dashboard');  // Redirect to dashboard
    } else {
        res.render('login', {
            layout: false,
            message: "Invalid Credentials"  
        });
    }
    
});

// Render Dashboard
app.get('/dashboard', async(req, res) => {
    let session = req.cookies.session
    let type =await business.getSessionData(session)
    if ( type == "Admin"){
        res.render('Admin', { layout: false });
    }if(type == "basic"){
        res.render('basic', { layout: false });
    }else{
        res.render('login', {
            layout: false,
            message: "Invalid Cookie"  
        });
    }
   
});

// Logout
app.get('/logout', async (req, res) => {
    try {
        let sessionKey = req.cookies.session;
        if (!sessionKey) return res.redirect('/');
        await business.terminateSession(sessionKey);
        res.clearCookie('session');
        res.redirect('/');
    } catch (error) {
        res.status(400).json({ error: "Session not found" });
    }
});

// Render Register Page
app.get('/register', (req, res) => {
    res.render('register', { layout: false });
});

// Handle Register Request
app.post('/register', async (req, res) => {
    try {
        let { Username, Email, Password, Password2, program } = req.body;

        if (Password !== Password2) {
            return res.render('register', {
                layout: false,
                message: "Passwords do not match!"
            });
        }

        let emailValid = await business.checkEmail(Email);
        if (!emailValid) {
            return res.render('register', {
                layout: false,
                message: "Invalid or already registered email!"
            });
        }

        await business.registerUser(Username, Email, Password, program);
        res.render('register_successfully', { layout: false });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Forgot Password Page
app.get('/forgot_password', (req, res) => {
    res.render('forgot_password', { layout: false });
});

app.post('/forgot_password', async(req, res) => {
    let email = req.body.email
    let checkEmail = await business.checkEmail(email)
    console.log(checkEmail)
    if(checkEmail == true){

        let {resetKey, resetExpiry} = await business.createResetPassword(email);
        console.log("Your reset code:", resetKey);
        console.log("the email to rset the password http://localhost:8000/resetPassword?")
        res.send("<h1>The link has been sent to your email</h1>");

    }else{
        console.log("the email is not in the database")
    }
   
    
});

// Handle Forgot Password Request
app.get('/resetPassword', async (req, res) => {
    res.render("enterResetKey",{
        layout: false
    })
});

app.post('/resetPassword', async (req, res) => {
    let key = req.body.resetKey;
    let {resetKey, resetExpiry,email} = await business.getDateByKey(key);
    let date = new Date(Date.now()); // Current time
if (key == resetKey && new Date(resetExpiry) > date) {
    // If the reset key matches and the reset expiry time has passed
    res.render("resetpassword",{
        layout: false,
        email : email,
        key :key
    })
} else {
    // Handle the case when either the key doesn't match or the expiry time is not yet passed
    res.status(400).send("Invalid reset key or expired reset link.");
}
});

// Confirm Password Reset
app.post('/conform', async (req, res) => {
    try {
        let { email,key, password, password2 } = req.body;
        if (password !== password2) {
            return res.render('resetpassword', {
                layout: false,
                message: "Passwords do not match!",
                key:key
            });
        }

        let isValid = await business.checkEmail(email);
        if (!isValid) {
            return res.render('resetpassword', {
                layout: false,
                message: "Invalid email!"
            });
        }

        await business.resetPassword(email, password);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Start Server
app.listen(8000, () => {
    console.log("Server running on port 8000");
});
