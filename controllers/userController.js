const { google } = require("googleapis"); 
// const fs = require("fs"); 
const mime = require("mime-types");
const COORDINATORS = require("../data/coordinators")
// const multer = require("multer");
const { Readable } = require("stream");
require("dotenv").config();



// // Ensure the "uploads" folder exists
// const uploadDir = "uploads";
// if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir);
// }

// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, 'uploads/'); // Make sure 'uploads/' directory exists
//     },
//     filename: function (req, file, cb) {
//         cb(null, Date.now() + '-' + file.originalname);
//     }
// });

// const upload = multer({
//     storage: storage
// }).fields([
//     { name: 'permissionLetter', maxCount: 1 },
//     { name: 'completionCertificate', maxCount: 1 },
//     { name: 'internshipReport', maxCount: 1 },
//     { name: 'studentFeedback', maxCount: 1 },
//     { name: 'employerFeedback', maxCount: 1 }
// ]);

async function getDriveInstance() {
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
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets"
      ]
    });
  
    return google.drive({ version: "v3", auth });
  }
  




// Function to create a subfolder in Drive
async function createSubfolder(subfolderName) {
    const drive = await getDriveInstance();
    const fileMetadata = {
        name: subfolderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [process.env.DRIVE_FOLDER_ID],
    };

    const folder = await drive.files.create({
        resource: fileMetadata,
        fields: "id",
    });

    console.log(`✅ Subfolder '${subfolderName}' created with ID: ${folder.data.id}`);
    return folder.data.id;
}






async function uploadToDrive(buffer, originalName, mimeType, subfolderId) {
    const drive = await getDriveInstance();

    const fileMetadata = {
        name: originalName,
        parents: [subfolderId],
    };

    const media = {
        mimeType: mimeType || mime.lookup(originalName) || "application/octet-stream",
        body: Readable.from(buffer),
    };

    const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id",
    });

    console.log(`✅ Uploaded ${originalName} to Drive: ${file.data.id}`);
    return file.data.id;
}






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



// Middleware to check coordinator authentication
function isCoordinator(req, res, next) {
    if (!req.session.user || !COORDINATORS[req.session.user]) {
        return res.redirect("/");
    }
    next();
}




async function updateGoogleSheetWithLinks(registerNumber, driveLinks) {
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

    // Fetch all rows to find the correct row for the student
    const sheetData = await googleSheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: process.env.SHEET_NAME + "!A:Z",  // Adjust range if needed
    });

    let rows = sheetData.data.values;
    let rowIndex = -1;

    // Find the row matching the register number (ignoring spaces)
    for (let i = 1; i < rows.length; i++) {
        let sheetRegisterNumber = rows[i][1]?.replace(/\s+/g, ""); // Remove spaces from sheet data
        if (sheetRegisterNumber === registerNumber) { 
            rowIndex = i + 1;  // Google Sheets is 1-based index
            break;
        }
    }

    if (rowIndex === -1) {
        console.error("❌ Student not found in sheet!");
        return;
    }

    // Prepare the updated row data
    const updatedData = [
        driveLinks.permissionLetter || rows[rowIndex - 1][20], // Signed Permission Letter Link
        driveLinks.completionCertificate || rows[rowIndex - 1][21], // Completion Certificate Link
        driveLinks.internshipReport || rows[rowIndex - 1][22], // Internship Report Link
        driveLinks.studentFeedback || rows[rowIndex - 1][23], // Student Feedback Link
        driveLinks.employerFeedback || rows[rowIndex - 1][24], // Employer Feedback Link
    ];

    // Update the respective row
    await googleSheets.spreadsheets.values.update({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: `Sheet1!U${rowIndex}:Y${rowIndex}`, // Columns U to Y contain the links
        valueInputOption: "USER_ENTERED",
        resource: { values: [updatedData] },
    });

    console.log(`✅ Updated Google Sheets for Register Number: ${registerNumber}`);
}


module.exports = {
    createSubfolder,
    uploadToDrive,
    getLastSerialNumber,
    isCoordinator,
    updateGoogleSheetWithLinks,
};


