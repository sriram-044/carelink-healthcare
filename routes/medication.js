const express = require('express');
const router = express.Router();
const { Medication, DietPlan } = require('../models/Medication');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// GET /api/medication/diet/:patientId — get diet plan  (MUST be before /:patientId)
router.get('/diet/:patientId', auth, async (req, res) => {
  try {
    const diet = await DietPlan.findOne({ patientId: req.params.patientId })
      .sort({ createdAt: -1 });
    res.json(diet);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/medication/:patientId — get medications
router.get('/:patientId', auth, async (req, res) => {
  try {
    const meds = await Medication.find({ patientId: req.params.patientId, isActive: true })
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 });
    res.json(meds);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/medication — doctor adds medication
router.post('/', auth, role('doctor', 'admin'), async (req, res) => {
  try {
    const { patientId, name, dosage, frequency, instructions, startDate, endDate } = req.body;
    const med = new Medication({
      patientId, doctorId: req.user._id,
      name, dosage, frequency, instructions,
      startDate, endDate
    });
    await med.save();
    res.status(201).json({ message: 'Medication added', med });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/medication/:id/taken — patient marks as taken
router.put('/:id/taken', auth, role('patient'), async (req, res) => {
  try {
    const med = await Medication.findByIdAndUpdate(
      req.params.id,
      { takenToday: true, $push: { takenDates: new Date() } },
      { new: true }
    );
    res.json({ message: 'Marked as taken', med });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/medication/:id — doctor removes medication
router.delete('/:id', auth, role('doctor', 'admin'), async (req, res) => {
  try {
    await Medication.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Medication removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/medication/diet — doctor adds diet plan  (MUST be before /:patientId would catch 'diet')
router.post('/diet', auth, role('doctor'), async (req, res) => {
  try {
    const { patientId, plan, calories, notes } = req.body;
    const diet = new DietPlan({ patientId, doctorId: req.user._id, plan, calories, notes });
    await diet.save();
    res.status(201).json({ message: 'Diet plan added', diet });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

