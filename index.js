const express = require("express"); 
const session = require("express-session"); 
const path = require("path"); 
const routes = require("./routes/userRoutes");
require("dotenv").config();
const mongoose = require("mongoose");
const serverless = require('serverless-http');
const app = express(); 
const MongoStore = require("connect-mongo");
const Redis = require("ioredis");
const { RedisStore } = require("connect-redis");


app.use(express.json()); // Middleware to parse JSON 
 
// Set EJS as the template engine 
app.set("view engine", "ejs"); 
app.set("views", path.join(__dirname, "views"));
// Middleware to parse form data 
app.use(express.urlencoded({ extended: true })); 
 
// Serve static files (CSS) 
app.use(express.static(path.join(__dirname, "public"))); 
 


console.log("Connecting to Redis...");
console.log("Upstash Redis URL:", process.env.UPSTASH_REDIS_REST_URL);
console.log("Upstash Redis Token:", process.env.UPSTASH_REDIS_REST_TOKEN);

// Connect to Upstash Redis using ioredis
const redisClient = new Redis({
  host: process.env.UPSTASH_REDIS_REST_URL,
  password: process.env.UPSTASH_REDIS_REST_TOKEN,
  tls: {}  // ensure this is necessary
});


redisClient.on('connect', () => {
  console.log("Connected to Redis!");
});



app.set("trust proxy", 1); // Vercel proxy

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60, // 1 hour
      secure: process.env.NODE_ENV === "production", // will be false locally
      sameSite: "lax"
    }
  })
);

redisClient.on('error', (err) => {
  console.log("Error connecting to Redis:", err);
});





// // Vercel deployment using MongoDB as the session store
// app.set("trust proxy", 1); // Trust Vercel's proxy
// app.use(session({
//   secret: "mySecretKey-you-fraud-intruder-cant-guess-man",
//   resave: false,
//   saveUninitialized: false,
//   store: MongoStore.create({
//     mongoUrl: process.env.MONGO_URI, 
//     collectionName: "sessions",
//   }),
//   cookie: {
//     maxAge: 1000 * 60 * 60, // 1 hour
//     sameSite: "lax",        // Important for Vercel
//     secure: false          // Required for HTTPS on Vercel
//   }
// }));

app.use("/",routes);
 
const PORT = process.env.PORT || 3739; 

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Internship";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Connection error:", err));



// Only start server if NOT in Vercel
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
}

// Export app for Vercel
module.exports = app;
module.exports.handler = serverless(app);