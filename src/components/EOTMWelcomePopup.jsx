import { useEffect, useState } from "react";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  TrophyIcon,
  SparklesIcon,
  XMarkIcon,
  HeartIcon,
} from "@heroicons/react/24/outline";

export default function EOTMWelcomePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [winner, setWinner] = useState(null);
  const [monthName, setMonthName] = useState("");
  const [clapped, setClapped] = useState(false);

  const normalizeName = (name = "") => {
    return name
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/mr |mrs |ms /g, "")
      .trim();
  };

  const getFirstName = (name = "") => {
    return normalizeName(name).split(" ")[0];
  };

  useEffect(() => {
    // Check if popup was already shown in this session
    const hasShown = sessionStorage.getItem("eotm_welcome_popup_shown");
    
    const now = new Date();
    const currentMonth = now.toLocaleString("default", { month: "long", year: "numeric" });
    setMonthName(currentMonth);

    // Fetch top employee for current month
    const startOfMonthMs = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime();

    const unsubSales = onSnapshot(collection(db, "sales"), (salesSnap) => {
      onSnapshot(collection(db, "excel_sales_raw"), (excelSnap) => {
        onSnapshot(collection(db, "users"), (usersSnap) => {
          onSnapshot(collection(db, "employees"), (employeesSnap) => {
            try {
              const empTotalsMap = {};

              const userList = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
              const employeeList = employeesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

              userList.forEach((u) => {
                const normName = normalizeName(u.name || u.email || "");
                if (!normName) return;
                empTotalsMap[normName] = {
                  id: u.id,
                  name: u.name || u.email || "Employee",
                  email: u.email || "",
                  department: u.department || "Sales Department",
                  designation: u.role || "Sales Executive",
                  photoUrl: u.photoUrl || "",
                  totalAmount: 0,
                };
              });

              employeeList.forEach((emp) => {
                const normName = normalizeName(emp.name || emp.email || "");
                if (normName && empTotalsMap[normName]) {
                  empTotalsMap[normName].department = emp.department || empTotalsMap[normName].department;
                  empTotalsMap[normName].designation = emp.designation || empTotalsMap[normName].designation;
                  if (emp.photoUrl) {
                    empTotalsMap[normName].photoUrl = emp.photoUrl;
                  }
                }
              });

              salesSnap.docs.forEach((doc) => {
                const data = doc.data();
                let saleMs = data.createdAtMs;
                if (!saleMs && data.createdAt) {
                  saleMs = data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
                }
                if (saleMs && saleMs < startOfMonthMs) return;

                const amt = Number(data.saleAmount ?? data.amount ?? 0);
                const empName = data.employeeName || data.employeeEmail || "";
                const normName = normalizeName(empName);
                if (!normName) return;

                if (!empTotalsMap[normName]) {
                  empTotalsMap[normName] = {
                    id: data.employeeId || normName,
                    name: empName,
                    email: data.employeeEmail || "",
                    department: "Sales Department",
                    designation: "Sales Executive",
                    totalAmount: 0,
                  };
                }

                empTotalsMap[normName].totalAmount += amt;
              });

              excelSnap.docs.forEach((doc) => {
                const data = doc.data();
                const amt = Number(data.amount || 0);
                const rawPerson = data.salesPerson || data.employeeName || "";
                if (!rawPerson || !amt) return;

                const firstName = getFirstName(rawPerson);
                let matchedKey = Object.keys(empTotalsMap).find(
                  (key) => key.includes(firstName) || firstName.includes(key.split(" ")[0])
                );

                if (!matchedKey) {
                  matchedKey = normalizeName(rawPerson);
                  empTotalsMap[matchedKey] = {
                    id: matchedKey,
                    name: rawPerson,
                    email: "",
                    department: "Sales Department",
                    designation: "Sales Executive",
                    totalAmount: 0,
                  };
                }

                empTotalsMap[matchedKey].totalAmount += amt;
              });

              const sorted = Object.values(empTotalsMap).sort((a, b) => b.totalAmount - a.totalAmount);
              
              if (sorted.length > 0) {
                setWinner(sorted[0]);
              } else {
                setWinner({
                  name: "Nikita Rajawat",
                  designation: "Sales Executive",
                  department: "Sales Department",
                });
              }

              // Automatically open popup if not shown yet in this session
              if (!hasShown) {
                setIsOpen(true);
                sessionStorage.setItem("eotm_welcome_popup_shown", "true");
              }
            } catch (err) {
              console.error("Welcome Popup error:", err);
            }
          });
        });
      });
    });

    return () => unsubSales();
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen || !winner) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn">
      {/* ===== FLOATING FRILLS / CONFETTI PARTICLES ===== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {[...Array(24)].map((_, i) => (
          <span
            key={i}
            className="absolute text-xl animate-bounce"
            style={{
              top: `${Math.random() * 90}%`,
              left: `${Math.random() * 90}%`,
              animationDuration: `${1.5 + Math.random() * 2}s`,
              animationDelay: `${Math.random() * 1.5}s`,
              opacity: 0.8,
            }}
          >
            {["🎉", "🎊", "✨", "🌟", "🎈", "🏆", "💫"][i % 7]}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative border border-amber-200 z-20 animate-scaleUp">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-500 hover:text-slate-900 flex items-center justify-center shadow-md border border-slate-100 transition-all hover:rotate-90"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* CELEBRATION BANNER */}
        <div className="bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600 p-7 text-white text-center relative overflow-hidden shadow-md">
          {/* Subtle background glow rings */}
          <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-white/20 rounded-full blur-2xl" />
          <div className="absolute -right-10 -top-10 w-36 h-36 bg-yellow-200/30 rounded-full blur-2xl" />

          {/* Top Pill */}
          <div className="inline-flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-4 py-1 rounded-full text-xs font-black tracking-wider text-yellow-100 uppercase shadow-inner mb-4 border border-white/20">
            <SparklesIcon className="w-4 h-4 text-yellow-300 animate-spin" />
            EMPLOYEE OF THE MONTH
          </div>

          {/* Winner Crown & Avatar */}
          <div className="relative mx-auto w-24 h-24 mb-3">
            <div className="w-24 h-24 rounded-full bg-white p-1.5 shadow-2xl mx-auto flex items-center justify-center overflow-hidden">
              {winner.photoUrl ? (
                <img
                  src={winner.photoUrl}
                  alt={winner.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center text-3xl font-black text-amber-800 uppercase shadow-inner">
                  {winner.name ? winner.name.substring(0, 2) : "E"}
                </div>
              )}
            </div>

            {/* 3D Crown Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full text-lg shadow-lg border-2 border-white">
              👑
            </div>
            
            <div className="absolute bottom-0 right-0 bg-amber-700 text-white p-1.5 rounded-full shadow-lg border-2 border-white">
              <TrophyIcon className="w-4 h-4 text-yellow-300" />
            </div>
          </div>

          <h2 className="text-2xl font-black text-white drop-shadow-md">
            {winner.name}
          </h2>
          
          <p className="text-xs font-bold text-amber-100 mt-0.5 tracking-wide">
            {winner.designation || "Sales Executive"} • {winner.department || "Sales Department"}
          </p>
          
          <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[11px] font-extrabold text-amber-50">
            🌟 {monthName.toUpperCase()} WINNER
          </span>
        </div>

        {/* POPUP BODY CONTENT */}
        <div className="p-6 text-center space-y-4">
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50/70 p-4 rounded-2xl border border-amber-200/70 text-amber-900 shadow-xs">
            <span className="text-2xl">🎉 🎊</span>
            <h3 className="text-sm font-black text-amber-950 mt-1">
              Honor & Excellence!
            </h3>
            <p className="text-xs text-amber-800/90 leading-relaxed mt-1">
              Celebrating outstanding dedication, teamwork, and sales achievement in <b>{monthName}</b>.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setClapped(true);
                setTimeout(() => setIsOpen(false), 1200);
              }}
              className={`w-full py-3 rounded-2xl font-extrabold text-sm shadow-md transition-all duration-300 ${
                clapped
                  ? "bg-emerald-600 text-white shadow-emerald-200 scale-95"
                  : "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white hover:brightness-105"
              }`}
            >
              {clapped ? "Applauded! 👏🎉" : "Clap & Celebrate 👏"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
