const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// GET /api/emergency/alerts — view active critical emergency alerts
router.get('/alerts', auth, role('emergency', 'admin', 'doctor', 'hospital'), async (req, res) => {
  try {
    const alerts = await Alert.find({ type: { $in: ['Critical', 'SOS'] } })
      .populate('patientId', 'name email age bloodGroup phone roomLocation caregiverPhone emergencyContact medicalHistory allergies')
      .sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/emergency/dispatch/:id — dispatch ambulance or update status
router.put('/dispatch/:id', auth, role('emergency', 'admin'), async (req, res) => {
  try {
    const { status } = req.body; // 'Dispatched', 'On Route', 'Arrived', 'Resolved'
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { emergencyStatus: status, resolved: status === 'Resolved' },
      { new: true }
    );
    res.json({ message: `Ambulance dispatch status updated to ${status}`, alert });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
