const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Report = require('../models/Report');
const User = require('../models/User');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpeg|jpg|png/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only PDF, JPG and PNG files allowed'));
  }
});

// POST /api/reports/upload — patient or lab uploads report
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { patientId, reportType, labName, testDate, patientNote, doctorId } = req.body;

    const targetPatientId = req.user.role === 'patient' ? req.user._id : patientId;

    const report = new Report({
      patientId: targetPatientId,
      doctorId: doctorId || null,
      uploadedBy: req.user.role,
      uploaderId: req.user._id,
      reportType: reportType || 'other',
      labName,
      testDate: testDate ? new Date(testDate) : null,
      patientNote,
      fileName: req.file?.originalname,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
      mimeType: req.file?.mimetype,
      status: 'Pending'
    });

    await report.save();
    res.status(201).json({ message: 'Report uploaded successfully', report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/reports/admin-add — admin adds report manually
router.post('/admin-add', auth, role('admin'), upload.single('file'), async (req, res) => {
  try {
    const { patientId, doctorId, reportType, labName, testDate } = req.body;
    const report = new Report({
      patientId,
      doctorId,
      uploadedBy: 'admin',
      uploaderId: req.user._id,
      reportType: reportType || 'other',
      labName,
      testDate: testDate ? new Date(testDate) : null,
      fileName: req.file?.originalname,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
      mimeType: req.file?.mimetype,
      status: 'Pending'
    });
    await report.save();
    res.status(201).json({ message: 'Report added successfully', report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports — all reports (admin/doctor/lab)
router.get('/', auth, role('doctor', 'admin', 'lab'), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'doctor') query.doctorId = req.user._id;
    // lab sees all reports (their archive)
    const reports = await Report.find(query)
      .populate('patientId', 'name email age')
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/:patientId — get patient reports
router.get('/:patientId', auth, async (req, res) => {
  try {
    if (req.user.role === 'patient' && req.user._id.toString() !== req.params.patientId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const reports = await Report.find({ patientId: req.params.patientId })
      .populate('doctorId', 'name specialization')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/reports/:id/review — doctor reviews report
router.put('/:id/review', auth, role('doctor'), async (req, res) => {
  try {
    const { doctorComment, severity, status } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        doctorComment,
        severity,
        status: status || (severity === 'Critical' ? 'Flagged' : 'Reviewed'),
        reviewedAt: new Date()
      },
      { new: true }
    );
    res.json({ message: 'Report reviewed', report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
