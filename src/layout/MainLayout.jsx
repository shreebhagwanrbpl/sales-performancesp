import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import EOTMWelcomePopup from "../components/EOTMWelcomePopup";
import PhotoReminderModal from "../components/PhotoReminderModal";

export default function MainLayout() {
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: "",
    role: "",
  });

  useEffect(() => {
    const uid = localStorage.getItem("uid");
    setUser({
      name: localStorage.getItem("employeeName") || "User",
      role: localStorage.getItem("role") || "Employee",
      photoUrl: localStorage.getItem("photoUrl") || "",
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("uid");
    localStorage.removeItem("employeeName");
    localStorage.removeItem("role");
    localStorage.removeItem("tlId");
    localStorage.removeItem("photoUrl");

    navigate("/login");
  };

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden">
      {/* CELEBRATION WELCOME POPUP ON SOFTWARE OPEN */}
      <EOTMWelcomePopup />

      {/* MISSING PHOTO REMINDER POPUP */}
      <PhotoReminderModal />

      {/* SIDEBAR – FIXED */}
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>

      {/* RIGHT SIDE */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER – FIXED */}
        <div className="h-16 bg-white shadow-xs px-6 flex justify-between items-center flex-shrink-0 border-b border-slate-200/80">
          <h1 className="font-extrabold text-lg text-slate-800 tracking-tight">Sales System</h1>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {/* Profile Avatar */}
              <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 shadow-2xs overflow-hidden flex items-center justify-center text-amber-800 font-bold text-xs uppercase flex-shrink-0">
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.name ? user.name.substring(0, 2) : "U"
                )}
              </div>

              <div className="text-right leading-tight">
                <p className="text-sm font-bold text-slate-800">{user.name}</p>
                <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">{user.role}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* 🔥 SCROLLABLE CONTENT ONLY */}
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

