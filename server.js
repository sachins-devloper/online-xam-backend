const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect Database
connectDB();

// Init Middleware
const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173"];

app.use((req, res, next) => {
  console.log(`[REQUEST] ${new Date().toISOString()}: ${req.method} ${req.path}`);
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, postman)
      if (!origin) return callback(null, true);
      
      const normalizedOrigin = origin.toLowerCase();
      const isAllowed = allowedOrigins.some(o => o.toLowerCase() === normalizedOrigin);
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS REJECTION] Origin: ${origin}`);
        callback(new Error(`CORS policy: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Define Routes
app.get("/", (req, res) => {
  res.json({ 
    message: "Exam Apt Backend is running...",
    status: "Healthy",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/student", require("./routes/student"));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()}: ${err.message}`);
  if (err.message.includes('CORS policy')) {
    return res.status(403).json({ msg: err.message });
  }
  res.status(500).json({ msg: 'Something went wrong on the server!' });
});

// Export the app for Vercel
module.exports = app;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server started on port ${PORT} (Environment: ${process.env.NODE_ENV || 'development'})`));
}
