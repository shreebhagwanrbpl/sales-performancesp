import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase"; // ✅ adjust path

import jsPDF from "jspdf";
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import companyLogo from "../assets/logo.png";
/* ================= Helpers ================= */
const cn = (...a) => a.filter(Boolean).join(" ");

const toISO = (v) => {
  if (!v) return "";
  // Firestore Timestamp support
  if (typeof v?.toDate === "function")
    return v.toDate().toISOString().slice(0, 10);
  // Date string
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};

const money = (n) =>
  Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/* ================= Config (Change if needed) ================= */
const CTC_COLLECTION = "ctc"; // ✅ your AddCTC collection
const APPRAISAL_COLLECTION = "appraisals";

/* ================= Component ================= */
export default function Appraisal() {
  const [employees, setEmployees] = useState([]); // from CTC
  const [rows, setRows] = useState([]); // appraisals table
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const [form, setForm] = useState({
    employeeId: "",
    employeeName: "",
    department: "",
    designation: "",
    joiningDate: "",
    lastAppraisalDate: "",
    lastCTC: "",
    appraisalPeriod: "Apr 2025 – Mar 2026",
    incrementAmount: "",
  });

  const newCTC = useMemo(
    () => num(form.lastCTC) + num(form.incrementAmount),
    [form.lastCTC, form.incrementAmount],
  );

  /* ===== Fetch Employees from CTC (for dropdown) ===== */
  useEffect(() => {
    const q = query(
      collection(db, CTC_COLLECTION),
      orderBy("employeeName", "asc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEmployees(list);
    });
    return () => unsub();
  }, []);

  /* ===== Fetch Appraisals Table ===== */
  useEffect(() => {
    const q = query(
      collection(db, APPRAISAL_COLLECTION),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRows(list);
    });
    return () => unsub();
  }, []);

  /* ===== When employee selected => auto fill from CTC + last appraisal date ===== */
  const loadLastAppraisalDate = async (employeeId) => {
    if (!employeeId) return "";
    const q = query(
      collection(db, APPRAISAL_COLLECTION),
      where("employeeId", "==", employeeId),
      orderBy("createdAt", "desc"),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return "";
    const last = snap.docs[0].data();
    // prefer stored lastAppraisalDate OR createdAt
    return toISO(last?.effectiveDate || last?.createdAt || "");
  };

  const handleEmployeeChange = async (e) => {
    const employeeId = e.target.value;
    const emp =
      employees.find((x) => String(x.employeeId) === String(employeeId)) ||
      null;

    if (!emp) {
      setForm((p) => ({
        ...p,
        employeeId: "",
        employeeName: "",
        department: "",
        designation: "",
        joiningDate: "",
        lastAppraisalDate: "",
        lastCTC: "",
      }));
      return;
    }

    const lastAppDate = await loadLastAppraisalDate(employeeId);

    setForm((p) => ({
      ...p,
      employeeId: String(emp.employeeId ?? employeeId),
      employeeName: emp.employeeName ?? "",
      department: emp.department ?? "",
      designation: emp.designation ?? "",
      joiningDate: toISO(emp.joiningDate ?? ""),
      lastCTC: String(emp.ctc ?? ""),
      lastAppraisalDate: lastAppDate,
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      employeeId: "",
      employeeName: "",
      department: "",
      designation: "",
      joiningDate: "",
      lastAppraisalDate: "",
      lastCTC: "",
      appraisalPeriod: "Apr 2024 – Mar 2025",
      incrementAmount: "",
    });
  };

  const validate = () => {
    if (!form.employeeId) return "Please select Employee";
    if (!form.appraisalPeriod) return "Appraisal period required";
    if (!num(form.incrementAmount)) return "Increment amount required";
    return "";
  };

  /* ===== Save / Update ===== */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return alert(err);

    setSaving(true);
    try {
      const payload = {
        employeeId: String(form.employeeId),
        employeeName: form.employeeName,
        department: form.department,
        designation: form.designation,
        joiningDate: form.joiningDate || "",
        lastAppraisalDate: form.lastAppraisalDate || "",
        lastCTC: num(form.lastCTC),
        appraisalPeriod: form.appraisalPeriod,
        incrementAmount: num(form.incrementAmount),
        newCTC: num(form.lastCTC) + num(form.incrementAmount),
        effectiveDate: new Date().toISOString().slice(0, 10), // you can add field in UI if needed
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, APPRAISAL_COLLECTION, editingId), payload);
      } else {
        await addDoc(collection(db, APPRAISAL_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      const increment = num(form.incrementAmount);
      const last = num(form.lastCTC);
      const percent = last ? ((increment / last) * 100).toFixed(2) : 0;
      const total = last + increment;

      setToast({
        employeeName: form.employeeName,
        percent,
        increment,
        total,
      });
      setTimeout(() => setToast(null), 9000);
      resetForm();
    } catch (error) {
      console.error(error);
      alert("Save failed. Console check karo.");
    } finally {
      setSaving(false);
    }
  };

  /* ===== Edit Row ===== */
  const onEdit = (r) => {
    setEditingId(r.id);
    setForm({
      employeeId: String(r.employeeId || ""),
      employeeName: r.employeeName || "",
      department: r.department || "",
      designation: r.designation || "",
      joiningDate: toISO(r.joiningDate || ""),
      lastAppraisalDate: toISO(r.lastAppraisalDate || ""),
      lastCTC: String(r.lastCTC ?? ""),
      appraisalPeriod: r.appraisalPeriod || "",
      incrementAmount: String(r.incrementAmount ?? ""),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ===== Delete ===== */
  const onDelete = async () => {
    if (!confirmDel?.id) return;
    try {
      await deleteDoc(doc(db, APPRAISAL_COLLECTION, confirmDel.id));
      setConfirmDel(null);
    } catch (error) {
      console.error(error);
      alert("Delete failed. Console check karo.");
    }
  };

  const downloadIncrementLetter = (r) => {
    const doc = new jsPDF("p", "mm", "a4");

    const LEFT = 25;
    const RIGHT = 185;
    let y = 0;

    /* ================= HEADER ================= */
    doc.addImage(companyLogo, "PNG", LEFT, 12, 42, 22);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("RAJ BIOSIS PRIVATE LIMITED", RIGHT, 18, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      "Registered Office: Jaipur, Rajasthan | Email: hr@rajbiosis.com",
      RIGHT,
      24,
      { align: "right" },
    );

    doc.setLineWidth(0.4);
    doc.line(LEFT, 38, RIGHT, 38);

    /* ================= DATE ================= */
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, RIGHT, 48, {
      align: "right",
    });

    /* ================= EMPLOYEE DETAILS ================= */
    y = 60;
    doc.setFont("helvetica", "bold");
    doc.text("To,", LEFT, y);

    doc.setFont("helvetica", "normal");
    doc.text(r.employeeName, LEFT, (y += 6));
    doc.text(r.designation || "", LEFT, (y += 6));
    doc.text(r.department || "", LEFT, (y += 6));

    /* ================= SUBJECT ================= */
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Subject: Increment Letter", LEFT, y);

    /* ================= BODY ================= */
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const intro =
      `We are pleased to inform you that based on your performance and contribution during the appraisal period ` +
      `(${r.appraisalPeriod}), the management has approved a revision in your compensation structure.`;

    doc.text(doc.splitTextToSize(intro, 160), LEFT, y);

    /* ================= COMPENSATION TABLE ================= */
    y += 25;

    doc.setFont("helvetica", "bold");
    doc.text("Revised Compensation Details:", LEFT, y);

    y += 8;

    const labelX = LEFT;
    const valueX = RIGHT - 10;

    const drawRow = (label, value) => {
      doc.setFont("helvetica", "normal");
      doc.rect(LEFT, y, 160, 10);
      doc.text(label, labelX + 4, y + 7);
      doc.text(`₹ ${money(value)}`, valueX, y + 7, { align: "right" });
      y += 10;
    };

    drawRow("Previous CTC", r.lastCTC);
    drawRow("Increment Amount", r.incrementAmount);
    drawRow("Revised CTC", r.newCTC);

    /* ================= EFFECTIVE DATE ================= */
    y += 12;
    doc.text(
      `This increment will be effective from ${r.effectiveDate}.`,
      LEFT,
      y,
    );

    /* ================= CLOSING ================= */
    y += 12;
    const closing =
      `We appreciate your dedication and valuable contribution to the organisation. ` +
      `We look forward to your continued commitment and wish you success in your future endeavours with Raj Biosis Private Limited.`;

    doc.text(doc.splitTextToSize(closing, 160), LEFT, y);

    /* ================= SIGNATURE ================= */
    y = 235;
    doc.line(LEFT, y, LEFT + 70, y);

    doc.setFont("helvetica", "bold");
    doc.text("Authorised Signatory", LEFT, y + 6);

    doc.setFont("helvetica", "normal");
    doc.text("For Raj Biosis Private Limited", LEFT, y + 12);

    /* ================= FOOTER ================= */
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      "This is a system generated document and does not require a physical signature.",
      105,
      285,
      { align: "center" },
    );

    doc.save(`Increment_Letter_${r.employeeName.replace(/\s+/g, "_")}.pdf`);
  };

  /* ===== Filtered Rows ===== */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.employeeName,
        r.employeeId,
        r.department,
        r.designation,
        r.appraisalPeriod,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          {/* 🎊 Sparkles */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[...Array(18)].map((_, i) => (
              <span
                key={i}
                className="sparkle"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 1.5}s`,
                }}
              >
                ✨
              </span>
            ))}
          </div>

          {/* 🎉 Toast Card */}
          <div className="relative w-full max-w-md animate-toast-pop rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center text-white shadow-2xl">
            <p className="text-sm uppercase tracking-wider text-slate-300">
              🎊 Appraisal Saved
            </p>

            <h2 className="mt-2 text-2xl font-bold">{toast.employeeName}</h2>

            <p className="mt-3 text-lg">
              Got a{" "}
              <span className="font-extrabold text-emerald-400">
                {toast.percent}%
              </span>{" "}
              hike 🚀
            </p>

            <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm">
              <p>
                Increment:{" "}
                <span className="font-semibold">
                  ₹ {money(toast.increment)}
                </span>
              </p>
              <p className="mt-1">
                New CTC:{" "}
                <span className="text-lg font-bold text-white">
                  ₹ {money(toast.total)}
                </span>
              </p>
            </div>

            <p className="mt-4 text-xs text-slate-300">
              This message will close automatically
            </p>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
              Employee Appraisal
            </h1>
            <p className="text-sm text-slate-600">HR/Admin increment details</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <MagnifyingGlassIcon className="h-5 w-5 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee / dept / period..."
                className="w-56 bg-transparent text-sm outline-none"
              />
            </div>
            <button
              onClick={resetForm}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              type="button"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? "Edit Appraisal" : "Add New Appraisal"}
              </h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Employee dropdown */}
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Employee Name
                </label>
                <select
                  value={form.employeeId}
                  onChange={handleEmployeeChange}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">Select employee...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={String(e.employeeId)}>
                      {e.employeeName}
                      {/* ({e.employeeId}) */}
                    </option>
                  ))}
                </select>
              </div>

              <Field
                label="Department"
                value={form.department}
                onChange={(e) =>
                  setForm((p) => ({ ...p, department: e.target.value }))
                }
              />

              <Field
                label="Designation"
                value={form.designation}
                onChange={(e) =>
                  setForm((p) => ({ ...p, designation: e.target.value }))
                }
              />
              <Field
                label="Joining Date"
                type="date"
                value={form.joiningDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, joiningDate: e.target.value }))
                }
              />
              <Field
                label="Last Appraisal Date"
                type="date"
                value={form.lastAppraisalDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, lastAppraisalDate: e.target.value }))
                }
              />

              <Field
                label="Last CTC"
                value={form.lastCTC}
                onChange={(e) =>
                  setForm((p) => ({ ...p, lastCTC: e.target.value }))
                }
              />

              <p className="mt-1 text-xs text-slate-500">
                Formatted: ₹ {money(form.lastCTC)}
              </p>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-600">
                  Appraisal Period
                </label>
                <input
                  value={form.appraisalPeriod}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, appraisalPeriod: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Increment Amount
                </label>
                <input
                  value={form.incrementAmount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, incrementAmount: e.target.value }))
                  }
                  placeholder="e.g. 20000"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
                <p className="mt-1 text-xs text-slate-500">
                  New CTC:{" "}
                  <span className="font-semibold text-slate-800">
                    ₹ {money(newCTC)}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-slate-500">
                Employee details are auto-filled from the CTC records. Once the
                appraisal is saved, it will immediately appear in the table
                below
              </div>

              <div className="flex gap-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  disabled={saving}
                  type="submit"
                  className={cn(
                    "rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm",
                    saving ? "bg-slate-400" : "bg-slate-900 hover:bg-slate-800",
                  )}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Appraisal"
                      : "Save Appraisal"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              Appraisal Records
            </h3>
            <p className="text-sm text-slate-600">
              Download the increment letter, edit records, or delete entries
              from here.
            </p>
          </div>

          <div className="overflow-x-auto p-2">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">Dept</th>
                  <th className="px-4 py-2">Designation</th>
                  <th className="px-4 py-2">Period</th>
                  <th className="px-4 py-2">Last CTC</th>
                  <th className="px-4 py-2">Increment</th>
                  <th className="px-4 py-2">New CTC</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="rounded-xl bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {r.employeeName}
                      </div>
                      {/* <div className="text-xs text-slate-500">ID: {r.employeeId}</div> */}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {r.department || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {r.designation || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {r.appraisalPeriod || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      ₹ {money(r.lastCTC)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      ₹ {money(r.incrementAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      ₹ {money(r.newCTC)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => downloadIncrementLetter(r)}
                          className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                          title="Download Increment Letter"
                          type="button"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          Letter
                        </button>

                        <button
                          onClick={() => onEdit(r)}
                          className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                          title="Edit"
                          type="button"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                          Edit
                        </button>

                        <button
                          onClick={() => setConfirmDel(r)}
                          className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200 hover:bg-rose-50"
                          title="Delete"
                          type="button"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delete Confirm Modal (Tailwind) */}
        {confirmDel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <h4 className="text-base font-semibold text-slate-900">
                Delete appraisal?
              </h4>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{confirmDel.employeeName}</span>
                ’s appraisal record? This action cannot be undone.
              </p>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDel(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>
        {`
      
            @keyframes toastPop {
            0% {
                opacity: 0;
                transform: scale(0.8);
            }
            60% {
                opacity: 1;
                transform: scale(1.05);
            }
            100% {
                transform: scale(1);
            }
            }

            .animate-toast-pop {
            animation: toastPop 0.45s ease-out;
            }

            /* ✨ Sparkles */
            .sparkle {
            position: absolute;
            top: -10%;
            font-size: 1.25rem;
            animation: sparkleFall 2.5s linear infinite;
            opacity: 0.8;
            }

            @keyframes sparkleFall {
            0% {
                transform: translateY(0) rotate(0deg);
                opacity: 1;
            }
            100% {
                transform: translateY(120vh) rotate(360deg);
                opacity: 0;
            }
            }

  `}
      </style>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={onChange}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
      />
    </div>
  );
}
