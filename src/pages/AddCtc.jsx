import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";

export default function AddCTC() {
  const [employees, setEmployees] = useState([]);
  const [ctcEntries, setCtcEntries] = useState([]);
  const [editingEmp, setEditingEmp] = useState(null);
  const [joiningDate, setJoiningDate] = useState("");
  const [editingCTC, setEditingCTC] = useState(null);
  const [editingCTCAmount, setEditingCTCAmount] = useState("");
  const [editingTarget, setEditingTarget] = useState(0);
  const [editingMonthlySalary, setEditingMonthlySalary] = useState(0);

  const [form, setForm] = useState({
    employeeId: "",
    employeeName: "",
    ctc: "",
    monthlySalary: 0,
    target: 0,
  });
  const getCTCByEmp = (empId) => {
    return ctcEntries.find((c) => c.employeeId === empId);
  };

  // CTC entries fetch karo
  useEffect(() => {
    const fetchCTC = async () => {
      const snap = await getDocs(collection(db, "ctc"));
      setCtcEntries(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })),
      );
    };

    fetchCTC();
  }, []);

  /* ================= FETCH EMPLOYEES ================= */
  useEffect(() => {
    const fetchEmployees = async () => {
      const snap = await getDocs(collection(db, "users"));
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetchEmployees();
  }, []);

  /* ================= HANDLE CHANGE ================= */
  const handleChange = (e) => {
    const { name, value } = e.target;

    let updated = { ...form, [name]: value };

    // 🔥 AUTO TARGET CALCULATION
    if (name === "ctc") {
      const ctc = Number(value || 0);
      updated.monthlySalary = Math.round(ctc / 12);
      updated.target = Math.round((ctc / 12) * 55);
    }

    setForm(updated);
  };

  const hasCTC = (empId) => {
    return ctcEntries.some((c) => c.employeeId === empId);
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasCTC(form.employeeId)) {
      alert("CTC already added ❌");
      return;
    }
    try {
      await addDoc(collection(db, "ctc"), {
        employeeId: form.employeeId,
        employeeName: form.employeeName,
        ctc: Number(form.ctc),
        monthlySalary: Number(form.monthlySalary || 0),
        target: form.target,
        createdAt: serverTimestamp(),
      });

      alert("CTC & Target Added Successfully ✅");

      setForm({
        employeeId: "",
        employeeName: "",
        ctc: "",
        monthlySalary: 0,
        target: 0,
      });

      const snap = await getDocs(collection(db, "ctc"));
      setCtcEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("CTC SAVE ERROR:", err);
      alert("Failed to add CTC ❌");
    }
  };

  // save joining date
  // const saveJoiningDate = async (ctcId) => {
  //   if (!joiningDate) {
  //     alert("Please select joining date ❌");
  //     return;
  //   }

  //   try {
  //     await updateDoc(doc(db, "ctc", ctcId), {
  //       joiningDate,
  //     });

  //     setEditingCTC(null);
  //     setJoiningDate("");

  //     const snap = await getDocs(collection(db, "ctc"));
  //     setCtcEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  //   } catch (e) {
  //     alert("Failed to update ❌");
  //   }
  // };

  const saveJoiningDate = async (ctcId) => {
    if (!editingCTCAmount) {
      alert("CTC required ❌");
      return;
    }

    try {
      const payload = {
        ctc: Number(editingCTCAmount),
        monthlySalary: Number(editingMonthlySalary || 0),
        target: editingTarget,
        updatedAt: serverTimestamp(),
      };

      // 👉 joining date optional
      if (joiningDate) {
        payload.joiningDate = joiningDate;
      }

      await updateDoc(doc(db, "ctc", ctcId), payload);

      setEditingCTC(null);
      setJoiningDate("");
      setEditingCTCAmount("");
      setEditingTarget(0);
      setEditingMonthlySalary(0);

      const snap = await getDocs(collection(db, "ctc"));
      setCtcEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      alert("Failed to update ❌");
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-6 grid grid-cols-12 gap-6 items-stretch">
      <div className="col-span-12 md:col-span-6 h-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 h-full flex flex-col">
          <h2 className="text-2xl font-bold mb-6 text-indigo-600">
            💼 Employee CTC & Target Setup
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6 flex-1">
            <div>
              <label className="label">Select Employee</label>
              <select
                className="input"
                value={form.employeeId}
                onChange={(e) => {
                  const emp = employees.find((x) => x.id === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    employeeId: emp.id,
                    employeeName: emp.name,
                  }));
                }}
                required
              >
                <option value="">-- Select Employee --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role})
                  </option>
                ))}
              </select>
            </div>

            {/* CTC INPUT */}
            <div>
              <label className="label">Annual CTC (₹)</label>
              <input
                name="ctc"
                type="number"
                placeholder="Ex: 600000"
                className="input"
                value={form.ctc}
                onChange={handleChange}
                required
              />
            </div>

            {/* TARGET DISPLAY */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-600">
                Monthly Target (Auto Calculated)
              </p>
              <h3 className="text-3xl font-bold text-indigo-700 mt-1">
                ₹ {form.target.toLocaleString("en-IN")}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Formula: (CTC ÷ 12) × 55
              </p>
            </div>
            {/* SUBMIT */}
            <button
              type="submit"
              className="
                  px-10 py-3 text-lg font-semibold text-white
                  rounded-xl
                  bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600
                  hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700
                  shadow-lg hover:shadow-2xl
                  transition-all duration-200
                  active:scale-95
                  focus:outline-none focus:ring-4 focus:ring-indigo-300
                  mx-auto block
                "
            >
              💾 Save CTC & Target
            </button>
          </form>
        </div>
      </div>

      {/* ================= CTC STATUS TABLE ================= */}
      <div className="col-span-12 md:col-span-6 h-full">
        <div className="bg-white rounded-2xl shadow-xl p-6 h-full flex flex-col">
          <h3 className="text-2xl font-bold mb-6 text-indigo-600">
            📋 Employee CTC Status
          </h3>

          <div
            className=" border rounded-xl overflow-y-auto"
            style={{ maxHeight: "362px" }} 
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">CTC (₹)</th>
                  <th className="p-3 text-left">Monthly Salary (₹)</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Joining Date</th>
                  <th className="p-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const added = hasCTC(emp.id);
                  const ctc = getCTCByEmp(emp.id);
                  return (
                    <tr key={emp.id} className="border-t">
                      <td className="p-3 font-medium">{emp.name}</td>
                      <td className="p-3 text-gray-600">{emp.role}</td>
                      <td className="p-3 font-semibold text-indigo-700">
                        {ctc ? `₹ ${ctc.ctc.toLocaleString("en-IN")}` : "-"}
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        {ctc
                          ? `₹ ${Number(
                              ctc.monthlySalary ?? Math.round(ctc.ctc / 12),
                            ).toLocaleString("en-IN")}`
                          : "-"}
                      </td>

                      <td className="p-3">
                        {added ? (
                          <span className="px-3 py-1 text-xs rounded-full bg-green-100 text-green-700">
                            ✅ Added
                          </span>
                        ) : (
                          <span className="px-3 py-1 text-xs rounded-full bg-red-100 text-red-700">
                            ❌ Not Added
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-sm">{ctc?.joiningDate || "-"}</td>

                      {/* 🔹 NEW COLUMN – EDIT */}
                      <td className="p-3">
                        {added && (
                          <button
                            className="text-xs px-3 py-1 bg-indigo-600 text-white rounded"
                            onClick={() => {
                              setEditingCTC(ctc);
                              setEditingCTCAmount(ctc.ctc);
                              setEditingTarget(ctc.target);
                              setEditingMonthlySalary(
                                ctc?.monthlySalary ??
                                  Math.round(Number(ctc.ctc || 0) / 12),
                              );
                              setJoiningDate(ctc?.joiningDate || "");
                            }}
                          >
                            ✏️ Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {editingCTC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-fadeIn">
            <h3 className="text-xl font-bold text-indigo-600 mb-4">
              📅 Update Joining Date
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Employee
                </label>
                <p className="font-semibold">{editingCTC.employeeName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Annual CTC (₹)
                </label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={editingCTCAmount}
                  onChange={(e) => {
                    const ctcVal = Number(e.target.value || 0);
                    setEditingCTCAmount(ctcVal);
                    setEditingTarget(Math.round((ctcVal / 12) * 55));
                    setEditingMonthlySalary(Math.round(ctcVal / 12));
                  }}
                />
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-600">Monthly Target</p>
                <p className="text-xl font-bold text-indigo-700">
                  ₹ {editingTarget.toLocaleString("en-IN")}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">
                  Joining Date
                </label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                className="px-4 py-2 rounded-lg border"
                onClick={() => {
                  setEditingCTC(null);
                  setJoiningDate("");
                  setEditingMonthlySalary(0);
                  setEditingCTCAmount("");
                  setEditingTarget(0);
                }}
              >
                Cancel
              </button>

              <button
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold"
                onClick={() => saveJoiningDate(editingCTC.id)}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
