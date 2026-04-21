const express = require('express');
const router = express.Router();
const User = require('../models/User');
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

    // Patients can only view their own profile
    if (req.user.role === 'patient' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/patients/:id — update patient profile
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role === 'patient' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { name, phone, age, gender, bloodGroup, address } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { name, phone, age, gender, bloodGroup, address },
      { new: true }
    ).select('-password');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
