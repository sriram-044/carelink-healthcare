const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const User = require('../models/User');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// GET /api/alerts — all active alerts (doctor/admin)
router.get('/', auth, role('doctor', 'admin'), async (req, res) => {
  try {
    let query = req.user.role === 'doctor' ? { doctorId: req.user._id } : {};
    if (req.query.resolved === 'false') query.resolved = false;
    const alerts = await Alert.find(query)
      .populate('patientId', 'name email age bloodGroup')
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

// POST /api/alerts/sos — patient SOS button
router.post('/sos', auth, role('patient'), async (req, res) => {
  try {
    const patient = await User.findById(req.user._id);
    const alert = new Alert({
      patientId: req.user._id,
      doctorId: patient?.assignedDoctor,
      type: 'SOS',
      message: `🚨 EMERGENCY SOS triggered by patient ${patient.name}. Immediate attention required!`,
      score: 100
    });
    await alert.save();
    res.status(201).json({ message: 'SOS alert sent to doctor and admin', alert });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/alerts/:id/resolve — doctor resolves alert
router.put('/:id/resolve', auth, role('doctor', 'admin'), async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedAt: new Date(), resolvedBy: req.user._id },
      { new: true }
    );
    res.json({ message: 'Alert resolved', alert });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
