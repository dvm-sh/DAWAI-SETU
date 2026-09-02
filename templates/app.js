/* DAWAI-SETU — Client Interactivity & Real-time State Management */

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✓' : (type === 'danger' ? '⚠' : 'ℹ');
  toast.innerHTML = `<span style="font-weight: 800">${icon}</span> <span>${message}</span>`;

  container.appendChild(toast);

  // Trigger reflow for animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Auto remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// MODAL MANAGEMENT
// ==========================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// Close modal on click outside dialog
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('show');
    document.body.style.overflow = '';
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => {
      m.classList.remove('show');
      document.body.style.overflow = '';
    });
  }
});

// ==========================================
// STATS & DASHBOARD DATA LOADER
// ==========================================
async function loadLiveStats() {
  const metricBox = document.getElementById('metricsGrid');
  if (!metricBox) return;

  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const data = await res.json();

    Object.keys(data).forEach(key => {
      const el = document.querySelector(`[data-stat="${key}"]`);
      if (el) {
        el.textContent = Number(data[key]).toLocaleString('en-IN');
      }
    });
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ==========================================
// INVENTORY BATCH INTAKE
// ==========================================
async function handleAddMedicine(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const res = await fetch('/api/medicines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (res.ok && result.ok) {
      closeModal('addBatchModal');
      form.reset();
      showToast(result.message || 'Medicine batch recorded successfully!', 'success');
      setTimeout(() => location.reload(), 750);
    } else {
      showToast(result.error || 'Failed to add batch.', 'danger');
    }
  } catch (err) {
    showToast('Network error while saving batch.', 'danger');
  }
}

// Quick action on medicine row (e.g. mark surplus, route disposal)
async function triggerMedicineAction(mid, action) {
  try {
    const res = await fetch(`/api/medicines/${mid}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast(data.message, 'success');
      setTimeout(() => location.reload(), 700);
    } else {
      showToast(data.error || 'Action failed', 'danger');
    }
  } catch (err) {
    showToast('Network error executing action', 'danger');
  }
}

// ==========================================
// SMART MATCHING & TRANSFERS
// ==========================================
function openTransferModal(orgName, defaultMedicine = 'Paracetamol 650mg', defaultBatch = 'PCM-24081', defaultQty = 200) {
  const modal = document.getElementById('transferInitiateModal');
  if (!modal) {
    // Direct transfer creation if modal is not present
    executeTransferCreation(orgName, defaultMedicine, defaultBatch, defaultQty);
    return;
  }

  document.getElementById('transferOrgInput').value = orgName;
  document.getElementById('transferMedicineInput').value = defaultMedicine;
  document.getElementById('transferBatchInput').value = defaultBatch;
  document.getElementById('transferQtyInput').value = defaultQty;
  openModal('transferInitiateModal');
}

async function handleTransferSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());

  await executeTransferCreation(data.recipient, data.medicine, data.batch, parseInt(data.quantity));
  closeModal('transferInitiateModal');
}

async function executeTransferCreation(recipient, medicine, batch, quantity) {
  try {
    const res = await fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medicine,
        batch,
        quantity,
        donor: 'CityCare Pharmacy',
        recipient
      })
    });
    const result = await res.json();

    if (res.ok && result.ok) {
      showToast(`Transfer offer dispatched to ${recipient}!`, 'success');
      setTimeout(() => location.href = 'transfers.html', 800);
    } else {
      showToast(result.error || 'Failed to initiate transfer.', 'danger');
    }
  } catch (err) {
    showToast('Network error initiating transfer.', 'danger');
  }
}

// Advance Transfer Lifecycle
async function advanceTransfer(tid, currentStatus) {
  const statusFlow = {
    'Pending': 'Accepted',
    'Accepted': 'Scheduled',
    'Scheduled': 'Collected',
    'Collected': 'In Transit',
    'In Transit': 'Verified',
    'Verified': 'Completed'
  };

  const nextStatus = statusFlow[currentStatus] || 'Completed';

  try {
    const res = await fetch(`/api/transfer/${tid}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      showToast(`Transfer #${tid} advanced to: ${nextStatus}`, 'success');
      setTimeout(() => location.reload(), 600);
    } else {
      showToast(data.error || 'Failed to update transfer.', 'danger');
    }
  } catch (err) {
    showToast('Error updating status.', 'danger');
  }
}

// Preview Consignment Manifest Modal
function previewManifest(tid, medicine, batch, quantity, donor, recipient, status, trackingCode) {
  document.getElementById('manifestTitle').textContent = `Consignment #${trackingCode || 'TRK-26296-01'}`;
  document.getElementById('manifestTrackingCode').textContent = trackingCode || `TRK-26296-${tid}`;

  const container = document.getElementById('manifestDetailsContent');
  if (container) {
    container.innerHTML = `
      <div class="manifest-details-row"><span>Medicine & Strength:</span><b>${medicine}</b></div>
      <div class="manifest-details-row"><span>Batch Number:</span><b>${batch}</b></div>
      <div class="manifest-details-row"><span>Consignment Units:</span><b>${quantity} units</b></div>
      <div class="manifest-details-row"><span>Origin Donor:</span><b>${donor}</b></div>
      <div class="manifest-details-row"><span>Destination Recipient:</span><b>${recipient}</b></div>
      <div class="manifest-details-row"><span>Pipeline Stage:</span><b><span class="pill ok">${status}</span></b></div>
      <div class="manifest-details-row"><span>Verification Protocol:</span><b>QR Cryptographic Seal</b></div>
    `;
  }

  openModal('manifestModal');
}

// ==========================================
// ECO-DISPOSAL MANIFEST
// ==========================================
async function handleDisposalSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch('/api/disposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();

    if (res.ok && result.ok) {
      closeModal('disposalModal');
      showToast(result.message || 'Disposal manifest generated!', 'success');
      setTimeout(() => location.reload(), 700);
    } else {
      showToast(result.error || 'Failed to create disposal request.', 'danger');
    }
  } catch (err) {
    showToast('Network error creating disposal request.', 'danger');
  }
}

// ==========================================
// GOVERNANCE & ORGANIZATION VERIFICATION
// ==========================================
async function toggleOrgVerification(oid, currentState) {
  const newState = currentState === 1 ? false : true;

  try {
    const res = await fetch(`/api/org/${oid}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: newState })
    });
    const result = await res.json();

    if (res.ok && result.ok) {
      showToast(result.message, 'success');
      setTimeout(() => location.reload(), 600);
    } else {
      showToast(result.error || 'Failed to update verification.', 'danger');
    }
  } catch (err) {
    showToast('Network error updating verification.', 'danger');
  }
}

// ==========================================
// EMERGENCY SOS BROADCAST
// ==========================================
async function handleEmergencySubmit(event) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch('/api/emergency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();

    if (res.ok && result.ok) {
      closeModal('emergencyModal');
      form.reset();
      showToast('🚨 Priority SOS Alert broadcasted across regional network!', 'danger');
      setTimeout(() => {
        if (location.pathname === '/admin') location.reload();
      }, 1000);
    } else {
      showToast(result.error || 'Failed to broadcast emergency alert.', 'danger');
    }
  } catch (err) {
    showToast('Network error broadcasting SOS alert.', 'danger');
  }
}

async function resolveEmergency(eid) {
  try {
    const res = await fetch(`/api/emergency/${eid}/resolve`, { method: 'POST' });
    if (res.ok) {
      showToast('Emergency SOS marked as resolved.', 'success');
      setTimeout(() => location.reload(), 600);
    }
  } catch (err) {
    showToast('Failed to resolve emergency.', 'danger');
  }
}

// ==========================================
// AI SURPLUS PREDICTION SIMULATOR
// ==========================================
async function updateAiSimulation() {
  const stockInput = document.getElementById('simStock');
  const dispenseInput = document.getElementById('simDispense');
  const surgeInput = document.getElementById('simSurge');

  if (!stockInput || !dispenseInput || !surgeInput) return;

  const stock = parseInt(stockInput.value) || 500;
  const dispense = parseFloat(dispenseInput.value) || 4.2;
  const surge = parseFloat(surgeInput.value) || 1.0;

  document.getElementById('valStock').textContent = stock;
  document.getElementById('valDispense').textContent = `${dispense} /day`;
  document.getElementById('valSurge').textContent = `${surge}x`;

  try {
    const res = await fetch('/api/ai/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stock,
        daily_dispense: dispense,
        days_to_expiry: 48,
        surge_factor: surge
      })
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      document.getElementById('predDemandVal').textContent = data.predicted_local_demand;
      document.getElementById('predSurplusVal').textContent = data.predicted_surplus;
      document.getElementById('predActionText').textContent = data.action_recommendation;

      const riskPill = document.getElementById('predRiskPill');
      if (riskPill) {
        riskPill.textContent = data.risk_tier.toUpperCase();
        riskPill.className = `pill ${data.predicted_surplus > 150 ? 'high' : (data.predicted_surplus > 0 ? 'warn' : 'ok')}`;
      }
    }
  } catch (err) {
    console.error('AI Simulation error:', err);
  }
}

// ==========================================
// AUDIT LOG FILTERING & SEARCH
// ==========================================
async function searchAuditLogs(query) {
  const listEl = document.getElementById('auditLogContainer');
  if (!listEl) return;

  try {
    const res = await fetch(`/api/audit?q=${encodeURIComponent(query)}`);
    const logs = await res.json();

    if (logs.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>No audit events match your search.</p></div>';
      return;
    }

    listEl.innerHTML = logs.map(l => `
      <div class="audit-entry">
        <div class="audit-icon">✓</div>
        <div class="audit-content">
          <b>${l.action}</b>
          <span>${l.entity} · Initiated by ${l.actor}</span>
          ${l.previous_status || l.new_status ? `<span class="pill ok" style="font-size:10px; margin-left:6px">${l.previous_status || 'New'} → ${l.new_status}</span>` : ''}
        </div>
        <div class="audit-time">${l.created}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to filter audit logs:', err);
  }
}

// ==========================================
// DOM READY INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Load Live Stats
  loadLiveStats();

  // 2. Mobile Menu Toggle
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      mainNav.classList.toggle('open');
    });
  }

  // 3. Inventory Table Search & Status Filter
  const invSearch = document.getElementById('inventorySearchInput');
  const catFilter = document.getElementById('categoryFilterSelect');
  const statusFilter = document.getElementById('statusFilterSelect');

  function filterInventory() {
    const query = (invSearch?.value || '').toLowerCase().trim();
    const cat = (catFilter?.value || '').toLowerCase();
    const status = (statusFilter?.value || '').toLowerCase();

    document.querySelectorAll('#inventoryTable tbody tr').forEach(row => {
      const text = row.textContent.toLowerCase();
      const rowCat = (row.dataset.category || '').toLowerCase();
      const rowStatus = (row.dataset.status || '').toLowerCase();

      const matchQuery = !query || text.includes(query);
      const matchCat = !cat || rowCat.includes(cat);
      const matchStatus = !status || rowStatus.includes(status);

      row.style.display = (matchQuery && matchCat && matchStatus) ? '' : 'none';
    });
  }

  invSearch?.addEventListener('input', filterInventory);
  catFilter?.addEventListener('change', filterInventory);
  statusFilter?.addEventListener('change', filterInventory);

  // 4. AI Simulator Range Listeners
  const simStock = document.getElementById('simStock');
  const simDispense = document.getElementById('simDispense');
  const simSurge = document.getElementById('simSurge');

  [simStock, simDispense, simSurge].forEach(el => {
    el?.addEventListener('input', updateAiSimulation);
  });

  // 5. Audit Log Search
  const auditSearch = document.getElementById('auditSearchInput');
  if (auditSearch) {
    let timeout = null;
    auditSearch.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => searchAuditLogs(e.target.value), 250);
    });
  }
});
