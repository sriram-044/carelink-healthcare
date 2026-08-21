/**
 * autoSeed.js — Automatically seeds demo data for MediLink AI 8-Portal Ecosystem
 */

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const VitalSigns = require('../models/VitalSigns');
const { Medication, DietPlan } = require('../models/Medication');
const Report = require('../models/Report');
const Alert = require('../models/Alert');
const HospitalVisit = require('../models/HospitalVisit');
const InsuranceClaim = require('../models/InsuranceClaim');
const { analyzeVitals } = require('./aiEngine');

const seed = async () => {
  try {
    const existing = await User.findOne({ email: 'patient@demo.com' });
    if (existing) return; // already seeded

    console.log('🌱 Seeding MediLink AI 8-Portal Ecosystem demo dataset...');
    const password = await bcrypt.hash('demo123', 10);

    // 1. Admin User
    await new User({
      name: 'Admin Super User', email: 'admin@demo.com', password,
      role: 'admin', phone: '+91 98765 43210', isActive: true
    }).save();

    // 2. Doctor User
    const doctor = await new User({
      name: 'Dr. Priya Sharma', email: 'doctor@demo.com', password,
      role: 'doctor', specialization: 'Cardiologist',
      department: 'Cardiology', phone: '+91 98765 11111', isActive: true
    }).save();

    // 3. Lab Technician User
    await new User({
      name: 'Lab Technician (John Doe)', email: 'lab@demo.com', password,
      role: 'lab', department: 'Pathology', isActive: true
    }).save();

    // 4. Pharmacist User
    await new User({
      name: 'Pharmacist (Anita Patel)', email: 'pharmacy@demo.com', password,
      role: 'pharmacy', department: 'Central Pharmacy', isActive: true
    }).save();

    // 5. Insurance Officer User
    const insuranceOfficer = await new User({
      name: 'Insurance Officer (Rakesh Mehta)', email: 'insurance@demo.com', password,
      role: 'insurance', department: 'Claims Assessment', isActive: true
    }).save();

    // 6. Emergency Officer User
    await new User({
      name: 'Emergency Response Officer (Vikram Singh)', email: 'emergency@demo.com', password,
      role: 'emergency', department: 'Trauma & Ambulance Response', isActive: true
    }).save();

    // 7. Patient 1 (Rajan Kumar)
    const patient1 = await new User({
      name: 'Rajan Kumar', email: 'patient@demo.com', password,
      role: 'patient', age: 45, gender: 'male', bloodGroup: 'O+',
      phone: '+91 98765 22222', assignedDoctor: doctor._id,
      caregiverPhone: '+91 98765 00001', emergencyContact: '+91 98765 99991',
      roomLocation: 'Sector 4, Apartment 2B',
      medicalHistory: ['Hypertension', 'Mild Asthma'],
      allergies: ['Penicillin'],
      allergiesDetail: [
        { name: 'Penicillin', severity: 'Severe', reaction: 'Anaphylactic reaction' }
      ],
      medicalConditionsDetail: [
        { condition: 'Essential Hypertension', diagnosedYear: '2020', status: 'Active' },
        { condition: 'Mild Asthma', diagnosedYear: '2017', status: 'Managed' }
      ],
      isActive: true
    }).save();

    // 8. Patient 2 — CASE STUDY ELDERLY PATIENT (Mr. Ravi)
    const patientRavi = await new User({
      name: 'Mr. Ravi', email: 'ravi@demo.com', password,
      role: 'patient', age: 68, gender: 'male', bloodGroup: 'B+',
      phone: '+91 98765 77777', assignedDoctor: doctor._id,
      caregiverPhone: '+91 98765 88888 (Anish - Caregiver)',
      emergencyContact: '+91 98765 99999 (Sunita - Daughter)',
      roomLocation: 'Room 104, Sunrise Senior Home',
      medicalHistory: ['Coronary Artery Disease', 'Hypertension', 'History of Dizziness'],
      allergies: ['Sulfa Drugs', 'NSAIDs / Ibuprofen'],
      allergiesDetail: [
        { name: 'Sulfa Drugs', severity: 'Severe', reaction: 'Severe skin rash and hives' },
        { name: 'NSAIDs / Ibuprofen', severity: 'Moderate', reaction: 'Gastric irritation and facial swelling' }
      ],
      medicalConditionsDetail: [
        { condition: 'Coronary Artery Disease', diagnosedYear: '2019', status: 'Managed' },
        { condition: 'Essential Hypertension', diagnosedYear: '2018', status: 'Active' },
        { condition: 'History of Vertigo / Dizziness', diagnosedYear: '2022', status: 'Active' }
      ],
      isActive: true
    }).save();

    // Patient 3 (Meena Pillai)
    const patient3 = await new User({
      name: 'Meena Pillai', email: 'patient2@demo.com', password,
      role: 'patient', age: 38, gender: 'female', bloodGroup: 'B+',
      phone: '+91 98765 33333', assignedDoctor: doctor._id,
      roomLocation: 'Flat 301, Green Valley',
      medicalHistory: ['Type 2 Diabetes'],
      isActive: true
    }).save();

    // Link doctor to patients
    await User.findByIdAndUpdate(doctor._id, {
      assignedPatients: [patient1._id, patientRavi._id, patient3._id]
    });

    // Seed Hospital Visits for Mr. Ravi
    await new HospitalVisit({
      patientId: patientRavi._id,
      hospitalName: 'Apollo Emergency Care Center',
      visitDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      visitType: 'Emergency Admission',
      doctorName: 'Dr. Priya Sharma',
      reason: 'Acute dizziness and sudden hypertensive spike (BP 170/105)',
      diagnosis: 'Transient Hypertensive Crisis & Mild Dehydration',
      dischargeSummary: 'Patient IV hydrated, sublingual antihypertensives administered. Discharged in stable condition with modified beta-blocker dosage.',
      status: 'Discharged'
    }).save();

    await new HospitalVisit({
      patientId: patientRavi._id,
      hospitalName: 'Sunrise Specialty Clinic',
      visitDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      visitType: 'Outpatient Consult',
      doctorName: 'Dr. Priya Sharma',
      reason: 'Routine quarterly cardiac evaluation & ECG checkup',
      diagnosis: 'Stable Angina Pectoris',
      dischargeSummary: 'ECG within expected baseline. Lipid profile requested.',
      status: 'Completed'
    }).save();

    // Seed Insurance Claims
    await new InsuranceClaim({
      claimId: 'CLM100248',
      patientId: patientRavi._id,
      hospitalName: 'Apollo Emergency Care Center',
      claimAmount: 45000,
      policyNumber: 'POL-MED-99201',
      treatmentDescription: 'Emergency Admission for Hypertensive Crisis & IV Hydration Therapy',
      status: 'Pending'
    }).save();

    await new InsuranceClaim({
      claimId: 'CLM100249',
      patientId: patient1._id,
      hospitalName: 'City Care Hospital',
      claimAmount: 18500,
      policyNumber: 'POL-MED-88102',
      treatmentDescription: 'Outpatient Diagnostic Workup & Asthma Management',
      status: 'Approved',
      reviewedAt: new Date(),
      reviewedBy: insuranceOfficer._id
    }).save();

    // Seed 7 days telemetry for Mr. Ravi (Case Study)
    const now = new Date();
    const raviTelemetry = [
      { heartRate: 74, spo2: 98, temperature: 98.4, stepCount: 4250, systolicBP: 124, diastolicBP: 82, fallDetected: false },
      { heartRate: 76, spo2: 97, temperature: 98.6, stepCount: 3800, systolicBP: 126, diastolicBP: 84, fallDetected: false },
      { heartRate: 82, spo2: 96, temperature: 98.5, stepCount: 2900, systolicBP: 130, diastolicBP: 86, fallDetected: false },
      { heartRate: 88, spo2: 95, temperature: 98.8, stepCount: 1500, systolicBP: 138, diastolicBP: 90, fallDetected: false },
      { heartRate: 98, spo2: 93, temperature: 99.4, stepCount: 800, systolicBP: 145, diastolicBP: 94, fallDetected: false },
      { heartRate: 145, spo2: 88, temperature: 101.2, stepCount: 120, systolicBP: 165, diastolicBP: 102, fallDetected: true } // Emergency event
    ];

    for (let i = 0; i < raviTelemetry.length; i++) {
      const v = raviTelemetry[i];
      const ai = analyzeVitals(v.heartRate, v.spo2, v.temperature, v.stepCount, v.systolicBP, v.diastolicBP, v.fallDetected);
      const date = new Date(now);
      date.setDate(date.getDate() - (raviTelemetry.length - 1 - i));

      await new VitalSigns({
        patientId: patientRavi._id,
        ...v,
        source: 'wearable',
        location: 'Room 104, Sunrise Senior Home',
        aiScore: ai.score,
        aiStatus: ai.status,
        aiReasons: ai.reasons,
        aiRecommendation: ai.recommendation,
        recordedAt: date
      }).save();
    }

    // Critical Emergency Alert for Mr. Ravi (Case Study)
    await new Alert({
      patientId: patientRavi._id,
      doctorId: doctor._id,
      type: 'Critical',
      message: '🚨 CRITICAL FALL EVENT & Abnormal Vitals detected for Mr. Ravi. AI Risk Score: 92/100',
      score: 92,
      vitals: { heartRate: 145, spo2: 88, temperature: 101.2, systolicBP: 165, diastolicBP: 102 },
      fallDetected: true,
      location: 'Room 104, Sunrise Senior Home',
      notifiedEntities: ['Caregiver', 'Family', 'Doctor', 'Hospital'],
      emergencyStatus: 'Dispatched',
      reasons: [
        'Hard Fall Impact detected by wearable sensor',
        'Severe tachycardia: Heart rate 145 bpm (>140)',
        'Critical hypoxia: SpO2 88% (<88%)',
        'Hypertension Stage 2: BP 165/102 mmHg'
      ]
    }).save();

    // Telemetry & Alert for Rajan Kumar
    await new VitalSigns({
      patientId: patient1._id,
      heartRate: 85, spo2: 97, temperature: 98.6, stepCount: 6500,
      systolicBP: 120, diastolicBP: 80, fallDetected: false,
      aiScore: 10, aiStatus: 'Normal',
      aiReasons: ['All vitals within normal range'],
      aiRecommendation: 'All vitals normal. Continue regular monitoring.'
    }).save();

    // Medications for Mr. Ravi
    await new Medication({
      patientId: patientRavi._id, doctorId: doctor._id,
      name: 'Metoprolol Succinate', dosage: '50mg', frequency: 'Once daily in morning',
      instructions: 'Take with food. Monitors cardiac rhythm.', isActive: true
    }).save();

    await new Medication({
      patientId: patientRavi._id, doctorId: doctor._id,
      name: 'Ecosprin (Aspirin)', dosage: '75mg', frequency: 'Once daily after lunch',
      instructions: 'Antiplatelet therapy.', isActive: true
    }).save();

    await new Medication({
      patientId: patientRavi._id, doctorId: doctor._id,
      name: 'Atorvastatin', dosage: '20mg', frequency: 'Once at bedtime',
      instructions: 'Take before sleep.', isActive: true
    }).save();

    // Diet plan for Mr. Ravi
    await new DietPlan({
      patientId: patientRavi._id, doctorId: doctor._id,
      plan: `Breakfast: Oatmeal with chopped walnuts + low-fat milk\nMid-morning: Tender coconut water or 1 apple\nLunch: 2 Phulka + Dal + Boiled vegetables + Curd\nEvening: Green tea with roasted makhana\nDinner: Mixed vegetable soup + 1 Multigrain chapati\n\nGuidelines:\n- Low Sodium (<1.5g/day)\n- Hydration target: 2.5 Liters/day\n- Avoid high-fat dairy and fried snacks`,
      calories: 1600,
      notes: 'Geriatric Cardiac Diet — Sodium Restricted.'
    }).save();

    // Sample Lab Reports for Mr. Ravi
    await new Report({
      patientId: patientRavi._id, doctorId: doctor._id,
      uploadedBy: 'lab', uploaderId: doctor._id,
      reportType: 'ecg', labName: 'Sunrise Pathology & Imaging',
      testDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      patientNote: 'Routine 12-lead ECG review',
      status: 'Flagged',
      doctorComment: 'Sinus tachycardia with rare PACs observed. Continue beta-blockers.',
      severity: 'High',
      reviewedAt: new Date(),
      fileName: 'ravi_ecg_report.pdf'
    }).save();

    console.log('✅ MediLink AI 8-Portal Ecosystem dataset pre-loaded!');
    console.log('');
    console.log('  1. 👤 Patient (Elderly): ravi@demo.com     / demo123 (Mr. Ravi)');
    console.log('  2. 👤 Patient (Standard): patient@demo.com  / demo123 (Rajan Kumar)');
    console.log('  3. 👨‍⚕️ Doctor:             doctor@demo.com   / demo123 (Dr. Priya Sharma)');
    console.log('  4. 🏥 Hospital / Admin:  admin@demo.com    / demo123 (Super Admin)');
    console.log('  5. 🧪 Lab Staff:         lab@demo.com      / demo123 (John Doe)');
    console.log('  6. 💊 Pharmacist:        pharmacy@demo.com / demo123 (Anita Patel)');
    console.log('  7. 🛡️ Insurance Officer: insurance@demo.com/ demo123 (Rakesh Mehta)');
    console.log('  8. 🚑 Emergency Response: emergency@demo.com/ demo123 (Vikram Singh)');
    console.log('');

  } catch (err) {
    console.error('Seed error:', err.message);
  }
};

module.exports = { seed };
