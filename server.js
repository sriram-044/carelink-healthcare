require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('mongo-sanitize');
const passport = require('./config/passport');
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

// ─── Security Headers ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disabled to allow inline CSS/JS in frontend
  crossOriginEmbedderPolicy: false
}));

// ─── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, 'http://localhost:5000']
  : ['http://localhost:5000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, Postman)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy violation'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ─── Body Parsers ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// ─── NoSQL Injection Sanitization ─────────────────────────────────────────
app.use((req, _res, next) => {
  req.body = mongoSanitize(req.body);
  req.query = mongoSanitize(req.query);
  req.params = mongoSanitize(req.params);
  next();
});

// ─── Rate Limiters ────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { message: 'Too many requests. Please slow down.' }
});

// Apply limiters
app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);

// ─── Session & Passport ───────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'carelink_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// ─── Static Files ─────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'frontend')));

// ─── Scheduled Jobs ───────────────────────────────────────────────────────
require('./utils/scheduler');

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/auth', require('./routes/googleAuth'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/vitals', require('./routes/vitals'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/medication', require('./routes/medication'));
app.use('/api/admin', require('./routes/admin'));

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'CareLink API is running ✅', timestamp: new Date() });
});

// ─── Global Error Handler ─────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// ─── Catch-all: serve frontend ────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   🏥 CareLink Server Running         ║
  ║   Port: ${PORT}                          ║
  ║   URL:  http://localhost:${PORT}         ║
  ║   Mode: ${process.env.NODE_ENV || 'development'}                   ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = app;
