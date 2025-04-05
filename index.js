const express = require("express"); 
const session = require("express-session"); 
const path = require("path"); 
const routes = require("./routes/userRoutes");
require("dotenv").config();
const mongoose = require("mongoose");

const app = express(); 
 
 
app.use(express.json()); // Middleware to parse JSON 
 
// Set EJS as the template engine 
app.set("view engine", "ejs"); 
 
// Middleware to parse form data 
app.use(express.urlencoded({ extended: true })); 
 
// Serve static files (CSS) 
app.use(express.static(path.join(__dirname, "public"))); 
 
app.use(express.static("uploads")); // Serve uploaded files


app.use(session({ 
    secret: "mysecretkey", 
    resave: false, 
    saveUninitialized: true, 
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