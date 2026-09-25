// emergency.js — MediLink AI Emergency Command Portal Controller

let currentSection = 'active';
let allEmergencyCases = [];
let allEmergencyTeams = [];
let activeIncidentStream = [];
let viewingCaseId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth('emergency', 'admin', 'hospital', 'doctor');
  if (!user) return;
  initSidebar();

  // Live Clock
  setInterval(() => {
    const clock = document.getElementById('currentDateTime');
    if (clock) {
      clock.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }, 1000);

  loadDashboardStats();
  loadActiveEmergencies();
  loadTeams();

  // Auto-refresh active stream every 8 seconds
  setInterval(() => {
    if (currentSection === 'active') {
      loadDashboardStats();
      loadActiveEmergencies(true);
    }
  }, 8000);
});

function showSection(section, navEl) {
  currentSection = section;
  document.querySelectorAll('section[id^="section-"]').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(`section-${section}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  const titles = {
    active: ['🚨 Active Emergencies & Dispatch', 'Real-time emergency incident feed & response coordination'],
    cases: ['📋 Emergency Cases Master Registry', 'Filter and inspect all system emergency case records'],
    locations: ['🗺️ Emergency Locations & Telemetry', 'GPS coordinate mapping & response distance calculation'],
    teams: ['👥 Emergency Response Teams', 'Rapid response vehicles, paramedics, and on-duty readiness'],
    history: ['📊 Emergency Resolution History', 'Archived incident timeline audits and resolution records'],
    notifications: ['🔔 Dispatch Notifications', 'Real-time emergency broadcast logs and notifications'],
    settings: ['⚙️ Emergency Settings', 'Configure escalation thresholds and dispatch parameters']
  };

  if (titles[section]) {
    document.getElementById('pageTitle').textContent = titles[section][0];
    document.getElementById('pageSubtitle').textContent = titles[section][1];
  }

  refreshCurrentSection();
}

function refreshCurrentSection() {
  loadDashboardStats();
  if (currentSection === 'active') loadActiveEmergencies();
  if (currentSection === 'cases') loadAllCases();
  if (currentSection === 'locations') loadLocationsView();
  if (currentSection === 'teams') loadTeams();
  if (currentSection === 'history') loadEmergencyHistory();
  if (currentSection === 'notifications') loadNotifications();
}

/**
 * Loads real-time aggregated metrics computed from MongoDB
 */
async function loadDashboardStats() {
  const res = await apiRequest('/emergency/dashboard-stats');
  if (!res || !res.ok) return;

  const data = res.data;
  document.getElementById('statActiveCount').textContent = data.activeEmergencies || 0;
  document.getElementById('statPendingCount').textContent = data.pendingResponse || 0;
  document.getElementById('statAssignedCount').textContent = data.teamsAssigned || 0;
  document.getElementById('statResolvedCount').textContent = data.resolvedToday || 0;

  const badge = document.getElementById('activeBadge');
  if (badge) {
    if (data.activeEmergencies > 0) {
      badge.style.display = 'inline-block';
      badge.textContent = data.activeEmergencies;
    } else {
      badge.style.display = 'none';
    }
  }
}

/**
 * Loads real-time active emergencies queue
 */
async function loadActiveEmergencies(silent = false) {
  const container = document.getElementById('activeIncidentsList');
  if (!silent && container) {
    container.innerHTML = '<div class="loading-spinner"></div>';
  }

  const res = await apiRequest('/emergency/active');
  if (!res || !res.ok || !res.data || !res.data.length) {
    if (container) {
      container.innerHTML = `
        <div class="empty-state" style="padding:32px 0;">
          <div class="empty-icon">✅</div>
          <div class="empty-text">No active emergency incidents detected. All clear.</div>
        </div>
      `;
    }
    return;
  }

  activeIncidentStream = res.data;

  if (container) {
    container.innerHTML = activeIncidentStream.map(emg => renderActiveEmergencyCard(emg)).join('');
  }
}

function renderActiveEmergencyCard(emg) {
  const isLocationShared = emg.location?.isAvailable;
  const locationText = isLocationShared
    ? (emg.location.address || `GPS: ${emg.location.latitude?.toFixed(4)}, ${emg.location.longitude?.toFixed(4)}`)
    : 'Location unavailable at trigger time';

  const mapsUrl = isLocationShared && emg.location.latitude && emg.location.longitude
    ? `https://maps.google.com/?q=${emg.location.latitude},${emg.location.longitude}`
    : null;

  const statusClass = `badge-status-${emg.status.toLowerCase().replace(/_/g, '-')}`;

  return `
    <div class="card" style="background:rgba(255,71,87,0.06); border:1.5px solid rgba(255,71,87,0.4);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:14px;">
        <div style="flex:1; min-width:280px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px; flex-wrap:wrap;">
            <span style="font-size:22px;">🚨</span>
            <span style="font-size:16px; font-weight:800; color:#ff4d4d">${emg.patientName}</span>
            <span class="priority-indicator-critical">${emg.priority}</span>
            <span class="${statusClass}">${emg.status}</span>
            <span class="badge" style="background:rgba(255,255,255,0.08); font-size:11px;">${emg.emergencyId}</span>
          </div>

          <div style="font-size:13px; color:var(--text-primary); font-weight:600; margin-bottom:4px;">
            📍 Location: <span style="color:var(--primary)">${locationText}</span>
            ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="font-size:11px; color:var(--primary); margin-left:6px; text-decoration:underline;">[View Map ➔]</a>` : ''}
          </div>

          <div style="font-size:13px; color:var(--text-secondary); margin-bottom:6px;">
            ${emg.timeline?.[0]?.message || 'Emergency SOS triggered'}
          </div>

          <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:12px; color:var(--text-muted);">
            <div>🩸 Blood: <strong style="color:#ff6b6b;">${emg.patientId?.bloodGroup || '—'}</strong></div>
            <div>👨‍👩‍👧 Family: <strong>${emg.emergencyContacts?.[0]?.phone || emg.patientId?.emergencyContact || '—'}</strong></div>
            <div>🩺 Doctor: <strong>${emg.assignedDoctor?.name || 'On-Call'}</strong></div>
            <div>🚑 Assigned Team: <strong>${emg.assignedEmergencyTeam?.teamName || 'None assigned yet'}</strong></div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
          <button class="btn btn-primary btn-sm" onclick="openErCaseModal('${emg._id}')" style="font-weight:700;">
            🔍 View Incident &amp; Timeline
          </button>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${emg.status === 'ACTIVE' ? `
              <button class="btn btn-warning btn-sm" onclick="quickAcknowledgeCase('${emg._id}')">👁️ Acknowledge</button>
            ` : ''}
            ${emg.status === 'ACTIVE' || emg.status === 'ACKNOWLEDGED' ? `
              <button class="btn btn-secondary btn-sm" onclick="openAssignTeamModal('${emg._id}')">🚑 Assign Team</button>
            ` : ''}
            ${emg.status === 'TEAM_ASSIGNED' ? `
              <button class="btn btn-sm" style="background:#e17055; color:#fff;" onclick="quickUpdateStatus('${emg._id}', 'EN_ROUTE')">🚑 En Route</button>
            ` : ''}
            ${emg.status === 'EN_ROUTE' ? `
              <button class="btn btn-sm" style="background:#74b9ff; color:#080c14;" onclick="quickUpdateStatus('${emg._id}', 'ARRIVED')">📍 Arrived</button>
            ` : ''}
            ${emg.status === 'ARRIVED' ? `
              <button class="btn btn-sm" style="background:#81ecec; color:#080c14;" onclick="quickUpdateStatus('${emg._id}', 'UNDER_CARE')">🩺 Under Care</button>
            ` : ''}
            ${emg.status === 'UNDER_CARE' ? `
              <button class="btn btn-sm" style="background:#00d4aa; color:#080c14;" onclick="quickUpdateStatus('${emg._id}', 'RESOLVED')">✅ Resolve</button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Loads all emergency cases for Master Registry table
 */
async function loadAllCases() {
  const container = document.getElementById('allCasesList');
  if (container) container.innerHTML = '<div class="loading-spinner"></div>';

  const res = await apiRequest('/emergency/cases');
  if (!res || !res.ok || !res.data) {
    if (container) container.innerHTML = '<div class="empty-state"><div class="empty-text">Failed to load cases</div></div>';
    return;
  }

  allEmergencyCases = res.data;
  renderFilteredCases(allEmergencyCases);
}

function filterCases() {
  const search = document.getElementById('caseSearchInput')?.value.toLowerCase() || '';
  const status = document.getElementById('caseStatusFilter')?.value || '';
  const priority = document.getElementById('casePriorityFilter')?.value || '';

  const filtered = allEmergencyCases.filter(c => {
    const matchSearch = !search || c.emergencyId.toLowerCase().includes(search) || c.patientName.toLowerCase().includes(search);
    const matchStatus = !status || c.status === status;
    const matchPriority = !priority || c.priority === priority;
    return matchSearch && matchStatus && matchPriority;
  });

  renderFilteredCases(filtered);
}

function renderFilteredCases(cases) {
  const container = document.getElementById('allCasesList');
  if (!container) return;

  if (!cases.length) {
    container.innerHTML = '<div class="empty-state" style="padding:24px 0;"><div class="empty-text">No cases matching criteria.</div></div>';
    return;
  }

  container.innerHTML = cases.map(c => `
    <div class="card" style="padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <strong style="font-size:15px; color:var(--text-primary);">${c.emergencyId}</strong>
          <span style="font-weight:700; color:var(--text-primary);">${c.patientName}</span>
          <span class="badge-status-${c.status.toLowerCase().replace(/_/g, '-')}">${c.status}</span>
          <span class="priority-indicator-${c.priority.toLowerCase().replace(/ /g, '-')}">${c.priority}</span>
        </div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
          Type: ${c.emergencyType} • Triggered: ${formatDateTime(c.triggeredAt)} • 📍 ${c.location?.address || (c.location?.isAvailable ? 'GPS Shared' : 'Unavailable')}
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-ghost btn-sm" onclick="openErCaseModal('${c._id}')">🔍 View Details</button>
      </div>
    </div>
  `).join('');
}

/**
 * Loads Locations View (GPS coordinates & mapping)
 */
async function loadLocationsView() {
  const container = document.getElementById('locationsFeedContainer');
  if (container) container.innerHTML = '<div class="loading-spinner"></div>';

  const res = await apiRequest('/emergency/active');
  if (!res || !res.ok || !res.data || !res.data.length) {
    if (container) container.innerHTML = '<div class="empty-state" style="padding:24px 0;"><div class="empty-text">No active emergency locations to track.</div></div>';
    return;
  }

  container.innerHTML = res.data.map(emg => {
    const isShared = emg.location?.isAvailable;
    const lat = emg.location?.latitude;
    const lng = emg.location?.longitude;
    const mapsUrl = isShared && lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null;

    return `
      <div class="location-coord-box">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:15px; color:#ff4d4d;">🚨 ${emg.patientName}</strong>
            <span class="badge" style="background:rgba(255,255,255,0.06);">${emg.emergencyId}</span>
            <span class="badge-status-${emg.status.toLowerCase().replace(/_/g, '-')}">${emg.status}</span>
          </div>
          <div style="font-size:13px; color:var(--text-primary); margin-top:6px;">
            📍 <strong>${emg.location?.address || (isShared ? `GPS: ${lat?.toFixed(5)}, ${lng?.toFixed(5)}` : 'Location unavailable')}</strong>
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
            Accuracy: ±${emg.location?.accuracy || 10} meters • Fix Timestamp: ${formatDateTime(emg.location?.timestamp || emg.triggeredAt)}
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-direction:column; align-items:flex-end;">
          ${mapsUrl ? `
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
              🗺️ Open in Google Maps
            </a>
          ` : '<span class="badge badge-pending">No GPS Signal</span>'}
          <button class="btn btn-ghost btn-sm" onclick="openErCaseModal('${emg._id}')">Inspect Incident</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Loads Response Teams Roster
 */
async function loadTeams() {
  const container = document.getElementById('teamsGridContainer');
  const res = await apiRequest('/emergency/teams');
  if (!res || !res.ok || !res.data) return;

  allEmergencyTeams = res.data;

  if (container) {
    container.innerHTML = allEmergencyTeams.map(t => `
      <div class="card" style="border-left: 4px solid var(--secondary);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div>
            <strong style="font-size:16px; color:var(--text-primary);">${t.teamName}</strong>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">ID: ${t.teamId} • Base: ${t.baseLocation}</div>
          </div>
          <span class="badge" style="background:rgba(0,212,170,0.15); color:var(--primary); font-weight:700;">🟢 ${t.status}</span>
        </div>
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">
          🚑 <strong>Vehicle:</strong> ${t.vehicleType}<br/>
          🧑‍⚕️ <strong>Lead:</strong> ${t.leadResponder}<br/>
          📞 <strong>Radio / Phone:</strong> ${t.contactPhone}
        </div>
      </div>
    `).join('');
  }
}

/**
 * Loads Emergency Resolution History
 */
async function loadEmergencyHistory() {
  const container = document.getElementById('historyIncidentsList');
  if (container) container.innerHTML = '<div class="loading-spinner"></div>';

  const res = await apiRequest('/emergency/history');
  if (!res || !res.ok || !res.data || !res.data.length) {
    if (container) container.innerHTML = '<div class="empty-state" style="padding:24px 0;"><div class="empty-text">No archived incidents recorded.</div></div>';
    return;
  }

  container.innerHTML = res.data.map(h => `
    <div class="card" style="padding:14px 18px; border-left: 3px solid ${h.status === 'CANCELLED' ? 'var(--text-muted)' : 'var(--status-normal)'};">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:15px; color:var(--text-primary);">${h.emergencyId}</strong>
            <span style="font-weight:700;">${h.patientName}</span>
            <span class="badge-status-${h.status.toLowerCase().replace(/_/g, '-')}">${h.status}</span>
            <span class="badge" style="background:rgba(255,255,255,0.06);">${h.emergencyType}</span>
          </div>
          <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
            Triggered: ${formatDateTime(h.triggeredAt)} • Resolved: ${formatDateTime(h.resolvedAt)}
          </div>
          ${h.cancellationReason ? `<div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Cancellation Note: ${h.cancellationReason}</div>` : ''}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="openErCaseModal('${h._id}')">View Full Audit Log</button>
      </div>
    </div>
  `).join('');
}

/**
 * Loads Notifications
 */
async function loadNotifications() {
  const container = document.getElementById('erNotificationsList');
  if (container) container.innerHTML = '<div class="loading-spinner"></div>';

  const res = await apiRequest('/lab/notifications');
  if (!res || !res.ok || !res.data || !res.data.length) {
    if (container) container.innerHTML = '<div class="empty-state"><div class="empty-text">No active dispatch notifications</div></div>';
    return;
  }

  container.innerHTML = res.data.map(n => `
    <div class="notif-card ${n.severity ? n.severity.toLowerCase() : 'critical'}">
      <div style="font-size:20px;">🚨</div>
      <div style="flex:1;">
        <div style="font-size:14px; font-weight:700; color:var(--text-primary);">${n.title}</div>
        <div style="font-size:13px; color:var(--text-secondary); margin-top:2px;">${n.message}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${formatDateTime(n.createdAt)}</div>
      </div>
    </div>
  `).join('');
}

/**
 * Opens Detailed Emergency Case Modal
 */
async function openErCaseModal(caseId) {
  viewingCaseId = caseId;
  const modal = document.getElementById('erCaseDetailModal');
  const body = document.getElementById('erModalCaseBody');
  const footer = document.getElementById('erModalActionFooter');

  if (!modal || !body) return;
  modal.classList.remove('hidden');
  body.innerHTML = '<div class="loading-spinner"></div>';

  const res = await apiRequest(`/emergency/cases/${caseId}`);
  if (!res || !res.ok || !res.data) {
    body.innerHTML = '<div class="empty-state"><div class="empty-text">Failed to load case details</div></div>';
    return;
  }

  const emg = res.data;
  document.getElementById('erModalCaseTitle').textContent = `🚨 Case ${emg.emergencyId} — ${emg.patientName}`;
  document.getElementById('erModalCaseSub').textContent = `Type: ${emg.emergencyType} • Priority: ${emg.priority} • Triggered: ${formatDateTime(emg.triggeredAt)}`;

  const isLocationShared = emg.location?.isAvailable;
  const locationText = isLocationShared
    ? (emg.location.address || `GPS: ${emg.location.latitude?.toFixed(5)}, ${emg.location.longitude?.toFixed(5)}`)
    : 'Location coordinates unavailable at trigger time';

  const mapsUrl = isLocationShared && emg.location.latitude && emg.location.longitude
    ? `https://maps.google.com/?q=${emg.location.latitude},${emg.location.longitude}`
    : null;

  body.innerHTML = `
    <!-- Key Clinical & Location Grid -->
    <div class="grid-2" style="gap:14px; margin-bottom:16px;">
      <div class="card" style="background:rgba(255,71,87,0.06); padding:12px 14px;">
        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Patient Demographics</div>
        <div style="font-size:15px; font-weight:700; color:var(--text-primary); margin-top:2px;">
          ${emg.patientName} (${emg.patientId?.age || '—'} yrs / ${emg.patientId?.gender || '—'})
        </div>
        <div style="font-size:13px; color:var(--text-secondary); margin-top:2px;">
          🩸 Blood: <strong style="color:#ff4d4d;">${emg.patientId?.bloodGroup || '—'}</strong> • 📞 ${emg.patientId?.phone || '—'}
        </div>
      </div>

      <div class="card" style="background:rgba(0,212,170,0.06); padding:12px 14px;">
        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Location Telemetry</div>
        <div style="font-size:14px; font-weight:700; color:var(--primary); margin-top:2px;">
          📍 ${locationText}
        </div>
        ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="font-size:12px; color:var(--primary); text-decoration:underline; display:inline-block; margin-top:4px;">🗺️ Open in Google Maps ➔</a>` : ''}
      </div>
    </div>

    <!-- Assigned Team & Doctor -->
    <div class="grid-2" style="gap:14px; margin-bottom:16px;">
      <div style="background:rgba(255,255,255,0.03); padding:12px 14px; border-radius:var(--radius-sm); border:1px solid var(--border);">
        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Response Unit Assigned</div>
        <div style="font-size:14px; font-weight:700; color:var(--text-primary); margin-top:2px;">
          ${emg.assignedEmergencyTeam?.teamName ? `🚑 ${emg.assignedEmergencyTeam.teamName}` : '<span style="color:var(--warning);">⏳ No Team Assigned</span>'}
        </div>
        ${emg.assignedEmergencyTeam?.leadResponder ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Lead: ${emg.assignedEmergencyTeam.leadResponder} • Radio: ${emg.assignedEmergencyTeam.contactPhone}</div>` : ''}
      </div>

      <div style="background:rgba(255,255,255,0.03); padding:12px 14px; border-radius:var(--radius-sm); border:1px solid var(--border);">
        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Attending Doctor</div>
        <div style="font-size:14px; font-weight:700; color:var(--text-primary); margin-top:2px;">
          🩺 ${emg.assignedDoctor?.name || 'Central Trauma On-Call Physician'}
        </div>
        ${emg.assignedDoctor?.specialization ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">${emg.assignedDoctor.specialization} • ${emg.assignedDoctor.phone || ''}</div>` : ''}
      </div>
    </div>

    <!-- Emergency Contacts & Clinical Notes -->
    <div class="card mb-16" style="background:rgba(255,255,255,0.02);">
      <div style="font-size:12px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">👨‍👩‍👧 Emergency Family Contacts:</div>
      <div style="font-size:13px; color:var(--text-secondary); margin-bottom:10px;">
        ${emg.emergencyContacts?.map(c => `<div>• <strong>${c.name}</strong> (${c.relationship}): ${c.phone} ${c.notified ? '<span style="color:#00d4aa;">(Notified ✓)</span>' : ''}</div>`).join('') || 'None on file'}
      </div>

      <div style="font-size:12px; font-weight:700; color:#ff6b6b; margin-bottom:4px;">⚠️ High-Caution Allergies:</div>
      <div style="font-size:13px; color:var(--text-primary); margin-bottom:10px;">
        ${emg.patientId?.allergiesDetail?.map(a => `<span class="badge" style="background:rgba(255,71,87,0.15); color:#ff6b6b; margin-right:4px;">${a.name} (${a.severity})</span>`).join('') || 'None reported'}
      </div>

      <div style="font-size:12px; font-weight:700; color:var(--secondary); margin-bottom:4px;">🩺 Active Diagnoses &amp; Conditions:</div>
      <div style="font-size:13px; color:var(--text-secondary);">
        ${emg.patientId?.medicalConditionsDetail?.map(c => `<span class="badge" style="background:rgba(108,99,255,0.15); color:#a29bfe; margin-right:4px;">${c.condition}</span>`).join('') || 'None listed'}
      </div>
    </div>

    <!-- Complete Event Timeline -->
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div style="font-size:13px; font-weight:700; color:var(--text-primary);">⏱️ Audit Event Timeline:</div>
        <button class="btn btn-ghost btn-sm" onclick="openAddCaseNoteModal('${emg._id}')">+ Add Incident Note</button>
      </div>
      <div class="emergency-timeline">
        ${emg.timeline?.map(t => `
          <div class="timeline-event-item">
            <div class="timeline-event-dot ${t.event.includes('CANCEL') ? 'warning' : t.event.includes('RESOLVED') ? 'success' : 'danger'}">
              ${t.event.includes('CANCEL') ? '✕' : t.event.includes('RESOLVED') ? '✓' : '🚨'}
            </div>
            <div class="timeline-event-title">${t.event.replace(/_/g, ' ')}</div>
            <div class="timeline-event-msg">${t.message}</div>
            <div class="timeline-event-meta">${formatDateTime(t.timestamp)} • by ${t.performedByName || 'System'} (${t.performedByRole || 'system'})</div>
          </div>
        `).join('') || '<div style="font-size:12px; color:var(--text-muted);">No timeline events recorded.</div>'}
      </div>
    </div>
  `;

  // Render Action Footer
  if (footer) {
    footer.innerHTML = `
      <div style="display:flex; gap:8px; flex-wrap:wrap; flex:1;">
        ${emg.status === 'ACTIVE' ? `
          <button class="btn btn-warning btn-sm" onclick="quickAcknowledgeCase('${emg._id}')">👁️ Acknowledge</button>
        ` : ''}
        ${['ACTIVE', 'ACKNOWLEDGED'].includes(emg.status) ? `
          <button class="btn btn-secondary btn-sm" onclick="openAssignTeamModal('${emg._id}')">🚑 Assign Response Unit</button>
        ` : ''}
        ${emg.status === 'TEAM_ASSIGNED' ? `
          <button class="btn btn-sm" style="background:#e17055; color:#fff;" onclick="quickUpdateStatus('${emg._id}', 'EN_ROUTE')">🚑 Unit En Route</button>
        ` : ''}
        ${emg.status === 'EN_ROUTE' ? `
          <button class="btn btn-sm" style="background:#74b9ff; color:#080c14;" onclick="quickUpdateStatus('${emg._id}', 'ARRIVED')">📍 Unit Arrived at Scene</button>
        ` : ''}
        ${emg.status === 'ARRIVED' ? `
          <button class="btn btn-sm" style="background:#81ecec; color:#080c14;" onclick="quickUpdateStatus('${emg._id}', 'UNDER_CARE')">🩺 Patient Under Care</button>
        ` : ''}
        ${emg.status === 'UNDER_CARE' ? `
          <button class="btn btn-sm" style="background:#00d4aa; color:#080c14;" onclick="quickUpdateStatus('${emg._id}', 'RESOLVED')">✅ Mark Resolved</button>
        ` : ''}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="closeErCaseModal()">Close</button>
    `;
  }
}

function closeErCaseModal() {
  const modal = document.getElementById('erCaseDetailModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Quick status updater
 */
async function quickUpdateStatus(caseId, newStatus) {
  const res = await apiRequest(`/emergency/cases/${caseId}/status`, {
    method: 'PUT',
    body: { status: newStatus }
  });

  if (res && res.ok) {
    showToast(`Case status updated to ${newStatus} 🚑`, 'success');
    if (viewingCaseId === caseId) openErCaseModal(caseId);
    refreshCurrentSection();
  } else {
    showToast(res?.message || 'Failed to update status', 'error');
  }
}

async function quickAcknowledgeCase(caseId) {
  const res = await apiRequest(`/emergency/cases/${caseId}/acknowledge`, { method: 'POST' });
  if (res && res.ok) {
    showToast('Emergency case acknowledged! Response team alert dispatched.', 'success');
    if (viewingCaseId === caseId) openErCaseModal(caseId);
    refreshCurrentSection();
  } else {
    showToast(res?.message || 'Failed to acknowledge case', 'error');
  }
}

/**
 * Assign Team Modal Handlers
 */
function openAssignTeamModal(caseId) {
  document.getElementById('assignCaseId').value = caseId;
  const modal = document.getElementById('assignTeamModal');
  if (modal) modal.classList.remove('hidden');
}

function closeAssignTeamModal() {
  const modal = document.getElementById('assignTeamModal');
  if (modal) modal.classList.add('hidden');
}

function onTeamSelectChange(val) {
  const team = allEmergencyTeams.find(t => t.teamId === val);
  if (team) {
    document.getElementById('teamLead').value = team.leadResponder;
    document.getElementById('teamContact').value = team.contactPhone;
    document.getElementById('teamVehicle').value = team.vehicleType;
  }
}

async function handleAssignTeamSubmit(e) {
  e.preventDefault();
  const caseId = document.getElementById('assignCaseId').value;
  const teamId = document.getElementById('teamSelect').value;
  const leadResponder = document.getElementById('teamLead').value;
  const contactPhone = document.getElementById('teamContact').value;
  const vehicleType = document.getElementById('teamVehicle').value;

  const res = await apiRequest(`/emergency/cases/${caseId}/assign-team`, {
    method: 'POST',
    body: { teamId, leadResponder, contactPhone, vehicleType }
  });

  if (res && res.ok) {
    showToast('Emergency response unit dispatched! 🚑', 'success');
    closeAssignTeamModal();
    if (viewingCaseId === caseId) openErCaseModal(caseId);
    refreshCurrentSection();
  } else {
    showToast(res?.message || 'Failed to assign team', 'error');
  }
}

/**
 * Add Case Note Modal Handlers
 */
function openAddCaseNoteModal(caseId) {
  document.getElementById('noteCaseId').value = caseId;
  document.getElementById('noteText').value = '';
  const modal = document.getElementById('addCaseNoteModal');
  if (modal) modal.classList.remove('hidden');
}

function closeCaseNoteModal() {
  const modal = document.getElementById('addCaseNoteModal');
  if (modal) modal.classList.add('hidden');
}

async function handleAddCaseNoteSubmit(e) {
  e.preventDefault();
  const caseId = document.getElementById('noteCaseId').value;
  const text = document.getElementById('noteText').value;

  const res = await apiRequest(`/emergency/cases/${caseId}/notes`, {
    method: 'POST',
    body: { text }
  });

  if (res && res.ok) {
    showToast('Incident note appended to timeline', 'success');
    closeCaseNoteModal();
    if (viewingCaseId === caseId) openErCaseModal(caseId);
  } else {
    showToast(res?.message || 'Failed to add note', 'error');
  }
}
