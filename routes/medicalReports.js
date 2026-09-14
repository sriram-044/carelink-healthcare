/**
 * routes/medicalReports.js — Medical Report Management System API Routes
 * Handles upload, file validation, storage, multi-format retrieval, structured test results, and EHR publishing.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const MedicalReport = require('../models/MedicalReport');
const Report = require('../models/Report'); // Legacy model for backward compatibility
const TestRequest = require('../models/TestRequest');
const Sample = require('../models/Sample');
const User = require('../models/User');
const Notification = require('../models/Notification');

const auth = require('../middleware/auth');
const role = require('../middleware/role');

const {
  validateMedicalReportFile,
  generateSafeFileName,
  getReportCategoriesConfig,
  MAX_FILE_SIZE_BYTES
} = require('../utils/fileValidator');

const storageService = require('../utils/storageService');
const { evaluateStructuredResults, triggerCriticalResultAlert, getReferenceRangesCatalog } = require('../utils/criticalDetection');
const { generateReportAiAnalysis } = require('../utils/reportAiEngine');

// Temporary disk storage for Multer before validation & final storage
const tempUploadDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(tempUploadDir)) fs.mkdirSync(tempUploadDir, { recursive: true });

const upload = multer({
  dest: tempUploadDir,
  limits: { fileSize: MAX_FILE_SIZE_BYTES }
});

// ─── GET /api/medical-reports/config/categories ──────────────────────────────
// Returns categories, types, allowed formats, and reference range catalog
router.get('/config/categories', auth, (req, res) => {
  try {
    const categories = getReportCategoriesConfig();
    const referenceRanges = getReferenceRangesCatalog();
    res.json({
      categories,
      referenceRanges,
      maxSizeBytes: MAX_FILE_SIZE_BYTES,
      storageDriver: storageService.getDriverName()
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/medical-reports/upload ─────────────────────────────────────────
// Multipart file upload with strict validation, storage abstraction, and critical detection
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  let tempFilePath = null;
  try {
    const {
      patientId,
      doctorId,
      testRequestId,
      sampleId,
      hospitalName,
      labName,
      category,
      reportType,
      testDate,
      reportDate,
      patientNote,
      structuredResults: rawStructuredResults,
      publishImmediately
    } = req.body;

    if (!patientId) {
      return res.status(400).json({ message: 'Patient selection is required.' });
    }
    if (!reportType) {
      return res.status(400).json({ message: 'Report type is required.' });
    }

    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Selected patient not found.' });
    }

    // Determine target doctor
    const targetDoctorId = doctorId || patient.assignedDoctor || null;

    let safeFileName = null;
    let fileFormat = 'MANUAL';
    let fileSize = 0;
    let fileUrl = null;
    let mimeType = null;
    let originalFileName = null;

    // 1. Validate File if provided
    if (req.file) {
      tempFilePath = req.file.path;
      originalFileName = req.file.originalname;

      const validation = validateMedicalReportFile(req.file, reportType);
      if (!validation.isValid) {
        // Clean up temp file
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return res.status(400).json({ message: validation.error });
      }

      fileFormat = validation.format || path.extname(originalFileName).replace('.', '').toUpperCase();
      safeFileName = generateSafeFileName(originalFileName, category || 'report');
      fileSize = req.file.size;
      mimeType = req.file.mimetype;

      // 2. Save via Storage Service
      await storageService.uploadFile(tempFilePath, safeFileName);
      fileUrl = storageService.getFileUrl(safeFileName, req);

      // Remove temp file
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }

    // 3. Process Structured Test Results
    let structuredResults = [];
    if (rawStructuredResults) {
      try {
        structuredResults = typeof rawStructuredResults === 'string'
          ? JSON.parse(rawStructuredResults)
          : rawStructuredResults;
      } catch (parseErr) {
        console.warn('Could not parse structured results:', parseErr.message);
      }
    }

    // 4. Critical Result & Range Evaluation
    const evaluation = evaluateStructuredResults(structuredResults);
    const criticalStatus = evaluation.overallStatus;

    // 5. Generate AI Non-Diagnostic Summary
    const aiAnalysis = generateReportAiAnalysis(
      evaluation.evaluatedResults,
      reportType,
      category || 'Laboratory'
    );

    const isPublished = publishImmediately === 'true' || publishImmediately === true;

    // 6. Create Medical Report Record
    const medicalReport = new MedicalReport({
      patientId,
      doctorId: targetDoctorId,
      hospitalName: hospitalName || 'CareLink Central Hospital',
      laboratoryId: req.user.role === 'lab' ? req.user._id : null,
      labName: labName || (req.user.role === 'lab' ? req.user.name : 'CareLink Diagnostic Laboratory'),
      testRequestId: testRequestId || null,
      sampleId: sampleId || null,
      category: category || 'Laboratory',
      reportType,
      fileName: safeFileName,
      originalFileName,
      fileFormat,
      fileSize,
      fileUrl,
      mimeType,
      testDate: testDate ? new Date(testDate) : new Date(),
      reportDate: reportDate ? new Date(reportDate) : new Date(),
      uploadDate: new Date(),
      uploadedBy: req.user.role || 'lab',
      uploaderId: req.user._id,
      reportStatus: isPublished ? 'Published' : 'Uploaded',
      criticalStatus,
      structuredResults: evaluation.evaluatedResults,
      aiAnalysis,
      patientNote: patientNote || ''
    });

    await medicalReport.save();

    // 7. Sync with Legacy Report model for complete backwards-compatibility
    try {
      await new Report({
        patientId,
        doctorId: targetDoctorId,
        uploadedBy: req.user.role === 'lab' ? 'lab' : (req.user.role === 'patient' ? 'patient' : 'admin'),
        uploaderId: req.user._id,
        reportType: reportType.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15) || 'other',
        labName: medicalReport.labName,
        testDate: medicalReport.testDate,
        patientNote,
        fileName: originalFileName || safeFileName,
        fileUrl,
        mimeType,
        status: isPublished ? 'Reviewed' : 'Pending',
        severity: criticalStatus === 'Critical' ? 'Critical' : (criticalStatus === 'Abnormal' ? 'Risk' : 'Normal')
      }).save();
    } catch (legacyErr) {
      console.warn('Legacy Report model sync note:', legacyErr.message);
    }

    // 8. Update Test Request status if linked
    if (testRequestId) {
      await TestRequest.findByIdAndUpdate(testRequestId, {
        reportId: medicalReport._id,
        status: 'Completed',
        completedAt: new Date()
      });
    }

    // 9. Handle Critical Alerts
    if (criticalStatus === 'Critical') {
      await triggerCriticalResultAlert({
        report: medicalReport,
        patient,
        doctorId: targetDoctorId,
        hospitalName: medicalReport.hospitalName
      });
    } else if (isPublished) {
      // Standard publication notification
      await new Notification({
        recipientId: patientId,
        role: 'patient',
        type: 'report_published',
        title: `📄 New ${reportType} Report Available`,
        message: `Your ${reportType} report has been published to your Lifetime EHR record.`,
        reportId: medicalReport._id,
        severity: 'Normal'
      }).save();
    }

    res.status(201).json({
      message: 'Medical report uploaded and processed successfully!',
      report: medicalReport,
      isCritical: criticalStatus === 'Critical'
    });
  } catch (err) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
    console.error('Report upload error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/medical-reports ─────────────────────────────────────────────────
// List reports with role-based access and multi-field filters
router.get('/', auth, async (req, res) => {
  try {
    const { category, reportType, patientId, criticalStatus, reportStatus, search } = req.query;
    const query = {};

    // Role-based restrictions
    if (req.user.role === 'patient') {
      query.patientId = req.user._id;
      // Patient sees verified and published reports
      query.reportStatus = { $in: ['Verified', 'Published', 'Uploaded'] };
    } else if (req.user.role === 'doctor') {
      // Doctor can see their assigned patients' reports or reports assigned to them
      if (patientId) {
        query.patientId = patientId;
      } else {
        query.$or = [{ doctorId: req.user._id }, { patientId: { $in: req.user.assignedPatients || [] } }];
      }
    } else {
      // Lab, Hospital, Admin can view all
      if (patientId && mongoose.Types.ObjectId.isValid(patientId)) {
        query.patientId = patientId;
      }
    }

    if (category) query.category = category;
    if (reportType) query.reportType = reportType;
    if (criticalStatus) query.criticalStatus = criticalStatus;
    if (reportStatus) query.reportStatus = reportStatus;

    let reports = await MedicalReport.find(query)
      .populate('patientId', 'name email age gender phone roomLocation bloodGroup')
      .populate('doctorId', 'name specialization phone email')
      .populate('testRequestId', 'requestId priority testName')
      .populate('sampleId', 'sampleId sampleType status')
      .sort({ testDate: -1, createdAt: -1 });

    if (search) {
      const q = search.toLowerCase();
      reports = reports.filter(r =>
        (r.reportId && r.reportId.toLowerCase().includes(q)) ||
        (r.reportType && r.reportType.toLowerCase().includes(q)) ||
        (r.category && r.category.toLowerCase().includes(q)) ||
        (r.patientId?.name && r.patientId.name.toLowerCase().includes(q)) ||
        (r.doctorId?.name && r.doctorId.name.toLowerCase().includes(q)) ||
        (r.labName && r.labName.toLowerCase().includes(q))
      );
    }

    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/medical-reports/:id ─────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const report = await MedicalReport.findById(req.params.id)
      .populate('patientId', 'name email age gender phone roomLocation bloodGroup caregiverPhone emergencyContact medicalHistory allergies')
      .populate('doctorId', 'name specialization phone email')
      .populate('testRequestId')
      .populate('sampleId');

    if (!report) return res.status(404).json({ message: 'Medical report not found' });

    // Authorization check
    if (req.user.role === 'patient' && report.patientId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied to this report.' });
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/medical-reports/:id/view ────────────────────────────────────────
// Secure inline preview stream
router.get('/:id/view', auth, async (req, res) => {
  try {
    const report = await MedicalReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Medical report not found' });

    if (req.user.role === 'patient' && report.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied to this report file.' });
    }

    if (!report.fileName) {
      return res.status(404).json({ message: 'No file attached to this report (structured data only).' });
    }

    const fileData = await storageService.getFile(report.fileName);

    const mime = report.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${report.originalFileName || report.fileName}"`);

    fileData.stream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/medical-reports/:id/download ────────────────────────────────────
// Secure download attachment
router.get('/:id/download', auth, async (req, res) => {
  try {
    const report = await MedicalReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Medical report not found' });

    if (req.user.role === 'patient' && report.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (!report.fileName) {
      return res.status(404).json({ message: 'No downloadable file attached to this report.' });
    }

    const fileData = await storageService.getFile(report.fileName);
    const downloadName = report.originalFileName || report.fileName;

    res.setHeader('Content-Type', report.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

    fileData.stream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /api/medical-reports/:id/publish ──────────────────────────────────────
// Publish report to Patient's Lifetime EHR & notify patient and doctor
router.put('/:id/publish', auth, role('lab', 'doctor', 'admin', 'hospital'), async (req, res) => {
  try {
    const report = await MedicalReport.findByIdAndUpdate(
      req.params.id,
      { reportStatus: 'Published' },
      { new: true }
    ).populate('patientId', 'name email').populate('doctorId', 'name email');

    if (!report) return res.status(404).json({ message: 'Medical report not found' });

    // Send notification to Patient
    await new Notification({
      recipientId: report.patientId._id,
      role: 'patient',
      type: 'report_published',
      title: `📄 ${report.reportType} Published to EHR`,
      message: `Your ${report.reportType} report is now available in your Lifetime Electronic Health Record.`,
      reportId: report._id,
      severity: report.criticalStatus === 'Critical' ? 'Critical' : 'Normal'
    }).save();

    // Send notification to Doctor if assigned
    if (report.doctorId) {
      await new Notification({
        recipientId: report.doctorId._id,
        role: 'doctor',
        type: 'report_published',
        title: `📋 Report Published: ${report.patientId?.name}`,
        message: `${report.reportType} has been published and is ready for clinical evaluation.`,
        reportId: report._id,
        severity: report.criticalStatus === 'Critical' ? 'Critical' : 'Normal'
      }).save();
    }

    res.json({ message: 'Report published to Patient Lifetime EHR successfully!', report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /api/medical-reports/:id/archive ──────────────────────────────────────
router.put('/:id/archive', auth, role('lab', 'admin', 'doctor'), async (req, res) => {
  try {
    const report = await MedicalReport.findByIdAndUpdate(
      req.params.id,
      { reportStatus: 'Archived' },
      { new: true }
    );
    if (!report) return res.status(404).json({ message: 'Medical report not found' });
    res.json({ message: 'Report archived successfully', report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /api/medical-reports/:id/review ───────────────────────────────────────
// Doctor clinical review
router.put('/:id/review', auth, role('doctor', 'admin'), async (req, res) => {
  try {
    const { doctorComment, severity } = req.body;
    const report = await MedicalReport.findByIdAndUpdate(
      req.params.id,
      {
        doctorComment,
        reviewedAt: new Date(),
        reportStatus: 'Verified'
      },
      { new: true }
    );
    if (!report) return res.status(404).json({ message: 'Medical report not found' });
    res.json({ message: 'Clinical review saved', report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/medical-reports/:id/results ────────────────────────────────────
// Enter or update structured test results
router.post('/:id/results', auth, role('lab', 'doctor', 'admin'), async (req, res) => {
  try {
    const { structuredResults } = req.body;
    if (!Array.isArray(structuredResults)) {
      return res.status(400).json({ message: 'structuredResults must be an array of test parameters.' });
    }

    const report = await MedicalReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Medical report not found' });

    const evaluation = evaluateStructuredResults(structuredResults);
    report.structuredResults = evaluation.evaluatedResults;
    report.criticalStatus = evaluation.overallStatus;
    report.aiAnalysis = generateReportAiAnalysis(evaluation.evaluatedResults, report.reportType, report.category);

    await report.save();

    if (report.criticalStatus === 'Critical') {
      const patient = await User.findById(report.patientId);
      await triggerCriticalResultAlert({
        report,
        patient,
        doctorId: report.doctorId,
        hospitalName: report.hospitalName
      });
    }

    res.json({ message: 'Structured test results updated successfully', report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE /api/medical-reports/:id ──────────────────────────────────────────
// Delete report with authorization check
router.delete('/:id', auth, role('lab', 'admin'), async (req, res) => {
  try {
    const report = await MedicalReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Medical report not found' });

    // Delete underlying physical file
    if (report.fileName) {
      await storageService.deleteFile(report.fileName);
    }

    await MedicalReport.findByIdAndDelete(req.params.id);
    res.json({ message: 'Medical report deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
