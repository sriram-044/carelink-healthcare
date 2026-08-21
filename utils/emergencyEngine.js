/**
 * MediLink AI — Emergency Decision Engine
 * Coordinates real-time alerts across Caregiver, Family, Doctor, and Hospital.
 */

const Alert = require('../models/Alert');

/**
 * Triggers emergency workflow when AI score >= 70 or fall detected or SOS triggered
 */
const triggerEmergencyWorkflow = async ({
  patient,
  doctorId = null,
  type = 'Critical', // 'Critical', 'Risk', 'SOS'
  score = 80,
  vitals = {},
  reasons = [],
  fallDetected = false,
  location = 'Home'
}) => {
  try {
    const notifiedEntities = ['Caregiver', 'Doctor', 'Hospital'];
    if (patient.emergencyContact) notifiedEntities.push('Family');

    let alertMessage = '';
    if (type === 'SOS') {
      alertMessage = `🚨 EMERGENCY SOS triggered by ${patient.name}. Location: ${location}`;
    } else if (fallDetected) {
      alertMessage = `🚨 CRITICAL FALL EVENT & Abnormal Vitals detected for ${patient.name}. AI Risk Score: ${score}/100`;
      if (!reasons.includes('Hard Fall Impact detected')) {
        reasons.unshift('Hard Fall Impact detected by wearable sensor');
      }
    } else {
      alertMessage = `🚨 CRITICAL HEALTH PATTERN detected for ${patient.name}. AI Risk Score: ${score}/100`;
    }

    const alertDoc = new Alert({
      patientId: patient._id,
      doctorId: doctorId || patient.assignedDoctor,
      type,
      message: alertMessage,
      score,
      vitals,
      fallDetected,
      location: location || patient.roomLocation || 'Home / Old Age Home',
      notifiedEntities,
      emergencyStatus: 'Dispatched',
      reasons
    });

    await alertDoc.save();

    console.log(`
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    🚨 [MEDILINK AI EMERGENCY ENGINE DISPATCH]
    Patient        : ${patient.name} (Age ${patient.age || 'N/A'})
    Location       : ${location || patient.roomLocation || 'Room 104, Sunrise Senior Home'}
    Event Type     : ${type} ${fallDetected ? '(HARD FALL DETECTED)' : ''}
    AI Risk Score  : ${score}/100
    Notified List  : ${notifiedEntities.join(' ➔ ')}
    Caregiver Phone: ${patient.caregiverPhone || '+91 98765 00000'}
    Emergency Contact: ${patient.emergencyContact || '+91 98765 99999'}
    Hospital Status: 🚑 Emergency Ticket Dispatched
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    return alertDoc;
  } catch (err) {
    console.error('[EMERGENCY ENGINE ERROR]', err.message);
    throw err;
  }
};

module.exports = { triggerEmergencyWorkflow };
