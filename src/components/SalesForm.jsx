import { useEffect, useState, useRef } from "react";
import {
  CurrencyRupeeIcon,
  PhoneIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  where,
  Timestamp,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import { getAuth, onAuthStateChanged } from "firebase/auth";
const applyProductSelect = ({
  value,
  productName,
  index,
  list,
  setList,
  close,
}) => {
  let parts = [];

  // 🧠 old data (string) + new data (array) dono handle
  if (Array.isArray(value)) {
    parts = value.map((p) => p.name || "");
  } else if (typeof value === "string") {
    parts = value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  // last typed product replace
  if (parts.length === 0) parts.push(productName);
  else parts[parts.length - 1] = productName;

  const updated = [...list];

  // 🔥 always save as ARRAY OF OBJECTS (new structure)
  updated[index].products = parts.map((name) => ({
    name,
    qty: "",
  }));

  setList(updated);
  close();
};

// const parseAmount = (val) => {
//   if (val === null || val === undefined) return 0;
//   // remove commas & spaces
//   const cleaned = String(val).replace(/,/g, "").trim();
//   const num = Number(cleaned);
//   return isNaN(num) ? 0 : num;
// };

export default function SalesForm() {
  /* ================= AUTH STATE ================= */
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeId, setEmployeeId] = useState(null);
  const [employeeName, setEmployeeName] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("ALL");
  const [role, setRole] = useState("");
  const [employees, setEmployees] = useState([]);
  const [entryEmployeeId, setEntryEmployeeId] = useState("");
  const [entryEmployeeName, setEntryEmployeeName] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState(0);
  const [editId, setEditId] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [openProductIndex, setOpenProductIndex] = useState(null);
  const auth = getAuth();
  // const [authReady, setAuthReady] = useState(false);
  // const [authLoading, setAuthLoading] = useState(true);
  const formRef = useRef(null);
  // #helper for NaN
  const parseNumber = (val) => {
    if (val === null || val === undefined) return 0;
    const cleaned = String(val).replace(/,/g, "").trim();
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // employee fetch for TL/admin
  useEffect(() => {
    if (role !== "TL" && role !== "ADMIN") return;

    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.role === "EMPLOYEE");

      setEmployees(list);
    });

    return () => unsub();
  }, [role]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "inventory_items"), orderBy("itemName")),
      (snap) => {
        setInventory(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().itemName,
          })),
        );
      },
    );

    return () => unsub();
  }, []);

  // projected state

  // useEffect(() => {
  //   const unsub = onAuthStateChanged(auth, async (user) => {
  //     if (!user) return;
  //     const r = localStorage.getItem("role") || "";
  //     setRole(r);
  //     setEmployeeId(user.uid);

  //     // 🔥 REAL SOURCE OF TRUTH
  //     const snap = await getDoc(doc(db, "users", user.uid));
  //     if (snap.exists()) {
  //       setEmployeeName(snap.data().name || "");
  //     }
  //   });

  //   return () => unsub();
  // }, []);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const r = localStorage.getItem("role");
      setRole(r);
      setEmployeeId(user.uid);
    });

    return () => unsub();
  }, []);

  // for month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // helper: start & end of selected month
  const getMonthRange = (monthStr) => {
    const [y, m] = monthStr.split("-").map(Number);
    const start = new Date(y, m - 1, 1).getTime();
    const end = new Date(y, m, 1).getTime();
    return { start, end };
  };

  /* ================= FORM STATE ================= */

  const [form, setForm] = useState({
    ptDate: "",
    piConfirmDate: "",
    piCount: "",
    saleCount: "",
    currency: "INR",
    calls: "",
    refund: "",
    sales: [],
    pis: [],
    remark: "",
  });

  const [entries, setEntries] = useState([]); // ✅ HERE

  // ✅ FILTERED ENTRIES (GLOBAL INSIDE COMPONENT)
  const filteredEntries =
    selectedEmployee === "ALL"
      ? entries
      : entries.filter((e) => e.employeeName === selectedEmployee);

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSummary({
        todayPI: 0,
        todayCalls: 0,
        todaySale: 0,
        monthPI: 0,
        monthCalls: 0,
        monthSale: 0,
      });
      return;
    }

    const { start, end } = getMonthRange(selectedMonth);
    const todayStr = new Date().toDateString();

    let todayPI = 0,
      todayCalls = 0,
      todaySale = 0,
      monthPI = 0,
      monthCalls = 0,
      monthSale = 0;

    filteredEntries.forEach((e) => {
      const d = e.createdAt?.toDate?.();
      if (!d) return;

      const time = d.getTime();

      if (time >= start && time < end) {
        monthPI += Number(e.piCount || 0);
        monthCalls += parseNumber(e.calls);
        monthSale += parseNumber(e.saleAmount);

        if (d.toDateString() === todayStr) {
          todayPI += Number(e.piCount || 0);
          todayCalls += parseNumber(e.calls);
          todaySale += parseNumber(e.saleAmount);
        }
      }
    });

    setSummary({
      todayPI,
      todayCalls,
      todaySale,
      monthPI,
      monthCalls,
      monthSale,
    });
  }, [filteredEntries, selectedMonth]);

  const [products, setProducts] = useState([]);
  // ✅ PROJECTED STATE
  const [projected, setProjected] = useState({
    target: 0,
    achieved: 0,
  });

  // #product of the month
  useEffect(() => {
    if (!entries || entries.length === 0) return;

    const productMap = {};

    entries.forEach((e) => {
      if (!Array.isArray(e.sales)) return;

      e.sales.forEach((s) => {
        if (!Array.isArray(s.products)) return;

        s.products.forEach((prod) => {
          const product = prod?.name?.trim();
          if (!product) return;

          if (!productMap[product]) {
            productMap[product] = 0;
          }

          // 💰 SALE AMOUNT ADD
          productMap[product] += Number(s.amount || 0);
        });
      });
    });

    const sortedProducts = Object.entries(productMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    setProducts(sortedProducts);
  }, [entries]);

  // ✅ PROJECTED FROM LAST SAVED ENTRY
  useEffect(() => {
    if (!entries || entries.length === 0) {
      setProjected({ target: 0, achieved: 0 });
      return;
    }
    const { start, end } = getMonthRange(selectedMonth);
    let totalTarget = 0;
    let totalAchieved = 0;

    entries.forEach((e) => {
      // const d = e.createdAt?.toDate();
      const d = e.createdAt?.toDate?.();
      if (!d) return;
      const time = d.getTime();
      if (time >= start && time < end) {
        totalTarget += Array.isArray(e.pis)
          ? e.pis.reduce((sum, p) => sum + Number(p.amount || 0), 0)
          : 0;
        totalAchieved += Number(e.saleAmount || 0);
      }
    });

    setProjected({
      target: totalTarget,
      achieved: totalAchieved,
    });
  }, [entries, selectedMonth]);

  const [summary, setSummary] = useState({
    todayPI: 0,
    todayCalls: 0,
    todaySale: 0,
    monthPI: 0,
    monthCalls: 0,
    monthSale: 0,
  });

  const [loading, setLoading] = useState(false);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
  const isManager = role === "TL" || role === "ADMIN";

  // TL / ADMIN → default closed
  // EMPLOYEE → default open
  const [openForm, setOpenForm] = useState(false);

  useEffect(() => {
    if (role === "EMPLOYEE") {
      setOpenForm(true);
    } else {
      setOpenForm(false);
    }
  }, [role]);

  // const getProgressColor = (achieved, target) => {
  //   if (!target || target <= 0) return "border-gray-300 bg-gray-50";

  //   const ratio = achieved / target;

  //   if (ratio < 0.33) return "border-red-500 bg-red-50";
  //   if (ratio < 0.66) return "border-yellow-500 bg-yellow-50";
  //   return "border-green-500 bg-green-50";
  // };

  const getProgressColor = (achieved, target) => {
    if (!target || target <= 0) return "border-gray-300 bg-gray-50";

    const ratio = achieved / target;

    if (ratio < 0.33) return "border-red-500 bg-red-50";
    if (ratio < 0.66) return "border-yellow-500 bg-yellow-50";
    return "border-green-500 bg-green-50";
  };

  /* ================= HANDLE CHANGE ================= */
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const getMonthKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  /* ================= SAVE TO FIRESTORE ================= */
  const handleSave = async () => {
    const totalSale = Number(todaySaleTotal || 0);
    if (!employeeId) {
      alert("User not logged in");
      return;
    }
    if (role === "TL" || role === "ADMIN") {
      if (!entryEmployeeId || !entryEmployeeName) {
        alert("Please select employee");
        return;
      }
    }
    const callsCount = parseNumber(form.calls);
    const hasPI = form.pis.some((p) => p.piNo || parseNumber(p.amount) > 0);
    const hasSale = form.sales.some((s) => parseNumber(s.amount) > 0);
    if (!callsCount) {
      alert("Calls are required");
      return;
    }
    let finalEmployeeId = "";
    let finalEmployeeName = "";
    if (role === "EMPLOYEE") {
      finalEmployeeId = employeeId;
      const snap = await getDoc(doc(db, "users", employeeId));
      finalEmployeeName = snap.exists() ? snap.data().name : "";
    } else {
      finalEmployeeId = entryEmployeeId;
      const snap = await getDoc(doc(db, "users", entryEmployeeId));
      finalEmployeeName = snap.exists() ? snap.data().name : "";
    }
    if (!finalEmployeeName) {
      alert("Employee name missing");
      return;
    }
    const cleanPIs = form.pis
      .filter((p) => p.piNo || p.amount)
      .map((p) => ({
        piNo: String(p.piNo || "").trim(),
        amount: parseNumber(p.amount),
        currency: p.currency || "INR",
        products: (p.products || []).map((x) => ({
          name: x.name || "",
          qty: Number(x.qty || 0),
        })),
      }));

    const totalAmount = cleanPIs.reduce((sum, p) => sum + p.amount, 0);
    setLoading(true);
    try {
      const now = new Date();

      if (editId) {
        // 🔁 EDIT MODE
        await updateDoc(doc(db, "sales", editId), {
          ptDate: form.ptDate
            ? Timestamp.fromDate(new Date(form.ptDate))
            : null,

          piCount: cleanPIs.length,
          pis: cleanPIs,

          sales: form.sales.map((s) => ({
            piNo: s.piNo || "",
            amount: parseNumber(s.amount),
            currency: s.currency || "INR",
            products: (s.products || []).map((x) => ({
              name: x.name || "",
              qty: Number(x.qty || 0),
            })),
            piConfirmDate: s.piConfirmDate
              ? Timestamp.fromDate(new Date(s.piConfirmDate))
              : null,
          })),

          calls: parseNumber(form.calls),
          saleAmount: todaySaleTotal,
          refund: parseNumber(form.refund),
          updatedAt: serverTimestamp(),
        });

        setEditId(null);
      } else {
        await addDoc(collection(db, "sales"), {
          employeeId: finalEmployeeId,
          employeeName: finalEmployeeName,
          ptDate: form.ptDate
            ? Timestamp.fromDate(new Date(form.ptDate))
            : null,

          piCount: cleanPIs.length,
          pis: cleanPIs,
          remark: form.remark,
          sales: form.sales.map((s) => ({
            piNo: s.piNo || "",
            amount: parseNumber(s.amount),
            currency: s.currency || "INR",

            products: (s.products || []).map((x) => ({
              name: x.name || "",
              qty: Number(x.qty || 0),
            })),

            qty: Number(s.qty || 0),

            piConfirmDate: s.piConfirmDate
              ? Timestamp.fromDate(new Date(s.piConfirmDate))
              : null,
          })),

          calls: parseNumber(form.calls),
          saleAmount: todaySaleTotal,
          refund: parseNumber(form.refund),
          createdAt: serverTimestamp(),
          createdAtMs: now.getTime(),
          month: selectedMonth,
        });

        if (editId) {
          await updateDoc(doc(db, "sales", editId), {
            // ... existing fields
            remark: form.remark, // 🔥 ADD YE
            updatedAt: serverTimestamp(),
          });
        }
      }

      // ✅ reset (same as before)
      setForm({
        ptDate: "",
        piConfirmDate: "",
        piCount: "",
        saleCount: "",
        currency: "INR",
        calls: "",
        refund: "",
        sales: [],
        pis: [],
      });
      setEntryEmployeeId("");
      setEntryEmployeeName("");
    } catch (err) {
      console.error("SAVE ERROR:", err);
      alert("Failed to save entry ❌");
    } finally {
      setLoading(false);
    }
  };

  /* ================= FETCH SALES (THIS MONTH) ================= */
  useEffect(() => {
    if (!employeeId || !role) return;

    const { start, end } = getMonthRange(selectedMonth);

    let q;

    if (role === "EMPLOYEE") {
      q = query(
        collection(db, "sales"),
        where("employeeId", "==", employeeId),
        where("createdAtMs", ">=", start),
        where("createdAtMs", "<", end),
        orderBy("createdAtMs", "desc"),
      );
    } else {
      q = query(
        collection(db, "sales"),
        where("createdAtMs", ">=", start),
        where("createdAtMs", "<", end),
        orderBy("createdAtMs", "desc"),
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      setEntries(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })),
      );
    });

    return () => unsub();
  }, [employeeId, role, selectedMonth]);

  // pi counter change

  // useEffect(() => {
  //   if (!employeeId || !role) return;

  //   let q;

  //   if (role === "EMPLOYEE") {
  //     q = query(
  //       collection(db, "sales"),
  //       where("employeeId", "==", employeeId),
  //       where("month", "==", selectedMonth),
  //       orderBy("createdAtMs", "desc"),
  //     );
  //   } else {
  //     q = query(
  //       collection(db, "sales"),
  //       where("month", "==", selectedMonth),
  //       orderBy("createdAtMs", "desc"),
  //     );
  //   }

  //   const unsub = onSnapshot(q, (snap) => {
  //     setEntries(
  //       snap.docs.map((doc) => ({
  //         id: doc.id,
  //         ...doc.data(),
  //       })),
  //     );
  //   });

  //   return () => unsub();
  // }, [employeeId, role, selectedMonth]);

  const handlePiCountChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    const count = Number(value || 0);

    setForm((prev) => ({
      ...prev,
      piCount: value, // ✅ STRING

      pis: Array.from({ length: count }, (_, i) => ({
        piNo: prev.pis[i]?.piNo || "",
        amount: prev.pis[i]?.amount || "",
        currency: prev.pis[i]?.currency || "INR",

        // ✅ NEW DYNAMIC PRODUCTS STRUCTURE
        products: Array.isArray(prev.pis[i]?.products)
          ? prev.pis[i].products
          : [{ name: "", qty: "" }],
      })),
    }));
  };

  // export csv for employee
  // const exportToCSV = () => {
  //   if (!entries || entries.length === 0) return;

  //   const headers = [
  //     "Employee",
  //     "PI Date",
  //     "PI Confirm Date",
  //     "PI Count",
  //     "PI Numbers",
  //     "PI Amounts",
  //     "Products",
  //     "Total Sale",
  //     "Calls",
  //     "Currency",
  //   ];

  //   const rows = entries.map((e) => [
  //     e.employeeName,
  //     e.ptDate ? e.ptDate.toDate().toLocaleDateString() : "",
  //     e.sales
  //       ?.map((s) =>
  //         s.piConfirmDate ? s.piConfirmDate.toDate().toLocaleDateString() : "-"
  //       )
  //       .join(" | "),
  //     e.piCount || e.pis?.length || 0,
  //     e.pis?.map((p) => p.piNo).join(" | "),
  //     e.pis?.map((p) => p.amount).join(" | "),
  //     e.pis?.map((p) => p.products).join(" | "),
  //     e.saleAmount || 0,
  //     e.calls || 0,
  //     e.currency,
  //   ]);

  //   const csvContent =
  //     "data:text/csv;charset=utf-8," +
  //     [headers, ...rows]
  //       .map((row) =>
  //         row.map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(",")
  //       )
  //       .join("\n");

  //   const link = document.createElement("a");
  //   link.href = encodeURI(csvContent);
  //   link.download = `sales_export_${selectedMonth}.csv`;
  //   document.body.appendChild(link);
  //   link.click();
  //   document.body.removeChild(link);
  // };

  const exportToExcelSameUI = () => {
    if (!entries || entries.length === 0) return;

    const wb = XLSX.utils.book_new();
    const wsData = [];

    entries.forEach((e, index) => {
      /* ================= PI SUMMARY ================= */
      wsData.push(["PI Date", "No. of PI Created"]);
      wsData.push([
        e.ptDate ? e.ptDate.toDate().toLocaleDateString() : "",
        e.piCount || e.pis?.length || 0,
      ]);
      wsData.push([]);

      /* ================= PI DETAILS ================= */
      wsData.push(["PI No", "Amount", "Currency", "Products"]);

      if (Array.isArray(e.pis) && e.pis.length > 0) {
        e.pis.forEach((p) => {
          wsData.push([
            p.piNo || "",
            Number(p.amount || 0),
            e.currency || "INR",
            p.products || "",
          ]);
        });
      } else {
        wsData.push(["-", "-", "-", "-"]);
      }

      wsData.push([]);

      /* ================= SALE DETAILS ================= */
      wsData.push([
        "Sale Confirm Date",
        "PI No",
        "Amount",
        "Currency",
        "Products",
      ]);

      if (Array.isArray(e.sales) && e.sales.length > 0) {
        e.sales.forEach((s) => {
          wsData.push([
            s.piConfirmDate
              ? s.piConfirmDate.toDate().toLocaleDateString()
              : "",
            s.piNo || "",
            Number(s.amount || 0),
            s.currency || "INR",
            s.products || "",
          ]);
        });
      } else {
        wsData.push(["-", "-", "-", "-", "-"]);
      }

      wsData.push([]);

      /* ================= DAILY ACTIVITY ================= */
      wsData.push(["Today Calls Made", "Total Sale Today"]);
      wsData.push([e.calls || 0, Number(e.saleAmount || 0)]);

      /* ================= SEPARATOR ================= */
      if (index !== entries.length - 1) {
        wsData.push([]);
        wsData.push(["----------------------------------------"]);
        wsData.push([]);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");

    XLSX.writeFile(wb, `Sales_Report_${selectedMonth}.xlsx`);
  };

  // export for TL & Admin
  const exportMonthlyReport = () => {
    if (!entries || entries.length === 0) return;
    if (filteredEntries.length === 0) {
      alert("No data found");
      return;
    }
    const summaryBlock = [
      `Month,${selectedMonth}`,
      `Employee,${
        selectedEmployee === "ALL" ? "All Employees" : selectedEmployee
      }`,
      ``,

      `Monthly PI Target,90`,
      `Monthly PI Achieved,${summary.monthPI}`,
      ``,

      `Monthly Calls Target,2500`,
      `Monthly Calls Achieved,${summary.monthCalls}`,
      ``,

      `Monthly Sale Target,800000`,
      `Monthly Sale Achieved,${summary.monthSale}`,
      ``,

      `Projected Target,${projected.target}`,
      `Projected Achieved,${projected.achieved}`,
      ``,
      `---`,
      ``,
    ];

    const headers = ["Employee", "PI Date", "PI Count", "Calls", "Sale Amount"];

    const rows = filteredEntries.map((e) => [
      e.employeeName,
      e.ptDate ? e.ptDate.toDate().toLocaleDateString() : "",
      e.piCount || e.pis?.length || 0,
      e.calls || 0,
      e.saleAmount || 0,
    ]);

    const csv =
      "data:text/csv;charset=utf-8," +
      [
        ...summaryBlock,
        headers.join(","),
        ...rows.map((r) => r.join(",")),
      ].join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download =
      selectedEmployee === "ALL"
        ? `monthly_summary_${selectedMonth}.csv`
        : `monthly_summary_${selectedEmployee}_${selectedMonth}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const todaySaleTotal = (form.sales || []).reduce(
    (sum, s) => sum + parseNumber(s.amount),
    0,
  );

  // filtered table
  const filteredTableEntries = entries.filter((e) => {
    if (!searchTerm) return true;

    const q = String(searchTerm || "").toLowerCase();

    return (
      e.employeeName?.toLowerCase().includes(q) ||
      String(e.saleAmount || "").includes(q) ||
      String(e.calls || "").includes(q) ||
      e.pis?.some(
        (p) =>
          p.piNo?.toLowerCase().includes(q) ||
          String(p.amount || "").includes(q) ||
          (Array.isArray(p.products) &&
            p.products.some((prod) => prod.name?.toLowerCase().includes(q))),
      ) ||
      e.sales?.some(
        (s) =>
          s.piNo?.toLowerCase().includes(q) ||
          String(s.amount || "").includes(q) ||
          (Array.isArray(s.products) &&
            s.products.some((prod) => prod.name?.toLowerCase().includes(q))),
      )
    );
  });

  const progress =
    monthlyTarget > 0
      ? Math.round((summary.monthSale / monthlyTarget) * 100)
      : 0;

  // link target to sales emoployee
  // useEffect(() => {
  //   const fetchEmployeeTarget = async () => {
  //     const uid = localStorage.getItem("uid");
  //     if (!uid) return;

  //     const q = query(
  //       collection(db, "ctc"),
  //       where("employeeId", "==", uid)
  //     );

  //     const snap = await getDocs(q);

  //     if (!snap.empty) {
  //       const data = snap.docs[0].data();
  //       setMonthlyTarget(data.target); // 🔥 HERE
  //     } else {
  //       setMonthlyTarget(0);
  //     }
  //   };

  //   fetchEmployeeTarget();
  // }, []);

  // for the target

  useEffect(() => {
    const targetEmployeeId = role === "EMPLOYEE" ? employeeId : entryEmployeeId;

    if (!targetEmployeeId) {
      setMonthlyTarget(0);
      return;
    }

    const fetchEmployeeTarget = async () => {
      try {
        const q = query(
          collection(db, "ctc"),
          where("employeeId", "==", targetEmployeeId),
        );

        const snap = await getDocs(q);

        if (snap.empty) {
          setMonthlyTarget(0);
          return;
        }

        // 🔥 latest CTC pick (JS sort – no index needed)
        const latestCTC = snap.docs
          .map((doc) => doc.data())
          .sort(
            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
          )[0];

        setMonthlyTarget(latestCTC?.target || 0);
      } catch (err) {
        console.error("CTC fetch error:", err);
        setMonthlyTarget(0);
      }
    };

    fetchEmployeeTarget();
  }, [employeeId, entryEmployeeId, role]);

  //   if (authLoading) {
  //   return (
  //     <div className="flex items-center justify-center h-[60vh]">
  //       <p className="text-gray-500 text-lg">Loading sales form...</p>
  //     </div>
  //   );
  // }

  return (
    <div className="space-y-8">
      {/* ================= EMPLOYEE SUMMARY CARDS ================= */}
      {role === "EMPLOYEE" && (
        <div className="max-w-6xl">
          {/* header row */}
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-semibold">Monthly Summary</h3>
            {/* MONTH DROPDOWN */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input w-40"
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const d = new Date();
                d.setDate(1);
                d.setMonth(d.getMonth() - i);
                const val = `${d.getFullYear()}-${String(
                  d.getMonth() + 1,
                ).padStart(2, "0")}`;
                return (
                  <option key={val} value={val}>
                    {d.toLocaleString("default", {
                      month: "long",
                      year: "numeric",
                    })}
                  </option>
                );
              })}
            </select>
          </div>

          {/* cards */}
          <div className="grid md:grid-cols-4 gap-6">
            <SummaryCard
              title="Monthly PI"
              value={`${summary.monthPI} / 90`}
              sub={`Today: ${summary.todayPI}`}
              color={getProgressColor(summary.monthPI, 90)}
            />
            <SummaryCard
              title="Monthly Calls"
              value={`${summary.monthCalls} / 2.5k`}
              sub={`Today: ${summary.todayCalls}`}
              color={getProgressColor(summary.monthCalls, 2500)}
            />
            {/* <SummaryCard
              title="Monthly Sale"
              value={`₹${summary.monthSale.toLocaleString()} / ₹8Lac`}
              sub={`Today: ₹${summary.todaySale.toLocaleString()}`}
              color={getProgressColor(summary.monthSale, 800000)}
            /> */}
            <SummaryCard
              title="Monthly Sale"
              value={`₹${summary.monthSale.toLocaleString("en-IN")} / ₹${
                monthlyTarget > 0 ? monthlyTarget.toLocaleString("en-IN") : "--"
              }`}
              sub={`Today: ₹${summary.todaySale.toLocaleString(
                "en-IN",
              )} • ${progress}% achieved`}
              color={getProgressColor(summary.monthSale, monthlyTarget)}
            />
            <SummaryCard
              title="Projected Score"
              value={`₹${projected.achieved.toLocaleString()} / ₹${projected.target.toLocaleString()}`}
              sub="Based on today's PI & Sale"
              color={getProgressColor(
                projected.achieved,
                projected.target || 1,
              )}
            />
          </div>
        </div>
      )}

      {/* ================= EMPLOYEE: DIRECT FORM (OPEN) ================= */}
      {role === "EMPLOYEE" && (
        <div
          ref={formRef}
          className="bg-white rounded-2xl shadow-sm max-w-6xl mx-auto overflow-hidden"
        >
          <div className="p-6">
            <h2 className="text-2xl font-semibold mb-1">Today’s Work Entry</h2>
            <p className="text-sm text-gray-500 mb-6">
              Fill your daily sales & PI activity
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="PI Date"
                name="ptDate"
                type="date"
                value={form.ptDate}
                onChange={handleChange}
              />

              <Input
                label="No. of PI Created Today"
                name="piCount"
                value={form.piCount}
                onChange={handlePiCountChange}
              />

              {/* <Input
                label="PI Number"
                name="piNo"
                value={form.piNo}
                onChange={handleChange}
              /> */}
            </div>

            {form.pis.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-gray-700 mt-8 mb-3">
                  PI Details
                </h3>

                <div className="space-y-3">
                  {form.pis.map((pi, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <div>
                        <label className="label">PI Number {index + 1}</label>
                        <input
                          className="input"
                          value={pi.piNo}
                          onChange={(e) => {
                            const updated = [...form.pis];
                            updated[index].piNo = e.target.value;
                            setForm({ ...form, pis: updated });
                          }}
                        />
                      </div>

                      <div>
                        <label className="label">Amount {index + 1}</label>
                        <input
                          className="input"
                          value={pi.amount}
                          onChange={(e) => {
                            const updated = [...form.pis];
                            updated[index].amount = e.target.value.replace(
                              /[^0-9,]/g,
                              "",
                            );
                            setForm({ ...form, pis: updated });
                          }}
                        />
                      </div>

                      <div>
                        <label className="label">Currency</label>
                        <select
                          className="input"
                          value={pi.currency || "INR"}
                          onChange={(e) => {
                            const updated = [...form.pis];
                            updated[index].currency = e.target.value;
                            setForm({ ...form, pis: updated });
                          }}
                        >
                          <option value="INR">INR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>

                      <div>
                        <label className="label">No of Products</label>
                        <input
                          className="input mb-2"
                          value={pi.products?.length || ""}
                          onChange={(e) => {
                            const count =
                              Number(e.target.value.replace(/[^0-9]/g, "")) ||
                              0;

                            const updated = [...form.pis];

                            updated[index].products = Array.from(
                              { length: count },
                              (_, i) => ({
                                name: updated[index].products?.[i]?.name || "",
                                qty: updated[index].products?.[i]?.qty || "",
                              }),
                            );

                            setForm({ ...form, pis: updated });
                          }}
                        />

                        {/* 🔥 Dynamic Product + Qty Inputs */}
                        {pi.products?.map((prod, pIndex) => (
                          <div
                            key={pIndex}
                            className="grid grid-cols-2 gap-2 mb-2 relative"
                          >
                            <input
                              className="input"
                              placeholder={`Product ${pIndex + 1}`}
                              value={prod.name}
                              onChange={(e) => {
                                const updated = [...form.pis];
                                updated[index].products[pIndex].name =
                                  e.target.value;
                                setForm({ ...form, pis: updated });
                              }}
                              onFocus={() =>
                                setOpenProductIndex(`pi-emp-${index}-${pIndex}`)
                              }
                              onBlur={() =>
                                setTimeout(() => setOpenProductIndex(null), 150)
                              }
                            />
                            {openProductIndex ===
                              `pi-emp-${index}-${pIndex}` && (
                              <div className="absolute left-0 top-full z-30 bg-white border rounded-lg shadow w-full max-h-48 overflow-y-auto mt-1">
                                {inventory
                                  .filter((p) =>
                                    p.name
                                      .toLowerCase()
                                      .includes(
                                        (prod.name || "").toLowerCase(),
                                      ),
                                  )
                                  .slice(0, 10)
                                  .map((p) => (
                                    <div
                                      key={p.id}
                                      className="px-3 py-2 cursor-pointer hover:bg-indigo-50"
                                      onMouseDown={() => {
                                        const updated = [...form.pis];
                                        updated[index].products[pIndex].name =
                                          p.name;
                                        setForm({
                                          ...form,
                                          pis: updated,
                                        });
                                        setOpenProductIndex(null);
                                      }}
                                    >
                                      {p.name}
                                    </div>
                                  ))}
                              </div>
                            )}
                            <input
                              className="input"
                              placeholder="Qty"
                              value={prod.qty}
                              onChange={(e) => {
                                const updated = [...form.pis];
                                updated[index].products[pIndex].qty =
                                  e.target.value.replace(/[^0-9]/g, "");
                                setForm({ ...form, pis: updated });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <Input
              label="No of Sale Done Today"
              name="saleCount"
              value={form.saleCount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, "");
                const count = Number(value || 0); // ✅ YAHI MISSING THA

                setForm((prev) => ({
                  ...prev,
                  saleCount: value, // STRING
                  sales: Array.from({ length: count }, (_, i) => ({
                    piNo: prev.sales[i]?.piNo || "",
                    amount: prev.sales[i]?.amount || "",
                    currency: prev.sales[i]?.currency || "INR",
                    products: Array.isArray(prev.sales[i]?.products)
                      ? prev.sales[i].products
                      : [{ name: "", qty: "" }],
                    piConfirmDate: prev.sales[i]?.piConfirmDate || "",
                  })),
                }));
              }}
            />

            {form.sales.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-gray-700 mt-8 mb-3">
                  Sale Details
                </h3>

                <div className="space-y-3">
                  {form.sales.map((s, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg border bg-gray-50"
                    >
                      <input
                        type="date"
                        placeholder="PI Confirm Date"
                        className="input"
                        value={s.piConfirmDate || ""}
                        onChange={(e) => {
                          const updated = [...form.sales];
                          updated[index].piConfirmDate = e.target.value;
                          setForm({ ...form, sales: updated });
                        }}
                      />
                      <input
                        className="input"
                        placeholder="PI Number"
                        value={s.piNo}
                        onChange={(e) => {
                          const updated = [...form.sales];
                          updated[index].piNo = e.target.value;
                          setForm({ ...form, sales: updated });
                        }}
                      />
                      {/* <input
                        className="input"
                        placeholder="Qty"
                        value={s.qty || ""}
                        onChange={(e) => {
                          const updated = [...form.sales];
                          updated[index].qty = e.target.value.replace(
                            /[^0-9]/g,
                            "",
                          );
                          setForm({ ...form, sales: updated });
                        }}
                      /> */}

                      <input
                        className="input"
                        placeholder="Amount"
                        value={s.amount}
                        onChange={(e) => {
                          const updated = [...form.sales];
                          updated[index].amount = e.target.value.replace(
                            /[^0-9,]/g,
                            "",
                          );
                          setForm({ ...form, sales: updated });
                        }}
                      />

                      <select
                        className="input"
                        value={s.currency}
                        onChange={(e) => {
                          const updated = [...form.sales];
                          updated[index].currency = e.target.value;
                          setForm({ ...form, sales: updated });
                        }}
                      >
                        <option value="INR">INR</option>
                        <option value="USD">USD</option>
                      </select>

                      <label className="label">No of Products</label>
                      <input
                        className="input mb-2"
                        value={s.products?.length || ""}
                        onChange={(e) => {
                          const count =
                            Number(e.target.value.replace(/[^0-9]/g, "")) || 0;

                          const updated = [...form.sales];

                          updated[index].products = Array.from(
                            { length: count },
                            (_, i) => ({
                              name: updated[index].products?.[i]?.name || "",
                              qty: updated[index].products?.[i]?.qty || "",
                            }),
                          );

                          setForm({ ...form, sales: updated });
                        }}
                      />

                      {s.products?.map((prod, pIndex) => (
                        <div
                          key={pIndex}
                          className="grid grid-cols-2 gap-2 mb-2 relative"
                        >
                          <input
                            className="input"
                            placeholder={`Product ${pIndex + 1}`}
                            value={prod.name}
                            onChange={(e) => {
                              const updated = [...form.sales];
                              updated[index].products[pIndex].name =
                                e.target.value;
                              setForm({ ...form, sales: updated });
                            }}
                            onFocus={() =>
                              setOpenProductIndex(`sale-emp-${index}-${pIndex}`)
                            }
                            onBlur={() =>
                              setTimeout(() => setOpenProductIndex(null), 150)
                            }
                          />
                          {openProductIndex ===
                            `sale-emp-${index}-${pIndex}` && (
                            <div className="absolute left-0 top-full z-30 bg-white border rounded-lg shadow w-full max-h-48 overflow-y-auto mt-1">
                              {inventory
                                .filter((p) =>
                                  p.name
                                    .toLowerCase()
                                    .includes((prod.name || "").toLowerCase()),
                                )
                                .slice(0, 10)
                                .map((p) => (
                                  <div
                                    key={p.id}
                                    className="px-3 py-2 cursor-pointer hover:bg-indigo-50"
                                    onMouseDown={() => {
                                      const updated = [...form.sales];
                                      updated[index].products[pIndex].name =
                                        p.name;
                                      setForm({ ...form, sales: updated });
                                      setOpenProductIndex(null);
                                    }}
                                  >
                                    {p.name}
                                  </div>
                                ))}
                            </div>
                          )}
                          <input
                            className="input"
                            placeholder="Qty"
                            value={prod.qty}
                            onChange={(e) => {
                              const updated = [...form.sales];
                              updated[index].products[pIndex].qty =
                                e.target.value.replace(/[^0-9]/g, "");
                              setForm({ ...form, sales: updated });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3 className="text-sm font-semibold text-gray-700 mt-8 mb-3">
              Daily Activity
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Today Calls Made"
                name="calls"
                value={form.calls}
                onChange={(e) =>
                  setForm({
                    ...form,
                    calls: e.target.value.replace(/[^0-9,]/g, ""),
                  })
                }
              />
              <Input
                label="Today's Refund Amount"
                name="refund"
                value={form.refund}
                onChange={(e) =>
                  setForm({
                    ...form,
                    refund: e.target.value.replace(/[^0-9,]/g, ""),
                  })
                }
              />

              <Input
                label="Today's Sale (Auto Calculated)"
                value={`₹${todaySaleTotal.toLocaleString()}`}
                readOnly
              />

              <Input
                label="Remark"
                name="remark"
                value={form.remark}
                onChange={(e) =>
                  setForm({
                    ...form,
                    remark: e.target.value,
                  })
                }
                placeholder="Today's special note..."
              />
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ptDate: "",
                    piConfirmDate: "",
                    piCount: "",
                    saleCount: "",
                    currency: "INR",
                    calls: "",
                    sales: [],
                    pis: [],
                  })
                }
                className="px-5 py-2 border rounded-lg"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg"
              >
                {loading ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TL/ADMIN: ACCORDION FORM (DEFAULT CLOSED) ================= */}
      {isManager && (
        <div className="bg-white rounded-2xl shadow-sm max-w-6xl">
          {/* ACCORDION HEADER */}
          <button
            type="button"
            onClick={() => setOpenForm((p) => !p)}
            className="w-full flex justify-between items-center p-6 text-left"
          >
            <div>
              <h2 className="text-xl font-semibold">Today’s Work Entry</h2>
              <p className="text-sm text-gray-500">
                Fill daily sales & PI activity
              </p>
            </div>
            {role !== "ADMIN" && (
              <span className="text-indigo-600 font-medium me-10">
                {openForm ? "Close" : "Add New Entry"}
              </span>
            )}
          </button>

          {/* ACCORDION BODY */}
          {openForm && (
            <div className="border-t p-8 space-y-8">
              {isManager && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="label">Select Employee</label>
                    <select
                      className="input"
                      value={entryEmployeeId}
                      onChange={(e) => {
                        const emp = employees.find(
                          (u) => u.id === e.target.value,
                        );
                        setEntryEmployeeId(emp?.id || "");
                        setEntryEmployeeName(emp?.name || "");
                      }}
                    >
                      <option value="">-- Select Employee --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* ================= PI DATE + COUNT ================= */}
              <div className="grid md:grid-cols-2 gap-6">
                <Input
                  label="PI Date"
                  name="ptDate"
                  type="date"
                  value={form.ptDate}
                  onChange={handleChange}
                />

                <Input
                  label="No. of PI Created Today"
                  name="piCount"
                  value={form.piCount}
                  onChange={handlePiCountChange}
                />
              </div>

              {/* ================= PI DETAILS ================= */}
              {form.pis.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-gray-700">
                    PI Details
                  </h3>

                  <div className="space-y-3">
                    {form.pis.map((pi, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg border bg-gray-50 space-y-3"
                      >
                        <input
                          className="input"
                          placeholder={`PI Number ${index + 1}`}
                          value={pi.piNo}
                          onChange={(e) => {
                            const updated = [...form.pis];
                            updated[index].piNo = e.target.value;
                            setForm({ ...form, pis: updated });
                          }}
                        />

                        <input
                          className="input"
                          placeholder="Amount"
                          value={pi.amount}
                          onChange={(e) => {
                            const updated = [...form.pis];
                            updated[index].amount = e.target.value.replace(
                              /[^0-9,]/g,
                              "",
                            );
                            setForm({ ...form, pis: updated });
                          }}
                        />
                        <select
                          className="input"
                          value={pi.currency || "INR"}
                          onChange={(e) => {
                            const updated = [...form.pis];
                            updated[index].currency = e.target.value;
                            setForm({ ...form, pis: updated });
                          }}
                        >
                          <option value="INR">INR</option>
                          <option value="USD">USD</option>
                        </select>

                        <label className="label">No of Products</label>
                        <input
                          className="input mb-2"
                          value={pi.products?.length || ""}
                          onChange={(e) => {
                            const count =
                              Number(e.target.value.replace(/[^0-9]/g, "")) ||
                              0;

                            const updated = [...form.pis];

                            updated[index].products = Array.from(
                              { length: count },
                              (_, i) => ({
                                name: updated[index].products?.[i]?.name || "",
                                qty: updated[index].products?.[i]?.qty || "",
                              }),
                            );

                            setForm({ ...form, pis: updated });
                          }}
                        />

                        {pi.products?.map((prod, pIndex) => (
                          <div
                            key={pIndex}
                            className="flex gap-2 mb-2 relative"
                          >
                            <input
                              className="input flex-1"
                              placeholder={`Product ${pIndex + 1}`}
                              value={prod.name}
                              onChange={(e) => {
                                const updated = [...form.pis];
                                updated[index].products[pIndex].name =
                                  e.target.value;
                                setForm({ ...form, pis: updated });
                              }}
                              onFocus={() =>
                                setOpenProductIndex(`pi-emp-${index}-${pIndex}`)
                              }
                              onBlur={() =>
                                setTimeout(() => setOpenProductIndex(null), 150)
                              }
                            />
                            {openProductIndex ===
                              `pi-emp-${index}-${pIndex}` && (
                              <div className="absolute left-0 top-full z-30 bg-white border rounded-lg shadow w-full max-h-48 overflow-y-auto mt-1">
                                {inventory
                                  .filter((p) =>
                                    p.name
                                      .toLowerCase()
                                      .includes(
                                        (prod.name || "").toLowerCase(),
                                      ),
                                  )
                                  .slice(0, 10)
                                  .map((p) => (
                                    <div
                                      key={p.id}
                                      className="px-3 py-2 cursor-pointer hover:bg-indigo-50"
                                      onMouseDown={() => {
                                        const updated = [...form.pis];
                                        updated[index].products[pIndex].name =
                                          p.name;
                                        setForm({ ...form, pis: updated });
                                        setOpenProductIndex(null);
                                      }}
                                    >
                                      {p.name}
                                    </div>
                                  ))}
                              </div>
                            )}

                            <input
                              className="input w-28"
                              placeholder="Qty"
                              value={prod.qty}
                              onChange={(e) => {
                                const updated = [...form.pis];
                                updated[index].products[pIndex].qty =
                                  e.target.value.replace(/[^0-9]/g, "");
                                setForm({ ...form, pis: updated });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ================= SALE COUNT ================= */}
              <Input
                label="No of Sale Done Today"
                name="saleCount"
                value={form.saleCount}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "");
                  const count = Number(value || 0);

                  setForm((prev) => ({
                    ...prev,
                    saleCount: value, // ✅ STRING
                    sales: Array.from({ length: count }, (_, i) => ({
                      piNo: prev.sales[i]?.piNo || "",
                      amount: prev.sales[i]?.amount || "",
                      currency: prev.sales[i]?.currency || "INR",
                      products: Array.isArray(prev.sales[i]?.products)
                        ? prev.sales[i].products
                        : [{ name: "", qty: "" }],
                      piConfirmDate: prev.sales[i]?.piConfirmDate || "",
                    })),
                  }));
                }}
              />

              {/* ================= SALE DETAILS ================= */}
              {form.sales.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Sale Details
                  </h3>

                  <div className="space-y-3">
                    {form.sales.map((s, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg border bg-gray-50"
                      >
                        <input
                          type="date"
                          className="input"
                          value={s.piConfirmDate}
                          onChange={(e) => {
                            const updated = [...form.sales];
                            updated[index].piConfirmDate = e.target.value;
                            setForm({ ...form, sales: updated });
                          }}
                        />

                        <input
                          className="input"
                          placeholder="PI Number"
                          value={s.piNo}
                          onChange={(e) => {
                            const updated = [...form.sales];
                            updated[index].piNo = e.target.value;
                            setForm({ ...form, sales: updated });
                          }}
                        />

                        <input
                          className="input"
                          placeholder="Amount"
                          value={s.amount}
                          onChange={(e) => {
                            const updated = [...form.sales];
                            updated[index].amount = e.target.value.replace(
                              /[^0-9,]/g,
                              "",
                            );
                            setForm({ ...form, sales: updated });
                          }}
                        />
                        <input
                          className="input"
                          placeholder="Qty"
                          value={s.qty || ""}
                          onChange={(e) => {
                            const updated = [...form.sales];
                            updated[index].qty = e.target.value.replace(
                              /[^0-9]/g,
                              "",
                            );
                            setForm({ ...form, sales: updated });
                          }}
                        />

                        <select
                          className="input"
                          value={s.currency || "INR"}
                          onChange={(e) => {
                            const updated = [...form.sales];
                            updated[index].currency = e.target.value;
                            setForm({ ...form, sales: updated });
                          }}
                        >
                          <option value="INR">INR</option>
                          <option value="USD">USD</option>
                        </select>

                        <label className="label">No of Products</label>
                        <input
                          className="input mb-2"
                          value={s.products?.length || ""}
                          onChange={(e) => {
                            const count =
                              Number(e.target.value.replace(/[^0-9]/g, "")) ||
                              0;

                            const updated = [...form.sales];

                            updated[index].products = Array.from(
                              { length: count },
                              (_, i) => ({
                                name: updated[index].products?.[i]?.name || "",
                                qty: updated[index].products?.[i]?.qty || "",
                              }),
                            );

                            setForm({ ...form, sales: updated });
                          }}
                        />

                        {s.products?.map((prod, pIndex) => (
                          <div
                            key={pIndex}
                            className="grid grid-cols-2 gap-2 mb-2 relative"
                          >
                            <input
                              className="input"
                              placeholder={`Product ${pIndex + 1}`}
                              value={prod.name}
                              onChange={(e) => {
                                const updated = [...form.sales];
                                updated[index].products[pIndex].name =
                                  e.target.value;
                                setForm({ ...form, sales: updated });
                              }}
                              onFocus={() =>
                                setOpenProductIndex(`${index}-${pIndex}`)
                              }
                              onBlur={() =>
                                setTimeout(() => setOpenProductIndex(null), 150)
                              }
                            />
                            {openProductIndex ===
                              `sale-emp-${index}-${pIndex}` && (
                              <div className="absolute left-0 top-full z-30 bg-white border rounded-lg shadow w-full max-h-48 overflow-y-auto mt-1">
                                {inventory
                                  .filter((p) =>
                                    p.name
                                      .toLowerCase()
                                      .includes(
                                        (prod.name || "").toLowerCase(),
                                      ),
                                  )
                                  .slice(0, 10)
                                  .map((p) => (
                                    <div
                                      key={p.id}
                                      className="px-3 py-2 cursor-pointer hover:bg-indigo-50"
                                      onMouseDown={() => {
                                        const updated = [...form.sales];
                                        updated[index].products[pIndex].name =
                                          p.name;
                                        setForm({ ...form, sales: updated });
                                        setOpenProductIndex(null);
                                      }}
                                    >
                                      {p.name}
                                    </div>
                                  ))}
                              </div>
                            )}
                            <input
                              className="input"
                              placeholder="Qty"
                              value={prod.qty}
                              onChange={(e) => {
                                const updated = [...form.sales];
                                updated[index].products[pIndex].qty =
                                  e.target.value.replace(/[^0-9]/g, "");
                                setForm({ ...form, sales: updated });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ================= DAILY ACTIVITY ================= */}
              <div className="grid md:grid-cols-2 gap-6">
                <Input
                  label="Today Calls Made"
                  name="calls"
                  value={form.calls}
                  onChange={handleChange}
                />
                <Input
                  label="Today's Refund Amount"
                  name="refund"
                  value={form.refund}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      refund: e.target.value.replace(/[^0-9,]/g, ""),
                    })
                  }
                />

                {/* 🔥 SAME AS EMPLOYEE — AUTO CALCULATED */}
                <Input
                  label="Today's Sale (Auto Calculated)"
                  value={`₹${todaySaleTotal.toLocaleString()}`}
                  readOnly
                />
              </div>

              {/* ================= ACTION BUTTONS ================= */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ptDate: "",
                      piConfirmDate: "",
                      piCount: "",
                      saleCount: "",
                      currency: "INR",
                      calls: "",
                      sales: [],
                      pis: [],
                      remark: "",
                    })
                  }
                  className="px-5 py-2 border rounded-lg"
                >
                  Reset
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg"
                >
                  {loading ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/*  */}
      {/* ================= TABLE (ALWAYS VISIBLE) ================= */}
      <div className="bg-white rounded-2xl shadow-sm p-6 max-w-6xl">
        {/* <h3 className="text-lg font-semibold">Select Employee to Export Monthly Report</h3> */}
        <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
          {/* LEFT: EMPLOYEE DROPDOWN */}
          {/* <h3 className="text-lg font-semibold">Sales Entries</h3> */}
          <div className="flex items-center gap-2">
            {isManager && (
              <>
                <label className="text-sm font-medium whitespace-nowrap">
                  Pelase seelct employee, to Download monthly report
                </label>
                <select
                  className="input w-72 md:w-80"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  <option value="ALL">All</option>

                  {[...new Set(entries.map((e) => e.employeeName))].map(
                    (name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ),
                  )}
                </select>
              </>
            )}
          </div>

          {/* RIGHT: BUTTONS */}
          <div className="flex gap-2">
            <button
              onClick={exportToExcelSameUI}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
            >
              Export CSV
            </button>

            {isManager && (
              <button
                onClick={exportMonthlyReport}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
              >
                Monthly Report
              </button>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center mb-4"></div>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">No entries found.</p>
        ) : (
          <div className="max-h-[720px] overflow-y-auto border rounded-lg scroll-area">
            {isManager && (
              <div className="flex justify-between items-center mb-4 ml-3">
                <h3 className="ml-3"> Search Bar</h3>
                <input
                  type="text"
                  placeholder="Search by Name / PI No / Amount / Product / Calls"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input w-full md:w-96"
                />
              </div>
            )}

            <table className="w-full text-sm border-collapse">
              <tbody>
                {/* {entries.map((e, index) => ( */}
                {filteredTableEntries.map((e, index) => (
                  <tr key={e.id} className="border">
                    <td className="p-4 space-y-4">
                      {/* ✅ EMPLOYEE NAME HEADER */}
                      <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2">
                        <span className="text-sm font-semibold text-indigo-700">
                          👤 Employee:{" "}
                          {e.employeeName || "— Unknown Employee —"}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            Entry #{index + 1}
                          </span>

                          {role === "EMPLOYEE" &&
                            e.employeeId === employeeId && (
                              <button
                                onClick={() => {
                                  setEditId(e.id);

                                  setForm({
                                    ptDate: e.ptDate
                                      ? e.ptDate
                                          .toDate()
                                          .toISOString()
                                          .split("T")[0]
                                      : "",
                                    piCount: e.piCount || e.pis?.length || "",
                                    saleCount: e.sales?.length || "",
                                    calls: e.calls || "",
                                    remark: e.remark || "",
                                    pis: e.pis || [],
                                    sales: (e.sales || []).map((s) => ({
                                      ...s,
                                      products: Array.isArray(s.products)
                                        ? s.products
                                        : typeof s.products === "string"
                                          ? s.products
                                              .split(",")
                                              .map((item) => {
                                                const match =
                                                  item.match(/(.+)\((\d+)\)/);
                                                return match
                                                  ? {
                                                      name: match[1].trim(),
                                                      qty: Number(match[2]),
                                                    }
                                                  : {
                                                      name: item.trim(),
                                                      qty: 0,
                                                    };
                                              })
                                          : [],

                                      piConfirmDate: s.piConfirmDate
                                        ? s.piConfirmDate
                                            .toDate()
                                            .toISOString()
                                            .split("T")[0]
                                        : "",
                                    })),
                                  });

                                  // 🔥 YE LINE ADD KARO
                                  setTimeout(() => {
                                    formRef.current?.scrollIntoView({
                                      behavior: "smooth",
                                    });
                                  }, 100);
                                }}
                                className="text-xs px-3 py-1 bg-yellow-500 text-white rounded"
                              >
                                Edit
                              </button>
                            )}
                        </div>
                      </div>

                      {/* ================= PI ENTRY ================= */}
                      <div className="border rounded-lg">
                        <div className="grid grid-cols-2 bg-gray-100 font-semibold text-sm">
                          <div className="p-2 border-r">PI Date</div>
                          <div className="p-2">No. of PI Created</div>
                        </div>
                        <div className="grid grid-cols-2">
                          <div className="p-2 border-r">
                            {e.ptDate
                              ? e.ptDate.toDate().toLocaleDateString()
                              : "-"}
                          </div>
                          <div className="p-2">
                            {e.piCount || e.pis?.length || 0}
                          </div>
                        </div>
                      </div>

                      {/* ================= PI DETAILS ================= */}
                      <div className="border rounded-lg">
                        <div className="grid grid-cols-6 bg-gray-100 font-semibold text-sm">
                          <div className="p-2 border-r">PI No</div>
                          <div className="p-2 border-r">Amount</div>
                          <div className="p-2 border-r">Currency</div>
                          <div className="p-2">Products</div>
                          <div className="p-2">Qty</div>
                        </div>

                        {Array.isArray(e.pis) && e.pis.length > 0 ? (
                          e.pis.map((p, i) => (
                            <div key={i} className="grid grid-cols-6 border-t">
                              <div className="p-2 border-r">
                                {p.piNo || "-"}
                              </div>
                              <div className="p-2 border-r">
                                {p.currency === "USD" ? "$" : "₹"}
                                {Number(p.amount || 0).toLocaleString()}
                              </div>
                              <div className="p-2 border-r">
                                {p.currency || "INR"}
                              </div>
                              <div className="p-2">
                                {Array.isArray(p.products)
                                  ? p.products.map((prod, idx) => (
                                      <div key={idx}>{prod.name}</div>
                                    ))
                                  : "-"}
                              </div>
                              <div className="p-2">
                                {Array.isArray(p.products)
                                  ? p.products.map((prod, idx) => (
                                      <div key={idx}>{prod.qty}</div>
                                    ))
                                  : 0}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-2 text-center text-gray-500">
                            No PI
                          </div>
                        )}
                      </div>

                      {/* ================= SALE DETAILS ================= */}
                      <div className="border rounded-lg">
                        <div className="grid grid-cols-6 bg-gray-100 font-semibold text-sm">
                          <div className="p-2 border-r">Sale Confirm Date</div>
                          <div className="p-2 border-r">PI No</div>
                          <div className="p-2 border-r">Amount</div>
                          <div className="p-2 border-r">Currency</div>
                          <div className="p-2">Products</div>
                          <div className="p-2">Qty</div>
                        </div>

                        {e.sales?.length ? (
                          e.sales.map((s, i) => (
                            <div key={i} className="grid grid-cols-6 border-t">
                              <div className="p-2 border-r">
                                {s.piConfirmDate
                                  ? s.piConfirmDate
                                      .toDate()
                                      .toLocaleDateString()
                                  : "-"}
                              </div>
                              <div className="p-2 border-r">
                                {s.piNo || "-"}
                              </div>
                              <div className="p-2 border-r">
                                {s.currency === "USD" ? "$" : "₹"}
                                {Number(s.amount || 0).toLocaleString()}
                              </div>
                              <div className="p-2 border-r">{s.currency}</div>
                              <div className="p-2">
                                {Array.isArray(s.products)
                                  ? s.products.map((prod, idx) => (
                                      <div key={idx}>{prod.name}</div>
                                    ))
                                  : "-"}
                              </div>

                              <div className="p-2">
                                {Array.isArray(s.products)
                                  ? s.products.map((prod, idx) => (
                                      <div key={idx}>{prod.qty}</div>
                                    ))
                                  : 0}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-2 text-center text-gray-500">
                            No Sale
                          </div>
                        )}
                      </div>

                      {/* ================= DAILY ACTIVITY ================= */}
                      <div className="border rounded-lg">
                        <div className="grid grid-cols-2 bg-gray-100 font-semibold text-sm">
                          <div className="p-2 border-r">Today Calls Made</div>
                          <div className="p-2">Total Sale Today</div>
                        </div>
                        <div className="grid grid-cols-2">
                          <div className="p-2 border-r">{e.calls || 0}</div>
                          <div className="p-2 font-semibold">
                            {e.currency === "USD" ? "$" : "₹"}
                            {Number(e.saleAmount || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {e.remark && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="font-semibold text-sm text-yellow-800 mb-1">
                            Remark:
                          </div>
                          <div className="text-sm text-yellow-900">
                            {e.remark}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style>
        {`
            /* ===== Custom Scrollbar ===== */
            .scroll-area::-webkit-scrollbar {
              width: 6px;
            }
            .scroll-area::-webkit-scrollbar-thumb {
              background-color: #c7c7c7;
              border-radius: 10px;
            }
            .scroll-area::-webkit-scrollbar-track {
              background: transparent;
            }
            `}
      </style>
    </div>
  );
}

const Input = ({
  label,
  name,
  value,
  onChange,
  Icon,
  type = "text",
  readOnly = false,
}) => (
  <div>
    <label className="label flex items-center gap-1">
      {Icon && <Icon className="w-4 h-4" />} {label}
    </label>
    <input
      name={name}
      value={value}
      onChange={readOnly ? undefined : onChange}
      type={type}
      readOnly={readOnly}
      className={`input ${readOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
    />
  </div>
);

const SummaryCard = ({ title, value, sub, color }) => (
  <div className={`rounded-xl shadow p-5 border-2 ${color}`}>
    <p className="text-sm text-gray-500">{title}</p>
    <p className="text-2xl font-bold mt-1">{value}</p>
    <p className="text-xs text-gray-500 mt-1">{sub}</p>
  </div>
);
