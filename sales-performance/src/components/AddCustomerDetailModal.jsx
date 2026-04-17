import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function AddCustomerModal({
  onClose,
  employees = [],
  customers = [],
}) {
  const tlName = localStorage.getItem("employeeName") || "";
  const tlId = localStorage.getItem("uid") || "";

  const MAX_TOTAL_PER_EMPLOYEE = 150;

  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    employeeId: "",
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  /* ================= ESC CLOSE ================= */
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* ================= HELPERS ================= */
  const getAssignedCount = (empId) =>
    customers.filter(
      (c) => c.assignedEmployeeId === empId && c.status !== "TRASH",
    ).length;

  const employeeOptions = useMemo(() => {
    return employees.map((e) => {
      const count = getAssignedCount(e.id);
      return {
        ...e,
        count,
        disabled: count >= MAX_TOTAL_PER_EMPLOYEE,
      };
    });
  }, [employees, customers]);

  /* ================= HANDLERS ================= */
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!/^\d{10}$/.test(form.mobile))
      e.mobile = "Valid 10 digit mobile required";
    if (form.email && !/\S+@\S+\.\S+/.test(form.email))
      e.email = "Invalid email";
    if (!form.employeeId) e.employeeId = "Select employee";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;

    const assignedCount = getAssignedCount(form.employeeId);
    if (assignedCount + 1 > MAX_TOTAL_PER_EMPLOYEE) {
      alert("❌ Employee ke paas already 150 customers hain");
      return;
    }

    try {
      setSaving(true);

      const emp = employees.find((e) => e.id === form.employeeId);

      await addDoc(collection(db, "existingCustomers"), {
        name: form.name,
        email: form.email || "",
        mobile: form.mobile,

        assignedEmployeeId: emp.id,
        assignedEmployeeName: emp.name,

        assignedByTLId: tlId,
        assignedByTLName: tlName,

        status: "NEW",
        city: "",
        state: "",
        country: "India",
        address: "",
        purchases: [],
        totalAmount: null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onClose();
    } catch (e) {
      console.error(e);
      alert("Assign failed");
    } finally {
      setSaving(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Assign Customer</h2>
          <button onClick={onClose} className="border rounded px-3 py-1">
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-4">
          <Input label="Assign By (TL)" value={tlName} disabled />

          <Input
            label="Customer Name *"
            name="name"
            value={form.name}
            onChange={onChange}
            error={errors.name}
          />

          <Input
            label="Email"
            name="email"
            value={form.email}
            onChange={onChange}
            error={errors.email}
          />

          <Input
            label="Mobile *"
            name="mobile"
            value={form.mobile}
            onChange={onChange}
            error={errors.mobile}
          />

          <Select
            label="Assign To Employee *"
            name="employeeId"
            value={form.employeeId}
            onChange={onChange}
            error={errors.employeeId}
          >
            <option value="">Select Employee</option>
            {employeeOptions.map((e) => (
              <option key={e.id} value={e.id} disabled={e.disabled}>
                {e.name} ({e.count}/150)
              </option>
            ))}
          </Select>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2 border-t px-6 py-4 bg-slate-50">
          <button onClick={onClose} className="border px-4 py-2 rounded">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="bg-purple-600 text-white px-5 py-2 rounded font-semibold"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= SMALL INPUTS ================= */

function Input({ label, error, ...props }) {
  return (
    <div>
      <label className="text-xs font-semibold">{label}</label>
      <input
        {...props}
        className={`mt-1 w-full rounded border px-3 py-2 ${
          error ? "border-red-500" : ""
        }`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Select({ label, error, children, ...props }) {
  return (
    <div>
      <label className="text-xs font-semibold">{label}</label>
      <select
        {...props}
        className={`mt-1 w-full rounded border px-3 py-2 ${
          error ? "border-red-500" : ""
        }`}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
