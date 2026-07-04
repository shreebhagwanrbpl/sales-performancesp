import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import logo from "../assets/logo.png";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      // 1️⃣ Firebase Auth login
      const res = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password.trim()
      );

      // 2️⃣ Fetch user profile from Firestore
      const userRef = doc(db, "users", res.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        throw new Error("User profile not found. Contact admin.");
      }

      const userData = snap.data();
      console.log("USER DATA FROM FIRESTORE 👉", userData);
      // 🚨 Block ONLY if approved === false
      if (userData.approved === false) {
        throw new Error("Your account is pending admin approval.");
      }

      // 3️⃣ Save globally (simple & effective)
      localStorage.setItem("uid", res.user.uid);
      localStorage.setItem("employeeName", userData.name);
      localStorage.setItem("role", userData.role);

      if (userData.role === "TL" || userData.role === "ADMIN") {
        localStorage.setItem("tlId", res.user.uid);
      } else if (userData.role === "EMPLOYEE" && userData.tlId) {
        localStorage.setItem("tlId", userData.tlId);
      }

      // 4️⃣ Redirect
      if (userData.role === "TL") {
        navigate("/add-sale");
      } else {
        navigate("/add-sale");
      }
    } catch (err) {
      console.error("AUTH ERROR:", err);

      if (err.code === "auth/wrong-password") {
        setError("Wrong password");
      } else if (err.code === "auth/user-not-found") {
        setError("User not found");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ================= FORGOT PASSWORD ================= */
  const handleForgot = async () => {
    if (!email) {
      setError("Enter email to reset password");
      return;
    }
    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent");
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* LEFT – LOGIN */}
      <div className="flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="w-[360px] bg-white p-8 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Welcome 👋</h2>
          <p className="text-gray-500 mb-6">Login to continue</p>

          {/* FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <input
              className="input mb-4"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div className="relative mb-3">
              <input
                type={showPass ? "text" : "password"}
                className="input pr-10"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-2.5 text-sm text-gray-500 cursor-pointer"
              >
                {showPass ? "Hide" : "Show"}
              </span>
            </div>

            <div className="text-right mb-4">
              <button
                type="button"
                onClick={handleForgot}
                className="text-sm text-indigo-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600
                         text-white py-2.5 rounded-lg font-medium
                         hover:opacity-90 transition disabled:opacity-50 text-center"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
            <p className="text-sm text-center text-gray-500 mt-4">
              New employee?{" "}
              <span
                onClick={() => navigate("/sign-up")}
                className="text-indigo-600 font-medium cursor-pointer hover:underline"
              >
                Create an account
              </span>
            </p>
          </form>

          {/* FOOTER */}
          <p className="text-xs text-gray-400 text-center mt-6">
            © {new Date().getFullYear()} RajBiosis Pvt. Ltd.
          </p>
        </div>
      </div>

      {/* RIGHT – BRAND */}
      <div
        className="hidden md:flex relative items-center justify-center
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

// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   signInWithEmailAndPassword,
//   sendPasswordResetEmail,
// } from "firebase/auth";
// import { auth, db } from "../firebase";
// import { doc, getDoc } from "firebase/firestore";
// import logo from "../assets/logo.png";
// export default function Login() {
//   const navigate = useNavigate();
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPass, setShowPass] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const handleLogin = async () => {
//     setError("");
//     setLoading(true);

//     try {
//       // 1️⃣ Firebase Auth
//       const res = await signInWithEmailAndPassword(
//         auth,
//         email.trim(),
//         password.trim()
//       );

//       // 2️⃣ Fetch user profile (AuthContext bhi yahi read karega)
//       const snap = await getDoc(doc(db, "users", res.user.uid));
//       if (!snap.exists()) {
//         throw new Error("User profile not found. Contact admin.");
//       }

//       // 3️⃣ Redirect to system
//       navigate("/add-sale");
//     } catch (err) {
//       if (err.code === "auth/wrong-password") {
//         setError("Wrong password");
//       } else if (err.code === "auth/user-not-found") {
//         setError("User not found");
//       } else {
//         setError(err.message);
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleForgot = async () => {
//     if (!email) {
//       setError("Enter email to reset password");
//       return;
//     }
//     await sendPasswordResetEmail(auth, email);
//     alert("Password reset email sent");
//   };

//   return (
//     <div className="min-h-screen grid md:grid-cols-2">
//       {/* LEFT */}
//       <div className="flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
//         <div className="w-[360px] bg-white p-8 rounded-2xl shadow-lg">
//           <h2 className="text-2xl font-bold mb-1">Welcome 👋</h2>
//           <p className="text-gray-500 mb-6">Login to continue</p>

//           <form
//             onSubmit={(e) => {
//               e.preventDefault();
//               handleLogin();
//             }}
//           >
//             <input
//               className="input mb-4"
//               placeholder="Email"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//             />

//             <div className="relative mb-3">
//               <input
//                 type={showPass ? "text" : "password"}
//                 className="input pr-10"
//                 placeholder="Password"
//                 value={password}
//                 onChange={(e) => setPassword(e.target.value)}
//               />
//               <span
//                 onClick={() => setShowPass(!showPass)}
//                 className="absolute right-3 top-2.5 text-sm cursor-pointer"
//               >
//                 {showPass ? "Hide" : "Show"}
//               </span>
//             </div>

//             <div className="text-right mb-4">
//               <button
//                 type="button"
//                 onClick={handleForgot}
//                 className="text-sm text-indigo-600 hover:underline"
//               >
//                 Forgot password?
//               </button>
//             </div>

//             {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
//             <button
//               type="submit"
//               disabled={loading}
//               className="w-full bg-indigo-600 text-white py-2.5 rounded-lg"
//             >
//               {loading ? "Logging in..." : "Login"}
//             </button>
//           </form>

//           <p className="text-xs text-center text-gray-400 mt-6">
//             © {new Date().getFullYear()} RajBiosis Pvt. Ltd.
//           </p>
//         </div>
//       </div>
//       {/* RIGHT */}
//       <div className="hidden md:flex items-center justify-center bg-indigo-600 text-white">
//         <img src={logo} className="w-24 h-24" />
//       </div>
//     </div>
//   );
// }