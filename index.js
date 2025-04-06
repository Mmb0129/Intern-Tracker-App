const express = require("express"); 
const session = require("express-session"); 
const path = require("path"); 
const routes = require("./routes/userRoutes");
require("dotenv").config();
const mongoose = require("mongoose");
const serverless = require('serverless-http');
const app = express(); 
const MongoStore = require("connect-mongo");
 
app.use(express.json()); // Middleware to parse JSON 
 
// Set EJS as the template engine 
app.set("view engine", "ejs"); 
app.set("views", path.join(__dirname, "views"));
// Middleware to parse form data 
app.use(express.urlencoded({ extended: true })); 
 
// Serve static files (CSS) 
app.use(express.static(path.join(__dirname, "public"))); 
 

// Vercel deployment using MongoDB as the session store
app.set("trust proxy", 1); // Trust Vercel's proxy
app.use(session({
  secret: "mySecretKey-you-fraud-intruder-cant-guess-man",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI, 
    collectionName: "sessions",
  }),
  cookie: {
    maxAge: 1000 * 60 * 60, // 1 hour
    sameSite: "lax",        // Important for Vercel
    secure: true            // Required for HTTPS on Vercel
  }
}));

app.use("/",routes);
 
const PORT = process.env.PORT || 3739; 

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Internship";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Connection error:", err));

app.listen(PORT, () => { 
    console.log("Server running on PORT "+PORT); 
}); 

// Only start server if NOT in Vercel
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3739;
  app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
}

// Export app for Vercel
module.exports = app;
module.exports.handler = serverless(app);