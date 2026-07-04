import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "EMPLOYEE",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSignup = async () => {
    if (!form.name || !form.email || !form.password) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1️⃣ Create Firebase Auth user
      const res = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password
      );

      // 2️⃣ Create Firestore profile
      // await setDoc(doc(db, "users", res.user.uid), {
      //   name: form.name,
      //   email: form.email,
      //   role: form.role,
      //   createdAt: serverTimestamp(),
      // });
//       await setDoc(doc(db, "users", res.user.uid), {
//   name: form.name,
//   email: form.email,
//   role: form.role,       
//   approved: false,        
//   status: "PENDING",      
//   createdAt: serverTimestamp(),
// });

await setDoc(doc(db, "users", res.user.uid), {
  name: form.name,
  email: form.email,
  role: form.role,
  approved: false,
  isNewSignup: true,
  status: "PENDING",
  createdAt: serverTimestamp(),
});



      // 3️⃣ Redirect to login
      navigate("/login");
    } catch (err) {
      console.error(err);

      if (err.code === "auth/email-already-in-use") {
        setError("Email already registered");
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters");
      } else {
        setError("Signup failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow w-full max-w-md">
          <h2 className="text-2xl font-bold mb-1">Create Account 😎</h2>
          <p className="text-gray-500 mb-6">Signup to continue</p>

          <input
            className="input mb-3"
            placeholder="Full Name"
            name="name"
            value={form.name}
            onChange={handleChange}
          />

          <input
            className="input mb-3"
            placeholder="Email"
            name="email"
            value={form.email}
            onChange={handleChange}
          />

          <input
            className="input mb-3"
            type="password"
            placeholder="Password"
            name="password"
            value={form.password}
            onChange={handleChange}
          />

          <select
            className="input mb-4"
            name="role"
            value={form.role}
            onChange={handleChange}
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="TL">Team Leader</option>
            <option value="ADMIN">Admin</option>
          </select>

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full text-center bg-indigo-600 text-white py-2 rounded-lg disabled:opacity-60"
          >
            {loading ? "Creating..." : "Signup"}
          </button>
          <p className="text-sm text-center text-gray-500 mt-4">
            Already Account? Please{" "}
            <span
              onClick={() => navigate("/login")}
              className="text-indigo-600 font-medium cursor-pointer hover:underline"
            >
              Login
            </span>
          </p>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          {/* FOOTER */}
          <p className="text-xs text-gray-400 text-center mt-6">
            © {new Date().getFullYear()} RajBiosis Pvt. Ltd.
          </p>
        </div>
      </div>

      {/* RIGHT */}
      <div
        className="hidden md:flex w-1/2 relative items-center justify-center 
                      bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500
                      text-white overflow-hidden"
      >
        <div className="relative z-10 text-center px-10">
          <div
            className="mx-auto mb-8 w-32 h-32 rounded-3xl 
                          bg-white/20 backdrop-blur-lg
                          flex items-center justify-center shadow-2xl"
          >
            <img
              src={logo}
              alt="RajBiosis"
              className="w-20 h-20 object-contain"
            />
          </div>

          <h1 className="text-4xl font-bold mb-4">Sales Performance Hub</h1>

          <p className="text-lg opacity-90">
            Track sales, performance & feedback
            <br />
            in one smart dashboard 🚀
          </p>
        </div>
      </div>
    </div>
  );
}
