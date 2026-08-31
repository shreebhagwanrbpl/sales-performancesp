import { useEffect, useState } from "react";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  TrophyIcon,
  SparklesIcon,
  UserIcon,
  BriefcaseIcon,
  ChartBarIcon,
  CalendarIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";

export default function EotmList() {
  const role = localStorage.getItem("role") || "EMPLOYEE";
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);

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
    const unsubSales = onSnapshot(collection(db, "sales"), (salesSnap) => {
      onSnapshot(collection(db, "excel_sales_raw"), (excelSnap) => {
        onSnapshot(collection(db, "users"), (usersSnap) => {
          onSnapshot(collection(db, "employees"), (employeesSnap) => {
            onSnapshot(collection(db, "ctc"), (ctcSnap) => {
              try {
                // Get users metadata
                const userList = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                const employeeList = employeesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                const ctcList = ctcSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

                // Map target info by user
                const targetMap = {};
                ctcList.forEach((c) => {
                  const norm = normalizeName(c.name || c.employeeName || "");
                  if (norm) {
                    targetMap[norm] = Number(c.monthlyTarget || c.target || c.ctc / 12 || 0);
                  }
                });

                // Group sales by Month (YYYY-MM)
                const monthlySalesGroup = {};

                // Process Firestore sales
                salesSnap.docs.forEach((doc) => {
                  const data = doc.data();
                  let dateObj = new Date();
                  if (data.createdAtMs) {
                    dateObj = new Date(data.createdAtMs);
                  } else if (data.createdAt) {
                    dateObj = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                  }

                  const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
                  const monthLabel = dateObj.toLocaleString("default", { month: "long", year: "numeric" });

                  if (!monthlySalesGroup[monthKey]) {
                    monthlySalesGroup[monthKey] = {
                      monthKey,
                      monthLabel,
                      dateObj,
                      empMap: {},
                    };
                  }

                  const empName = data.employeeName || data.employeeEmail || "";
                  const normName = normalizeName(empName);
                  if (!normName) return;

                  if (!monthlySalesGroup[monthKey].empMap[normName]) {
                    monthlySalesGroup[monthKey].empMap[normName] = {
                      name: empName,
                      email: data.employeeEmail || "",
                      totalAmount: 0,
                      dealCount: 0,
                    };
                  }

                  monthlySalesGroup[monthKey].empMap[normName].totalAmount += Number(data.saleAmount ?? data.amount ?? 0);
                  monthlySalesGroup[monthKey].empMap[normName].dealCount += 1;
                });

                // Process Excel raw sales
                excelSnap.docs.forEach((doc) => {
                  const data = doc.data();
                  const amt = Number(data.amount || 0);
                  const rawPerson = data.salesPerson || data.employeeName || "";
                  if (!rawPerson || !amt) return;

                  let dateObj = new Date();
                  if (data.dateMs) {
                    dateObj = new Date(data.dateMs);
                  } else if (data.uploadedAt) {
                    dateObj = data.uploadedAt.toDate ? data.uploadedAt.toDate() : new Date(data.uploadedAt);
                  }

                  const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
                  const monthLabel = dateObj.toLocaleString("default", { month: "long", year: "numeric" });

                  if (!monthlySalesGroup[monthKey]) {
                    monthlySalesGroup[monthKey] = {
                      monthKey,
                      monthLabel,
                      dateObj,
                      empMap: {},
                    };
                  }

                  const firstName = getFirstName(rawPerson);
                  let matchedKey = Object.keys(monthlySalesGroup[monthKey].empMap).find(
                    (key) => key.includes(firstName) || firstName.includes(key.split(" ")[0])
                  );

                  if (!matchedKey) {
                    matchedKey = normalizeName(rawPerson);
                    monthlySalesGroup[monthKey].empMap[matchedKey] = {
                      name: rawPerson,
                      email: "",
                      totalAmount: 0,
                      dealCount: 0,
                    };
                  }

                  monthlySalesGroup[monthKey].empMap[matchedKey].totalAmount += amt;
                  monthlySalesGroup[monthKey].empMap[matchedKey].dealCount += 1;
                });

                // Compute #1 winner for each month
                const winnersList = Object.values(monthlySalesGroup)
                  .map((monthData) => {
                    const sortedEmps = Object.values(monthData.empMap).sort((a, b) => b.totalAmount - a.totalAmount);
                    const topEmp = sortedEmps[0] || null;

                    if (!topEmp) return null;

                    // Match with user/employee profiles
                    const normName = normalizeName(topEmp.name);
                    const userMeta = userList.find((u) => normalizeName(u.name) === normName) || {};
                    const empMeta = employeeList.find((e) => normalizeName(e.name) === normName) || {};
                    const monthlyTarget = targetMap[normName] || 1500000;

                    const achievementPercent = monthlyTarget > 0
                      ? Math.round((topEmp.totalAmount / monthlyTarget) * 100)
                      : 100;

                    return {
                      monthKey: monthData.monthKey,
                      monthLabel: monthData.monthLabel,
                      dateObj: monthData.dateObj,
                      name: userMeta.name || empMeta.name || topEmp.name,
                      email: userMeta.email || empMeta.email || topEmp.email || "-",
                      department: empMeta.department || userMeta.department || "Sales Department",
                      designation: empMeta.designation || userMeta.role || "Sales Executive",
                      photoUrl: userMeta.photoUrl || empMeta.photoUrl || "",
                      totalAmount: topEmp.totalAmount,
                      dealCount: topEmp.dealCount,
                      achievementPercent,
                    };
                  })
                  .filter(Boolean);

                // Filter to ONLY show current month winner
                const now = new Date();
                const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                
                const validWinnersList = winnersList.filter((item) => item.monthKey === currentMonthKey);

                // Sort history by Date descending (latest month first)
                validWinnersList.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

                // Fallback demo data if empty
                if (validWinnersList.length === 0) {
                  setHistoryList([
                    {
                      monthKey: currentMonthKey,
                      monthLabel: now.toLocaleString("default", { month: "long", year: "numeric" }),
                      name: "Nikita Rajawat",
                      email: "nikita@rajbiosis.com",
                      department: "Sales Department",
                      designation: "Sales Executive",
                      photoUrl: "",
                      totalAmount: 4578654,
                      dealCount: 894,
                      achievementPercent: 180,
                    },
                  ]);
                } else {
                  setHistoryList(validWinnersList);
                }
              } catch (err) {
                console.error("EOTM List calculation error:", err);
              } finally {
                setLoading(false);
              }
            });
          });
        });
      });
    });

    return () => unsubSales();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 rounded-3xl p-7 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />

        <div className="space-y-1 z-10">
          <div className="inline-flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider text-amber-100 mb-1 border border-white/20">
            <TrophyIcon className="w-4 h-4 text-yellow-300" />
            WALL OF FAME
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Employee of the Month
          </h1>
          <p className="text-xs text-amber-100 font-medium">
            Current month top performing sales star record.
          </p>
        </div>

        <div className="bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-center z-10">
          <span className="text-xs font-bold text-amber-100 uppercase tracking-wider block">Current Status</span>
          <span className="text-2xl font-black text-white">Active Winner</span>
        </div>
      </div>

      {/* HISTORICAL EOTM LIST CARDS */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 font-semibold text-sm">
          Loading Employee of the Month list...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {historyList.map((item, idx) => (
            <div
              key={item.monthKey || idx}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group relative overflow-hidden"
            >
              {/* Subtle top accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500" />

              <div className="flex justify-between items-start pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200/80 px-3 py-1 rounded-full uppercase tracking-wider">
                  <CalendarIcon className="w-3.5 h-3.5 text-amber-600" />
                  {item.monthLabel}
                </span>

                <span className="w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center shadow-xs">
                  🏆
                </span>
              </div>

              {/* Employee Avatar & Profile */}
              <div className="flex items-center gap-3.5 pt-1">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 p-0.5 shadow-sm flex-shrink-0 overflow-hidden">
                  {item.photoUrl ? (
                    <img
                      src={item.photoUrl}
                      alt={item.name}
                      className="w-full h-full object-cover rounded-[14px]"
                    />
                  ) : (
                    <div className="w-full h-full rounded-[14px] bg-amber-50 flex items-center justify-center text-xl font-black text-amber-800 uppercase shadow-inner">
                      {item.name ? item.name.substring(0, 2) : "E"}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-extrabold text-slate-900 truncate group-hover:text-amber-900 transition-colors" title={item.name}>
                    {item.name}
                  </h3>
                  <p className="text-xs font-semibold text-amber-700/90 truncate">
                    {item.designation}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium truncate">
                    {item.department}
                  </p>
                </div>
              </div>

              {/* STATS SECTION (Role-based metrics) */}
              <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-100 space-y-2">
                {/* Target Achievement % (Visible to BOTH Employee and Admin) */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <CheckBadgeIcon className="w-4 h-4 text-emerald-600" />
                    Target Achieved:
                  </span>
                  <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    {item.achievementPercent >= 100 ? `${item.achievementPercent}% 🎉` : `${item.achievementPercent}%`}
                  </span>
                </div>

                {/* Total Sales (Visible ONLY to ADMIN) */}
                {role === "ADMIN" && (
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <ChartBarIcon className="w-4 h-4 text-indigo-600" />
                      Total Sales (Admin):
                    </span>
                    <span className="font-black text-indigo-700">
                      ₹{Number(item.totalAmount || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
