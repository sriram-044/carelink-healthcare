const mongoose = require('mongoose');

const InsuranceClaimSchema = new mongoose.Schema({
  claimId: { type: String, required: true, unique: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hospitalName: { type: String, required: true },
  claimAmount: { type: Number, required: true },
  policyNumber: { type: String, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Under Review'],
    default: 'Pending'
  },
  claimDate: { type: Date, default: Date.now },
  treatmentDescription: { type: String },
  rejectionReason: { type: String },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('InsuranceClaim', InsuranceClaimSchema);
