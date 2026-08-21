const express = require('express');
const router = express.Router();
const { Medication } = require('../models/Medication');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// GET /api/pharmacy/prescriptions — view all prescriptions
router.get('/prescriptions', auth, role('pharmacy', 'admin', 'doctor'), async (req, res) => {
  try {
    const prescriptions = await Medication.find()
      .populate('patientId', 'name email age bloodGroup phone roomLocation')
      .populate('doctorId', 'name specialization')
      .sort({ createdAt: -1 });
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/pharmacy/dispense/:id — dispense prescription
router.put('/dispense/:id', auth, role('pharmacy', 'admin'), async (req, res) => {
  try {
    const med = await Medication.findByIdAndUpdate(
      req.params.id,
      { takenToday: true, updatedAt: new Date() },
      { new: true }
    );
    res.json({ message: 'Medication dispensed successfully', med });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
