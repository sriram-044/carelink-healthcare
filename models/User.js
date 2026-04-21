const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, default: null },
  googleId: { type: String, default: null },
  avatar: { type: String, default: null },
  role: { type: String, enum: ['patient', 'doctor', 'admin', 'lab'], required: true },
  phone: { type: String },
  age: { type: Number },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  bloodGroup: { type: String },
  address: { type: String },
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedPatients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  specialization: { type: String }, // for doctors
  department: { type: String },
  profilePic: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
