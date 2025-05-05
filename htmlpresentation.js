const express = require('express');
const bodyParser = require('body-parser');
const handlebars = require('express-handlebars');
const cookieParser = require('cookie-parser');
const business = require('./business.js');
const app = express();


app.set('views', __dirname + "/templates");
app.use(express.static(__dirname + '/css'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'handlebars');
app.engine('handlebars', handlebars.engine({ defaultLayout: 'main' }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.post('/dashboard', (req, res) => {
    res.render('dashboard', { layout: false });
})
app.get('/dashboard', (req, res) => {
    res.render('dashboard', { layout: false });
}
)
// Routes
app.get('/', (req, res) => {
    
    res.render('login', { layout: false }); 
    
})

// Handle Login Request
app.post('/login', (req, res) => {
    let username = req.body.Username;
    let password =req.body.Password
    let session = business.loginUser(username, password)
    console.log("Login Attempt:", username, password);


    if (!username === "admin" && password === "password") {
        res.render("mianpage",{layout:false})
        if (session) {
            res.cookie('session', session.key, {expires: session.expiry})
        }

    } else {
        res.redirect('/?message=Invalid Credentials')
    }   

    // if (session) {
    //     res.cookie('session', session.key, {expires: session.expiry})
    //     res.send('login successful')
    // }
    // else {
    //     res.redirect('/?message=Invalid Credentials')
    // }

})

app.get('/logout', async (req, res) => {
    if(business.TerminateSession(req.cookies.session)!=null){
    res.redirect('/')
    }
    else{
        res.send('"error": "Session not found"')
    }
})

app.get('/register', (req, res) => {
    res.render('register',{ layout:false })
})

// Handle Register Request

app.post('/register', async (req, res) => {
    let name =req.body.Username
    let email =req.body.Email
    let Password =req.body.Password
    let Password2 =req.body.Password2
    let programU =req.body.program  // yooo add the program to the register page 
    let abc = await business.checkEmail(email)
    if(abc == null){
        res.render('register',{
            layout:false,
            message: "The Email is invalid or already resgistered "
         })
    }
    console.log("New User:", name, email, Password,Password2);

    // Save user data to database (Mock response)
    if(business.registerUser({name,email,Password,programU}) == true){
        res.render('register_successfully.handlebars',{ layout:false })
    }
    else{
        res.render('register',{
            layout:false,
            message: "The Email is invalid or already resgistered "
            })
    }
});
app.get('/Forgot_password', (req, res) => {
    res.render('forgot_password',{ layout:false })
});


    
app.post('/resetPassword', async(req, res) => {
    let username =req.body.username
    if(Email == req.body.email){
        res.render('resetpassword', {layout: false});
    }else{
        res.render('forgot_password',{
            layout:false,
            message: "The Email is not resgistered "
         })
    }
    let dataemail = await business.getUseremail(username)   //let User enter their userName
        if(dataemail){
            res.send("<h1>the link has been send to your email</h1>")
            let resetKey = uuidv4()
            let resetExpiry = new Date()
            resetExpiry.setHours(resetExpiry.getHours() + 0.1)
            business.createResetPassword(resetKey, resetExpiry, dataemail) //change from username to email
            console.log("Hi there,")
            console.log("You have requested to reset your password. Your secret code is here:", resetKey)
            console.log("Please don't share this code with anyone. This code will expire in 6 min.")
            console.log("If you did not request this code, please ignore this email.")
            //create a page to input the code 
            business.checkKey(resetKey,resetExpiry) //checks reset key and expairy date and returns false if expirykey is expired or key is invalid otherwise it returns true
            business.ResetPassword(newPassword,Email) 
        }else{
            res.render('forgot_password',{
                layout:false,
                message: "The Email is not resgistered "
            })
        }
    
});
app.post('/Conform', (req, res) => {
    let Email =req.body.email
    let password = req.body.password
    let password2 = req.body.password2
    console.log(Email,password,password2)
    res.redirect("/")
});


app.listen(8000, () => {
    console.log("Server running on port 8000");
});
