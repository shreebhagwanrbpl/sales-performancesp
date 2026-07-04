import { useEffect, useState } from "react";

import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  getDoc,
  where,
  getDocs,
} from "firebase/firestore";

import { db } from "../firebase";

import { getAuth, onAuthStateChanged } from "firebase/auth";

const leaveTypes = ["CL", "SL", "EL", "Half Day", "Work From Home", "Other"];
const leaveReasonMap = {
  CL: "Casual Leave",
  SL: "Sick Leave",
  EL: "Earned Leave",
  "Half Day": "Half Day Leave",
  "Work From Home": "Work From Home",
  Other: "",
};

export default function LeaveManagement() {
  const auth = getAuth();
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: "",
    fromDate: "",
    toDate: "",
    reason: "",
    halfDayType: "",
    halfDayTime: "",
  });

  /* ================= AUTH ================= */

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setEmployeeId(user.uid);
      const localRole = localStorage.getItem("role");
      setRole(localRole || "");
      // 🔥 DIRECT AUTH NAME
      setEmployeeName(
        user.displayName || localStorage.getItem("name") || user.email,
      );
    });
    return () => unsub();
  }, []);

  /* ================= FETCH LEAVES ================= */

  useEffect(() => {
    if (!employeeId) return;
    const q = query(
      collection(db, "leave_requests"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      let data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // employee only own data
      if (role === "EMPLOYEE") {
        data = data.filter((x) => x.employeeId === employeeId);
      }
      setLeaves(data);
    });
    return () => unsub();
  }, [employeeId, role]);



  const handleApplyLeave = async () => {
    // ================= VALIDATION =================
    if (!leaveForm.leaveType || !leaveForm.fromDate) {
      alert("Please fill all fields");
      return;
    }
    // Full day leave validation
    if (leaveForm.leaveType !== "Half Day" && !leaveForm.toDate) {
      alert("Please select To Date");
      return;
    }
    // Half day validation
    if (
      leaveForm.leaveType === "Half Day" &&
      (!leaveForm.halfDayType || !leaveForm.halfDayTime)
    ) {
      alert("Please select half day details");
      return;
    }
    // Reason validation
    if (!leaveForm.reason) {
      alert("Please enter reason");
      return;
    }
    setLoading(true);
    try {
      // ================= USER FETCH =================

      const userSnap = await getDoc(doc(db, "users", employeeId));
      let finalEmployeeName = "";
      if (userSnap.exists()) {
        finalEmployeeName = userSnap.data().name || "";
      }

      // ================= DATE LOGIC =================

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const leaveDate = new Date(leaveForm.fromDate);
      leaveDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - leaveDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      let leaveStatus = "Pending";
      let approvedBy = "";
      let approvedAt = null;
      // ================= RULES =================

      // Future leave
      if (diffDays < 0) {
        leaveStatus = "Pending";
      }

      // Last 3 days
      // Half Day -> Always Pending
      else if (leaveForm.leaveType === "Half Day") {
        leaveStatus = "Pending";
      }

      // Last 3 days emergency
      else if (diffDays <= 3) {
        leaveStatus = "Auto Approved";
        approvedBy = "System";
        approvedAt = serverTimestamp();
      }

      // More than 3 days
      else {
        alert("Emergency leave period expired. Please ask Admin for approval.");
        setLoading(false);
        return;
      }

      // ================= SAVE =================

      // Duplicate leave check

      const leaveQuery = query(
        collection(db, "leave_requests"),
        where("employeeId", "==", employeeId),
        where("leaveType", "==", leaveForm.leaveType),
        where("fromDate", "==", leaveForm.fromDate),
      );

      const existingLeave = await getDocs(leaveQuery);

      if (!existingLeave.empty) {
        alert("You already applied leave for this date.");

        setLoading(false);

        return;
      }

      await addDoc(collection(db, "leave_requests"), {
        employeeId,
        employeeName: finalEmployeeName,
        leaveType: leaveForm.leaveType,
        fromDate: leaveForm.fromDate,
        // Half day me empty
        toDate: leaveForm.leaveType === "Half Day" ? "" : leaveForm.toDate,
        reason: leaveForm.reason,
        // Half day data
        halfDayType: leaveForm.halfDayType || "",
        halfDayTime: leaveForm.halfDayTime || "",
        status: leaveStatus,
        approvedBy,
        approvedAt,
        createdAt: serverTimestamp(),
      });

      // ================= RESET =================

      setLeaveForm({
        leaveType: "",
        fromDate: "",
        toDate: "",
        reason: "",
        halfDayType: "",
        halfDayTime: "",
      });

      alert("Leave Applied Successfully");
    } catch (err) {
      console.log(err);

      alert("Error applying leave");
    } finally {
      setLoading(false);
    }
  };

  /* ================= APPROVE / REJECT ================= */

  const updateLeaveStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, "leave_requests", id), {
        status,
        approvedBy: role,
        approvedAt: serverTimestamp(),
      });
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* ================= PAGE HEADER ================= */}

      <div className="bg-white rounded-3xl shadow-sm border p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Leave Management
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Manage employee leave requests
            </p>
          </div>

          <div className="hidden md:block">
            <span className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-semibold">
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* ================= EMPLOYEE APPLY FORM ================= */}

      {role === "EMPLOYEE" && (
        <div className="bg-white rounded-3xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold">Apply Leave</h3>

              <p className="text-sm text-gray-500">Submit your leave request</p>
            </div>

            <div className="bg-indigo-50 px-4 py-2 rounded-xl">
              <p className="text-xs text-gray-500">Employee</p>

              <p className="font-semibold text-indigo-700">{employeeName}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* LEAVE TYPE */}

            <div>
              <label className="block text-sm font-medium mb-2">
                Leave Type
              </label>

              <select
                className="w-full border rounded-xl px-4 py-3"
                value={leaveForm.leaveType}
                onChange={(e) => {
                  const selectedType = e.target.value;

                  setLeaveForm({
                    ...leaveForm,
                    leaveType: selectedType,

                    // auto reason
                    reason: leaveReasonMap[selectedType] || "",
                  });
                }}
              >
                <option value="">Select Leave Type</option>
                {leaveTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* FROM DATE */}

            <div>
              <label className="block text-sm font-medium mb-2">
                {leaveForm.leaveType === "Half Day" ? "Date" : "From Date"}
              </label>
              {/* 
              <input
                type="date"
                className="w-full border rounded-xl px-4 py-3"
                value={leaveForm.fromDate}
                onChange={(e) =>
                  setLeaveForm({
                    ...leaveForm,
                    fromDate: e.target.value,
                  })
                }
              /> */}
              <input
                type="date"
                className="w-full border rounded-xl px-4 py-3"
                value={leaveForm.fromDate}
                onChange={(e) =>
                  setLeaveForm({
                    ...leaveForm,
                    fromDate: e.target.value,
                  })
                }
              />
            </div>

            {leaveForm.leaveType === "Half Day" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Half Day Type
                  </label>

                  <select
                    className="w-full border rounded-xl px-4 py-3"
                    value={leaveForm.halfDayType}
                    onChange={(e) =>
                      setLeaveForm({
                        ...leaveForm,
                        halfDayType: e.target.value,
                      })
                    }
                  >
                    <option value="">Select</option>
                    <option value="Before Lunch">Before Lunch</option>
                    <option value="After Lunch">After Lunch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Half Day Time
                  </label>

                  <input
                    type="time"
                    className="w-full border rounded-xl px-4 py-3"
                    value={leaveForm.halfDayTime}
                    onChange={(e) =>
                      setLeaveForm({
                        ...leaveForm,
                        halfDayTime: e.target.value,
                      })
                    }
                  />
                </div>
              </>
            )}

            {/* TO DATE */}

            {leaveForm.leaveType !== "Half Day" && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  To Date
                </label>

                <input
                  type="date"
                  className="w-full border rounded-xl px-4 py-3"
                  value={leaveForm.toDate}
                  onChange={(e) =>
                    setLeaveForm({
                      ...leaveForm,
                      toDate: e.target.value,
                    })
                  }
                />
              </div>
            )}

            {leaveForm.leaveType && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Reason</label>

                <textarea
                  rows={4}
                  className="w-full border rounded-xl px-4 py-3"
                  placeholder="Enter reason..."
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm({
                      ...leaveForm,
                      reason: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={handleApplyLeave}
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition"
            >
              {loading ? "Applying..." : "Apply Leave"}
            </button>
          </div>
        </div>
      )}

      {/* ================= LEAVE TABLE ================= */}

      <div className="bg-white rounded-3xl shadow-sm border p-6">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-xl font-semibold">Leave Requests</h3>
            <p className="text-sm text-gray-500">All leave applications</p>
          </div>
          <div className="text-sm text-gray-500">Total: {leaves.length}</div>
        </div>

        {leaves.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            No leave requests found
          </div>
        ) : (
          <div className="overflow-auto rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-4 text-left">Employee</th>
                  <th className="p-4 text-left">Leave Type</th>
                  <th className="p-4 text-left">From</th>
                  <th className="p-4 text-left">To</th>
                  <th className="p-4 text-left">Reason</th>
                  <th className="p-4 text-left">Status</th>
                  {(role === "ADMIN" || role === "TL") && (
                    <th className="p-4 text-center">Action</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave.id} className="border-t hover:bg-gray-50">
                    {/* EMPLOYEE */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-semibold text-indigo-700">
                          {leave.employeeName?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">
                            {leave.employeeName || "No Name"}
                          </p>
                          {/* <p className="text-xs text-gray-400">
                    {leave.employeeId}
                  </p> */}
                        </div>
                      </div>
                    </td>

                    {/* TYPE */}
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                        {leave.leaveType}
                      </span>
                    </td>

                    <td className="p-4">
                      <div>
                        <p>{leave.fromDate}</p>
                        {leave.leaveType === "Half Day" && (
                          <div className="text-xs text-indigo-600 mt-1">
                            {leave.halfDayType}
                            {" | "}
                            {leave.halfDayTime}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      {leave.leaveType === "Half Day" ? (
                        <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-xs font-medium">
                          Half Day
                        </span>
                      ) : (
                        leave.toDate
                      )}
                    </td>
                    <td className="p-4">{leave.reason || "-"}</td>

                    {/* STATUS */}
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold
                        ${
                          leave.status === "Approved" ||
                          leave.status === "Auto Approved"
                            ? "bg-green-100 text-green-700"
                            : leave.status === "Rejected"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {leave.status}
                      </span>
                    </td>

                    {/* ACTION */}
                    {(role === "ADMIN" || role === "TL") && (
                      <td className="p-4">
                        {leave.status === "Pending" ||
                        leave.status === "Pending Admin Approval" ? (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() =>
                                updateLeaveStatus(leave.id, "Approved")
                              }
                              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs"
                            >
                              Approve
                            </button>

                            <button
                              onClick={() =>
                                updateLeaveStatus(leave.id, "Rejected")
                              }
                              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-center text-xs text-gray-400">
                            {leave.status === "Auto Approved"
                              ? "System Approved"
                              : "Action Completed"}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
