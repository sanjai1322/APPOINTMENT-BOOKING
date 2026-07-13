/* ==========================================================================
   MedSchedule Pro — storage.js
   Single responsibility: persist appointments to localStorage as JSON and
   expose CRUD primitives. No DOM access happens in this file.
   ========================================================================== */

const STORAGE_KEY = 'medschedule.appointments.v1';

/**
 * Read every appointment from localStorage.
 * @returns {Array<Object>} appointments, or [] if none exist / data is corrupt
 */
function loadAppointments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('MedSchedule: could not parse stored appointments — starting fresh.', err);
    return [];
  }
}

/**
 * Write the full appointments array back to localStorage.
 * @param {Array<Object>} appointments
 * @returns {boolean} whether the write succeeded
 */
function persistAppointments(appointments) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
    return true;
  } catch (err) {
    console.error('MedSchedule: could not save appointments to localStorage.', err);
    return false;
  }
}

/**
 * Generate a reasonably unique id without any external uuid library.
 */
function generateAppointmentId() {
  return 'apt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/* ==========================================================================
   CRUD
   ========================================================================== */

/**
 * Create — persist a brand new appointment.
 * @param {Object} appointmentData fields from the form (no id)
 * @returns {Object} the stored appointment, including its generated id
 */
function createAppointment(appointmentData) {
  const appointments = loadAppointments();
  const newAppointment = {
    id: generateAppointmentId(),
    createdAt: new Date().toISOString(),
    ...appointmentData
  };
  appointments.push(newAppointment);
  persistAppointments(appointments);
  return newAppointment;
}

/**
 * Read — find a single appointment by id.
 * @param {string} id
 * @returns {Object|null}
 */
function findAppointmentById(id) {
  return loadAppointments().find((appointment) => appointment.id === id) || null;
}

/**
 * Update — merge partial changes into an existing appointment.
 * @param {string} id
 * @param {Object} updates
 * @returns {Object|null} the updated appointment, or null if not found
 */
function updateAppointmentById(id, updates) {
  const appointments = loadAppointments();
  const index = appointments.findIndex((appointment) => appointment.id === id);
  if (index === -1) return null;

  appointments[index] = {
    ...appointments[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  persistAppointments(appointments);
  return appointments[index];
}

/**
 * Delete — remove an appointment permanently.
 * @param {string} id
 * @returns {boolean} true if something was actually removed
 */
function deleteAppointmentById(id) {
  const appointments = loadAppointments();
  const filtered = appointments.filter((appointment) => appointment.id !== id);
  const removed = filtered.length !== appointments.length;
  if (removed) persistAppointments(filtered);
  return removed;
}

/**
 * Business rule (bonus feature): a single doctor cannot have two
 * appointments booked at the exact same date + time.
 * @param {string} doctorName
 * @param {string} date   'YYYY-MM-DD'
 * @param {string} time   'HH:MM'
 * @param {string|null} excludeId appointment id to ignore (used while editing)
 * @returns {Object|null} the clashing appointment, or null if the slot is free
 */
function findOverlappingAppointment(doctorName, date, time, excludeId) {
  const normalizedDoctor = doctorName.trim().toLowerCase();
  return loadAppointments().find((appointment) =>
    appointment.id !== excludeId &&
    appointment.doctorName.trim().toLowerCase() === normalizedDoctor &&
    appointment.appointmentDate === date &&
    appointment.appointmentTime === time
  ) || null;
}