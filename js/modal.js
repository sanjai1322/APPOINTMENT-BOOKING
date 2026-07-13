/* ==========================================================================
   MedSchedule — modal.js
   Owns the Book/Edit Appointment modal: opening in create vs. edit mode,
   client-side validation, and the Create/Update write path.
   ========================================================================== */

const modalOverlay = document.getElementById('modalOverlay');
const modalTitleEl = document.getElementById('modalTitle');
const appointmentForm = document.getElementById('appointmentForm');
const openModalBtn = document.getElementById('openModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const emptyStateBookBtn = document.getElementById('emptyStateBookBtn');
const formGeneralError = document.getElementById('formGeneralError');
const appointmentIdField = document.getElementById('appointmentId');
const saveAppointmentBtn = document.getElementById('saveAppointmentBtn');

const FORM_FIELD_IDS = [
  'patientName', 'doctorName', 'hospitalName',
  'specialty', 'appointmentDate', 'appointmentTime', 'reason'
];

/**
 * Open the modal in "create" mode. If a date was clicked on the calendar,
 * pre-fill it so the user doesn't have to re-enter it.
 * @param {string} [prefillDate] 'YYYY-MM-DD'
 */
function openCreateModal(prefillDate) {

  if (typeof closeDayDetail === "function") {
    closeDayDetail();
  }

  if (typeof closeConfirmDialog === "function") {
    closeConfirmDialog();
  }

  appointmentForm.reset();
  appointmentIdField.value = "";
  clearFormErrors();

  modalTitleEl.textContent = "Book Appointment";
  saveAppointmentBtn.textContent = "Save Appointment";

  if (prefillDate) {
    document.getElementById("appointmentDate").value = prefillDate;
  }

  modalOverlay.hidden = false;
  document.getElementById("patientName").focus();
}


    

/**
 * Open the modal pre-filled with an existing appointment's data ("edit" mode).
 * @param {string} id
 */
function openEditAppointment(id) {

  if (typeof closeDayDetail === "function") {
    closeDayDetail();
  }

  if (typeof closeConfirmDialog === "function") {
    closeConfirmDialog();
  }

  const appointment = findAppointmentById(id);

  if (!appointment) {
    showToast("Appointment not found", "error");
    return;
  }

  appointmentForm.reset();
  clearFormErrors();

  appointmentIdField.value = appointment.id;

  document.getElementById("patientName").value = appointment.patientName;
  document.getElementById("doctorName").value = appointment.doctorName;
  document.getElementById("hospitalName").value = appointment.hospitalName;
  document.getElementById("specialty").value = appointment.specialty;
  document.getElementById("appointmentDate").value = appointment.appointmentDate;
  document.getElementById("appointmentTime").value = appointment.appointmentTime;
  document.getElementById("reason").value = appointment.reason;

  modalTitleEl.textContent = "Edit Appointment";
  saveAppointmentBtn.textContent = "Update Appointment";

  modalOverlay.hidden = false;
}

function closeAppointmentModal() {
  
  modalOverlay.hidden = true;
  appointmentForm.reset();
  clearFormErrors();
}

/* ---- validation ---- */

function clearFormErrors() {
  FORM_FIELD_IDS.forEach((id) => {
    const errorEl = document.getElementById('err-' + id);
    const inputEl = document.getElementById(id);
    if (errorEl) errorEl.textContent = '';
    if (inputEl) inputEl.classList.remove('is-invalid');
  });
  formGeneralError.hidden = true;
  formGeneralError.textContent = '';
}

function setFieldError(id, message) {
  const errorEl = document.getElementById('err-' + id);
  const inputEl = document.getElementById(id);
  if (errorEl) errorEl.textContent = message;
  if (inputEl) inputEl.classList.add('is-invalid');
}

/**
 * Validate the raw form values. Checks required fields and rejects
 * malformed/invalid dates.
 * @param {Object} data
 * @returns {boolean} true if the form is valid
 */
function validateAppointmentForm(data) {
  let isValid = true;

  if (!data.patientName.trim()) { setFieldError('patientName', 'Patient name is required.'); isValid = false; }
  if (!data.doctorName.trim()) { setFieldError('doctorName', 'Doctor name is required.'); isValid = false; }
  if (!data.hospitalName.trim()) { setFieldError('hospitalName', 'Hospital name is required.'); isValid = false; }
  if (!data.specialty) { setFieldError('specialty', 'Please select a specialty.'); isValid = false; }

  if (!data.appointmentDate) {
    setFieldError('appointmentDate', 'Date is required.');
    isValid = false;
  } else if (isNaN(new Date(data.appointmentDate + 'T00:00:00').getTime())) {
    setFieldError('appointmentDate', 'Enter a valid date.');
    isValid = false;
  }

  if (!data.appointmentTime) {
    setFieldError('appointmentTime', 'Time is required.');
    isValid = false;
  }

  if (!data.reason.trim()) { setFieldError('reason', 'Reason is required.'); isValid = false; }

  return isValid;
}

/* ---- submit (create or update) ---- */

function handleAppointmentSubmit(event) {
  event.preventDefault();
  clearFormErrors();

  const data = {
    patientName: document.getElementById('patientName').value,
    doctorName: document.getElementById('doctorName').value,
    hospitalName: document.getElementById('hospitalName').value,
    specialty: document.getElementById('specialty').value,
    appointmentDate: document.getElementById('appointmentDate').value,
    appointmentTime: document.getElementById('appointmentTime').value,
    reason: document.getElementById('reason').value
  };

  if (!validateAppointmentForm(data)) return;

  const editingId = appointmentIdField.value || null;

  // Bonus rule: the same doctor cannot be double-booked at one date+time.
  const clash = findOverlappingAppointment(data.doctorName, data.appointmentDate, data.appointmentTime, editingId);
  if (clash) {
    formGeneralError.hidden = false;
    formGeneralError.textContent =
      `${data.doctorName} already has an appointment with ${clash.patientName} at ` +
      `${formatTimeDisplay(data.appointmentTime)} on ${formatDateDisplay(data.appointmentDate)}. Please choose a different time.`;
    return;
  }

  if (editingId) {
    updateAppointmentById(editingId, data);
    showToast('Appointment updated.', 'success');
  } else {
    createAppointment(data);
    showToast('Appointment booked.', 'success');
  }

  closeAppointmentModal();
  refreshApp();
}

/* ---- wiring ---- */

openModalBtn.addEventListener('click', () => openCreateModal());
emptyStateBookBtn.addEventListener('click', () => openCreateModal());
closeModalBtn.addEventListener('click', closeAppointmentModal);
cancelModalBtn.addEventListener('click', closeAppointmentModal);
modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) closeAppointmentModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modalOverlay.hidden) closeAppointmentModal();
});
appointmentForm.addEventListener('submit', handleAppointmentSubmit);

// Clear a field's error the moment the user starts fixing it.
FORM_FIELD_IDS.forEach((id) => {
  const inputEl = document.getElementById(id);
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    const errorEl = document.getElementById('err-' + id);
    if (errorEl) errorEl.textContent = '';
    inputEl.classList.remove('is-invalid');
  });
});