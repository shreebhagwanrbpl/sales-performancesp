import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function AssignRole() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchUsers();
  }, []);

  const assignRole = async () => {
    if (!selectedUser) return;
    await updateDoc(doc(db, "users", selectedUser), { role });
    setMsg("✅ Role updated successfully");
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow max-w-md">
      <h2 className="text-xl font-bold mb-4">Assign Role</h2>

      <select
        className="input mb-3"
        onChange={(e) => setSelectedUser(e.target.value)}
      >
        <option value="">Select User</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.email})
          </option>
        ))}
      </select>

      <select
        className="input mb-3"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="EMPLOYEE">Employee</option>
        <option value="TL">Team Leader</option>
        <option value="ADMIN">Admin</option>
      </select>

      <button
        onClick={assignRole}
        className="w-full bg-indigo-600 text-white py-2 rounded-lg"
      >
        Assign Role
      </button>

      {msg && <p className="text-green-600 mt-3">{msg}</p>}
    </div>
  );
}
