const express = require("express");
const { google } = require("googleapis");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const COORDINATORS = require("./data/coordinators")


const app = express();

const SPREADSHEET_ID = "1OE4wJhQ2n96neFHzHLW5FVS4epFqyDVWbGn7mJK8dls";
const SHEET_NAME = "Sheet1";


app.use(express.json()); // Middleware to parse JSON

// Set EJS as the template engine
app.set("view engine", "ejs");

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS)
app.use(express.static(path.join(__dirname, "public")));

async function getLastSerialNumber(auth, spreadsheetId) {
    const googleSheets = google.sheets({ version: "v4", auth });

    const response = await googleSheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Sheet1!A:A", // Fetch only the S.No column
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return 1; // If only the header exists, start from 1
    const lastSerial = parseInt(rows[rows.length - 1][0]); // Extract last S.No
    return isNaN(lastSerial) ? 1 : lastSerial + 1; // Ensure it's a number
}


app.use(session({
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: true,
}));


app.get("/", (req, res) => {
    res.render("login");
});

app.post("/", async (req, res) => {
    try {
        const {
            registerNumber, name, mobileNo, section, obtainedInternship, title, period, startDate, endDate,
            companyName, placementSource, stipend, internshipType, location, permissionLetter, completionCertificate,
            internshipReport, studentFeedback, employerFeedback
        } = req.body;

        const auth = new google.auth.GoogleAuth({
            keyFile: "credentials.json",
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const client = await auth.getClient();
        const spreadsheetId = "1OE4wJhQ2n96neFHzHLW5FVS4epFqyDVWbGn7mJK8dls";

        // Get the last serial number and increment
        const newSerialNumber = await getLastSerialNumber(client, spreadsheetId);

        const googleSheets = google.sheets({ version: "v4", auth: client });

        await googleSheets.spreadsheets.values.append({
            auth,
            spreadsheetId,
            range: "Sheet1!A:T",
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [[
                    `${newSerialNumber}`, registerNumber, name, mobileNo, section, obtainedInternship, title, period,
                    startDate, endDate, companyName, placementSource, stipend, internshipType, location,
                    permissionLetter || "No", completionCertificate || "No", internshipReport || "No",
                    studentFeedback || "No", employerFeedback || "No"
                ]]
            },
        });

        res.send("<h2>Form submitted successfully!</h2><a href='/'>Go back</a>");
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/login", (req, res) => {
    const { role, registerNumber, email, studentPassword, coordinatorPassword } = req.body;

    console.log(role, registerNumber, email, studentPassword, coordinatorPassword);

    if (role === "coordinator") {
        // ✅ Validate Coordinator Credentials
        if (COORDINATORS[email] && COORDINATORS[email] === coordinatorPassword) {
            req.session.user = email;
            return res.redirect("/dashboard");
        } else {
            return res.render("error", {
                title: "Login Failed!",
                message: "Invalid Coordinator Email or Password."
            });
        }
    } else if (role === "student") {
        // ✅ Read Student Credentials from JSON
        const students = JSON.parse(fs.readFileSync("./data/students.json"));

        if (students[registerNumber] && students[registerNumber] === studentPassword) {
            req.session.user = registerNumber;
            return res.redirect("/welcome");
        } else {
            return res.render("error", {
                title: "Login Failed!",
                message: "Invalid Register Number or Password."
            });
        }
    } else {
        return res.render("error", {
            title: "Invalid Login",
            message: "Please select Student or Coordinator login."
        });
    }
});

// ✅ Welcome Page Route
app.get("/welcome", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.render("welcome", { userReg: req.session.user });
});

app.get("/view-details", async (req, res) => {
    if (!req.session.user) return res.redirect("/");

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: "credentials.json",
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });

        const spreadsheetId = "1OE4wJhQ2n96neFHzHLW5FVS4epFqyDVWbGn7mJK8dls";
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Sheet1!A:T",
        });

        const rows = response.data.values || [];
        const userReg = req.session.user;

        // Find the row that matches the student's register number
        const studentData = rows.find(row => row[1].replace(/\s+/g, '') === userReg.replace(/\s+/g, ''));


        if (!studentData) {
            return res.render("error", { 
                title: "No Records Found", 
                message: "You have not submitted any internship details yet."
            });
        }

        res.render("view-details", { studentData });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("Error Fetching Data");
    }
});


// Student Page - Internship Form
app.get("/student", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.render("index"); // Student form page
});

app.get("/dashboard", async (req, res) => {
    if (!req.session.user || !COORDINATORS[req.session.user]) return res.redirect("/");

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: "credentials.json",
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });

        const spreadsheetId = "1OE4wJhQ2n96neFHzHLW5FVS4epFqyDVWbGn7mJK8dls";
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Sheet1!A:T",
        });

        const rows = response.data.values || [];
        res.render("dashboard", { data: rows });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("Error Fetching Data");
    }
});

app.get("/update-details", async (req, res) => {
    if (!req.session.user) return res.redirect("/");

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: "credentials.json",
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });

        const spreadsheetId = SPREADSHEET_ID;
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Sheet1!A:T",
        });

        const rows = response.data.values || [];
        const userReg = req.session.user;

        // Find the student's row using Register Number
        const studentData = rows.find(row => row[1].replace(/\s+/g, '') === userReg.replace(/\s+/g, ''));

        if (!studentData) {
            return res.render("error", { 
                title: "No Records Found", 
                message: "You have not submitted any internship details yet."
            });
        }

        res.render("update-details", { studentData });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("Error Fetching Data");
    }
});




app.post("/update-details", async (req, res) => {
    if (!req.session.user) return res.redirect("/");

    try {
        const {
            serialNo, registerNumber, name, mobileNo, section, title, period, startDate, endDate,
            companyName, placementSource, stipend, internshipType, location, permissionLetter,
            completionCertificate, internshipReport, studentFeedback, employerFeedback
        } = req.body;

        const auth = new google.auth.GoogleAuth({
            keyFile: "credentials.json",
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });

        // Find row number based on serial number
        const spreadsheetId = SPREADSHEET_ID;
        const range = `Sheet1!A${serialNo}:T${serialNo}`; // Row to update

        await googleSheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [[
                    serialNo, registerNumber, name, mobileNo, section, "Yes", title, period,
                    startDate, endDate, companyName, placementSource, stipend, internshipType, location,
                    permissionLetter, completionCertificate, internshipReport,
                    studentFeedback, employerFeedback
                ]]
            },
        });

        res.send("<h2>Details updated successfully!</h2><a href='/welcome'>Go Back</a>");
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("Error Updating Data");
    }
});


// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.listen(1337, () => {
    console.log("Server running on PORT 1337");
});
