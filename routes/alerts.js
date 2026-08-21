const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const User = require('../models/User');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { triggerEmergencyWorkflow } = require('../utils/emergencyEngine');

// GET /api/alerts — active alerts (doctor/admin)
router.get('/', auth, role('doctor', 'admin'), async (req, res) => {
  try {
    let query = req.user.role === 'doctor' ? { doctorId: req.user._id } : {};
    if (req.query.resolved === 'false') query.resolved = false;
    const alerts = await Alert.find(query)
      .populate('patientId', 'name email age bloodGroup phone roomLocation caregiverPhone emergencyContact')
      .sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/alerts/patient/:patientId — alerts for a specific patient
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const alerts = await Alert.find({ patientId: req.params.patientId }).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/alerts/sos — patient SOS button (triggers full emergency workflow)
router.post('/sos', auth, role('patient'), async (req, res) => {
  try {
    const patient = await User.findById(req.user._id);
    const { location } = req.body;

    const alert = await triggerEmergencyWorkflow({
      patient,
      doctorId: patient?.assignedDoctor,
      type: 'SOS',
      score: 100,
      vitals: {},
      reasons: ['Patient pressed manual SOS Panic Button'],
      fallDetected: false,
      location: location || patient.roomLocation || 'Room 104, Sunrise Senior Home'
    });

    res.status(201).json({
      message: '🚨 Emergency SOS broadcasted to Caregiver, Family, Doctor, and Hospital.',
      alert
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/alerts/:id/status — update emergency status ('Acknowledged', 'Dispatched', 'Resolved')
router.put('/:id/status', auth, role('doctor', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const isResolved = status === 'Resolved';
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        emergencyStatus: status,
        resolved: isResolved,
        resolvedAt: isResolved ? new Date() : null,
        resolvedBy: isResolved ? req.user._id : null
      },
      { new: true }
    );
    res.json({ message: `Alert status updated to ${status}`, alert });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/alerts/:id/resolve — resolve alert
router.put('/:id/resolve', auth, role('doctor', 'admin'), async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { resolved: true, emergencyStatus: 'Resolved', resolvedAt: new Date(), resolvedBy: req.user._id },
      { new: true }
    );
    res.json({ message: 'Alert resolved', alert });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
