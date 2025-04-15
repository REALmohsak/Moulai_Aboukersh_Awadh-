// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const handlebars = require('express-handlebars');
const session = require('express-session');
const csrf = require('csrf'); // Correct CSRF package
const cookieParser = require('cookie-parser');
const business = require('./business.js');

// Initialize Express app
const app = express();

// Initialize CSRF
const csrfProtection = {
    tokens: new csrf({ saltLength: 16 }),
    
    // Middleware to generate token
    generate: (req, res, next) => {
        if (!req.session.csrfSecret) {
            req.session.csrfSecret = crypto.randomBytes(32).toString('hex');
        }
        res.locals.csrfToken = csrfProtection.tokens.create(req.session.csrfSecret);
        next();
    },
    
    // Middleware to verify token
    verify: (req, res, next) => {
        const token = req.body._csrf || req.query._csrf || req.headers['x-csrf-token'];
        if (!token || !csrfProtection.tokens.verify(req.session.csrfSecret, token)) {
            return res.status(403).render('error', {
                message: 'Invalid CSRF token',
                layout: false
            });
        }
        next();
    }
};
// ==================== APPLICATION CONFIGURATION ====================

// Configure view engine and static files
app.set('views', __dirname + "/templates"); // Set directory for view templates
app.use(express.static(__dirname + '/css')); // Serve static CSS files
app.use(express.static(__dirname + '/public')); // Serve other static files

// Configure Handlebars view engine with custom helpers
app.set('view engine', 'handlebars');
app.engine('handlebars', handlebars.engine({ 
    defaultLayout: 'main', // Main layout template
    helpers: {
        // Helper function to get CSS class based on request status
        getStatusClass: function(status) {
            switch(status) {
                case 'approved': return 'success';
                case 'rejected': return 'danger';
                case 'pending': return 'warning';
                default: return 'secondary';
            }
        }
    }
}));

// ==================== MIDDLEWARE SETUP ====================

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true, // Changed to true to ensure session exists for CSRF
    cookie: { secure: false } // Set to true in production with HTTPS
}));

// Initialize CSRF secret for session
app.use((req, res, next) => {
    if (!req.session.csrfSecret) {
        req.session.csrfSecret = require('crypto').randomBytes(32).toString('hex');
    }
    next();
});

// Apply CSRF token generation to all routes
app.use(csrfProtection.generate);
// ==================== AUTHENTICATION ROUTES ====================

/**
 * GET / - Login page
 * Renders the login form with CSRF token
 */
app.get('/', (req, res) => {
    res.render('login', { layout: false, csrfToken: res.locals.csrfToken });
});

/**
 * POST /login - Handle login form submission
 * Authenticates user credentials and creates session if valid
 */
app.post('/login',  csrfProtection.verify, async (req, res) => {
    let { Username, Password } = req.body;
    let session = await business.loginUser(Username, Password);
    if (session) {
        // Set session cookie and redirect to dashboard on success
        res.cookie('session', session.key, { expires: session.expiry });
        res.redirect('/dashboard');
    } else {
        // Show error message on invalid credentials
        res.render('login', { layout: false, message: "Invalid Credentials", csrfToken:  res.locals.csrfToken });
    }
});

/**
 * GET /dashboard - Main dashboard route
 * Shows different dashboards based on user type (Admin or basic user)
 */
app.get('/dashboard', async (req, res) => {
    let session = req.cookies.session;
    let type = await business.getSessionData(session);
    let userType = type ? type.data.type : "undefined";
    
    if (userType === "Admin") {
        // ADMIN DASHBOARD
        // Fetch various request statistics and forms data
        let forms = await business.getForms();
        let allCountForms = await business.getAllForms();
        let Pending = await business.getPending();
        let Rejected = await business.getRejected();
        let Approved = await business.getApproved();
        let { dropCourse, changeSection, register } = await business.getDifferentForms();
        
        // Check for flash messages
        const message = req.cookies.message || null;
        res.clearCookie('message');

        // Process form data for display (limit to 5 most recent)
        const processedForms = forms.slice(0, 5).map(form => ({
            _id: form._id,
            fullName: form['Full Name'],
            email: form.Email,
            courseCode: form['Course Code'],
            requestType: form['Request Type'],
            currentSection: form['Current Section'],
            status: form.status || 'pending'
        }));

        // Render admin dashboard with all data
        res.render('Admin', {
            layout: false,
            csrfToken: res.locals.csrfToken,
            message,
            forms: processedForms,
            count: forms.length,
            allCountForms,
            Pending,
            countPending: Pending.length,
            Rejected,
            countRejected: Rejected.length,
            Approved,
            countApproved: Approved.length,
            changeSectionCount: changeSection.length,
            cappedCourseCount: register.length,
            dropCourseCount: dropCourse.length
        });
    } else if (userType === "basic") {
        // BASIC USER DASHBOARD
        res.render('basic', { layout: false, csrfToken: res.locals.csrfToken });
    } else {
        // REDIRECT TO LOGIN IF NO VALID SESSION
        res.redirect("/");
    }
});

// ==================== REQUEST MANAGEMENT ROUTES ====================

/**
 * GET /request/ - View details of a specific request
 * Shows detailed information about a single request
 */
app.get('/request/', async (req, res) => {
    try {
        const request = await business.getRequestById(req.query.id);
        if (!request) return res.status(404).send("Request not found");

        // Render request detail page with all request data
        res.render('request-detail', {
            layout: false,
            request: {
                _id: request._id,
                fullName: request['Full Name'],
                email: request.Email,
                courseCode: request['Course Code'],
                courseName: request['Course Name'],
                currentSection: request['Current Section'],
                requestType: request['Request Type'],
                reason: request.Reason,
                status: request.status || 'pending'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// Dynamic routes for request status changes (approved/rejected/pending)
['approved', 'rejected', 'pending'].forEach(action => {
    /**
     * GET /approved, /rejected, /pending - Update request status
     * Changes the status of a request and redirects back to dashboard
     */
    app.get(`/${action}`, async (req, res) => {
        try {
            const request = await business.getRequestById(req.query.id);
            if (!request) return res.status(404).send("Request not found");
            let note = req.body.note
            // Update request status based on action
            if (action === "approved"){
                business.addApproved(request._id, request)
                console.log(`
                    -------------------------------------------------
                    TO: ${request.Email}
                    SUBJECT: Your ${request["Request Type"]} Request Has Been ${action.toUpperCase()}
                    -------------------------------------------------
                    
                    Hello ${request["Full Name"]},
                    
                    Your request for "${request["Request Type"]}" has been **${action}**.
                    
                    ${note ? `\nNote from the department:\n"${note}"\n` : ""}
                    
                    If you have any further questions, feel free to contact the department office.
                    
                    Thank you,
                    administration Department Team
                    -------------------------------------------------
                    `);
            }if (action === "rejected"){
                business.addRejected(request._id, request)
                console.log(`
                    -------------------------------------------------
                    TO: ${request.Email}
                    SUBJECT: Your ${request["Request Type"]} Request Has Been ${action.toUpperCase()}
                    -------------------------------------------------
                    
                    Hello ${request["Full Name"]},
                    
                    Your request for "${request["Request Type"]}" has been **${action}**.
                    
                    ${note ? `\nNote from the department:\n"${note}"\n` : ""}
                    
                    If you have any further questions, feel free to contact the department office.
                    
                    Thank you,
                    administration Department Team
                    -------------------------------------------------
                    `);
            }if (action === "pending"){
                business.addPending(request._id, request)
                console.log(`
                    -------------------------------------------------
                    TO: ${request.Email}
                    SUBJECT: Your ${request["Request Type"]} Request Has Been ${action.toUpperCase()}
                    -------------------------------------------------
                    
                    Hello ${request["Full Name"]},
                    
                    Your request for "${request["Request Type"]}" has been **${action}**.
                    
                    ${note ? `\nNote from the department:\n"${note}"\n` : ""}
                    
                    If you have any further questions, feel free to contact the department office.
                    
                    Thank you,
                    administration Department Team
                    -------------------------------------------------
                    `);
            }
            
            // Set flash message and redirect
            res.cookie('message', `The form is ${action.charAt(0).toUpperCase() + action.slice(1)}`);
            res.redirect('/dashboard');
        } catch (err) {
            console.error('Error in /' + action + ' route:', err);
            res.status(500).send("Server Error");
        }
    });
});

/**
 * GET /quick-help - Quick Help page
 * Shows a random selection of forms for quick reference
 */
app.get('/quick-help', async (req, res) => {
    let forms = await business.getForms();
    // Shuffle forms array to show random selection
    for (let i = forms.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [forms[i], forms[j]] = [forms[j], forms[i]];
    }
    // Process forms data for display
    const processedForms = forms.map(form => ({
        _id: form._id,
        fullName: form['Full Name'],
        email: form.Email,
        courseCode: form['Course Code'],
        requestType: form['Request Type'],
        currentSection: form['Current Section'],
        status: form.status || 'pending'
    }));
    res.render('quick-help', { layout: false, forms: processedForms });
});

// Dynamic routes for different form types (dropCourse/changeSection/cappedCourse)
['dropCourse', 'changeSection', 'cappedCourse'].forEach(type => {
    /**
     * GET /dropCourse, /changeSection, /cappedCourse - Filtered forms views
     * Shows forms filtered by specific request type
     */
    app.get(`/${type}`, async (req, res) => {
        let { dropCourse, changeSection, register } = await business.getDifferentForms();
        const map = { dropCourse, changeSection, cappedCourse: register };

        // Process forms data for display
        const processedForms = map[type].map(form => ({
            _id: form._id,
            fullName: form['Full Name'],
            email: form.Email,
            courseCode: form['Course Code'],
            requestType: form['Request Type'],
            currentSection: form['Current Section'],
            status: form.status || 'pending'
        }));

        // Set appropriate message for each form type
        const messages = {
            dropCourse: "All drop Course forms",
            changeSection: "All change section forms",
            cappedCourse: "All Register for Capped Course forms"
        };

        res.render('quick-help', {
            layout: false,
            forms: processedForms,
            message: messages[type]
        });
    });
});

/**
 * GET /charts - Statistics charts page
 * Shows visual charts of request statistics
 */
app.get('/charts', async (req, res) => {
    let Pending = await business.getPending();
    let Rejected = await business.getRejected();
    let Approved = await business.getApproved();
    let { dropCourse, changeSection, register } = await business.getDifferentForms();

    res.render('charts', {
        layout: false,
        countApproved: Approved.length,
        countPending: Pending.length,
        countRejected: Rejected.length,
        changeSectionCount: changeSection.length,
        cappedCourseCount: register.length,
        dropCourseCount: dropCourse.length
    });
});

// ==================== FORM ROUTES ====================

/**
 * GET /forms - Form submission page
 * Shows the form for submitting new requests
 */
app.get('/forms', (req, res) => {
    res.render('forms', { layout: false, csrfToken: req.csrfToken() });
});

// ==================== USER REGISTRATION ROUTES ====================

/**
 * GET /register - User registration page
 * Shows the user registration form
 */
app.get('/register', (req, res) => {
    res.render('register', { layout: false, csrfToken: res.locals.csrfToken });
});

/**
 * POST /register - Handle user registration
 * Processes new user registration form
 */
app.post('/register',csrfProtection.verify, async (req, res) => {
    let { Username, Email, Password, Password2, program } = req.body;

    // Validate password match
    if (Password !== Password2) {
        return res.render('register', { layout: false, message: "Passwords do not match!" });
    }

    // Check if email is valid and not already registered
    let emailValid = await business.checkEmail(Email);
    if (!emailValid) {
        return res.render('register', { layout: false, message: "Invalid or already registered email!" });
    }

    // Register user
    let message = await business.registerUser(Username, Email, Password, program);
    console.log(message)
    // Show registration success page
    res.render('register_successfully', { layout: false, csrfToken: res.locals.csrfToken });
});

/**
 * GET /verify - Email verification endpoint
 * Handles email verification links sent to users
 */
app.get('/verify', (req, res) => {
    let {email,token} = req.query
    business.completeVerification(email,token)
    res.send("<h1>Your Email is verified</h1>")
});

// ==================== PASSWORD RESET ROUTES ====================

/**
 * GET /forgot_password - Password reset request page
 * Shows form to request password reset
 */
app.get('/forgot_password', (req, res) => {
    res.render('forgot_password', { layout: false, csrfToken: res.locals.csrfToken });
});

/**
 * POST /forgot_password - Handle password reset request
 * Processes password reset request and sends reset email
 */
app.post('/forgot_password', csrfProtection.verify, async (req, res) => {
    let email = req.body.email;
    let checkEmail = await business.resetcheckEmail(email);
    if (checkEmail) {
        let { resetKey, resetExpiry } = await business.createResetPassword(email);
        console.log(`Email to reset your password
            http://localhost:8000/resetPassword?key=` + resetKey);
        res.send("<h1>The link has been sent to your email</h1>");
    } else {
        res.render('forgot_password', { layout: false, message: "The email is not registered", csrfToken:  res.locals.csrfToken });
    }
});

/**
 * GET /resetPassword - Password reset page
 * Shows form to enter new password after following reset link
 */
app.get('/resetPassword', (req, res) => {
    let key = req.query.key;
    res.render("enterResetKey", { layout: false, key: key});
});

/**
 * POST /resetPassword - Validate reset key
 * Validates password reset key and shows password reset form if valid
 */
app.post('/resetPassword',csrfProtection.verify, async (req, res) => {
    let key = req.body.resetKey;
    let { resetKey, resetExpiry, email } = await business.getDateByKey(key);
    // Validate reset key
    if (key === resetKey && new Date(resetExpiry) > new Date()) {
        res.render("resetpassword", { layout: false,  csrfToken: res.locals.csrfToken ,email, key });
    } else {
        res.status(400).send("Invalid reset key or expired reset link.");
    }
});

/**
 * POST /conform - Handle password reset confirmation
 * Processes the new password submission
 */
app.post('/conform', csrfProtection.verify, async (req, res) => {
    let { email, key, password, password2 } = req.body;
    if (password !== password2) {
        return res.render('resetpassword', { layout: false, message: "Passwords do not match!", key, csrfToken: res.locals.csrfToken });
    }
    let isValid = await business.resetcheckEmail(email);
    if (!isValid) {
        return res.render('resetpassword', { layout: false, message: "Invalid email!", csrfToken: res.locals.csrfToken });
    }
    await business.resetPassword(email, password);
    res.redirect('/');
});

// ==================== USER REQUEST ROUTES ====================

/**
 * POST /submitRequest - Submit new request
 * Handles form submission for new course-related requests
 */
app.post('/submitRequest', csrfProtection.verify, async (req, res) => {
    try {
        let sessionKey = req.cookies.session;
        if (!sessionKey) return res.redirect('/');

        let session = await business.getSessionData(sessionKey);
        if (!session) return res.redirect('/');

        let user = await business.getUserByName(session.data.username);

        // Prepare request data from form submission
        const requestData = {
            "Full Name": user.name,
            Email: user.email,
            "Course Code": req.body.course_code,
            "Course Name": req.body.course_name,
            "Current Section": req.body.Section,
            "Request Type": req.body.request_type,
            Reason: req.body.reason,
            createdAt: new Date()
        };

        // Save new request and redirect
        await business.addRequest(requestData);
        res.redirect('/userRequests?success=true');
    } catch (error) {
        console.error(error);
        res.status(500).render('submitRequest', { 
            layout: false, 
            error: "Failed to submit request. Please try again.", 
            csrfToken: req.csrfToken() 
        });
    }
});

/**
 * GET /userRequests - View user's requests
 * Shows all requests submitted by the current user
 */
app.get('/userRequests', async (req, res) => {
    try {
        const sessionKey = req.cookies.session;
        if (!sessionKey){ res.redirect('/')};
        let message = req.query.message
        const session = await business.getSessionData(sessionKey);
        const requests = await business.getUserByName(session.data.username);
        
        // Get all forms and canceled forms for the user
        let forms = await business.getFormsbYid(requests.name)
        let canceledRequest = await business.getCanceled(session.data.username)
        if(canceledRequest){
            for(f of canceledRequest){
                forms.push(f)
            }
        }
        
        // Process forms data for display
        const processedForms = forms.map(form => ({
            _id: form._id,
            fullName: form['Full Name'],
            email: form.Email,
            courseCode: form['Course Code'],
            requestType: form['Request Type'],
            currentSection: form['Current Section'],
            status: form.status || 'pending'
        }));
        res.render('basic_requests', { layout: false, forms: processedForms ,message :message });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

/**
 * GET /basic_request - View specific request details
 * Shows detailed view of a single user request
 */
app.get('/basic_request', async (req, res) => {
    try {
        // Try to get request from both active and canceled collections
        let request = await business.getRequestById(req.query.id);
        if (!request){
            request = await business.getCanceledById(req.query.id);
        }

        res.render('userRequests', {
            layout: false,
            request: {
                _id: request._id,
                fullName: request['Full Name'],
                email: request.Email,
                courseCode: request['Course Code'],
                courseName: request['Course Name'],
                currentSection: request['Current Section'],
                requestType: request['Request Type'],
                reason: request.Reason,
                status: request.status || 'pending'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
})

/**
 * GET /deleteRequest - Cancel/delete a request
 * Moves a request to canceled status
 */
app.get('/deleteRequest', async (req, res) => {
    let request = await business.getRequestById(req.query.id)
    let form = await business.getCanceledById(req.query.id) 
    if(!form){
        business.cancelRequest(req.query.id, request);
        res.redirect('/userRequests');
    }else{
        res.redirect("/userRequests?message=The cancelation has been submitted");
    }
});

/**
 * GET /resubmitRequest - Resubmit a canceled request
 * Reactivates a previously canceled request
 */
app.get('/resubmitRequest', async (req, res) => {
    let request = await business.getCanceledById(req.query.id)
    let form = await business.getRequestById(req.query.id) 
    if(!form){
        await business.resubmitRequest(req.query.id, request);
        res.redirect('/userRequests');
    }else{
        res.redirect("/userRequests?message=The form has been submitted ");
    }
});

// ==================== SESSION MANAGEMENT ====================

/**
 * GET /logout - Logout route
 * Terminates user session and clears cookies
 */
app.get('/logout', async (req, res) => {
    try {
        let sessionKey = req.cookies.session;
        if (!sessionKey) return res.redirect('/');
        // Terminate session and clear cookie
        await business.terminateSession(sessionKey);
        res.clearCookie('session');
        res.redirect('/');
    } catch (error) {
        res.status(400).json({ error: "Session not found" });
    }
});

// ==================== SERVER STARTUP ====================

/**
 * Start the Express server
 * Listens on port 8000 for incoming connections
 */
app.listen(8000, () => {
    console.log("Server is running on http://localhost:8000");
});
