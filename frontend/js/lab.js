// lab.js — Lab Portal Logic

// Resolve file URL — old records have relative paths, new ones have absolute URLs
function getFileUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url; // already absolute
  return `${BACKEND_URL}${url}`;          // prepend Render backend for relative paths
}

let archiveData = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('lab')) return;
  initSidebar();

  setInterval(() => {
    document.getElementById('currentDateTime').textContent =
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);

  loadPatientAndDoctorDropdowns();
  loadArchive();

  // File preview
  document.getElementById('labFile').addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
      document.getElementById('filePreview').style.display = 'block';
      document.getElementById('filePreviewText').textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    }
  });
});

function showSection(section, navEl) {
  document.querySelectorAll('section[id^="section-"]').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${section}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  const titles = {
    upload: ['Upload Report', 'Upload and assign lab reports to patients'],
    archive: ['Report Archive', 'All reports uploaded by the lab']
  };
  document.getElementById('pageTitle').textContent = titles[section]?.[0] || section;
  document.getElementById('pageSubtitle').textContent = titles[section]?.[1] || '';

  if (section === 'archive') loadArchive();
}

async function loadPatientAndDoctorDropdowns() {
  // Lab doesn't have /admin/users access, use reports endpoint context
  // Use a common endpoint — admin registers patients/doctors
  // Lab can see patients via a shared endpoint — adapt as needed
  // For now, we'll attempt fetching from the admin endpoint
  const [pRes, dRes] = await Promise.all([
    apiRequest('/admin/users?role=patient'),
    apiRequest('/admin/users?role=doctor')
  ]);

  if (pRes?.ok) {
    const opts = pRes.data.map(p => `<option value="${p._id}">${p.name}</option>`).join('');
    document.getElementById('labPatient').innerHTML = '<option value="">-- Select patient --</option>' + opts;
    document.getElementById('arPatient1') && (document.getElementById('arPatient1').innerHTML = opts);
  }

  if (dRes?.ok) {
    document.getElementById('labDoctor').innerHTML =
      '<option value="">-- Auto assign (patient\'s doctor) --</option>' +
      dRes.data.map(d => `<option value="${d._id}">${d.name} (${d.specialization || 'General'})</option>`).join('');
  }
}

async function uploadReport(e) {
  e.preventDefault();
  const btn = document.getElementById('uploadBtn');
  const progress = document.getElementById('uploadProgress');
  const bar = document.getElementById('uploadBar');

  btn.disabled = true;
  btn.textContent = 'Uploading...';
  progress.style.display = 'block';

  // Simulate progress
  let p = 0;
  const interval = setInterval(() => {
    p = Math.min(90, p + 10);
    bar.style.width = p + '%';
  }, 200);

  const formData = new FormData();
  formData.append('patientId', document.getElementById('labPatient').value);
  const doctorId = document.getElementById('labDoctor').value;
  if (doctorId) formData.append('doctorId', doctorId);
  formData.append('reportType', document.getElementById('labType').value);
  formData.append('labName', document.getElementById('labName').value);
  formData.append('testDate', document.getElementById('labDate').value);
  formData.append('patientNote', document.getElementById('labNote').value);
  const file = document.getElementById('labFile').files[0];
  if (file) formData.append('file', file);

  const res = await apiRequest('/reports/upload', { method: 'POST', body: formData });

  clearInterval(interval);
  bar.style.width = '100%';
  btn.disabled = false;
  btn.textContent = '📤 Upload Report';

  setTimeout(() => { progress.style.display = 'none'; bar.style.width = '0%'; }, 1000);

  if (res?.ok) {
    showToast('Report uploaded successfully! Doctor has been notified.', 'success');
    e.target.reset();
    document.getElementById('filePreview').style.display = 'none';
    loadArchive();
  } else {
    showToast(res?.data?.message || 'Upload failed', 'error');
  }
}

async function loadArchive() {
  // Get all reports uploaded by lab
  const res = await apiRequest('/reports');
  if (!res?.ok) return;

  archiveData = res.data;

  // Stats
  document.getElementById('statTotal').textContent = archiveData.length;
  document.getElementById('statPending').textContent = archiveData.filter(r => r.status === 'Pending').length;
  document.getElementById('statReviewed').textContent = archiveData.filter(r => r.status === 'Reviewed').length;

  renderArchive(archiveData);
}

function renderArchive(data) {
  const container = document.getElementById('archiveList');
  if (!data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><div class="empty-text">No reports uploaded yet</div></div>';
    return;
  }

  container.innerHTML = data.map(r => `
    <div class="card">
      <div style="display:flex;align-items:flex-start;gap:16px">
        <div class="report-type-icon">${getReportEmoji(r.reportType)}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
            <div style="font-size:15px;font-weight:700">${r.patientId?.name || 'Patient'}</div>
            ${getStatusBadge(r.status)}
          </div>
          <div style="font-size:13px;color:var(--text-muted)">
            ${getReportTypeLabel(r.reportType)} • ${r.labName || 'Lab'} • ${formatDate(r.testDate)}
          </div>
          ${r.doctorId ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">👨‍⚕️ Assigned to: ${r.doctorId?.name || '—'}</div>` : ''}
          ${r.doctorComment ? `<div style="font-size:12px;color:var(--primary);margin-top:4px">🩺 Doctor reviewed: "${r.doctorComment.substring(0,80)}..."</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div style="font-size:11px;color:var(--text-muted)">${timeAgo(r.createdAt)}</div>
          ${r.fileUrl ? `<a href="${getFileUrl(r.fileUrl)}" target="_blank" class="btn btn-ghost btn-sm">📥 View</a>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function filterArchive() {
  const q = document.getElementById('archiveSearch').value.toLowerCase();
  const filtered = archiveData.filter(r =>
    (r.patientId?.name || '').toLowerCase().includes(q) ||
    r.reportType.toLowerCase().includes(q) ||
    (r.labName || '').toLowerCase().includes(q)
  );
  renderArchive(filtered);
}

function getReportEmoji(type) {
  const map = { blood_test: '🩸', ecg: '💓', xray: '🦴', mri: '🧠', urine: '🧪', ct_scan: '🔬', other: '📄' };
  return map[type] || '📄';
}
