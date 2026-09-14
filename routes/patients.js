const express = require('express');
const router = express.Router();
const User = require('../models/User');
const HospitalVisit = require('../models/HospitalVisit');
const { Medication } = require('../models/Medication');
const Report = require('../models/Report');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// GET /api/patients — all patients (doctor/admin)
router.get('/', auth, role('doctor', 'admin'), async (req, res) => {
  try {
    let patients;
    if (req.user.role === 'admin') {
      patients = await User.find({ role: 'patient' }).select('-password').populate('assignedDoctor', 'name email specialization');
    } else {
      patients = await User.find({ role: 'patient', assignedDoctor: req.user._id }).select('-password');
    }
    res.json(patients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/patients/:id — single patient
router.get('/:id', auth, async (req, res) => {
  try {
    const patient = await User.findById(req.params.id).select('-password').populate('assignedDoctor', 'name email specialization phone');
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    if (req.user.role === 'patient' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const MedicalReport = require('../models/MedicalReport');

// GET /api/patients/:id/lifetime-history — full lifetime medical record
router.get('/:id/lifetime-history', auth, async (req, res) => {
  try {
    if (req.user.role === 'patient' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const patient = await User.findById(req.params.id).select('-password').populate('assignedDoctor', 'name email specialization phone');
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const hospitalVisits = await HospitalVisit.find({ patientId: req.params.id }).sort({ visitDate: -1 });
    const medications = await Medication.find({ patientId: req.params.id }).populate('doctorId', 'name').sort({ createdAt: -1 });
    const reports = await Report.find({ patientId: req.params.id }).sort({ testDate: -1 });
    const medicalReports = await MedicalReport.find({ patientId: req.params.id })
      .populate('doctorId', 'name specialization')
      .populate('testRequestId', 'requestId priority testName')
      .populate('sampleId', 'sampleId sampleType status')
      .sort({ testDate: -1, createdAt: -1 });

    res.json({
      patient,
      hospitalVisits,
      medications,
      reports,
      medicalReports,
      allergiesDetail: patient.allergiesDetail || [],
      medicalConditionsDetail: patient.medicalConditionsDetail || []
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/patients/:id/hospital-visit — add hospital visit
router.post('/:id/hospital-visit', auth, async (req, res) => {
  try {
    if (req.user.role === 'patient' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { hospitalName, visitDate, visitType, doctorName, reason, diagnosis, dischargeSummary, status } = req.body;

    const visit = new HospitalVisit({
      patientId: req.params.id,
      hospitalName,
      visitDate: visitDate || new Date(),
      visitType: visitType || 'Outpatient Consult',
      doctorName,
      reason,
      diagnosis,
      dischargeSummary,
      status: status || 'Completed'
    });

    await visit.save();
    res.status(201).json({ message: 'Hospital visit recorded', visit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/patients/:id/allergies — add allergy
router.post('/:id/allergies', auth, async (req, res) => {
  try {
    if (req.user.role === 'patient' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, severity, reaction } = req.body;
    if (!name) return res.status(400).json({ message: 'Allergy name is required' });

    const patient = await User.findById(req.params.id);
    patient.allergiesDetail.push({ name, severity: severity || 'Moderate', reaction });
    if (!patient.allergies.includes(name)) {
      patient.allergies.push(name);
    }
    await patient.save();

    res.status(201).json({ message: 'Allergy added to profile', allergiesDetail: patient.allergiesDetail });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/patients/:id/allergies/:allergyId — delete allergy
router.delete('/:id/allergies/:allergyId', auth, async (req, res) => {
  try {
    const patient = await User.findById(req.params.id);
    patient.allergiesDetail = patient.allergiesDetail.filter(a => a._id.toString() !== req.params.allergyId);
    await patient.save();
    res.json({ message: 'Allergy removed', allergiesDetail: patient.allergiesDetail });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/patients/:id/medical-conditions — add medical condition
router.post('/:id/medical-conditions', auth, async (req, res) => {
  try {
    if (req.user.role === 'patient' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { condition, diagnosedYear, status } = req.body;
    if (!condition) return res.status(400).json({ message: 'Condition name is required' });

    const patient = await User.findById(req.params.id);
    patient.medicalConditionsDetail.push({ condition, diagnosedYear, status: status || 'Active' });
    if (!patient.medicalHistory.includes(condition)) {
      patient.medicalHistory.push(condition);
    }
    await patient.save();

    res.status(201).json({ message: 'Medical condition added', medicalConditionsDetail: patient.medicalConditionsDetail });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/patients/:id — update basic profile
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role === 'patient' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { name, phone, age, gender, bloodGroup, address, caregiverPhone, emergencyContact, roomLocation } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { name, phone, age, gender, bloodGroup, address, caregiverPhone, emergencyContact, roomLocation },
      { new: true }
    ).select('-password');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
