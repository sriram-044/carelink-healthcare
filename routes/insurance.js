const express = require('express');
const router = express.Router();
const InsuranceClaim = require('../models/InsuranceClaim');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// GET /api/insurance/claims — list all insurance claims
router.get('/claims', auth, role('insurance', 'admin', 'patient', 'doctor'), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'patient') query.patientId = req.user._id;
    const claims = await InsuranceClaim.find(query)
      .populate('patientId', 'name email age bloodGroup phone')
      .sort({ claimDate: -1 });
    res.json(claims);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/insurance/claims — submit claim
router.post('/claims', auth, async (req, res) => {
  try {
    const { hospitalName, claimAmount, policyNumber, treatmentDescription } = req.body;
    const claimId = 'CLM' + Math.floor(100000 + Math.random() * 900000);

    const claim = new InsuranceClaim({
      claimId,
      patientId: req.user._id,
      hospitalName,
      claimAmount,
      policyNumber,
      treatmentDescription,
      status: 'Pending'
    });

    await claim.save();
    res.status(201).json({ message: 'Insurance claim submitted successfully', claim });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/insurance/claims/:id/review — approve/reject claim
router.put('/claims/:id/review', auth, role('insurance', 'admin'), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const claim = await InsuranceClaim.findByIdAndUpdate(
      req.params.id,
      {
        status,
        rejectionReason,
        reviewedAt: new Date(),
        reviewedBy: req.user._id
      },
      { new: true }
    );
    res.json({ message: `Claim status updated to ${status}`, claim });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
