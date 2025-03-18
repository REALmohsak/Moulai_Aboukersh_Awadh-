const express = require('express');
const bodyParser = require('body-parser');
const handlebars = require('express-handlebars');
const cookieParser = require('cookie-parser');
const app = express();


app.set('views', __dirname + "/templates");
app.use(express.static(__dirname + '/css'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'handlebars');
app.engine('handlebars', handlebars.engine({ defaultLayout: 'main' }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Routes
app.get('/', (req, res) => {
    
    res.render('login', { layout: false }); 
    
});

// Handle Login Request
app.post('/login', (req, res) => {
    let username = req.body.Username;
    let password =req.body.Password
    console.log("Login Attempt:", username, password);
    // Perform authentication logic here
    if (username === "admin" && password === "password") {
        res.render("mianpage",{layout:false})
    } else {
        res.render("Invalid_Credentials",{layout:false})
       
       
    }
    /*if (session) {
        res.cookie('session', session.key, {expires: session.expiry})
        res.redirect('/dashboard')
    }
    else {
        res.redirect('/?message=Invalid Credentials')
    } */


});

app.get('/logout', async (req, res) => {
    //await business.terminateSession(req.cookies.sessionid)
    //res.clearCookie('session')
    res.redirect('/')
})

app.get('/register', (req, res) => {
    res.render('register',{ layout:false })
});

// Handle Register Request
app.post('/register', (req, res) => {
    let name =req.body.Username
    let email =req.body.Email
    let Password =req.body.Password
    let Password2 =req.body.Password2


    console.log("New User:", name, email, Password,Password2);

    // Save user data to database (Mock response)
    res.render('register_successfully.handlebars',{ layout:false })
});
app.get('/Forgot_password', (req, res) => {
    res.render('forgot_password',{ layout:false })
});


    
app.post('/resetPassword', async(req, res) => {
    let Email =req.body.email
    if(Email == "u1@gmail.com"){
        res.render('resetpassword', {layout: false});
    }else{
        res.render('forgot_password',{
            layout:false,
            message: "The Email is not resgistered "
         })
    }
    /*let dataemail = await business.getUseremail(Email)
        if(email === dataemail){
            res.send("<h1>the link has been send to your email</h1>")
            let resetkey = uuidv4();
            business.addkey(email,resetkey)
            console.log("the rest link "+"http://localhost:8000/resetpassword?uuid="+resetkey+"&email="+email)
        }else{
            res.render('forgot_password',{
                layout:false,
                message: "The Email is not resgistered "
            })
        }*/
    
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
