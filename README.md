# CareLink — AI-Driven Remote Patient Monitoring System

> Full-stack healthcare management platform with role-based portals for Patient, Doctor, Admin, and Lab staff, powered by an AI-based health risk scoring engine.

---

## 🚀 Quick Start

### Step 1 — Configure MongoDB

Edit the `.env` file and replace `MONGO_URI` with your MongoDB Atlas connection string:

```
# Get from: https://cloud.mongodb.com → Your Cluster → Connect → Drivers
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/carelink
```

> **Note**: If you don't have Atlas yet, create a free account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)

### Step 2 — Install Dependencies

```bash
npm install --legacy-peer-deps
```

### Step 3 — Seed Demo Data

```bash
node utils/seed.js
```

This creates 4 demo users:
| Role    | Email               | Password |
|---------|---------------------|----------|
| Patient | patient@demo.com    | demo123  |
| Doctor  | doctor@demo.com     | demo123  |
| Admin   | admin@demo.com      | demo123  |
| Lab     | lab@demo.com        | demo123  |

### Step 4 — Start the Server

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

### Step 5 — Open in Browser

```
http://localhost:5000
```

---

## 🏗️ Project Structure

```
carelink/
├── .env                        # Environment variables
├── server.js                   # Express server entry point
├── package.json
│
├── config/
│   └── db.js                   # MongoDB connection
│
├── models/
│   ├── User.js                 # Patient, Doctor, Admin, Lab
│   ├── VitalSigns.js           # Heart rate, SpO2, temperature, AI score
│   ├── Report.js               # Lab reports (3-role workflow)
│   ├── Alert.js                # Critical, Risk, SOS alerts
│   └── Medication.js           # Medications + Diet plans
│
├── routes/
│   ├── auth.js                 # POST /login, /register, GET /me
│   ├── patients.js             # GET/PUT patient data
│   ├── vitals.js               # POST vitals (triggers AI engine)
│   ├── ai.js                   # GET AI analysis + 7-day history
│   ├── reports.js              # Lab report upload/review
│   ├── alerts.js               # Alert feed + SOS
│   ├── medication.js           # Medications + diet plans
│   └── admin.js                # User management + analytics
│
├── middleware/
│   ├── auth.js                 # JWT verification
│   └── role.js                 # RBAC (role-based access)
│
├── utils/
│   ├── aiEngine.js             # AI risk scoring (rule-based)
│   └── seed.js                 # Demo data seeder
│
├── uploads/                    # Uploaded lab report files
│
└── frontend/
    ├── index.html              # Login / Landing page
    ├── patient.html            # Patient Portal
    ├── doctor.html             # Doctor Portal
    ├── admin.html              # Admin Portal
    ├── lab.html                # Lab Portal
    ├── css/
    │   └── style.css           # Full design system (dark theme)
    └── js/
        ├── auth.js             # Shared auth utilities
        ├── patient.js          # Patient portal logic
        ├── doctor.js           # Doctor portal logic
        ├── admin.js            # Admin portal logic
        └── lab.js              # Lab portal logic
```

---

## 🤖 AI Risk Engine

The AI engine (`utils/aiEngine.js`) is a **rule-based scoring system**:

| Condition            | Score Added | Reason                   |
|---------------------|-------------|--------------------------|
| HR > 120 bpm        | +50         | Severe tachycardia        |
| HR > 100 bpm        | +30         | Elevated heart rate       |
| HR < 50 bpm         | +30         | Bradycardia               |
| SpO2 < 90%          | +50         | Severe hypoxia            |
| SpO2 < 95%          | +25         | Low oxygen saturation     |
| Temp > 103°F        | +30         | High fever                |
| Temp > 100°F        | +15         | Mild fever                |

**Classification:**
- 🔴 70–100 → **Critical** — Auto-alert sent
- 🟡 40–69  → **Risk** — Doctor notified
- 🟢 0–39   → **Normal** — All stable

---

## 🔑 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/vitals` | Submit vitals → triggers AI |
| GET | `/api/ai/analyze/:id` | Run AI on latest vitals |
| GET | `/api/ai/history/:id` | 7-day score trend |
| POST | `/api/reports/upload` | Upload lab report |
| PUT | `/api/reports/:id/review` | Doctor reviews report |
| POST | `/api/alerts/sos` | Patient SOS trigger |
| PUT | `/api/admin/assign` | Assign doctor to patient |

---

## 🛡️ Security

- **JWT** authentication on every API route
- **bcrypt** password hashing (never stored plain text)
- **RBAC** — each endpoint checks user role before responding
- Patients can only access their own data
- Doctors can only see assigned patients

---

## 🌐 Deployment

| Service | Platform | Instructions |
|---------|----------|--------------|
| Backend | [Render](https://render.com) | Connect GitHub repo, set env vars |
| Frontend | [Netlify](https://netlify.com) | Drag & drop `frontend/` folder |
| Database | [MongoDB Atlas](https://cloud.mongodb.com) | Free M0 cluster |

---

## 📚 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, JavaScript (ES6) |
| Charts | Chart.js |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose ODM |
| File Storage | Multer (disk storage) |
| Auth | JWT + bcrypt |
| Security | RBAC middleware |
| AI Engine | Rule-based scoring (no ML library) |
