// Shared Procurement & Vendor Store with LocalStorage Persistence
export const INITIAL_INQUIRIES_DATA = [];

// Helper functions for shared LocalStorage persistence
const STORAGE_KEY = "sales_system_procurement_inquiries_v2";

export function loadInquiriesFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error loading inquiries from localStorage", e);
  }
  return INITIAL_INQUIRIES_DATA;
}

export function saveInquiriesToStorage(inquiries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inquiries));
  } catch (e) {
    console.error("Error saving inquiries to localStorage", e);
  }
}
