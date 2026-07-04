// import { useNavigate } from "react-router-dom";

// const role = localStorage.getItem("role");
// const navigate = useNavigate();

// useEffect(() => {
//   if (role !== "ADMIN") {
//     navigate("/dashboard");
//   }
// }, [role, navigate]);


import { useEffect, useState } from "react";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";

export default function AdminAssignTL() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role"); // ADMIN only

  const [employees, setEmployees] = useState([]);
  const [tls, setTls] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ================= ADMIN GUARD ================= */
  useEffect(() => {
    if (role !== "ADMIN") {
      navigate("/dashboard");
    }
  }, [role, navigate]);

  /* ================= FETCH USERS ================= */
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));

        const emp = [];
        const tl = [];

        snap.forEach((d) => {
          const data = { id: d.id, ...d.data() };

          if (data.role === "EMPLOYEE") emp.push(data);
          if (data.role === "TL") tl.push(data);
        });

        setEmployees(emp);
        setTls(tl);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    fetchUsers();
  }, []);

  /* ================= ASSIGN TL ================= */
  const assignTL = async (employeeId, tlId) => {
    if (!tlId) return;

    try {
      setLoading(true);

      await updateDoc(doc(db, "users", employeeId), {
        tlId: tlId,
      });

      // update local state for instant UI update
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId ? { ...e, tlId } : e
        )
      );
    } catch (err) {
      console.error("Error assigning TL:", err);
      alert("Failed to assign TL");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-1">
          Assign Team Lead (TL)
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Assign employees to their respective Team Leads
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Employee
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Assigned TL
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Assign / Change TL
                </th>
              </tr>
            </thead>

            <tbody>
              {employees.map((emp, idx) => {
                const assignedTL = tls.find(
                  (t) => t.id === emp.tlId
                );

                return (
                  <tr
                    key={emp.id}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    {/* EMPLOYEE */}
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {emp.name || emp.email}
                    </td>

                    {/* CURRENT TL */}
                    <td className="px-4 py-3 text-gray-600">
                      {assignedTL
                        ? assignedTL.name || assignedTL.email
                        : "Not Assigned"}
                    </td>

                    {/* ASSIGN DROPDOWN */}
                    <td className="px-4 py-3">
                      <select
                        className="border rounded-lg px-3 py-1.5 text-sm bg-white"
                        value={emp.tlId || ""}
                        onChange={(e) =>
                          assignTL(emp.id, e.target.value)
                        }
                        disabled={loading}
                      >
                        <option value="">Select TL</option>
                        {tls.map((tl) => (
                          <option key={tl.id} value={tl.id}>
                            {tl.name || tl.email}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}

              {employees.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <p className="mt-4 text-xs text-gray-500">
            Updating assignment...
          </p>
        )}
      </div>
    </div>
  );
}
