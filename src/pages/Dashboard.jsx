import { useEffect, useState, useMemo } from "react";
import {
  ArrowTrendingUpIcon,
  PhoneIcon,
  ChartBarIcon,
  DocumentChartBarIcon,
} from "@heroicons/react/24/outline";

import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";

import { onAuthStateChanged, getAuth } from "firebase/auth";
import { db } from "../firebase";
import ProductOfTheMonth from "../components/ProductOfTheMonth";
import { calcExcelTotals } from "../utils/calcExcelTotals";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import { calculateFYTarget } from "../utils/targetCalculator";
import { saveAs } from "file-saver";

const COLORS = ["#22c55e", "#ef4444"];
const pad2 = (n) => String(n).padStart(2, "0");

const getDefaultFY = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  // Apr(3) se FY start hota hai
  const startYear = m >= 3 ? y : y - 1;
  const endYY = pad2((startYear + 1) % 100);
  return `${startYear}-${endYY}`; // e.g. 2025-26
};

// FY string (2025-26) -> start/end Date
const getFYRange = (fy) => {
  const startYear = parseInt(fy.split("-")[0], 10);
  const start = new Date(startYear, 3, 1, 0, 0, 0); // 1 Apr startYear
  const end = new Date(startYear + 1, 2, 31, 23, 59, 59); // 31 Mar nextYear
  return { start, end };
};

// Dropdown ke liye last N FY list
const buildFYOptions = (count = 4) => {
  const currentStart = parseInt(getDefaultFY().split("-")[0], 10);
  return Array.from({ length: count }, (_, i) => {
    const s = currentStart - i;
    const e = pad2((s + 1) % 100);
    return `${s}-${e}`;
  });
};

const normalizeName = (name = "") => {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/mr |mrs |ms /g, "")
    .trim();
};

const getFirstName = (name = "") => {
  return normalizeName(name).split(" ")[0]; // 👈 KEY
};

export default function Dashboard() {
  const role = localStorage.getItem("role");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [targets, setTargets] = useState(null);
  const [focusedEmployee, setFocusedEmployee] = useState(null);
  const [excelMap, setExcelMap] = useState({});
  const [selectedFY, setSelectedFY] = useState(getDefaultFY());
  const fyOptions = useMemo(() => buildFYOptions(5), []);
  const [excelBatchId, setExcelBatchId] = useState("");
  const [excelRows, setExcelRows] = useState([]);
  const [ctcEntries, setCtcEntries] = useState([]);
  const [rangeType, setRangeType] = useState("MONTH");
  const getEmployeeEffectiveTarget = (monthlyTarget) => {
    if (!monthlyTarget) return 0;

    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();

    if (rangeType === "DAILY") {
      return Math.round(monthlyTarget / daysInMonth);
    }

    if (rangeType === "WEEK") {
      return Math.round((monthlyTarget / daysInMonth) * 7);
    }

    if (rangeType === "YEAR") {
      return monthlyTarget * 12;
    }

    return monthlyTarget; // MONTH
  };
  const excelTotalMap = useMemo(() => {
    return calcExcelTotals(excelRows); // Map()
  }, [excelRows]);

  const normalize = (v = "") => v.trim().toLowerCase();

  const getAdjustedTarget = (monthlyTarget) => {
    if (!monthlyTarget) return 0;

    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();

    switch (rangeType) {
      case "DAILY":
        return Math.round(monthlyTarget / daysInMonth);

      case "WEEK":
        return Math.round((monthlyTarget / daysInMonth) * 7);

      case "YEAR":
        return monthlyTarget * 12;

      default: // MONTH
        return monthlyTarget;
    }
  };

  const getAdjustedCompanyTarget = () => {
    return employeeStats.reduce(
      (sum, e) => sum + getAdjustedTarget(e.target),
      0,
    );
  };

  const [companyTarget, setCompanyTarget] = useState(0);
  const [companyAchieved, setCompanyAchieved] = useState(0);
  const getEffectiveTarget = (monthlyTarget) => {
    if (!monthlyTarget) return 0;

    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();

    switch (rangeType) {
      case "DAILY":
        return Math.round(monthlyTarget / daysInMonth);

      case "WEEK":
        return Math.round((monthlyTarget / daysInMonth) * 7);

      case "YEAR":
        return monthlyTarget * 12;

      default: // MONTH
        return monthlyTarget;
    }
  };

  const [employeeStats, setEmployeeStats] = useState([]);

  // const [selectedMonth, setSelectedMonth] = useState(() => {
  //   const d = new Date();

  //   // 🟡 January → current month only
  //   if (d.getMonth() === 0) {
  //     return `${d.getFullYear()}-01`;
  //   }

  //   // 🟢 Feb onwards → default = previous month
  //   d.setMonth(d.getMonth() - 1);
  //   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  // });

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // useEffect(() => {
  //   let start, end;

  //   if (rangeType === "MONTH") {
  //     const [y, m] = selectedMonth.split("-").map(Number);
  //     start = new Date(y, m - 1, 1).getTime();
  //     end = new Date(y, m, 1).getTime();
  //   }

  //   else if (rangeType === "YEAR") {
  //     const { start: fyStart, end: fyEnd } = getFYRange(selectedFY);
  //     start = fyStart.getTime();
  //     end = fyEnd.getTime();
  //   } else {
  //     return;
  //   }

  //   const q = query(
  //     collection(db, "excel_sales_raw"),
  //     where("dateMs", ">=", start),
  //     where("dateMs", "<", end),
  //   );

  //   getDocs(q).then((snap) => {
  //     const map = {};
  //     snap.docs.forEach((d) => {
  //       const r = d.data();
  //       const name = (r.salesPerson || "").trim().toLowerCase();
  //       const amt = Number(r.amount || 0);
  //       if (!name || !amt) return;
  //       map[name] = (map[name] || 0) + amt;
  //     });
  //     setExcelMap(map);
  //   });
  //   // }, [rangeType, selectedMonth, selectedYear]);
  // }, [rangeType, selectedMonth, selectedYear, selectedFY]);

  useEffect(() => {
    const qLatest = query(
      collection(db, "excel_sales_raw"),
      orderBy("uploadedAt", "desc"),
      limit(1),
    );

    const unsub = onSnapshot(qLatest, (snap) => {
      const latest = snap.docs[0]?.data();
      const b = latest?.batchId || "";
      setExcelBatchId(b);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!excelBatchId) return;

    const qBatch = query(
      collection(db, "excel_sales_raw"),
      where("batchId", "==", excelBatchId),
    );

    const unsub = onSnapshot(qBatch, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setExcelRows(list);
    });

    return () => unsub();
  }, [excelBatchId]);

  const [stats, setStats] = useState({
    sale: 0,
    calls: 0,
    positive: 0,
    negative: 0,
    monthlyPI: 0,
    projectedScore: 0,
  });

  useEffect(() => {
    if (!selectedEmployee && role !== "EMPLOYEE") {
      setStats({
        sale: 0,
        calls: 0,
        positive: 0,
        negative: 0,
        monthlyPI: 0,
        projectedScore: 0,
      });
    }
  }, [selectedEmployee, role]);
  const getEffectiveCompanyTarget = () => {
    if (!companyTarget) return 0;

    if (rangeType === "YEAR") return companyTarget * 12;

    if (rangeType === "WEEK") {
      const daysInMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0,
      ).getDate();
      return Math.round((companyTarget / daysInMonth) * 7);
    }

    if (rangeType === "DAILY") {
      const daysInMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0,
      ).getDate();
      return Math.round(companyTarget / daysInMonth);
    }

    // MONTH
    return companyTarget;
  };

  useEffect(() => {
    // 🔥 HARD RESET on employee/month change
    setStats({
      sale: 0,
      calls: 0,
      positive: 0,
      negative: 0,
      monthlyPI: 0,
      projectedScore: 0,
    });
    setTargets(null);
  }, [selectedEmployee, selectedMonth]);

  const auth = getAuth();
  const [authUid, setAuthUid] = useState(null);
  // after select employee target fetch
  // 🔥 TARGET FETCH (EMPLOYEE + TL + ADMIN)
  useEffect(() => {
    setTargets(null);
  }, [selectedEmployee, selectedMonth]);

  useEffect(() => {
    setTargets(null);
    let empId = null;

    if (role === "EMPLOYEE") {
      if (!authUid) return;
      empId = authUid;
    } else {
      if (!selectedEmployee) {
        setTargets(null);
        return;
      }
      empId = selectedEmployee;
    }

    const q = query(
      collection(db, "targets"),
      where("employeeId", "==", empId),
      where("month", "==", selectedMonth),
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setTargets(snap.docs[0].data());
      } else {
        setTargets(null);
      }
    });

    return () => unsub();
  }, [role, authUid, selectedEmployee, selectedMonth]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setAuthUid(user.uid);
    });
    return () => unsub();
  }, []);

  const effectiveCompanyTarget = employeeStats.reduce(
    (sum, e) => sum + getEffectiveTarget(e.target),
    0,
  );

  // const companyPercent = effectiveCompanyTarget
  //   ? Math.round((companyAchieved / effectiveCompanyTarget) * 100)
  //   : 0;

  // date range generator
  // const getDateRange = () => {
  //   const now = new Date();

  //   if (rangeType === "WEEK") {
  //     const start = new Date(now);
  //     start.setDate(now.getDate() - 7);
  //     return {
  //       start: Timestamp.fromDate(start),
  //       end: Timestamp.fromDate(now),
  //     };
  //   }

  //   if (rangeType === "YEAR") {
  //     const start = new Date(now.getFullYear(), 0, 1);
  //     const end = new Date(now.getFullYear() + 1, 0, 1);
  //     return {
  //       start: Timestamp.fromDate(start),
  //       end: Timestamp.fromDate(end),
  //     };
  //   }

  //   // 🔵 MONTH (default)
  //   const [y, m] = selectedMonth.split("-").map(Number);
  //   const start = new Date(y, m - 1, 1);
  //   const end = new Date(y, m, 1);

  //   return {
  //     start: Timestamp.fromDate(start),
  //     end: Timestamp.fromDate(end),
  //   };
  // };

  const getDateRange = () => {
    const now = new Date();
    // ✅ DAILY (Today)
    if (rangeType === "DAILY") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      return {
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
      };
    }

    if (rangeType === "WEEK") {
      const start = new Date();
      start.setDate(now.getDate() - 7);
      return {
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(now),
      };
    }

    // if (rangeType === "YEAR") {
    //   const start = new Date(selectedYear, 0, 1);
    //   const end = new Date(selectedYear + 1, 0, 1);
    //   return {
    //     start: Timestamp.fromDate(start),
    //     end: Timestamp.fromDate(end),
    //   };
    // }

    if (rangeType === "YEAR") {
      const { start, end } = getFYRange(selectedFY);
      return {
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
      };
    }

    // MONTH
    const [y, m] = selectedMonth.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return {
      start: Timestamp.fromDate(start),
      end: Timestamp.fromDate(end),
    };
  };

  useEffect(() => {
    setStats({
      sale: 0,
      calls: 0,
      positive: 0,
      negative: 0,
      monthlyPI: 0,
      projectedScore: 0,
    });
  }, [rangeType, selectedEmployee, selectedMonth, selectedYear]);

  /* ================= FETCH EMPLOYEES (ADMIN/TL) ================= */
  useEffect(() => {
    if (!authUid) return;
    if (role !== "ADMIN" && role !== "TL") return;

    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      if (role === "ADMIN") {
        // 🔥 ADMIN → sab employees
        setEmployees(list.filter((u) => u.role === "EMPLOYEE"));
      }

      if (role === "TL") {
        // 🔥 ONLY assigned employees
        setEmployees(
          list.filter((u) => u.role === "EMPLOYEE" && u.tlId === authUid),
        );
      }
    };

    fetchUsers();
  }, [role, authUid]);

  useEffect(() => {
    if (role !== "ADMIN" && role !== "TL") return;
    const q = collection(db, "ctc");
    const unsub = onSnapshot(q, (snap) => {
      let total = 0;
      const map = {};
      snap.forEach((d) => {
        const ctc = d.data();
        const target = Number(ctc.target || 0);
        if (!target) return;
        // ✅ TL FILTER
        if (role === "TL") {
          const isAssigned = employees.some((e) => e.id === ctc.employeeId);
          if (!isAssigned) return;
        }
        total += target;
        map[ctc.employeeId] = {
          employeeId: ctc.employeeId,
          name: ctc.employeeName,
          target,
          achieved: 0,
        };
      });
      setCompanyTarget(total);
      setEmployeeStats(Object.values(map));
    });
    return () => unsub();
  }, [role, employees]);

  /* ================= FETCH SALES ================= */
  //   useEffect(() => {
  //     const startOfMonthMs = new Date(
  //       new Date().getFullYear(),
  //       new Date().getMonth(),
  //       1
  //     ).getTime();

  //     let q;

  //     if (role === "EMPLOYEE") {
  //       if (!authUid) return;

  //       q = query(
  //         collection(db, "sales"),
  //         where("employeeId", "==", authUid),
  //         where("createdAtMs", ">=", startOfMonthMs)
  //       );
  //     } else {
  //       if (!selectedEmployee) return;

  //       q = query(
  //         collection(db, "sales"),
  //         where("employeeId", "==", selectedEmployee),
  //         where("createdAtMs", ">=", startOfMonthMs)
  //       );
  //     }

  //     const [selectedMonth, setSelectedMonth] = useState(() => {
  //   const d = new Date();
  //   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  // });
  // const getMonthRange = (monthStr) => {
  //   const [y, m] = monthStr.split("-").map(Number);
  //   const start = new Date(y, m - 1, 1).getTime();
  //   const end = new Date(y, m, 1).getTime();
  //   return { start, end };
  // };

  //     const unsub = onSnapshot(q, (snap) => {
  //       let sale = 0,
  //         calls = 0,
  //         positive = 0,
  //         negative = 0;

  //       snap.forEach((d) => {
  //         const data = d.data();
  //         sale += data.saleAmount || 0;
  //         calls += data.calls || 0;
  //         positive += data.positiveScore || 0;
  //         negative += data.negativeScore || 0;
  //       });

  //       setStats({ sale, calls, positive, negative });
  //     });

  //     return () => unsub();
  //   }, [role, authUid, selectedEmployee]);

  // const [selectedMonth, setSelectedMonth] = useState(() => {
  //   const d = new Date();
  //   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  // });

  const getMonthRange = (monthStr) => {
    const [y, m] = monthStr.split("-").map(Number);
    const start = new Date(y, m - 1, 1).getTime();
    const end = new Date(y, m, 1).getTime();
    return { start, end };
  };

  // useEffect(() => {
  //   if (!role) return;
  //   const { start, end } = getMonthRange(selectedMonth);
  //   const startTs = Timestamp.fromMillis(start);
  //   const endTs = Timestamp.fromMillis(end);
  //   let q;
  //   if (role === "EMPLOYEE") {
  //     if (!authUid) return;
  //     q = query(
  //       collection(db, "sales"),
  //       where("employeeId", "==", authUid),
  //       where("createdAt", ">=", startTs),
  //       where("createdAt", "<", endTs)
  //     );
  //   } else {
  //     if (!selectedEmployee) return;
  //     q = query(
  //       collection(db, "sales"),
  //       where("employeeId", "==", selectedEmployee),
  //       where("createdAt", ">=", startTs),
  //       where("createdAt", "<", endTs)
  //     );
  //   }
  //   if (!q) return;

  //   const unsub = onSnapshot(q, (snap) => {
  //     if (snap.empty) {
  //       setStats({
  //         sale: 0,
  //         calls: 0,
  //         positive: 0,
  //         negative: 0,
  //       });
  //       return;
  //     }

  //     let sale = 0,
  //       calls = 0,
  //       positive = 0,
  //       negative = 0;

  //     snap.forEach((d) => {
  //       const data = d.data();
  //       sale += data.saleAmount ?? data.amount ?? 0;
  //       calls += data.calls || 0;
  //       positive += data.feedback === "Interested" ? 1 : 0;
  //       negative += data.feedback === "Not Interested" ? 1 : 0;
  //     });

  //     setStats({ sale, calls, positive, negative });
  //   });

  //   return () => unsub();
  // }, [role, authUid, selectedEmployee, selectedMonth]);

  // useEffect(() => {
  //   if (!role) return;

  //   const { start, end } = getDateRange();
  //   let q;

  //   if (role === "EMPLOYEE") {
  //     if (!authUid) return;
  //     q = query(
  //       collection(db, "sales"),
  //       where("employeeId", "==", authUid),
  //       where("createdAt", ">=", start),
  //       where("createdAt", "<", end)
  //     );
  //   } else {
  //     if (selectedEmployee) {
  //       q = query(
  //         collection(db, "sales"),
  //         where("employeeId", "==", selectedEmployee),
  //         where("createdAt", ">=", start),
  //         where("createdAt", "<", end)
  //       );
  //     } else {
  //       q = query(
  //         collection(db, "sales"),
  //         where("createdAt", ">=", start),
  //         where("createdAt", "<", end)
  //       );
  //     }
  //   }

  //   const unsub = onSnapshot(q, (snap) => {
  //     let sale = 0,
  //       calls = 0,
  //       positive = 0,
  //       negative = 0;

  //     snap.forEach((d) => {
  //       const data = d.data();
  //       sale += data.saleAmount ?? data.amount ?? 0;
  //       calls += data.calls || 0;
  //       positive += data.feedback === "Interested" ? 1 : 0;
  //       negative += data.feedback === "Not Interested" ? 1 : 0;
  //     });

  //     setStats({ sale, calls, positive, negative });
  //     setCompanyAchieved(sale);

  //     // employee wise achieved map
  //     setEmployeeStats((prev) =>
  //       prev.map((e) => ({
  //         ...e,
  //         achieved: snap.docs
  //           .filter((d) => d.data().employeeId === e.employeeId)
  //           .reduce(
  //             (sum, d) => sum + (d.data().saleAmount ?? d.data().amount ?? 0),
  //             0
  //           ),
  //       }))
  //     );
  //   });

  //   return () => unsub();
  // }, [role, authUid, selectedEmployee, selectedMonth, rangeType]);

  useEffect(() => {
    if (!role) return;
    const { start, end } = getDateRange();
    let q;
    const activeEmployeeId = focusedEmployee?.employeeId || selectedEmployee;

    // if (role === "EMPLOYEE") {
    //   if (!authUid) return;

    //   q = query(
    //     collection(db, "sales"),
    //     where("employeeId", "==", authUid),
    //     where("createdAt", ">=", start),
    //     where("createdAt", "<", end),
    //   );
    // } else {
    //   if (activeEmployeeId) {
    //     //
    //     q = query(
    //       collection(db, "sales"),
    //       where("employeeId", "==", activeEmployeeId),
    //       where("createdAt", ">=", start),
    //       where("createdAt", "<", end),
    //     );
    //   } else {
    //     //
    //     q = query(
    //       collection(db, "sales"),
    //       where("createdAt", ">=", start),
    //       where("createdAt", "<", end),
    //     );
    //   }
    // }

    if (role === "EMPLOYEE") {
      if (!authUid) return;
      q = query(
        collection(db, "sales"),
        where("employeeId", "==", authUid),
        where("createdAt", ">=", start),
        where("createdAt", "<", end),
      );
    } else {
      if (activeEmployeeId) {
        q = query(
          collection(db, "sales"),
          where("employeeId", "==", activeEmployeeId),
          where("createdAt", ">=", start),
          where("createdAt", "<", end),
        );
      } else {
        q = query(
          collection(db, "sales"),
          where("createdAt", ">=", start),
          where("createdAt", "<", end),
        );
      }
    }

    // const unsub = onSnapshot(q, (snap) => {
    //   let sale = 0,
    //     calls = 0,
    //     positive = 0,
    //     negative = 0;

    //   snap.forEach((d) => {
    //     const data = d.data();
    //     sale += data.saleAmount ?? data.amount ?? 0;
    //     calls += data.calls || 0;
    //     positive += data.feedback === "Interested" ? 1 : 0;
    //     negative += data.feedback === "Not Interested" ? 1 : 0;
    //   });

    //   setStats({ sale, calls, positive, negative });
    //   setCompanyAchieved(sale);

    //   // ✅ IMPORTANT PART
    //   if (!focusedEmployee) {
    //     // 🔥 ONLY update table when NOT focusing on single employee
    //     setEmployeeStats((prev) =>
    //       prev.map((e) => ({
    //         ...e,
    //         achieved: snap.docs
    //           .filter((d) => d.data().employeeId === e.employeeId)
    //           .reduce(
    //             (sum, d) => sum + (d.data().saleAmount ?? d.data().amount ?? 0),
    //             0
    //           ),
    //       }))
    //     );
    //   }
    // });

    // const unsub = onSnapshot(q, (snap) => {
    //   let sale = 0,
    //     calls = 0,
    //     positive = 0,
    //     negative = 0,
    //     monthlyPI = 0,
    //     projectedScore = 0;

    //   snap.forEach((d) => {
    //     const data = d.data();

    //     sale += data.saleAmount ?? data.amount ?? 0;
    //     calls += data.calls || 0;
    //     positive += data.feedback === "Interested" ? 1 : 0;
    //     negative += data.feedback === "Not Interested" ? 1 : 0;

    //     // ✅ NEW FIELDS (already saved in Firebase)
    //     monthlyPI += data.monthlyPI ?? data.piScore ?? 0;
    //     projectedScore += data.projectedScore ?? 0;
    //   });

    //   // 🔥 stats now includes PI & Projected
    //   setStats({
    //     sale,
    //     calls,
    //     positive,
    //     negative,
    //     monthlyPI,
    //     projectedScore,
    //   });
    // });

    const unsub = onSnapshot(q, (snap) => {
      let sale = 0,
        calls = 0,
        positive = 0,
        negative = 0,
        monthlyPI = 0,
        projectedScore = 0;

      snap.forEach((d) => {
        const data = d.data();

        sale += data.saleAmount ?? data.amount ?? 0;
        calls += data.calls || 0;
        positive += data.feedback === "Interested" ? 1 : 0;
        negative += data.feedback === "Not Interested" ? 1 : 0;
        monthlyPI += data.monthlyPI ?? 0;
        projectedScore += data.projectedScore ?? 0;
      });

      setStats({
        sale,
        calls,
        positive,
        negative,
        monthlyPI,
        projectedScore,
      });
    });

    return () => unsub();
  }, [
    role,
    authUid,
    selectedEmployee,
    focusedEmployee,
    selectedMonth,
    rangeType,
  ]);

  /* ================= FETCH COMPANY SALES (LEFT SIDE FIXED) ================= */

  // useEffect(() => {
  //   if (!role) return;
  //   if (role !== "ADMIN" && role !== "TL") return;

  //   const { start, end } = getDateRange();

  //   let q;

  //   if (role === "ADMIN") {
  //     // 🔥 ADMIN → company wide
  //     q = query(
  //       collection(db, "sales"),
  //       where("createdAt", ">=", start),
  //       where("createdAt", "<", end),
  //     );
  //   }

  //   if (role === "TL") {
  //     // 🔥 TL → sirf assigned employees
  //     const employeeIds = employees.map((e) => e.id);

  //     if (!employeeIds.length) return;

  //     q = query(
  //       collection(db, "sales"),
  //       where("employeeId", "in", employeeIds),
  //       where("createdAt", ">=", start),
  //       where("createdAt", "<", end),
  //     );
  //   }

  //   const unsub = onSnapshot(q, (snap) => {
  //     let totalSale = 0;
  //     const achievedMap = {};

  //     snap.forEach((d) => {
  //       const data = d.data();
  //       const amt = data.saleAmount ?? data.amount ?? 0;
  //       totalSale += amt;

  //       if (data.employeeId) {
  //         achievedMap[data.employeeId] =
  //           (achievedMap[data.employeeId] || 0) + amt;
  //       }
  //     });

  //     setCompanyAchieved(totalSale);

  //     setEmployeeStats((prev) =>
  //       prev.map((e) => ({
  //         ...e,
  //         achieved: achievedMap[e.employeeId] || 0,
  //       })),
  //     );
  //   });

  //   return () => unsub();
  // }, [role, employees, selectedMonth, selectedYear, rangeType]);

  useEffect(() => {
    if (!role) return;

    const { start, end } = getDateRange();
    const startMs = start.toMillis();
    const endMs = end.toMillis();

    let q;

    // 👤 EMPLOYEE VIEW
    if (role === "EMPLOYEE") {
      if (!authUid) return;

      q = query(
        collection(db, "sales"),
        where("employeeId", "==", authUid),
        where("createdAtMs", ">=", startMs),
        where("createdAtMs", "<", endMs),
      );
    }

    // 👑 ADMIN VIEW (company wide)
    else if (role === "ADMIN") {
      q = query(
        collection(db, "sales"),
        where("createdAtMs", ">=", startMs),
        where("createdAtMs", "<", endMs),
      );
    }

    // 👥 TL VIEW (only assigned employees)
    else if (role === "TL") {
      const employeeIds = employees.map((e) => e.id);
      if (!employeeIds.length) return;

      q = query(
        collection(db, "sales"),
        where("employeeId", "in", employeeIds),
        where("createdAtMs", ">=", startMs),
        where("createdAtMs", "<", endMs),
      );
    }

    if (!q) return;

    const unsub = onSnapshot(q, (snap) => {
      let totalSale = 0;
      const achievedMap = {};

      snap.forEach((d) => {
        const data = d.data();
        const amt = data.saleAmount ?? data.amount ?? 0;
        totalSale += amt;

        if (data.employeeId) {
          achievedMap[data.employeeId] =
            (achievedMap[data.employeeId] || 0) + amt;
        }
      });

      setCompanyAchieved(totalSale);

      setEmployeeStats((prev) =>
        prev.map((e) => ({
          ...e,
          achieved: achievedMap[e.employeeId] || 0,
        })),
      );
    });

    return () => unsub();
  }, [role, authUid, employees, selectedMonth, rangeType]);

  const showMonthDropdown = new Date().getMonth() > 0;

  const pieData = [
    { name: "Positive", value: stats.positive },
    { name: "Negative", value: stats.negative },
  ];

  const getRangeLabel = () => {
    const now = new Date();
    if (rangeType === "DAILY") {
      return `Today (${new Date().toLocaleDateString()})`;
    }
    if (rangeType === "WEEK") {
      const start = new Date();
      start.setDate(now.getDate() - 7);

      return `Last 7 days (${start.toLocaleDateString()} – ${now.toLocaleDateString()})`;
    }

    if (rangeType === "YEAR") {
      return `Year ${selectedYear}`;
    }

    // MONTH
    const d = new Date(selectedMonth + "-01");
    return d.toLocaleString("default", { month: "long", year: "numeric" });
  };

  // reusable function for export data
  // const fetchReportData = async () => {
  //   const { start, end } = getDateRange();

  //   let constraints = [
  //     where("createdAt", ">=", start),
  //     where("createdAt", "<", end),
  //   ];

  //     if (role === "EMPLOYEE") {
  //   constraints.push(where("employeeId", "==", authUid));
  // } else if (selectedEmployee && selectedEmployee !== "") {
  //   constraints.push(where("employeeId", "==", selectedEmployee));
  // }
  //   if (selectedEmployee && selectedEmployee !== "") {
  //     constraints.push(where("employeeId", "==", selectedEmployee));
  //   }

  //   const q = query(collection(db, "sales"), ...constraints);

  //   const snap = await getDocs(q);

  //   return snap.docs.map((d) => ({
  //     id: d.id,
  //     ...d.data(),
  //   }));
  // };

  const fetchReportData = async () => {
    const { start, end } = getDateRange();

    let constraints = [
      where("createdAt", ">=", start),
      where("createdAt", "<", end),
    ];

    // 🔥 FIXED LOGIC
    if (role === "EMPLOYEE") {
      constraints.push(where("employeeId", "==", authUid));
    } else if (selectedEmployee && selectedEmployee !== "") {
      constraints.push(where("employeeId", "==", selectedEmployee));
    }

    const q = query(collection(db, "sales"), ...constraints);

    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  };

  const generateSummary = (rows) => {
    let sale = 0,
      calls = 0,
      pos = 0,
      neg = 0;

    rows.forEach((r) => {
      sale += r.saleAmount ?? r.amount ?? 0;
      calls += r.calls || 0;
      if (r.feedback === "Interested") pos++;
      if (r.feedback === "Not Interested") neg++;
    });

    return { sale, calls, pos, neg };
  };

  const exportToExcel = async () => {
    console.log("Selected employee:", selectedEmployee);
    const rows = await fetchReportData();
    console.log("Export rows:", rows);
    if (!rows.length) {
      alert("No data available for selected range");
      return;
    }
    const sheetData = rows.map((r) => ({
      Date: r.createdAt?.toDate().toLocaleDateString(),
      Employee: r.employeeName || r.employeeEmail || r.employeeId,
      // Payment: r.saleAmount ?? r.amount ?? 0,
"PI Number":
  r.sales?.map((s) => s.piNo).join(", ") || "-",
      Sale: r.saleAmount ?? r.amount ?? 0,
      Calls: r.calls || 0,
      Feedback: r.feedback || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    const fileName = `Sales_Report_${getRangeLabel()}.xlsx`;
    const blob = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    saveAs(new Blob([blob]), fileName);
  };

  // export button for the sales person table
  const exportEmployeeAchievement = () => {
    if (!employeeStats.length) {
      alert("No employee data available");
      return;
    }

    const sheetData = employeeStats.map((e, index) => {
      // const effectiveTarget = getEmployeeEffectiveTarget(e.target || 0);
      const effectiveTarget = getYearlyTargetOnly(e.target || 0);
      const percent = effectiveTarget
        ? Math.round((e.achieved / effectiveTarget) * 100)
        : 0;

      return {
        "S.No": index + 1,
        "Employee Name": e.name,
        "Target (₹)": effectiveTarget,
        "Achieved (₹)": e.achieved,
        "Achievement %": percent > 100 ? "100%+" : `${percent}%`,
        Range: rangeType,
      };
    });

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employee Achievement");

    const fileName = `Employee_Achievement_${getRangeLabel()}.xlsx`;
    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
    });

    saveAs(new Blob([excelBuffer]), fileName);
  };

  const getRangeTarget = (monthlyTarget) => {
    if (!monthlyTarget) return 0;

    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();

    switch (rangeType) {
      case "DAILY":
        return Math.round(monthlyTarget / daysInMonth);

      case "WEEK":
        return Math.round((monthlyTarget / daysInMonth) * 7);

      case "MONTH":
        return monthlyTarget;

      case "YEAR":
        // 🔥 FULL FY = 12 months
        return monthlyTarget * 12;

      default:
        return monthlyTarget;
    }
  };

  const excelCompanyTotal = useMemo(() => {
    if (rangeType !== "YEAR") return 0;

    if (selectedFY !== "2025-26") return 0;
    return excelRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [excelRows, rangeType, selectedFY]);

  const finalCompanyAchieved = useMemo(() => {
    return Number(companyAchieved || 0) + Number(excelCompanyTotal || 0);
  }, [companyAchieved, excelCompanyTotal]);

  const companyPercent = effectiveCompanyTarget
    ? Math.round((finalCompanyAchieved / effectiveCompanyTarget) * 100)
    : 0;
  const companySummarySale =
    rangeType === "YEAR" ? finalCompanyAchieved : Number(stats.sale || 0);

  const excelOnlyEmployees = useMemo(() => {
    const existing = new Set(employeeStats.map((e) => getFirstName(e.name)));

    const list = [];

    excelTotalMap.forEach((amt, firstName) => {
      if (!existing.has(firstName)) {
        list.push({
          employeeId: `excel-${firstName}`,
          name: firstName.toUpperCase() + " (Excel)",
          target: 0,
          achieved: 0,
          excelOnly: true,
        });
      }
    });

    return list;
  }, [employeeStats, excelTotalMap]);

  useEffect(() => {
    if (role === "TL" && employees.length > 0 && !selectedEmployee) {
      setSelectedEmployee(employees[0].id);
    }
  }, [role, employees, selectedEmployee]);

  // 🔥 TL MUST ALWAYS SEE HIS EMPLOYEES
  useEffect(() => {
    if (role === "TL" && employees.length > 0) {
      // auto select first assigned employee
      setSelectedEmployee(employees[0].id);
    }
  }, [role, employees]);
  const fyYear = 2025;
  const totalTarget = useMemo(() => {
    if (!ctcEntries?.length) return 0;

    return ctcEntries.reduce((sum, ctc) => {
      return (
        sum +
        calculateFYTarget({
          ctc: ctc.ctc,
          joiningDate: ctc.joiningDate,
          fyYear,
        })
      );
    }, 0);
  }, [ctcEntries, fyYear]);

  useEffect(() => {
    const fetchCTC = async () => {
      const snap = await getDocs(collection(db, "ctc"));
      setCtcEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };

    fetchCTC();
  }, []);

  // 🔒 FIXED YEAR TARGET (TABLE ONLY)
  const getYearlyTargetOnly = (monthlyTarget) => {
    if (!monthlyTarget) return 0;
    return monthlyTarget * 12; // ALWAYS YEAR
  };

  return (
    <div className="px-4 py-2 space-y-4">
      {/* {(role === "TL" || role === "ADMIN") && <ProductOfTheMonth />} */}
      {/* <div className="flex items-start gap-4"> */}
      <div className="grid grid-cols-[auto,1fr] items-stretch gap-4">
        {(role === "TL" || role === "ADMIN") && <ProductOfTheMonth />}
        <div
          className="
            w-full
            bg-white rounded-xl shadow
            px-5 py-4
            grid
            grid-rows-[auto,auto]
            gap-3
          "
        >
          {/* ROW 1 – Title + Range label */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Sales Overview
              </h2>
              <p className="text-sm text-gray-500">
                Performance based on selected range
              </p>
            </div>

            <p className="text-xs text-blue-600 font-medium whitespace-nowrap">
              Showing data for: <b>FY {selectedFY}</b>
            </p>
          </div>

          {/* ROW 2 – Controls (NO HEIGHT JUMP) */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Range buttons */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {["DAILY", "WEEK", "MONTH", "YEAR"].map((t) => (
                <button
                  key={t}
                  onClick={() => setRangeType(t)}
                  className={`px-4 py-1.5 text-sm rounded-md transition-all
            ${
              rangeType === t
                ? "bg-blue-600 text-white shadow"
                : "text-gray-600 hover:bg-white"
            }`}
                >
                  {t === "DAILY"
                    ? "Daily"
                    : t === "WEEK"
                      ? "Weekly"
                      : t === "MONTH"
                        ? "Monthly"
                        : "Yearly"}
                </button>
              ))}
            </div>
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
            >
              {fyOptions.map((fy) => (
                <option key={fy} value={fy}>
                  FY {fy}
                </option>
              ))}
            </select>

            {(role === "ADMIN" || role === "TL") && (
              <select
                className="h-9 px-3 rounded-lg border border-gray-300 text-sm bg-white"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                {/* 🔒 TL ko "All Employees" kabhi nahi dikhega */}
                {role !== "TL" && <option value="">All Employees</option>}

                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name || emp.email}
                  </option>
                ))}
              </select>
            )}

            {/* MONTH dropdown – now safe */}
            {rangeType === "MONTH" && (
              <select
                className="h-9 px-3 rounded-lg border border-gray-300 text-sm bg-white"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {Array.from({ length: 36 }).map((_, i) => {
                  const d = new Date();
                  d.setDate(1); // 🔥 VERY IMPORTANT (fix bug)
                  d.setMonth(d.getMonth() - i);

                  const value = `${d.getFullYear()}-${String(
                    d.getMonth() + 1,
                  ).padStart(2, "0")}`;

                  return (
                    <option key={value} value={value}>
                      {d.toLocaleString("default", {
                        month: "long",
                        year: "numeric",
                      })}
                    </option>
                  );
                })}
              </select>
            )}

            <button
              onClick={exportToExcel}
              className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
            >
              Export Report
            </button>
          </div>
        </div>
      </div>
      {/* STATS */}
      <div className="grid grid-cols-12 gap-6">
        {/* Monthly Target */}
        <div className="col-span-12 md:col-span-3 bg-white rounded-2xl border shadow-sm p-5">
          <p className="text-sm font-medium text-gray-500">
            {rangeType === "DAILY"
              ? "Daily Target"
              : rangeType === "WEEK"
                ? "Weekly Target"
                : rangeType === "YEAR"
                  ? "Yearly Target"
                  : "Monthly Target"}
          </p>

          <h3 className="mt-2 text-2xl lg:text-3xl font-bold text-indigo-700">
            ₹{Number(getAdjustedCompanyTarget() || 0).toLocaleString("en-IN")}
          </h3>

          <p className="mt-1 text-sm text-gray-400">Sales Team</p>
        </div>

        {/* Achieved */}
        <div className="col-span-12 md:col-span-3 bg-white rounded-2xl border shadow-sm p-5">
          <p className="text-sm font-medium text-gray-500">
            Achieved ({rangeType.toLowerCase()})
          </p>

          <div>
            <h3 className="text-3xl font-extrabold text-green-600 leading-tight">
              ₹{finalCompanyAchieved.toLocaleString("en-IN")}
            </h3>

            {rangeType === "YEAR" && excelCompanyTotal > 0 && (
              <p className="text-[11px] text-blue-500 mt-1">
                + ₹{excelCompanyTotal.toLocaleString("en-IN")} from Excel
              </p>
            )}
          </div>

          <p className="text-xs text-gray-400">Based on selected range</p>
        </div>
        {/* ACHIEVEMENT % (compact card) */}
        <div className="col-span-12 md:col-span-2 bg-white rounded-2xl border shadow-sm p-5">
          <p className="text-sm font-medium text-gray-500">Achievement %</p>

          <p className="text-3xl font-extrabold text-green-600">
            {companyPercent}%
          </p>

          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500"
              style={{ width: `${Math.min(companyPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* TOTAL CALLS*/}
        {/* <div className="bg-white rounded-2xl border shadow-sm p-5 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Total Calls</p>
            <h2 className="text-3xl font-semibold text-blue-600">
              {stats.calls}
            </h2>
          </div>
          <div className="p-3 bg-blue-50 rounded-full">
            <PhoneIcon className="w-6 h-6 text-blue-600" />
          </div>
        </div> */}
        <div className="col-span-12 md:col-span-2 bg-white rounded-2xl border shadow-sm p-5">
          <p className="text-sm text-gray-500">Total Calls</p>
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-semibold text-blue-600">
              {stats.calls}
            </h2>
            <div className="p-3 bg-blue-50 rounded-full">
              <PhoneIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <span /> {/* spacer */}
        </div>

        {/* PERFORMANCE*/}
        <div className="col-span-12 md:col-span-2 bg-white rounded-2xl border shadow-sm p-5">
          <div>
            <p className="text-sm text-gray-500">Performance</p>
            <h2 className="text-3xl font-semibold text-purple-600">
              {stats.calls
                ? Math.round((stats.positive / stats.calls) * 100)
                : 0}
              %
            </h2>
          </div>
          <div className="p-3 bg-purple-50 rounded-full">
            <ChartBarIcon className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>

      {rangeType === "MONTH" && targets && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          <TargetCard
            title="Sale Target"
            achieved={stats.sale}
            target={targets.saleTarget}
            prefix="₹"
          />

          <TargetCard
            title="FY Sale Target"
            achieved={stats.sale}
            target={totalTarget}
            prefix="₹"
          />

          <TargetCard
            title="Calls Target"
            achieved={stats.calls}
            target={targets.callTarget}
          />

          <TargetCard
            title="PI Target"
            achieved={stats.positive}
            target={targets.piTarget}
          />
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm text-gray-500">Sales Person Achievement</h3>

            <button
              onClick={exportEmployeeAchievement}
              className="text-xs px-4 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              Export
            </button>
          </div>
          {/* EMPLOYEE TABLE */}
          <div className="mt-6 overflow-hidden rounded-xl border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {/* HEADER */}
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">
                      Target
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">
                      Achieved
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">
                      Progress
                    </th>
                  </tr>
                </thead>

                {/* BODY */}
                <tbody>
                  {/* {employeeStats.map((e, idx) => {
                    const effectiveTarget = getEmployeeEffectiveTarget(
                      e.target || 0,
                    );

                    // 🔥 ADD THESE LINES
                    // const excelAmt =
                    //   excelMap[e.name?.trim().toLowerCase()] || 0;
                    // const excelAmt = excelTotalMap.get(normalize(e.name)) || 0;
                    const excelAmt =
                      excelTotalMap.get(getFirstName(e.name)) || 0;

                    const totalAchieved = Number(e.achieved || 0) + excelAmt;

                    const employeePercent = effectiveTarget
                      ? Math.round((totalAchieved / effectiveTarget) * 100)
                      : 0; */}
                  {[...employeeStats, ...excelOnlyEmployees].map((e, idx) => {
                    const effectiveTarget = getEmployeeEffectiveTarget(
                      e.target || 0,
                    );

                    // const excelAmt =
                    //   excelTotalMap.get(getFirstName(e.name)) || 0;
                    const excelAmt =
                      rangeType === "YEAR" && selectedFY === "2025-26"
                        ? excelTotalMap.get(getFirstName(e.name)) || 0
                        : 0;

                    const totalAchieved = Number(e.achieved || 0) + excelAmt;

                    const employeePercent = effectiveTarget
                      ? Math.round((totalAchieved / effectiveTarget) * 100)
                      : 0;

                    return (
                      //   <tr
                      //     key={e.employeeId}
                      //     onClick={() =>
                      //       setFocusedEmployee({
                      //         employeeId: e.employeeId,
                      //         name: e.name,
                      //       })
                      //     }
                      //     className={`cursor-pointer transition
                      // ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      // hover:bg-blue-50
                      // ${focusedEmployee?.employeeId === e.employeeId ? "bg-blue-100" : ""}`}
                      //   >
                      //     {/* EMPLOYEE NAME */}
                      //     <td className="px-4 py-3 font-medium text-gray-800">
                      //       {e.name}
                      //     </td>

                      //     {/* TARGET (range based) */}
                      //     <td className="px-4 py-3 text-right text-gray-600">
                      //       ₹{effectiveTarget.toLocaleString("en-IN")}
                      //     </td>

                      //     {/* ACHIEVED */}
                      //     {/* <td className="px-4 py-3 text-right font-semibold text-green-600">
                      //       ₹{e.achieved.toLocaleString("en-IN")}
                      //     </td> */}

                      //     {/* <td className="px-4 py-3 text-right">
                      //       <div className="font-semibold text-green-700">
                      //         ₹{totalAchieved.toLocaleString("en-IN")}
                      //       </div>

                      //       {excelMap[e.name?.trim().toLowerCase()] > 0 && (
                      //         <div className="flex items-center justify-end gap-1 text-xs text-blue-500">
                      //           <DocumentChartBarIcon className="w-3.5 h-3.5" />+
                      //           ₹{excelMap[e.name].toLocaleString("en-IN")} from
                      //           Excel
                      //         </div>
                      //       )}
                      //     </td> */}
                      //     <td className="px-4 py-3 text-right">
                      //       <div className="font-semibold text-green-700">
                      //         ₹
                      //         {Number(totalAchieved || 0).toLocaleString("en-IN")}
                      //       </div>

                      //       <div className="text-[10px] text-red-500">
                      //         excelAmt: {excelAmt}
                      //       </div>

                      //       {excelAmt > 0 && (
                      //         <div className="flex items-center justify-end gap-1 text-xs text-blue-500">
                      //           <DocumentChartBarIcon className="w-3.5 h-3.5" />+
                      //           ₹{Number(excelAmt).toLocaleString("en-IN")} from
                      //           Excel
                      //         </div>
                      //       )}
                      //     </td>

                      //     {/* PROGRESS */}
                      //     <td className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                      //       {employeePercent > 100
                      //         ? "100%+"
                      //         : `${employeePercent}%`}
                      //     </td>
                      //   </tr>
                      <tr
                        key={e.employeeId}
                        onClick={() => {
                          if (e.excelOnly) return; // 🚫 Excel-only → no profile
                          setFocusedEmployee({
                            employeeId: e.employeeId,
                            name: e.name,
                          });
                        }}
                        className={`transition
                        ${e.excelOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer"}
                        ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        hover:bg-blue-50`}
                      >
                        {/* NAME */}
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {e.name}
                          {e.excelOnly && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-600">
                              From Excel
                            </span>
                          )}
                        </td>

                        {/* TARGET */}
                        <td className="px-4 py-3 text-right text-gray-600">
                          ₹{effectiveTarget.toLocaleString("en-IN")}
                        </td>

                        {/* ACHIEVED */}
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-green-700">
                            ₹{totalAchieved.toLocaleString("en-IN")}
                          </div>

                          {excelAmt > 0 && rangeType === "YEAR" && (
                            <div className="text-xs text-blue-500">
                              + ₹{excelAmt.toLocaleString("en-IN")} from Excel
                            </div>
                          )}
                        </td>

                        {/* PROGRESS */}
                        <td className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                          {employeePercent > 100
                            ? "100%+"
                            : `${employeePercent}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {focusedEmployee ? (
          (() => {
            // ======= COMMON DATA (ONE TIME) =======
            const emp = employeeStats.find(
              (e) => e.employeeId === focusedEmployee.employeeId,
            );

            // const effectiveTarget = getEmployeeEffectiveTarget(emp?.target || 0,);
            const effectiveTarget = getRangeTarget(emp?.target || 0);

            // Firebase sale
            const currentSale = Number(stats.sale || 0);

            // const excelSale =
            //   excelTotalMap.get(normalize(focusedEmployee?.name || "")) || 0;
            // const excelSale = rangeType === "YEAR" ? excelTotalMap.get(normalize(focusedEmployee?.name || "")) || 0: 0;
            const excelSale =
              rangeType === "YEAR"
                ? excelTotalMap.get(
                    getFirstName(focusedEmployee?.name || ""),
                  ) || 0
                : 0;

            // Total sale
            const totalSale = currentSale + excelSale;

            // Percentage
            const focusedPercent = effectiveTarget
              ? Math.round((totalSale / effectiveTarget) * 100)
              : 0;

            const isTargetAchieved = focusedPercent >= 100;

            // ======= UI =======
            return (
              <div className="bg-white p-6 rounded-2xl shadow-lg space-y-6 border">
                {/* HEADER */}
                <div className="flex justify-between items-center border-b pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">
                      {focusedEmployee.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Employee Performance • {rangeType.toLowerCase()}
                    </p>
                  </div>

                  <button
                    onClick={() => setFocusedEmployee(null)}
                    className="text-xs px-4 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200"
                  >
                    ← Back
                  </button>
                </div>

                {/* 🎯 PERFORMANCE BANNER (TotalSale = Firebase + Excel) */}
                {focusedPercent >= 100 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                    <p className="text-sm font-semibold text-green-700">
                      🎯 Performance of the{" "}
                      {rangeType === "DAILY"
                        ? "Day"
                        : rangeType === "WEEK"
                          ? "Week"
                          : rangeType === "YEAR"
                            ? "Year"
                            : "Month"}
                    </p>

                    <p className="text-xs text-green-600">
                      ({focusedEmployee.name}) • ₹
                      {totalSale.toLocaleString("en-IN")} / ₹
                      {Number(effectiveTarget || 0).toLocaleString("en-IN")} •{" "}
                      {focusedPercent}%
                    </p>
                  </div>
                )}

                {/* TARGET vs ACHIEVEMENT */}
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">
                    Target vs Achievement
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    FY {selectedFY} (1 Apr {selectedFY.split("-")[0]} – 31 Mar{" "}
                    {Number(selectedFY.split("-")[0]) + 1})
                  </p>

                  <div className="flex items-center gap-4">
                    {/* BAR */}
                    <div className="flex-1">
                      <div className="flex justify-between text-sm font-medium mb-1">
                        <span className="text-green-600">
                          ₹{totalSale.toLocaleString("en-IN")}
                        </span>
                        <span className="text-gray-500">
                          ₹
                          {Number(effectiveTarget || 0).toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            focusedPercent >= 70
                              ? "bg-green-500"
                              : focusedPercent >= 30
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(focusedPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* CIRCLE */}
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center
              text-sm font-bold shadow-inner
              ${
                focusedPercent >= 100
                  ? "bg-green-100 text-green-700"
                  : focusedPercent >= 30
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
              }`}
                    >
                      {focusedPercent}%
                    </div>
                  </div>
                </div>

                {/* STATS */}
                <div className="grid grid-cols-2 gap-2">
                  <StatBox
                    label="Current Sale"
                    value={`₹${currentSale.toLocaleString("en-IN")}`}
                    icon={
                      <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
                    }
                  />

                  {rangeType === "YEAR" && (
                    <StatBox
                      label="From Excel"
                      value={`₹${excelSale.toLocaleString("en-IN")}`}
                      icon={
                        <DocumentChartBarIcon className="w-5 h-5 text-blue-600" />
                      }
                    />
                  )}

                  <StatBox
                    label="Total Sale"
                    value={`₹${totalSale.toLocaleString("en-IN")}`}
                    green
                    icon={
                      <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
                    }
                  />

                  <StatBox
                    label="Calls"
                    value={stats.calls}
                    icon={<PhoneIcon className="w-5 h-5 text-blue-600" />}
                  />
                </div>
              </div>
            );
          })()
        ) : (
          <div className="bg-white p-6 rounded-2xl shadow border">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">
              Company Summary
            </h3>

            <div className="space-y-3 text-sm">
              {/* <Row label="Total Sale" value={`₹${stats.sale}`} /> */}
              <Row
                label="Total Sale"
                value={`₹${companySummarySale.toLocaleString("en-IN")}`}
              />

              <Row label="Total Calls" value={stats.calls} />
              <Row
                label="Performance %"
                value={`${
                  stats.calls
                    ? Math.round((stats.positive / stats.calls) * 100)
                    : 0
                }%`}
                green
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Card = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition">
    <div className="flex justify-between items-center">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <h2 className={`text-3xl font-semibold text-${color}-600`}>{value}</h2>
      </div>
      <div className={`p-3 bg-${color}-50 rounded-full`}>
        <Icon className={`w-6 h-6 text-${color}-600`} />
      </div>
    </div>
  </div>
);

const Row = ({ label, value, green, red }) => (
  <div className="flex justify-between">
    <span>{label}</span>
    <span
      className={`font-semibold ${
        green ? "text-green-600" : red ? "text-red-500" : ""
      }`}
    >
      {value}
    </span>
  </div>
);
const StatBox = ({ label, value, green, icon }) => (
  <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border shadow-sm">
    <div className="flex items-center gap-3">
      {icon && <div className="p-2 rounded-lg bg-gray-100">{icon}</div>}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p
          className={`text-xl font-bold ${
            green ? "text-green-600" : "text-gray-800"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  </div>
);
const TargetCard = ({ title, achieved, target, prefix = "" }) => {
  const percent = target
    ? Math.min(Math.round((achieved / target) * 100), 100)
    : 0;

  let barColor = "bg-red-500";
  if (percent >= 70) barColor = "bg-green-500";
  else if (percent >= 30) barColor = "bg-yellow-500";

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <p className="text-sm text-gray-500">{title}</p>

      <p className="text-2xl font-bold mt-1">
        {prefix}
        {achieved} / {prefix}
        {target}
      </p>

      <div className="mt-3">
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className={`h-2 rounded-full ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-xs mt-1 text-gray-500">{percent}% achieved</p>
      </div>
    </div>
  );
};
