const express = require("express");
const router = express.Router();
const fs = require("fs");
const { google } = require("googleapis");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");
require("dotenv").config(); // To load environment variables
const COORDINATORS = require("../data/coordinators")
const nodemailer = require("nodemailer");
const Doubt = require("../models/Doubt");


const {
    upload,
    createSubfolder,
    uploadToDrive,
    getLastSerialNumber,
    isCoordinator,
    updateGoogleSheetWithLinks,
    uploadDir, // optional; use only if needed
} = require("../controllers/userController");



router.post("/student/ask-doubt", async (req, res) => {
    try {
        const { doubt } = req.body;
        const studentRegNo = req.session.regNo || "Unknown";

        const newDoubt = new Doubt({
            regNo: studentRegNo,
            question: doubt,
            answer: "",
            isResolved: false,
        });

        await newDoubt.save();

        req.session.msg = "Doubt submitted successfully";  // 🔥 Store in session
        res.redirect("/welcome");
    } catch (err) {
        console.error("Error submitting doubt:", err);
        req.session.error = "Failed to submit doubt";  // 🔥 Store error in session
        res.redirect("/welcome");
    }
});






router.get("/generate-report", isCoordinator, async (req, res) => {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
              type: "service_account",
              project_id: process.env.GOOGLE_PROJECT_ID,
              private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
              private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              client_email: process.env.GOOGLE_CLIENT_EMAIL,
              client_id: process.env.GOOGLE_CLIENT_ID,
              auth_uri: "https://accounts.google.com/o/oauth2/auth",
              token_uri: "https://oauth2.googleapis.com/token",
              auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
              client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
              universe_domain: "googleapis.com"
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
          });

        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });

        const spreadsheetId = process.env.SPREADSHEET_ID;
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Sheet1!A:T", 
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(400).send("No internship data available.");
        }

        // Initialize PDF Document in A2 Landscape
        const doc = new jsPDF({ 
            orientation: "landscape", 
            format: "a2" 
        });

        // Set font and styling before writing the title
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");

        const pageWidth = doc.internal.pageSize.getWidth();
        const titleText = "Internship Report";
        const textWidth = doc.getTextWidth(titleText);
        const x = (pageWidth - textWidth) / 2;

        doc.text(titleText, x, 15);

        
        const logoBase64 = process.env.LOGO_BASE64;

        doc.addImage(logoBase64, "PNG", pageWidth - 70, 2, 20, 18); // X, Y, Width, Height

        // Shortened headers
        const headers = [
            "S.No", "Reg. No", "Name", "Mobile", "Sec", "Status", 
            "Title", "Dur", "Start", "End", "Company", "Type", "Stipend", 
            "Category", "Perm. Letter", "Offer Letter", "Cert. Sub.", "Report Sub.", 
            "Stu. Feedback", "Emp. Feedback"
        ];

        const data = rows.slice(1);

        doc.autoTable({
            head: [headers], 
            body: data,
            startY: 25,
            theme: "grid",
            styles: { fontSize: 12, cellPadding: 3 },
            margin: { left: 10, right: 10 },
            tableWidth: "auto",
            columnStyles: {
                0: { cellWidth: 15 },  1: { cellWidth: 40 },  2: { cellWidth: 35 },
                3: { cellWidth: 35 },  4: { cellWidth: 15 },  5: { cellWidth: 20 },
                6: { cellWidth: 30 },  7: { cellWidth: 15 },  8: { cellWidth: 30 },
                9: { cellWidth: 30 }, 10: { cellWidth: 30 }, 11: { cellWidth: 30 },
               12: { cellWidth: 25 }, 13: { cellWidth: 30 }, 14: { cellWidth: 30 },
               15: { cellWidth: 30 }, 16: { cellWidth: 30 }, 17: { cellWidth: 30 },
               18: { cellWidth: 30 }, 19: { cellWidth: 30 }
            },
            headStyles: { fillColor: [0, 128, 0], textColor: [255, 255, 255] },
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=Internship_Report.pdf");
        const pdfBuffer = doc.output("arraybuffer");
        res.send(Buffer.from(pdfBuffer));

    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).send("Error generating report.");
    }
});


router.post("/login", async (req, res) => { 
    const { role, registerNumber, email, studentPassword, coordinatorPassword } = req.body; 

    console.log(role, registerNumber, email, studentPassword, coordinatorPassword); 

    if (role === "coordinator") { 
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
        const students = JSON.parse(fs.readFileSync("./data/students.json")); 

        if (students[registerNumber] && students[registerNumber] === studentPassword) { 
            req.session.user = registerNumber; 
            req.session.regNo = registerNumber; // ✅ Needed by /student/ask-doubt
           
            
            
            // ✅ Check if student already submitted details
            try {
                const auth = new google.auth.GoogleAuth({
                    credentials: {
                      type: "service_account",
                      project_id: process.env.GOOGLE_PROJECT_ID,
                      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
                      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                      client_email: process.env.GOOGLE_CLIENT_EMAIL,
                      client_id: process.env.GOOGLE_CLIENT_ID,
                      auth_uri: "https://accounts.google.com/o/oauth2/auth",
                      token_uri: "https://oauth2.googleapis.com/token",
                      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                      client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
                      universe_domain: "googleapis.com"
                    },
                    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
                  });

                const client = await auth.getClient();
                const googleSheets = google.sheets({ version: "v4", auth: client });

                const spreadsheetId = process.env.SPREADSHEET_ID;
                const response = await googleSheets.spreadsheets.values.get({ 
                    spreadsheetId, 
                    range: "Sheet1!A:T",
                });

                const rows = response.data.values || [];
                // Find the student's row using Register Number 
                const studentData = rows.find(row => row[1].replace(/\s+/g, '') === registerNumber.replace(/\s+/g, ''));


                if (studentData) {
                    return res.redirect("/welcome");
                } else {
                    return res.redirect("/student");
                }
            } catch (error) {
                console.error("Error checking student submission:", error.message);
                return res.render("error", { title: "Error", message: "Login Failed" });
            }
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




router.post("/upload", upload, async (req, res) => {
    try {
        if (!req.files || !req.body.registerNumber) {
            return res.status(400).send("No files uploaded or missing Register Number.");
        }

        let registerNumber = req.body.registerNumber.trim().replace(/\s+/g, ""); // Remove spaces
        let studentName = req.body.name.trim().replace(/[^a-zA-Z0-9-_ ]/g, ""); 

        if (!studentName) {
            studentName = `Upload_${Date.now()}`; // Fallback if name is empty
        }

        // Create a subfolder in Google Drive for the student
        const subfolderId = await createSubfolder(studentName);

        let driveLinks = {};

        for (let field in req.files) {
            const file = req.files[field][0]; // Get uploaded file
            const driveFileId = await uploadToDrive(file.path, file.filename, subfolderId);
            driveLinks[field] = `https://drive.google.com/file/d/${driveFileId}/view`;
        }

        // Update Google Sheets with the links
        await updateGoogleSheetWithLinks(registerNumber, driveLinks);

        res.json({
            message: "Files uploaded successfully and updated in Google Sheets!",
            subfolderId: subfolderId,
            subfolderName: studentName,
            driveLinks: driveLinks,
        });

    } catch (error) {
        console.error("Upload Error:", error.message);
        res.status(500).send("Upload failed.");
    }
});



router.get("/welcome", (req, res) => {
    const msg = req.session.msg;
    const error = req.session.error;

    // Clear it after reading, so it's a one-time message (like toastify)
    req.session.msg = null;
    req.session.error = null;

    res.render("welcome", {
        userReg: req.session.user,
        msg,
        error,
    });
});




router.get("/send-reminders", async (req, res) => {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
              type: "service_account",
              project_id: process.env.GOOGLE_PROJECT_ID,
              private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
              private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              client_email: process.env.GOOGLE_CLIENT_EMAIL,
              client_id: process.env.GOOGLE_CLIENT_ID,
              auth_uri: "https://accounts.google.com/o/oauth2/auth",
              token_uri: "https://oauth2.googleapis.com/token",
              auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
              client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
              universe_domain: "googleapis.com"
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
          });

        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });

        const spreadsheetId = process.env.SPREADSHEET_ID;
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Sheet1!A:Z"
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return res.send("No data found in spreadsheet.");

        const header = rows[0];
        const emailIndex = header.indexOf("Email");
        const nameIndex = header.indexOf("Name");
        const regNoIndex = header.indexOf("Register Number");

        const docFields = {
            "Permission Letter": header.indexOf("Signed Permission Letter, Offer Letter Submitted (Yes / No)"),
            "Completion Certificate": header.indexOf("Completion Certificte Submitted (Yes/No)"),
            "Internship Report": header.indexOf("Internship Report Submitted (Yes/No)"),
            "Student Feedback": header.indexOf("Student Feedback (About Internship) Submitted (Yes/No)"),
            "Employer Feedback": header.indexOf("Employer Feedback (About student) Submitted (Yes/No)")
        };

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        let reminderCount = 0;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const email = row[emailIndex]?.trim();

            // Skip if email is missing or not valid
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

            const missing = [];

            for (let doc in docFields) {
                const colIndex = docFields[doc];
                if (colIndex === -1 || row[colIndex]?.trim().toLowerCase() !== "yes") {
                    missing.push(doc);
                }
            }

            if (missing.length > 0) {
                const mailOptions = {
                    from: process.env.EMAIL,
                    to: email,
                    subject: "SSN Internship Cell: Missing Internship Documents",
                    html: `
                        <p>Dear ${row[nameIndex] || "Student"} (${row[regNoIndex] || "N/A"}),</p>
                        <p>This is a reminder that the following internship documents are still <strong>pending</strong>:</p>
                        <ul>${missing.map(item => `<li>${item}</li>`).join("")}</ul>
                        <p>Please upload them at your earliest convenience to avoid any issues.</p>
                        <p>Regards,<br>Internship Coordinator</p>
                    `
                };

                await transporter.sendMail(mailOptions);
                reminderCount++;
            }
        }

        res.send(`✅ Reminder emails sent to ${reminderCount} student(s) with missing documents.`);
    } catch (error) {
        console.error("❌ Error sending reminders:", error.message);
        res.status(500).send("Error sending reminder emails.");
    }
});

router.get("/view-details", async (req, res) => {  
    if (!req.session.user) return res.redirect("/"); 

    try { 
        const auth = new google.auth.GoogleAuth({
            credentials: {
              type: "service_account",
              project_id: process.env.GOOGLE_PROJECT_ID,
              private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
              private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              client_email: process.env.GOOGLE_CLIENT_EMAIL,
              client_id: process.env.GOOGLE_CLIENT_ID,
              auth_uri: "https://accounts.google.com/o/oauth2/auth",
              token_uri: "https://oauth2.googleapis.com/token",
              auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
              client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
              universe_domain: "googleapis.com"
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
          });

        const client = await auth.getClient(); 
        const googleSheets = google.sheets({ version: "v4", auth: client }); 

        const spreadsheetId = process.env.SPREADSHEET_ID;
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

        // Pass the optional message from query parameters
        const message = req.query.message || "";

        res.render("view-details", { studentData, message }); 
    } catch (error) { 
        console.error("Error:", error.message); 
        res.status(500).send("Error Fetching Data"); 
    } 
});

 
router.get("/student", async (req, res) => { 
    if (!req.session.user) return res.redirect("/"); 

    try { 
        const auth = new google.auth.GoogleAuth({
            credentials: {
              type: "service_account",
              project_id: process.env.GOOGLE_PROJECT_ID,
              private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
              private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              client_email: process.env.GOOGLE_CLIENT_EMAIL,
              client_id: process.env.GOOGLE_CLIENT_ID,
              auth_uri: "https://accounts.google.com/o/oauth2/auth",
              token_uri: "https://oauth2.googleapis.com/token",
              auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
              client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
              universe_domain: "googleapis.com"
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
          });

        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });

        const spreadsheetId = process.env.SPREADSHEET_ID;
        const response = await googleSheets.spreadsheets.values.get({ 
            spreadsheetId, 
            range: "Sheet1!A:Z",  // Adjust the range to include all columns
        });

        const rows = response.data.values || [];
        const userReg = req.session.user;

        // Find the student's row using Register Number
        const studentRow = rows.find(row => row[1].replace(/\s+/g, '') === userReg.replace(/\s+/g, ''));

        if (studentRow) { 
            // Check if any of the student-filled fields are empty
            const studentFields = studentRow.slice(3); // Exclude S.No, Register Number, Name
            const isEmpty = studentFields.every(field => !field || field.trim() === ""); 

            if (!isEmpty) {
                return res.redirect("/view-details?message=You have already submitted your details.");
            }
        }
        
        res.render("index"); 
    } catch (error) { 
        console.error("Error:", error.message); 
        res.status(500).send("Error Fetching Data"); 
    } 
});




router.get("/dashboard", async (req, res) => { 
    if (!req.session.user || !COORDINATORS[req.session.user]) return res.redirect("/"); 
 
    try { 
        const auth = new google.auth.GoogleAuth({
            credentials: {
              type: "service_account",
              project_id: process.env.GOOGLE_PROJECT_ID,
              private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
              private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              client_email: process.env.GOOGLE_CLIENT_EMAIL,
              client_id: process.env.GOOGLE_CLIENT_ID,
              auth_uri: "https://accounts.google.com/o/oauth2/auth",
              token_uri: "https://oauth2.googleapis.com/token",
              auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
              client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
              universe_domain: "googleapis.com"
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
          }); 
 
        const client = await auth.getClient(); 
        const googleSheets = google.sheets({ version: "v4", auth: client }); 
 
        const spreadsheetId = process.env.SPREADSHEET_ID;
        const response = await googleSheets.spreadsheets.values.get({ 
            spreadsheetId, 
            range: "Sheet1!A:Y",  // Updated to include document links
        }); 
 
        const rows = response.data.values || []; 
        res.render("dashboard", { data: rows }); 
    } catch (error) { 
        console.error("Error:", error.message); 
        res.status(500).send("Error Fetching Data"); 
    } 
}); 



 
router.get("/update-details", async (req, res) => { 
    if (!req.session.user) return res.redirect("/"); 
 
    try { 
        const auth = new google.auth.GoogleAuth({
            credentials: {
              type: "service_account",
              project_id: process.env.GOOGLE_PROJECT_ID,
              private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
              private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              client_email: process.env.GOOGLE_CLIENT_EMAIL,
              client_id: process.env.GOOGLE_CLIENT_ID,
              auth_uri: "https://accounts.google.com/o/oauth2/auth",
              token_uri: "https://oauth2.googleapis.com/token",
              auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
              client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
              universe_domain: "googleapis.com"
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
          }); 
 
        const client = await auth.getClient(); 
        const googleSheets = google.sheets({ version: "v4", auth: client }); 
 
        const spreadsheetId = process.env.SPREADSHEET_ID; 
        const response = await googleSheets.spreadsheets.values.get({ 
            spreadsheetId, 
            range: "Sheet1!A:T", 
        }); 
 
        const rows = response.data.values || []; 
        const userReg = req.session.user; 
 
        // Find the student's row using Register Number 
        const studentData = rows.find(row => row[1].replace(/\s+/g, '') === 
userReg.replace(/\s+/g, '')); 
 
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
 
router.post("/student", async (req, res) => { 
    if (!req.session.user) return res.redirect("/");

    try { 
        const { registerNumber, name, mobileNo, section, title, period, startDate, endDate, 
            companyName, placementSource, stipend, internshipType, location, permissionLetter, 
            completionCertificate, internshipReport, studentFeedback, employerFeedback 
        } = req.body; 

        const auth = new google.auth.GoogleAuth({
            credentials: {
              type: "service_account",
              project_id: process.env.GOOGLE_PROJECT_ID,
              private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
              private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              client_email: process.env.GOOGLE_CLIENT_EMAIL,
              client_id: process.env.GOOGLE_CLIENT_ID,
              auth_uri: "https://accounts.google.com/o/oauth2/auth",
              token_uri: "https://oauth2.googleapis.com/token",
              auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
              client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
              universe_domain: "googleapis.com"
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
          });

        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });

        const spreadsheetId = process.env.SPREADSHEET_ID;

        // Append new student details
        await googleSheets.spreadsheets.values.append({ 
            spreadsheetId, 
            range: "Sheet1!A:T", 
            valueInputOption: "USER_ENTERED", 
            resource: { 
                values: [[ 
                    rows.length + 1, registerNumber, name, mobileNo, section, "Yes", title, period, 
                    startDate, endDate, companyName, placementSource, stipend, internshipType, 
                    location, permissionLetter, completionCertificate, internshipReport, 
                    studentFeedback, employerFeedback 
                ]] 
            }, 
        });

        res.redirect("/welcome"); 
    } catch (error) { 
        console.error("Error:", error.message); 
        res.status(500).send("Error Submitting Data"); 
    } 
});

 
router.post("/update-details", async (req, res) => { 
    if (!req.session.user) return res.redirect("/"); 
 
    try { 
        const { 
            serialNo, registerNumber, name, mobileNo, section, title, period, startDate, endDate, 
            companyName, placementSource, stipend, internshipType, location, permissionLetter, 
            completionCertificate, internshipReport, studentFeedback, employerFeedback 
        } = req.body; 
 
        const auth = new google.auth.GoogleAuth({
            credentials: {
              type: "service_account",
              project_id: process.env.GOOGLE_PROJECT_ID,
              private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
              private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              client_email: process.env.GOOGLE_CLIENT_EMAIL,
              client_id: process.env.GOOGLE_CLIENT_ID,
              auth_uri: "https://accounts.google.com/o/oauth2/auth",
              token_uri: "https://oauth2.googleapis.com/token",
              auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
              client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
              universe_domain: "googleapis.com"
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
          });

 
 
        const client = await auth.getClient(); 
        const googleSheets = google.sheets({ version: "v4", auth: client }); 
 
        // Find row number based on serial number 
        const spreadsheetId = process.env.SPREADSHEET_ID; 
        const range = `Sheet1!A${serialNo}:T${serialNo}`; // Row to update 
 
        await googleSheets.spreadsheets.values.update({ 
            spreadsheetId, 
            range, 
            valueInputOption: "USER_ENTERED", 
            resource: { 
                values: [[ 
                    serialNo, registerNumber, name, mobileNo, section, "Yes", title, period, 
                    startDate, endDate, companyName, placementSource, stipend, internshipType, 
location, 
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
router.get("/logout", (req, res) => { 
    req.session.destroy(() => { 
        res.redirect("/"); 
    }); 
}); 
 



// View doubts
router.get("/coordinator/doubts", async (req, res) => {
    const doubts = await Doubt.find().sort({ askedAt: -1 });
    res.render("coordinator-doubts", { doubts }); // coordinator-doubts.ejs
});

// Answer doubt
router.post("/answer-doubt/:id", async (req, res) => {
    const { answer } = req.body;

    await Doubt.findByIdAndUpdate(req.params.id, {
        answer,
        answeredAt: new Date()
    });

    res.redirect("/coordinator/doubts");
});


router.get("/student/my-doubts", async (req, res) => {
    const student = req.session.regNo;

    const doubts = await Doubt.find({ regNo: student}).sort({ askedAt: -1 });
    res.render("student-doubts", { doubts });
});




router.get("/", (req, res) => { 
    res.render("login"); 
}); 
 
router.post("/", async (req, res) => { 
    try { 
        const { 
            registerNumber, name, mobileNo, section, obtainedInternship, title, period, startDate, 
endDate, 
            companyName, placementSource, stipend, internshipType, location, permissionLetter, 
completionCertificate, 
            internshipReport, studentFeedback, employerFeedback 
        } = req.body; 
 
        const auth = new google.auth.GoogleAuth({
            credentials: {
              type: "service_account",
              project_id: process.env.GOOGLE_PROJECT_ID,
              private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
              private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              client_email: process.env.GOOGLE_CLIENT_EMAIL,
              client_id: process.env.GOOGLE_CLIENT_ID,
              auth_uri: "https://accounts.google.com/o/oauth2/auth",
              token_uri: "https://oauth2.googleapis.com/token",
              auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
              client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
              universe_domain: "googleapis.com"
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
          });
 
        const client = await auth.getClient(); 
        const spreadsheetId = process.env.SPREADSHEET_ID; 
 
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
                    `${newSerialNumber}`, registerNumber, name, mobileNo, section, 
obtainedInternship, title, period, 
                    startDate, endDate, companyName, placementSource, stipend, internshipType, 
location, 
                    permissionLetter || "No", completionCertificate || "No", internshipReport || 
"No", 
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
 



module.exports = router;