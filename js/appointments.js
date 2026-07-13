/* ==========================================================================
   MedSchedule — appointments.js
   Renders the appointment list (desktop table + mobile card list) and
   owns the delete-confirmation flow. Editing/booking lives in modal.js.
   ========================================================================== */

const tableBodyEl = document.getElementById('appointmentsTableBody');
const cardListEl = document.getElementById('appointmentsCardList');
const emptyStateEl = document.getElementById('emptyState');
const appointmentsTableEl = document.getElementById('appointmentsTable');

/**
 * Read — render the given appointments into both the table and the
 * mobile card list, keeping them in sync, and toggle the empty state.
 * @param {Array<Object>} appointments already filtered/searched
 */
function renderAppointmentsList(appointments) {
  const sorted = [...appointments].sort((a, b) => {
    const dateComparison = a.appointmentDate.localeCompare(b.appointmentDate);
    return dateComparison !== 0 ? dateComparison : a.appointmentTime.localeCompare(b.appointmentTime);
  });

  tableBodyEl.innerHTML = '';
  cardListEl.innerHTML = '';

  if (sorted.length === 0) {
    emptyStateEl.hidden = false;
    appointmentsTableEl.hidden = true;
    cardListEl.hidden = true;
    return;
  }

  emptyStateEl.hidden = true;
  appointmentsTableEl.hidden = false;
  cardListEl.hidden = false;

  const tableFragment = document.createDocumentFragment();
  const cardFragment = document.createDocumentFragment();

  sorted.forEach((appointment) => {
    tableFragment.appendChild(buildTableRow(appointment));
    cardFragment.appendChild(buildCard(appointment));
  });

  tableBodyEl.appendChild(tableFragment);
  cardListEl.appendChild(cardFragment);
}

function buildTableRow(appointment) {
  const row = document.createElement('tr');
  if (isDateInPast(appointment.appointmentDate)) row.classList.add('is-past');

  row.innerHTML = `
    <td data-label="Patient">${escapeHtml(appointment.patientName)}</td>
    <td data-label="Doctor">${escapeHtml(appointment.doctorName)}</td>
    <td data-label="Hospital">${escapeHtml(appointment.hospitalName)}</td>
    <td data-label="Specialty">
      <span class="specialty-pill" style="--chip-color:${getSpecialtyColor(appointment.specialty)}">
        ${escapeHtml(appointment.specialty)}
      </span>
    </td>
    <td data-label="Date">${formatDateDisplay(appointment.appointmentDate)}</td>
    <td data-label="Time">${formatTimeDisplay(appointment.appointmentTime)}</td>
    <td data-label="Reason" class="col-reason" title="${escapeHtml(appointment.reason)}">${escapeHtml(appointment.reason)}</td>
    <td data-label="Actions" class="col-actions"></td>
  `;
  row.querySelector('.col-actions').appendChild(buildActionButtons(appointment.id));
  return row;
}

function buildCard(appointment) {
  const card = document.createElement('li');
  card.className = 'appointment-card';
  card.innerHTML = `
    <div class="appointment-card-top">
      <span class="specialty-pill" style="--chip-color:${getSpecialtyColor(appointment.specialty)}">
        ${escapeHtml(appointment.specialty)}
      </span>
      <span class="appointment-card-datetime">
        ${formatDateDisplay(appointment.appointmentDate)} · ${formatTimeDisplay(appointment.appointmentTime)}
      </span>
    </div>
    <p class="appointment-card-patient">${escapeHtml(appointment.patientName)}</p>
    <p class="appointment-card-meta">${escapeHtml(appointment.doctorName)} — ${escapeHtml(appointment.hospitalName)}</p>
    <p class="appointment-card-reason">${escapeHtml(appointment.reason)}</p>
    <div class="appointment-card-actions"></div>
  `;
  card.querySelector('.appointment-card-actions').appendChild(buildActionButtons(appointment.id));
  return card;
}

function buildActionButtons(id) {
  const wrap = document.createElement('div');
  wrap.className = 'row-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'icon-btn';
  editBtn.setAttribute('aria-label', 'Edit appointment');
  editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  editBtn.addEventListener('click', () => openEditAppointment(id));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'icon-btn icon-btn-danger';
  deleteBtn.setAttribute('aria-label', 'Delete appointment');
  deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
  deleteBtn.addEventListener('click', () => requestDeleteAppointment(id));

  wrap.appendChild(editBtn);
  wrap.appendChild(deleteBtn);
  return wrap;
}

function isDateInPast(dateKey) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day) < today;
}

/* ==========================================================================
   Delete — confirmation dialog + actual removal
   ========================================================================== */

const confirmOverlay = document.getElementById('confirmOverlay');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

let pendingDeleteId = null;
function requestDeleteAppointment(id) {

    if (typeof closeAppointmentModal === "function") {
        closeAppointmentModal();
    }

    if (typeof closeDayDetail === "function") {
        closeDayDetail();
    }

    pendingDeleteId = id;

    confirmOverlay.hidden = false;

    confirmDeleteBtn.focus();
}

function closeConfirmDialog() {
  confirmOverlay.hidden = true;
  pendingDeleteId = null;
}

cancelDeleteBtn.addEventListener('click', closeConfirmDialog);
confirmOverlay.addEventListener('click', (event) => {
  if (event.target === confirmOverlay) closeConfirmDialog();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !confirmOverlay.hidden) closeConfirmDialog();
});

confirmDeleteBtn.addEventListener('click', () => {
  if (!pendingDeleteId) return;
  const wasDeleted = deleteAppointmentById(pendingDeleteId);
  closeConfirmDialog();

  if (wasDeleted) {
    showToast('Appointment deleted.', 'success');
    refreshApp();
  } else {
    showToast('Could not delete that appointment.', 'error');
  }
});