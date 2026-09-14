/**
 * MediLink AI — Modular Emergency Notification Service
 * Dispatches multi-channel alerts (In-App, SMS preview, System Dispatch)
 * with strict privacy controls and timeline auditing.
 */

const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationService {
  /**
   * Dispatches privacy-safe notification to an emergency family/caregiver contact
   */
  async sendEmergencyContactNotification(emergencyCase, contact) {
    try {
      const locationText = emergencyCase.location?.isAvailable
        ? (emergencyCase.location.address || `Lat: ${emergencyCase.location.latitude?.toFixed(4)}, Lng: ${emergencyCase.location.longitude?.toFixed(4)}`)
        : 'Location unavailable at trigger time';

      const previewMessage = `🚨 MEDILINK AI EMERGENCY ALERT: ${emergencyCase.patientName} has activated an SOS emergency alert. Time: ${new Date(emergencyCase.triggeredAt).toLocaleTimeString()}. Emergency ID: ${emergencyCase.emergencyId}. Location: ${locationText}. Open MediLink AI for authorized details.`;

      // In prototype mode, we log simulated SMS / Push dispatch safely
      console.log(`[SMS/PUSH DISPATCH] ➔ ${contact.name} (${contact.phone}): ${previewMessage}`);

      return {
        recipientType: 'Emergency Contact',
        recipientName: contact.name,
        recipientContact: contact.phone,
        channel: 'SMS_PREVIEW',
        status: 'DELIVERED',
        sentAt: new Date()
      };
    } catch (err) {
      console.error(`[NOTIFICATION ERROR - Contact ${contact.name}]`, err.message);
      return {
        recipientType: 'Emergency Contact',
        recipientName: contact.name,
        recipientContact: contact.phone,
        channel: 'SMS_PREVIEW',
        status: 'FAILED',
        sentAt: new Date()
      };
    }
  }

  /**
   * Dispatches urgent in-app notification to assigned doctor
   */
  async sendDoctorNotification(emergencyCase, doctorId) {
    try {
      if (!doctorId) return null;

      const docNotification = new Notification({
        recipientId: doctorId,
        role: 'doctor',
        type: 'emergency_sos',
        title: `🚨 EMERGENCY ALERT: Patient ${emergencyCase.patientName}`,
        message: `Emergency SOS (${emergencyCase.emergencyType}) active for ${emergencyCase.patientName}. Emergency ID: ${emergencyCase.emergencyId}. Priority: ${emergencyCase.priority}.`,
        link: `/doctor.html#alerts`,
        emergencyCaseId: emergencyCase._id,
        severity: 'Critical'
      });
      await docNotification.save();

      console.log(`[DOCTOR NOTIFICATION DISPATCHED] ➔ Doctor ID: ${doctorId} for Case: ${emergencyCase.emergencyId}`);

      return {
        recipientType: 'Doctor',
        recipientName: 'Assigned Doctor',
        recipientContact: doctorId.toString(),
        channel: 'IN_APP',
        status: 'DELIVERED',
        sentAt: new Date()
      };
    } catch (err) {
      console.error('[NOTIFICATION ERROR - Doctor]', err.message);
      return {
        recipientType: 'Doctor',
        recipientName: 'Assigned Doctor',
        recipientContact: doctorId?.toString() || 'Unknown',
        channel: 'IN_APP',
        status: 'FAILED',
        sentAt: new Date()
      };
    }
  }

  /**
   * Dispatches emergency alert to Hospital ER Officers and Admins
   */
  async sendHospitalNotification(emergencyCase) {
    try {
      const hospitalUsers = await User.find({
        role: { $in: ['emergency', 'admin', 'hospital'] },
        isActive: true
      });

      const notifications = hospitalUsers.map(user => ({
        recipientId: user._id,
        role: user.role,
        type: 'emergency_sos',
        title: `🏥 HOSPITAL EMERGENCY ALERT: ${emergencyCase.emergencyId}`,
        message: `New SOS Case: ${emergencyCase.patientName} — ${emergencyCase.emergencyType}. Status: ${emergencyCase.status}.`,
        link: `/emergency.html`,
        emergencyCaseId: emergencyCase._id,
        severity: 'Critical'
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

      console.log(`[HOSPITAL NOTIFICATION DISPATCHED] ➔ ${notifications.length} ER officers/admins notified.`);

      return {
        recipientType: 'Hospital',
        recipientName: emergencyCase.assignedHospital,
        recipientContact: 'Central Trauma Desk',
        channel: 'SYSTEM_DISPATCH',
        status: 'DELIVERED',
        sentAt: new Date()
      };
    } catch (err) {
      console.error('[NOTIFICATION ERROR - Hospital]', err.message);
      return {
        recipientType: 'Hospital',
        recipientName: emergencyCase.assignedHospital,
        recipientContact: 'Central Trauma Desk',
        channel: 'SYSTEM_DISPATCH',
        status: 'FAILED',
        sentAt: new Date()
      };
    }
  }

  /**
   * Dispatches dispatch alert to assigned emergency response team
   */
  async sendEmergencyTeamNotification(emergencyCase, team) {
    try {
      const erUsers = await User.find({ role: 'emergency', isActive: true });
      const notifications = erUsers.map(user => ({
        recipientId: user._id,
        role: 'emergency',
        type: 'emergency_assigned',
        title: `🚑 TEAM ASSIGNED: ${team.teamName || 'Rapid Response'} ➔ ${emergencyCase.emergencyId}`,
        message: `Team ${team.teamName} (${team.vehicleType || 'Ambulance'}) assigned to ${emergencyCase.patientName}. Lead: ${team.leadResponder || 'Responder'}.`,
        link: `/emergency.html`,
        emergencyCaseId: emergencyCase._id,
        severity: 'Critical'
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

      return {
        recipientType: 'Emergency Team',
        recipientName: team.teamName,
        recipientContact: team.contactPhone || 'Radio Unit',
        channel: 'SYSTEM_DISPATCH',
        status: 'DELIVERED',
        sentAt: new Date()
      };
    } catch (err) {
      console.error('[NOTIFICATION ERROR - Emergency Team]', err.message);
      return null;
    }
  }

  /**
   * Orchestrates complete multi-party broadcast when SOS is activated
   */
  async broadcastEmergencyAlert(emergencyCase) {
    const alertsSent = [];

    // 1. Notify emergency contacts
    if (emergencyCase.emergencyContacts && emergencyCase.emergencyContacts.length > 0) {
      for (const contact of emergencyCase.emergencyContacts) {
        const res = await this.sendEmergencyContactNotification(emergencyCase, contact);
        if (res) {
          alertsSent.push(res);
          contact.notified = true;
          contact.notifiedAt = new Date();
        }
      }

      emergencyCase.timeline.push({
        event: 'CONTACT_NOTIFIED',
        message: `Emergency contacts notified: ${emergencyCase.emergencyContacts.map(c => c.name).join(', ')}`,
        timestamp: new Date(),
        performedByName: 'Notification Engine',
        performedByRole: 'system'
      });
    }

    // 2. Notify assigned doctor
    if (emergencyCase.assignedDoctor) {
      const docRes = await this.sendDoctorNotification(emergencyCase, emergencyCase.assignedDoctor);
      if (docRes) {
        alertsSent.push(docRes);
        emergencyCase.timeline.push({
          event: 'DOCTOR_NOTIFIED',
          message: `Assigned doctor notified for emergency case ${emergencyCase.emergencyId}`,
          timestamp: new Date(),
          performedByName: 'Notification Engine',
          performedByRole: 'system'
        });
      }
    }

    // 3. Notify Hospital & ER Team
    const hospRes = await this.sendHospitalNotification(emergencyCase);
    if (hospRes) {
      alertsSent.push(hospRes);
      emergencyCase.timeline.push({
        event: 'HOSPITAL_NOTIFIED',
        message: `Hospital Emergency Command Center notified for case ${emergencyCase.emergencyId}`,
        timestamp: new Date(),
        performedByName: 'Notification Engine',
        performedByRole: 'system'
      });
    }

    emergencyCase.alertsSent = alertsSent;
    return emergencyCase;
  }

  /**
   * Broadcasts cancellation to doctor and hospital command center
   */
  async broadcastCancellationNotification(emergencyCase, performerUser = null) {
    try {
      const usersToNotify = await User.find({
        role: { $in: ['emergency', 'admin', 'doctor', 'hospital'] },
        isActive: true
      });

      const notifications = usersToNotify.map(user => ({
        recipientId: user._id,
        role: user.role,
        type: 'emergency_cancel',
        title: `ℹ️ EMERGENCY CANCELLED: ${emergencyCase.emergencyId}`,
        message: `Emergency case ${emergencyCase.emergencyId} for ${emergencyCase.patientName} was cancelled by patient (${emergencyCase.cancellationReason || 'False alert confirmation'}).`,
        link: `/emergency.html`,
        emergencyCaseId: emergencyCase._id,
        severity: 'Normal'
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } catch (err) {
      console.error('[NOTIFICATION ERROR - Cancellation]', err.message);
    }
  }
}

module.exports = new NotificationService();
