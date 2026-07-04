import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

export default function AdminUserApproval() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ================= ADMIN GUARD ================= */
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "ADMIN") {
      navigate("/dashboard");
    }
  }, [navigate]);

  /* ================= FETCH USERS ================= */
  useEffect(() => {
    const q = collection(db, "users");

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setUsers(list);
    });

    return () => unsub();
  }, []);

  /* ================= APPROVE USER ================= */
  const approveUser = async (userId) => {
    try {
      setLoading(true);

      await updateDoc(doc(db, "users", userId), {
        approved: true,
        status: "ACTIVE",
        approvedAt: new Date(),
        approvedBy: localStorage.getItem("uid"),
      });

      alert("User approved successfully ✅");
    } catch (err) {
      console.error(err);
      alert("Approval failed ❌");
    } finally {
      setLoading(false);
    }
  };

//  const pendingUsers = users.filter(
//   (u) => u.approved === false && u.role !== "ADMIN"
// );
const pendingUsers = users.filter(
  (u) => u.isNewSignup === true && u.approved === false
);


  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">
        Pending User Approvals
      </h2>

      <div className="overflow-x-auto bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {pendingUsers.length === 0 && (
              <tr>
                <td
                  colSpan="5"
                  className="text-center py-6 text-gray-500"
                >
                  No pending approvals 🎉
                </td>
              </tr>
            )}

            {pendingUsers.map((u) => (
              <tr
                key={u.id}
                className="border-t hover:bg-gray-50"
              >
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3 font-medium">{u.role}</td>
                <td className="p-3 text-orange-600 font-semibold">
                  {u.status || "PENDING"}
                </td>
                <td className="p-3">
                  <button
                    disabled={loading}
                    onClick={() => approveUser(u.id)}
                    className="bg-green-600 text-white px-3 py-1 rounded
                               hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? "Approving..." : "Approve"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

