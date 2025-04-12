// Unified Express App with Merged and De-duplicated Functions

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const handlebars = require('express-handlebars');
const cookieParser = require('cookie-parser');
const business = require('./business.js'); // Business logic module

// Initialize Express app
const app = express();

// Configure view engine and static files
app.set('views', __dirname + "/templates"); // Set views directory
app.use(express.static(__dirname + '/css')); // Serve static CSS files
app.use(express.static(__dirname + '/public')); // Serve other static files

// Configure Handlebars as the view engine
app.set('view engine', 'handlebars');
app.engine('handlebars', handlebars.engine({ 
    defaultLayout: 'main', // Default layout file
    helpers: {
        // Helper function to get Bootstrap class based on status
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

// Configure middleware
app.use(bodyParser.urlencoded({ extended: false })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies
app.use(express.json()); // Parse JSON bodies

// ==================== ROUTES ====================

// Home/Login route
app.get('/', (req, res) => {
    res.render('login', { layout: false });
});

// Login form submission
app.post('/login', async (req, res) => {
    let { Username, Password } = req.body;
    let session = await business.loginUser(Username, Password);
    if (session) {
        // Set session cookie and redirect to dashboard on successful login
        res.cookie('session', session.key, { expires: session.expiry });
        res.redirect('/dashboard');
    } else {
        // Show error message on failed login
        res.render('login', { layout: false, message: "Invalid Credentials" });
    }
});

// Dashboard route - shows different views based on user type
app.get('/dashboard', async (req, res) => {
    let session = req.cookies.session;
    let type = await business.getSessionData(session);
    let userType 
    if(!type){
         userType = "undefined"
    }else{
         userType =type.data.type
    }
    if (userType === "Admin") {
        // Admin dashboard view
        let forms = await business.getForms();
        let allCountForms = await business.getAllForms();
        let Pending = await business.getPending();
        let Rejected = await business.getRejected();
        let Approved = await business.getApproved();
        let { dropCourse, changeSection, register } = await business.getDifferentForms();
        const message = req.cookies.message || null;
        res.clearCookie('message');

        // Process forms data for display
        const processedForms = forms.slice(0, 5).map(form => ({
            _id: form._id,
            fullName: form['Full Name'],
            email: form.Email,
            courseCode: form['Course Code'],
            requestType: form['Request Type'],
            currentSection: form['Current Section'],
            status: form.status || 'pending'
        }));

        // Render admin dashboard with all the data
        res.render('Admin', {
            layout: false,
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
        // Basic user dashboard view
        res.render('basic', { layout: false });
    } else {
        // Invalid session - redirect to login
        res.redirect("/")
    }
});

// View a specific request detail
app.get('/request/', async (req, res) => {
    try {
        const request = await business.getRequestById(req.query.id);
        if (!request) return res.status(404).send("Request not found");

        // Render request detail page
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
    app.get(`/${action}`, async (req, res) => {
        try {
            const request = await business.getRequestById(req.query.id);
            if (!request) return res.status(404).send("Request not found");
            
            // Update request status based on action
            if (action === "approved"){
                business.addApproved(request._id, request)
            }if (action === "rejected"){
                business.addRejected(request._id, request)
            }if (action === "pending"){
                business.addPending(request._id, request)
            }
            
            // Set status message and redirect to dashboard
            res.cookie('message', `The form is ${action.charAt(0).toUpperCase() + action.slice(1)}`);
            res.redirect('/dashboard');
        } catch (err) {
            console.error('Error in /' + action + ' route:', err);
            res.status(500).send("Server Error");
        }
    });
});

// Quick Help page showing random forms
app.get('/quick-help', async (req, res) => {
    let forms = await business.getForms();
    // Shuffle forms array
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

// Charts page showing request statistics
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

// Forms page
app.get('/forms', (req, res) => {
    res.render('forms', { layout: false });
});

// Registration page
app.get('/register', (req, res) => {
    res.render('register', { layout: false });
});

// Registration form submission
app.post('/register', async (req, res) => {
    let { Username, Email, Password, Password2, program } = req.body;

    // Validate password match
    if (Password !== Password2) {
        return res.render('register', { layout: false, message: "Passwords do not match!" });
    }

    // Check if email is valid and not already registered
    let emailValid = await business.checkEmail(Email);
    if (emailValid) {
        return res.render('register', { layout: false, message: "Invalid or already registered email!" });
    }

    // Register user
    let message = await business.registerUser(Username, Email, Password, program);
    
    // Show registration success page
    res.render('register_successfully', { layout: false });
});

// Email verification route
app.get('/verify', (req, res) => {
    let {email,token} = req.query
    business.completeVerification(email,token)
    res.end()
});

// Forgot password page
app.get('/forgot_password', (req, res) => {
    res.render('forgot_password', { layout: false });
});

// Forgot password form submission
app.post('/forgot_password', async (req, res) => {
    let email = req.body.email;
    let checkEmail = await business.checkEmail(email);
    if (checkEmail) {
        // Create and send password reset link
        let { resetKey, resetExpiry } = await business.createResetPassword(email);
        console.log("http://localhost:8000/resetPassword?key="+resetKey);
        res.send("<h1>The link has been sent to your email</h1>");
    } else {
        res.render('forgot_password', { 
            layout: false,
            message: "The email is not registered"
         });
    }
});

// Password reset page
app.get('/resetPassword', (req, res) => {
    let key = req.query.key
    res.render("enterResetKey", { layout: false, key:key });
});

// Password reset form submission
app.post('/resetPassword', async (req, res) => {
    let key = req.body.resetKey;
    let { resetKey, resetExpiry, email } = await business.getDateByKey(key);
    // Validate reset key
    if (key === resetKey && new Date(resetExpiry) > new Date()) {
        res.render("resetpassword", { layout: false, email, key });
    } else {
        res.status(400).send("Invalid reset key or expired reset link.");
    }
});

// Password reset confirmation
app.post('/conform', async (req, res) => {
    let { email, key, password, password2 } = req.body;
    // Validate password match
    if (password !== password2) {
        return res.render('resetpassword', { layout: false, message: "Passwords do not match!", key });
    }

    // Validate email
    let isValid = await business.checkEmail(email);
    if (!isValid) {
        return res.render('resetpassword', { layout: false, message: "Invalid email!" });
    }

    // Reset password and redirect to login
    await business.resetPassword(email, password);
    res.redirect('/');
});

// ==================== USER REQUEST ROUTES ====================

// Submit a new request
app.post('/submitRequest', async (req, res) => {
    try {
        let sessionKey = req.cookies.session;
        if (!sessionKey) { res.redirect('/')};
        let session = await business.getSessionData(sessionKey);
        let user = await business.getUserByName(session.data.username);

        // Create request data object
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

        // Add request and redirect
        await business.addRequest(requestData);
        res.redirect('/userRequests?success=true');
    } catch (error) {
        console.error(error);
        res.status(500).render('submitRequest', { layout: false, error: "Failed to submit request. Please try again." });
    }
});

// View user's requests
app.get('/userRequests', async (req, res) => {
    try {
        const sessionKey = req.cookies.session;
        if (!sessionKey){ res.redirect('/')};

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
        res.render('basic_requests', { layout: false, forms: processedForms });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// View a specific user request detail
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

// Delete/cancel a request
app.get('/deleteRequest', async (req, res) => {
    let request = await business.getRequestById(req.query.id)
    business.cancelRequest(req.query.id, request);
    res.redirect('/userRequests');
});

// Resubmit a canceled request
app.get('/resubmitRequest', async (req, res) => {
    let request = await business.getCanceledById(req.query.id)
    await business.resubmitRequest(req.query.id, request);
    res.redirect('/userRequests');
});

// Logout route
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

// Start the server
app.listen(8000, () => {
    console.log("Server is running on http://localhost:8000");
});