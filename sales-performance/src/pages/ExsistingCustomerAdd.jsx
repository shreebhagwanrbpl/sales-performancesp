import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import AddCustomerModal from "../components/AddCustomerDetailModal";
import UpdateCustomerModal from "../components/UpdateCustomerDetail";
import { getAuth } from "firebase/auth";

const isDomesticClient = (country = "") => {
  const c = country.toLowerCase().trim();
  const INDIA_KEYWORDS = ["india", "bharat", "republic of india", "in"];

  return INDIA_KEYWORDS.some((k) => c === k || c.includes(k));
};

const DEFAULT_CYCLE_DAYS = 4;
const STATUS = {
  NEW: "NEW",
  FOLLOWUP: "FOLLOWUP",
  PREMIUM: "PREMIUM",
  NO_RESPONSE: "NO_RESPONSE",
  NOT_INTERESTED: "NOT_INTERESTED",
  VOID: "VOID",
  DND: "DND",
  TRASH: "TRASH", // 🔥 ADD THIS
};

// tabs
const TAB = {
  ACTIVE: "ACTIVE",
  ASSIGN: "ASSIGN",
  PREMIUM: "PREMIUM",
  FOLLOWUP: "FOLLOWUP",
  VOID: "VOID",
  DND: "DND",
  TRASH: "TRASH",
  GROUPS: "GROUPS",
};

// quick helpers
const cn = (...a) => a.filter(Boolean).join(" ");
const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");
const cleanMobile = (v) => {
  const d = onlyDigits(v);
  // keep last 10 digits (India)
  return d.length > 10 ? d.slice(-10) : d;
};
const stickyCol = (left) => `sticky left-[${left}px] bg-white z-20`;

const safeStr = (v) => String(v ?? "").trim();

// 🔥 SAFE datetime helper (Firestore Timestamp / Date / string)
const toInputDateTime = (val) => {
  if (!val) return "";

  // Firestore Timestamp
  if (val?.toDate) {
    const d = val.toDate();
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
  }

  // JS Date
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? "" : val.toISOString().slice(0, 16);
  }

  // number (ms)
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
  }

  // string
  const d = new Date(val);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
};

// ✅ Excel date (mm/dd/yy OR serial OR string) → ISO
const parseExcelDate = (val) => {
  if (!val) return "";

  // Excel serial number
  if (typeof val === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + val * 86400000);
    return date.toISOString();
  }

  // mm/dd/yy OR mm/dd/yyyy
  if (typeof val === "string") {
    const parts = val.split("/");
    if (parts.length === 3) {
      let [mm, dd, yy] = parts.map((p) => p.trim());
      if (yy.length === 2) yy = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
      const d = new Date(`${yy}-${mm}-${dd}`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    const d = new Date(val);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  }

  return "";
};
function sortAZ(arr, key = "name") {
  return [...arr].sort((a, b) =>
    (a[key] || "").toLowerCase().localeCompare((b[key] || "").toLowerCase()),
  );
}
const normalizeRow = (row) => {
  const clean = {};
  Object.keys(row).forEach((k) => {
    const key = k.replace(/\s+/g, " ").trim();
    clean[key] = row[k];
  });
  return clean;
};

const formatDateTime = (val) => {
  if (!val) return "—";

  // Firestore Timestamp
  if (val?.toDate) {
    return val.toDate().toLocaleString();
  }

  // JS Date
  if (val instanceof Date) {
    return val.toLocaleString();
  }

  // string / number
  const d = new Date(val);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

/* ===================== PARSE IMPORT ===================== */
function parseSheetToCustomers(rows) {
  console.log("🔥 parseSheetToCustomers CALLED", rows);
  const map = new Map();

  for (const raw of rows) {
    const r = normalizeRow(raw);
    const name =
      safeStr(r.name) || safeStr(r.Name) || safeStr(r["Customer Name"]);

    const mobile =
      cleanMobile(r.mobile) ||
      cleanMobile(r.Mobile) ||
      cleanMobile(r["Contact No"]);

    if (!mobile || mobile.length < 10) continue;

    const productCategory =
      safeStr(r["Product Category"]) || safeStr(r.category);

    const district =
      safeStr(r.District) || safeStr(r["District Name"]) || safeStr(r.DISTRICT);

    const area = safeStr(r.Area);

    const salesPerson =
      safeStr(r["Sales Person"]) ||
      safeStr(r["Sales Person Name"]) ||
      safeStr(r["Sales Person "]) || // trailing space
      safeStr(r.SalesPerson);

    // const totalAmount =
    //   Number(String(r["Total Amount"] || "").replace(/[^0-9.-]/g, "")) || 0;
    // const totalAmount =
    //   Number(
    //     String(
    //       r["Total Amount"] || r.Amount || r["Net Amount"] || r.Total || "",
    //     ).replace(/[^0-9.-]/g, ""),
    //   ) || 0;
    const totalAmount = parseAmount(
      r["Total Amount"] ||
        r["TOTAL AMOUNT"] ||
        r["Total amount"] ||
        r.Amount ||
        r["Net Amount"] ||
        r.Total,
    );

    // const purchaseDate = safeStr(r["Purchase Date"]) || safeStr(r.Date);
    // const purchaseDate =
    //   r["Purchase Date"] || r["Invoice Date"] || r.Date || "";
    const purchaseDate = parseExcelDate(
      r["Purchase Date"] || r["Invoice Date"] || r.Date,
    );

    // const group = safeStr(r.Group);
    const group =
      safeStr(r.Group) ||
      safeStr(r["Group Name"]) ||
      safeStr(r["Customer Group"]);

    // const sellerCompanyName = safeStr(r["Seller Company Name"]);
    const sellerCompanyName =
      safeStr(r["Seller Company Name"]) ||
      safeStr(r.Seller) ||
      safeStr(r.Company);

    // const salesType = safeStr(r["Sales Type"]);
    const salesType =
      safeStr(r["Sales Type"]) ||
      safeStr(r["Order Type"]) ||
      safeStr(r["Sale Type"]);

    // const source = safeStr(r.Source);
    const source =
      safeStr(r.Source) ||
      safeStr(r["Lead Source"]) ||
      safeStr(r["Source Name"]);

    const product = safeStr(r.product) || safeStr(r.Product);

    const purchase = product
      ? {
          product,
          price: totalAmount ?? null,
          date: purchaseDate,
        }
      : null;

    if (!map.has(mobile)) {
      map.set(mobile, {
        name: name || "Unknown",
        mobile,

        city: safeStr(r.City),
        district,
        area,
        state: safeStr(r.State),
        country: safeStr(r.Country),
        pincode: safeStr(r.Pincode),
        address: safeStr(r.Address),

        productCategory,
        salesPerson,
        totalAmount,
        purchaseDate,
        group,
        sellerCompanyName,
        salesType,
        source,

        purchases: purchase ? [purchase] : [],
      });
    } else {
      const existing = map.get(mobile);
      if (purchase) existing.purchases.push(purchase);
      map.set(mobile, existing);
    }
  }

  return Array.from(map.values());
}

const nowMs = () => Date.now();
const addDaysMs = (days) => days * 24 * 60 * 60 * 1000;

// status badge style
const statusBadge = (s) => {
  switch (s) {
    case STATUS.PREMIUM:
      return "bg-green-50 text-green-700 ring-green-200";
    case STATUS.FOLLOWUP:
      return "bg-yellow-50 text-yellow-700 ring-yellow-200";
    case STATUS.NO_RESPONSE:
      return "bg-slate-50 text-slate-700 ring-slate-200";
    case STATUS.NOT_INTERESTED:
      return "bg-red-50 text-red-700 ring-red-200";
    case STATUS.VOID:
      return "bg-zinc-50 text-zinc-700 ring-zinc-200";
    case STATUS.DND:
      return "bg-rose-50 text-rose-700 ring-rose-200";
    default:
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";
  }
};

const rowTint = (s) => {
  if (s === STATUS.PREMIUM) return "bg-green-50/30";
  if (s === STATUS.DND || s === STATUS.VOID) return "bg-zinc-50/60";
  return "";
};

// role from localStorage
const uid = localStorage.getItem("uid") || "";

const currentName = localStorage.getItem("employeeName") || "";

// ====== ADV FILTER HELPERS ======
const norm = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

const nnum = (v) => {
  const num = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? null : num;
};

const toMs = (v) => {
  if (!v) return null;
  if (typeof v === "number") return v;
  if (v?.toMillis) return v.toMillis();
  if (v?.seconds) return v.seconds * 1000;
  const d = Date.parse(String(v));
  return isNaN(d) ? null : d;
};

const getPurchases = (c) => (Array.isArray(c?.purchases) ? c.purchases : []);

const getProductsText = (c) => {
  const ps = getPurchases(c);
  const products = ps.map((p) => norm(p?.product)).filter(Boolean);
  return products.join(" ");
};

const getTotalSpent = (c) => {
  const ps = getPurchases(c);
  return ps.reduce((sum, p) => sum + (nnum(p?.price) || 0), 0);
};

const getLastPurchaseMs = (c) => {
  const ps = getPurchases(c);
  let best = null;
  for (const p of ps) {
    const ms = toMs(p?.date);
    if (ms && (!best || ms > best)) best = ms;
  }
  return best; // null if not found
};

const locationOk = (c, adv) => {
  if (!adv?.locationType || adv.locationType === "ALL") return true;

  const v = String(adv.locationValue || "")
    .toLowerCase()
    .trim();
  if (!v) return true;

  if (adv.locationType === "STATE")
    return (c.state || "").toLowerCase().includes(v);

  if (adv.locationType === "COUNTRY")
    return (c.country || "").toLowerCase().includes(v);

  if (adv.locationType === "PINCODE")
    return String(c.pincode || "").includes(v);

  return true;
};

const getStrField = (c, key) => norm(c?.[key]);

const parseAmount = (val) => {
  if (val === null || val === undefined || val === "") return null;

  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;

  const num = Number(cleaned);
  return isNaN(num) ? null : num;
};

// const toDateMs = (val) => {
//   if (!val) return null;
//   if (typeof val === "number") {
//     const d = XLSX.SSF.parse_date_code(val);
//     if (!d) return null;
//     return new Date(d.y, d.m - 1, d.d).getTime();
//   }
//   const s = String(val).trim();
//   const parts = s.split(/[\/\-\.]/).map((x) => Number(x));
//   if (parts.length !== 3) return null;
//   const [dd, mm, yyyy] = parts;
//   if (!yyyy || !mm || !dd) return null;
//   return new Date(yyyy, mm - 1, dd).getTime();
// };
const toDateMs = (val) => {
  if (!val) return null;

  // Excel serial
  if (typeof val === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    return excelEpoch.getTime() + val * 86400000;
  }

  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.getTime();
};

/* ===================== MAIN COMPONENT ===================== */
export default function ExistingCustomerDetail() {
  const MAX_TOTAL_PER_EMPLOYEE = 150;
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const getTotalCustomerCountForEmployee = (empId) =>
    customers.filter(
      (c) => c.assignedEmployeeId === empId && c.status !== STATUS.TRASH,
    ).length;
  const [tab, setTab] = useState(TAB.ACTIVE);
  const [tlFilter, setTlFilter] = useState("ALL"); // TL id
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [cycleDays, setCycleDays] = useState(DEFAULT_CYCLE_DAYS);
  // employees list (simple local list; you can fetch from your users collection later)
  const [employees, setEmployees] = useState([]);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [tls, setTls] = useState([]);
  const [loading, setLoading] = useState(true);
  // ===== FOLLOW-UP STATES =====
  const [followUpMode, setFollowUpMode] = useState("LATER");
  // LATER | NOT_REQUIRED
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const MAX_ASSIGN_LIMIT = 150;
  const [customers, setCustomers] = useState([]);
  const getEmployeeAssignedCount = (empId) => {
    return customers.filter(
      (c) => c.assignedEmployeeId === empId && c.status !== STATUS.TRASH,
    ).length;
  };
  const [doFilter, setDoFilter] = useState("");
  const [doNotFilter, setDoNotFilter] = useState("");
  // 🔥 Highest rate / minimum price filter
  // top-level states ke saath
  const [openContactId, setOpenContactId] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editFollowUp, setEditFollowUp] = useState(false);
  const [adv, setAdv] = useState({
    locationType: "ALL",
    locationValue: "",
    sortBy: "createdAt",
    sortDir: "desc",
    assignedTo: "ALL",
    eligible: "ALL",
    state: "ALL",
    country: "ALL",
  });

  /* ========= DROPDOWN OPTIONS (STATE / COUNTRY) ========= */
  const stateOptions = useMemo(() => {
    const set = new Set();
    customers.forEach((c) => {
      const s = (c.state || "").trim();
      if (s) set.add(s);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [customers]);

  const countryOptions = useMemo(() => {
    const set = new Set();
    customers.forEach((c) => {
      const s = (c.country || "").trim();
      if (s) set.add(s);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [customers]);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [detail, setDetail] = useState(null); // customer object
  const [toast, setToast] = useState({ show: false, type: "info", msg: "" });
  // 🔥 GROUP STATES
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);

  const [assignLogs, setAssignLogs] = useState([]);
  const tableScrollRef = useRef(null);

  // const ALL_COLUMNS = [
  //   { key: "name", label: "Customer" },
  //   { key: "city", label: "City" },
  //   { key: "mobile", label: "Mobile" },
  //   { key: "product", label: "Product" },
  //   { key: "country", label: "Country" },
  //   { key: "status", label: "Status" },
  //   { key: "tl", label: "Owner TL" },
  //   { key: "employee", label: "Employee" },
  // ];
  // const ALL_COLUMNS = [
  //   { key: "name", label: "Customer" },
  //   { key: "email", label: "Email" },
  //   { key: "mobile", label: "Mobile" },
  //   { key: "product", label: "Product" },
  //   { key: "productGroup", label: "Tags" },
  //   { key: "category", label: "Product Category" },
  //   { key: "clientType", label: "Client Type" },
  //   { key: "city", label: "City" },
  //   { key: "country", label: "Country" },
  //   { key: "salesPerson", label: "Sales Person" },
  //   { key: "status", label: "Status" },
  //   { key: "tl", label: "Owner TL" },
  //   { key: "employee", label: "Employee" },
  // ];

  const ALL_COLUMNS = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "mobile", label: "Mobile" },
    { key: "product", label: "Product" },
    { key: "tags", label: "Tags" },
    { key: "category", label: "Product Category" },
    { key: "clientType", label: "Client Type" },
    { key: "city", label: "City" },
    { key: "district", label: "District" },
    { key: "state", label: "State" },
    { key: "pincode", label: "Pincode" },
    { key: "area", label: "Area" },
    { key: "country", label: "Country" },
    { key: "address", label: "Address" },
    { key: "salesPerson", label: "Sales Person" },
    { key: "status", label: "Status" },
    { key: "tl", label: "Owner TL" },
    { key: "employee", label: "Employee" },
    { key: "totalAmount", label: "Total Amount" },
    { key: "purchaseDate", label: "Purchase Date" },
    { key: "group", label: "Group" },
    { key: "sellerCompanyName", label: "Seller Company Name" },
    { key: "salesType", label: "Sales Type" },
    { key: "source", label: "Source" },
  ];

  const parseFilterKeys = (txt) =>
    txt
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

  const visibleColumns = useMemo(() => {
    const doKeys = parseFilterKeys(doFilter);
    const doNotKeys = parseFilterKeys(doNotFilter);

    if (doKeys.length) {
      return ALL_COLUMNS.filter(
        (c) => doKeys.includes(c.key) || c.key === "name",
      );
    }

    if (doNotKeys.length) {
      return ALL_COLUMNS.filter(
        (c) => !doNotKeys.includes(c.key) || c.key === "name",
      );
    }

    return ALL_COLUMNS;
  }, [doFilter, doNotFilter]);

  useEffect(() => {
    if (search) {
      setDoFilter("");
      setDoNotFilter("");
    }
  }, [search]);

  const getProductTags = (c) => {
    const ps = c.purchases || [];
    const words = ps
      .flatMap((p) =>
        String(p.product || "")
          .toLowerCase()
          .split(" "),
      )
      .filter(Boolean);

    return Array.from(new Set(words));
  };

  const hasMinAmount = (customer, min) => {
    if (!min) return true;
    const amt = Number(min);
    if (isNaN(amt)) return true;

    return (customer.purchases || []).some((p) => Number(p?.price || 0) >= amt);
  };

  const fileRef = useRef(null);
  const [role, setRole] = useState("NA");
  const [tlId, setTlId] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("role") || "NA");
    setTlId(localStorage.getItem("tlId") || "");
  }, []);

  const isAdmin = role === "ADMIN";

  useEffect(() => {
    if (role === "TL") {
      setTlFilter("ALL");
    }
  }, [role]);

  const isTL = role === "TL" || role === "ADMIN";

  /* ========= TOAST ========= */
  const showToast = (msg, type = "info") => {
    setToast({ show: true, type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(
      () => setToast({ show: false, type: "info", msg: "" }),
      2200,
    );
  };

  /* ========= FIRESTORE SUBSCRIBE ========= */
  useEffect(() => {
    if (!role || !uid) return;
    setLoading(true);

    const qRef = query(
      collection(db, "existingCustomers"),
      orderBy("createdAt", "desc"),
      limit(2000),
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // console.log("🔥 CUSTOMERS FROM DB:", arr);
      setCustomers(arr);
      setLoading(false);
    });
    return () => unsub();
  }, [role, uid]);

  useEffect(() => {
    if (tab !== TAB.ASSIGN) return;

    const q = query(
      collection(db, "assignLogs"),
      orderBy("createdAt", "desc"),
      limit(200),
    );

    const unsub = onSnapshot(q, (snap) => {
      setAssignLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [tab]);

  // Employees Firestore query
  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "EMPLOYEE"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      // console.log("ALL EMPLOYEES 🔥", list);
      setEmployees(list);
    });

    return () => unsub();
  }, []);

  /* ========= DERIVED LISTS ========= */
  const PRODUCT_GROUP_MAP = {
    finecare: "FinCare",
    horiba: "Horiba",
    erba: "Erba",
    maglumi: "Maglumi",
    hematology: "Hematology",
    agappe: "Agappe",
    mindray: "Mindray",
    abbott: "Abbott",
  };
  const getProductGroups = (customer) => {
    const groups = new Set();

    (customer.purchases || []).forEach((p) => {
      const name = (p.product || "").toLowerCase();

      Object.keys(PRODUCT_GROUP_MAP).forEach((key) => {
        if (name.includes(key)) {
          groups.add(PRODUCT_GROUP_MAP[key]);
        }
      });
    });

    return Array.from(groups);
  };
  const getSearchText = (c) => {
    const products = (c.purchases || []).map((p) => p.product).join(" ");

    const productGroups = getProductGroups(c).join(" ");

    return [
      c.name,
      c.mobile,
      c.city,
      c.country,
      c.clientType,
      products,
      productGroups,
    ]
      .join(" ")
      .toLowerCase();
  };

  // const baseFiltered = useMemo(() => {
  //   return customers.filter((c) => {
  //     // TAB filters
  //     if (
  //       tab === TAB.ACTIVE &&
  //       [STATUS.VOID, STATUS.DND, STATUS.TRASH].includes(c.status)
  //     )
  //       return false;

  //     if (tab === TAB.PREMIUM && c.status !== STATUS.PREMIUM) return false;
  //     if (tab === TAB.VOID && c.status !== STATUS.VOID) return false;
  //     if (tab === TAB.DND && c.status !== STATUS.DND) return false;
  //     if (tab === TAB.TRASH && c.status !== STATUS.TRASH) return false;

  //     // 🔐 EMPLOYEE sees only assigned
  //     if (role === "EMPLOYEE") {
  //       if (c.assignedEmployeeId !== uid) return false;
  //     }

  //     // 🔥 TL / ADMIN → hide assigned customers
  //     if (role !== "EMPLOYEE" && !!c.assignedEmployeeId) return false;

  //     // TL filter
  //     if (role === "ADMIN" && tlFilter !== "ALL" && c.currentTLId !== tlFilter)
  //       return false;

  //     // Search
  //     if (search) {
  //       const s = search.toLowerCase().trim();
  //       if (!getSearchText(c).includes(s)) return false;
  //     }

  //     return true;
  //   });
  // }, [customers, tab, statusFilter, search, tlFilter, role, uid]);

  const baseFiltered = useMemo(() => {
    return customers.filter((c) => {
      /* ================= TAB FILTER ================= */

      if (tab === TAB.ACTIVE) {
        if ([STATUS.VOID, STATUS.DND, STATUS.TRASH].includes(c.status))
          return false;
      }

      if (tab === TAB.PREMIUM && c.status !== STATUS.PREMIUM) return false;
      if (tab === TAB.FOLLOWUP && c.status !== STATUS.FOLLOWUP) return false;
      if (tab === TAB.VOID && c.status !== STATUS.VOID) return false;
      if (tab === TAB.DND && c.status !== STATUS.DND) return false;
      if (tab === TAB.TRASH && c.status !== STATUS.TRASH) return false;

      /* ================= ROLE VISIBILITY ================= */

      // EMPLOYEE → sirf apne assigned
      if (role === "EMPLOYEE") {
        if (c.assignedEmployeeId !== uid) return false;
      }

      // TL / ADMIN
      if (role !== "EMPLOYEE") {
        // 🔥 ASSIGNMENT FILTER SIRF ACTIVE TAB ME
        if (tab === TAB.ACTIVE && !!c.assignedEmployeeId) return false;
      }

      /* ================= TL FILTER ================= */
      if (role === "ADMIN" && tlFilter !== "ALL" && c.currentTLId !== tlFilter)
        return false;

      /* ================= SEARCH ================= */
      if (search) {
        const s = search.toLowerCase().trim();
        if (!getSearchText(c).includes(s)) return false;
      }

      return true;
    });
  }, [customers, tab, search, tlFilter, role, uid]);

  const filtered = useMemo(() => {
    const list = baseFiltered.filter((c) => {
      if (!hasMinAmount(c, minAmount)) return false;
      if (!locationOk(c, adv)) return false;
      return true;
    });

    return sortAZ(list, "name");
  }, [baseFiltered, minAmount, adv]);

  // 🔢 Assigned / Available counts (for table header)
  const assignedCount = useMemo(() => {
    return customers.filter((c) => c.assignedEmployeeId).length;
  }, [customers]);

  const availableCount = useMemo(() => {
    return filtered.length;
  }, [filtered]);

  const trashCount = useMemo(() => {
    return customers.filter((c) => c.status === STATUS.TRASH).length;
  }, [customers]);
  // 🔥 IMPORT HISTORY (latest + previous)
  const latestImport = useMemo(() => {
    const withImport = customers.filter((c) => c.importedAt?.toDate);

    if (withImport.length === 0) return null;

    // 🔥 sabse latest importedAt
    const latest = withImport.reduce((a, b) =>
      a.importedAt.toDate() > b.importedAt.toDate() ? a : b,
    );

    return {
      importedAt: latest.importedAt.toDate(),
      importedByName: latest.importedByName || "—",
      importedByRole: latest.importedByRole || "",
    };
  }, [customers]);

  const dashboardBase = useMemo(() => {
    if (role === "EMPLOYEE") {
      return customers.filter((c) => c.assignedEmployeeId === uid);
    }
    return customers;
  }, [customers, role, uid]);

  const stats = useMemo(() => {
    const list = dashboardBase;

    const total = list.length;
    const premium = list.filter((c) => c.status === STATUS.PREMIUM).length;
    const follow = list.filter((c) => c.status === STATUS.FOLLOWUP).length;
    const voids = list.filter((c) => c.status === STATUS.VOID).length;
    const dnd = list.filter((c) => c.status === STATUS.DND).length;
    const active = total - voids - dnd;

    return { total, premium, follow, voids, dnd, active };
  }, [dashboardBase]);

  /* ========= SELECTION ========= */
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleExport = () => {
    const exportList =
      selectedIds.size > 0
        ? filtered.filter((c) => selectedIds.has(c.id))
        : filtered;

    if (exportList.length === 0) {
      showToast("No data to export ❌", "error");
      return;
    }

    // 🔹 build rows for excel
    const rows = exportList.map((c, i) => ({
      "#": i + 1,
      Name: c.name || "",
      Mobile: c.mobile || "",
      City: c.city || "",
      Country: c.country || "",
      Status: c.status || "",
      "Owner TL": c.currentTLName || "",
      Employee: c.assignedEmployeeName || "",
      "Total Amount": Number(c.totalAmount || 0),
      Products: (c.purchases || []).map((p) => p.product).join(", "),
    }));

    // 🔹 create sheet
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");

    // 🔹 filename
    const fileName =
      selectedIds.size > 0
        ? `customers_selected_${new Date().toISOString().slice(0, 10)}.xlsx`
        : `customers_all_${new Date().toISOString().slice(0, 10)}.xlsx`;

    // 🔥 THIS LINE WAS MISSING
    XLSX.writeFile(wb, fileName);

    showToast(
      selectedIds.size > 0
        ? `Exported ${selectedIds.size} customers ✅`
        : `Exported ${exportList.length} customers ✅`,
      "success",
    );
  };

  // const selectAllVisible = () => {
  //   setSelectedIds((prev) => {
  //     const n = new Set(prev);
  //     const ids = filtered.map((c) => c.id);
  //     const allSelected = ids.every((id) => n.has(id));
  //     if (allSelected) {
  //       ids.forEach((id) => n.delete(id));
  //     } else {
  //       ids.forEach((id) => n.add(id));
  //     }
  //     return n;
  //   });
  // };
  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const n = new Set(prev);

      // ❌ DND + VOID ko exclude
      const ids = filtered
        .filter((c) => c.status !== STATUS.DND && c.status !== STATUS.VOID)
        .map((c) => c.id);

      const allSelected = ids.every((id) => n.has(id));

      if (allSelected) {
        ids.forEach((id) => n.delete(id));
      } else {
        ids.forEach((id) => n.add(id));
      }

      return n;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  /* ========= CYCLE ELIGIBILITY ========= */
  const isForwardEligible = (c) => {
    // eligible only after nextEligibleAt (ms or Firestore timestamp-like)
    const next = c.nextEligibleAt;
    if (!next) return true; // if not set, allow (safe)
    const ms =
      typeof next === "number"
        ? next
        : next?.toMillis
          ? next.toMillis()
          : next?.seconds
            ? next.seconds * 1000
            : null;
    if (!ms) return true;
    return nowMs() >= ms;
  };

  /* ========= CRUD ACTIONS ========= */
  const updateStatus = async (c, newStatus) => {
    try {
      await updateDoc(doc(db, "existingCustomers", c.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      showToast("Updated ✅", "success");
    } catch (e) {
      console.error(e);
      showToast("Update failed ❌", "error");
    }
  };

  const forwardToNextTL = async (c) => {
    try {
      if (!isTL) return showToast("Only TL/Admin can forward", "error");
      if (!isForwardEligible(c))
        return showToast(
          "The customer can be forwarded only after the cycle is completed.",
          "error",
        );
      if (c.status === STATUS.PREMIUM)
        return showToast(
          "Premium customers cannot be forwarded (locked)",
          "error",
        );
      if ([STATUS.VOID, STATUS.DND].includes(c.status))
        return showToast("VOID/DND customers cannot be forwarded.", "error");
      const allTLs = [...tls].sort(
        (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
      );
      const idx = allTLs.findIndex((t) => t.id === c.currentTLId);
      if (idx === -1 || allTLs.length === 0) {
        return showToast("Next TL not found", "error");
      }
      const nextTL = allTLs[(idx + 1) % allTLs.length];

      // start new cycle for next TL
      const startMs = nowMs();
      const eligibleAt =
        startMs + addDaysMs(Number(cycleDays) || DEFAULT_CYCLE_DAYS);
      const history = Array.isArray(c.ownerHistory) ? c.ownerHistory : [];
      const nextHistory = [
        ...history,
        {
          fromTLId: c.currentTLId || "",
          fromTLName: c.currentTLName || "",
          toTLId: nextTL.id,
          toTLName: nextTL.name,
          movedBy: currentName || role || "SYSTEM",
          movedAt: new Date().toISOString(),
          reason: "cycle-forward",
        },
      ];
      // const allTLs = tls.sort((a, b) => a.createdAt - b.createdAt);
      // const index = allTLs.findIndex((t) => t.id === c.currentTLId);
      // const nextTL = allTLs[(index + 1) % allTLs.length];

      await updateDoc(doc(db, "existingCustomers", c.id), {
        currentTLId: nextTL.id,
        currentTLName: nextTL.name,

        ownerHistory: [
          ...(c.ownerHistory || []),
          {
            fromTLId: c.currentTLId,
            fromTLName: c.currentTLName,
            toTLId: nextTL.id,
            toTLName: nextTL.name,
            movedBy: currentName,
            movedAt: new Date().toISOString(),
            reason: "cycle-forward",
          },
        ],

        cycleStartAt: nowMs(),
        nextEligibleAt: nowMs() + addDaysMs(cycleDays),
        updatedAt: serverTimestamp(),
      });

      showToast(`Forwarded → ${nextTL.name} ✅`, "success");
    } catch (e) {
      console.error(e);
      showToast("Forward failed ❌", "error");
    }
  };

  const bulkAssignToEmployee = async () => {
    if (!isTL) {
      showToast("Only TL/Admin can assign customers", "error");
      return;
    }

    if (!assignEmployeeId)
      return showToast("Please select an employee", "error");

    if (selectedIds.size === 0)
      return showToast("Please select at least one customer.", "error");

    // 🔥 ADD THIS BLOCK (IMPORTANT)
    const alreadyAssigned = customers.filter(
      (c) => c.assignedEmployeeId === assignEmployeeId,
    ).length;

    if (alreadyAssigned + selectedIds.size > MAX_PER_EMPLOYEE) {
      showToast(
        `Cannot assign more than ${MAX_PER_EMPLOYEE} customers to one employee`,
        "error",
      );
      return;
    }
    const totalExisting = getTotalCustomerCountForEmployee(assignEmployeeId);

    const totalAfterAssign = totalExisting + selectedIds.size;

    if (totalAfterAssign > MAX_TOTAL_PER_EMPLOYEE) {
      const allowed = MAX_TOTAL_PER_EMPLOYEE - totalExisting;

      showToast(
        allowed <= 0
          ? `❌ Employee ke paas already ${totalExisting} customers hain.
VOID / DND delete karoge tabhi naye assign honge.`
          : `❌ Sirf ${allowed} customers hi assign ho sakte hain.
Employee ke paas already ${totalExisting} customers hain.`,
        "error",
      );
      return;
    }

    try {
      setAssigning(true);
      const assignee =
        employees.find((e) => e.id === assignEmployeeId) ||
        tls.find((t) => t.id === assignEmployeeId);
      if (!assignee && assignEmployeeId === uid) {
        assignee = {
          id: uid,
          name: currentName,
          role: "TL",
        };
      }
      if (!assignee) {
        showToast("Invalid assignee", "error");
        return;
      }

      const batch = writeBatch(db);

      selectedIds.forEach((id) => {
        batch.update(doc(db, "existingCustomers", id), {
          assignedEmployeeId: assignee.id,
          assignedEmployeeName: assignee.name,
          assignedRole: assignee.role || "EMPLOYEE",
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      // await addDoc(collection(db, "assignLogs"), {
      //   assignedById: uid,
      //   assignedByName: currentName,
      //   assignedToId: assignee.id,
      //   assignedToName: assignee.name,
      //   totalCustomers: selectedIds.size,
      //   createdAt: serverTimestamp(),
      // });

      const assignedCustomers = customers
        .filter((c) => selectedIds.has(c.id))
        .map((c) => ({
          id: c.id,
          name: c.name,
          mobile: c.mobile,
        }));

      await addDoc(collection(db, "assignLogs"), {
        assignedById: uid,
        assignedByName: currentName,

        assignedToId: assignee.id,
        assignedToName: assignee.name,

        totalCustomers: assignedCustomers.length,
        customers: assignedCustomers, // 🔥 IMPORTANT

        createdAt: serverTimestamp(),
      });

      showToast("Assigned successfully ✅", "success");
      clearSelection();
      setAssignEmployeeId("");
    } catch (e) {
      console.error(e);
      showToast("Assign failed ❌", "error");
    } finally {
      setAssigning(false);
    }
  };

  /* ========= IMPORT ========= */
  const openFilePicker = () => fileRef.current?.click();

  const importFile = async (file) => {
    if (!isTL && role !== "ADMIN")
      return showToast("Import is allowed only for TL/Admin", "error");
    if (!file) return;

    try {
      setLoading(true);

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      console.log("📦 RAW EXCEL ROWS 👉", rows);

      const parsed = parseSheetToCustomers(rows);

      console.log("✅ PARSED CUSTOMERS 👉", parsed);

      setCustomers(parsed);
      await importExcelSalesRaw(file);

      if (!parsed.length) {
        setLoading(false);
        return showToast(
          "No valid customers found. Please check Name & Mobile columns.",
          "error",
        );
      }

      const startMs = nowMs();
      const eligibleAt =
        startMs + addDaysMs(Number(cycleDays) || DEFAULT_CYCLE_DAYS);

      const tlUid = localStorage.getItem("uid");
      const tlName = localStorage.getItem("employeeName");

      const batch = writeBatch(db);
      for (const cust of parsed) {
        // 🔎 find existing by mobile,
        const q = query(
          collection(db, "existingCustomers"),
          where("mobile", "==", cust.mobile),
          limit(1),
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          // 🔁 UPDATE EXISTING CUSTOMER
          const ref = snap.docs[0].ref;
          const amountUpdate =
            cust.totalAmount !== null && cust.totalAmount !== undefined
              ? { totalAmount: cust.totalAmount }
              : {};
          batch.update(ref, {
            city: cust.city || "",
            district: cust.district || "",
            state: cust.state || "",
            pincode: cust.pincode || "",
            area: cust.area || "",
            country: cust.country || "",
            address: cust.address || "",

            // 🔥 SALES / META
            salesPerson: cust.salesPerson || "-",
            purchaseDate: cust.purchaseDate || "",
            group: cust.group || "",
            sellerCompanyName: cust.sellerCompanyName || "",
            salesType: cust.salesType || "",
            source: cust.source || "",
            category: cust.productCategory || "",
            purchases: cust.purchases || [],
            ...amountUpdate,
            updatedAt: serverTimestamp(),
          });
        } else {
          // ➕ CREATE NEW CUSTOMER
          const ref = doc(collection(db, "existingCustomers"));
          batch.set(ref, {
            name: cust.name,
            mobile: cust.mobile,

            // 🔥 LOCATION (ADD THIS)
            city: cust.city || "",
            district: cust.district || "",
            state: cust.state || "",
            pincode: cust.pincode || "",
            area: cust.area || "",
            country: cust.country || "",
            address: cust.address || "",

            // 🔥 SALES / META
            salesPerson: cust.salesPerson || "-",
            totalAmount: cust.totalAmount ?? 0,
            purchaseDate: cust.purchaseDate || "",
            group: cust.group || "",
            sellerCompanyName: cust.sellerCompanyName || "",
            salesType: cust.salesType || "",
            source: cust.source || "",
            category: cust.productCategory || "",
            purchases: cust.purchases || [],
            importedAt: serverTimestamp(),
            importedById: uid,
            importedByName: currentName,
            importedByRole: role,

            status: STATUS.NEW,

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();

      showToast(`Imported ${parsed.length} customers ✅`, "success");

      // reset UI
      setTab(TAB.ACTIVE);
      setStatusFilter("ALL");
      setTlFilter("ALL");
      setSearch("");
      setSelectedIds(new Set());
      setShowAdvanced(false);
    } catch (e) {
      console.error("IMPORT ERROR 🔴", e);
      showToast("Import failed ❌ (check console)", "error");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  //
  /* ========= DETAIL DRAWER ========= */
  const openDetail = (c) => setDetail(c);
  const closeDetail = () => setDetail(null);

  const detailPurchases = useMemo(() => {
    const p = detail?.purchases || [];
    // newest first if date looks parseable, else keep as is
    return [...p].sort((a, b) => {
      const da = Date.parse(a?.date || "") || 0;
      const dbb = Date.parse(b?.date || "") || 0;
      return dbb - da;
    });
  }, [detail]);

  const assignees = useMemo(() => {
    const tlOptions = tls.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      type: "TL",
    }));

    const empOptions = employees.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      type: "EMPLOYEE",
    }));

    return [...tlOptions, ...empOptions];
  }, [tls, employees]);

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "TL"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id, // TL user uid
        ...d.data(),
      }));

      // console.log("🧑‍💼 TL LIST:", list);
      setTls(list);
    });

    return () => unsub();
  }, []);

  // const saveFollowUp = async () => {
  //   try {
  //     if (followUpMode === "LATER" && !followUpAt) {
  //       showToast("Please select follow-up date", "error");
  //       return;
  //     }

  //     await updateDoc(doc(db, "existingCustomers", detail.id), {
  //       followUpAt: followUpMode === "LATER" ? new Date(followUpAt) : null,
  //       followUpNote: followUpNote || "",
  //       followUpStatus: followUpMode === "LATER" ? "PENDING" : "NOT_REQUIRED",
  //       followUpBy: currentName,
  //       followUpById: uid,
  //       updatedAt: serverTimestamp(),
  //     });

  //     showToast("Follow-up saved ✅", "success");
  //     closeDetail();
  //   } catch (e) {
  //     console.error(e);
  //     showToast("Failed to save follow-up ❌", "error");
  //   }
  // };

  // 🔥 Clear invalid selections when filter changes

  const saveFollowUp = async () => {
    try {
      if (followUpMode === "LATER" && !followUpAt) {
        showToast("Please select follow-up date", "error");
        return;
      }

      const updatePayload = {
        followUpAt: followUpMode === "LATER" ? new Date(followUpAt) : null,
        followUpNote: followUpNote || "",
        followUpStatus: followUpMode === "LATER" ? "PENDING" : "NOT_REQUIRED",
        followUpBy: currentName,
        followUpById: uid,
        updatedAt: serverTimestamp(),
      };

      // 🔥 IMPORTANT STATUS UPDATE
      if (
        followUpMode === "LATER" &&
        detail.status !== STATUS.PREMIUM // premium ko mat chhedo
      ) {
        updatePayload.status = STATUS.FOLLOWUP;
      }

      await updateDoc(doc(db, "existingCustomers", detail.id), updatePayload);

      showToast("Follow-up saved & status updated ✅", "success");
      closeDetail();
    } catch (e) {
      console.error(e);
      showToast("Failed to save follow-up ❌", "error");
    }
  };

  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(filtered.map((c) => c.id));
      return new Set([...prev].filter((id) => validIds.has(id)));
    });
  }, [filtered]);

  const MAX_PER_EMPLOYEE = 50;

  const getAssignedCount = (empId) =>
    customers.filter((c) => c.assignedEmployeeId === empId).length;

  const autoSelectForEmployee = () => {
    if (!assignEmployeeId) {
      showToast("Select employee first", "error");
      return;
    }

    const alreadyAssigned = getAssignedCount(assignEmployeeId);
    const remaining = MAX_PER_EMPLOYEE - alreadyAssigned;

    if (remaining <= 0) {
      showToast("Employee already has 50 customers", "error");
      return;
    }

    // sirf un customers ko lo jo unassigned hain
    const availableCustomers = filtered.filter((c) => !c.assignedEmployeeId);

    const toSelect = availableCustomers.slice(0, remaining);

    if (toSelect.length === 0) {
      showToast("No customers available for assignment", "error");
      return;
    }

    setSelectedIds(new Set(toSelect.map((c) => c.id)));

    showToast(`Auto selected ${toSelect.length} customers`, "success");
  };

  // table horizantial
  // useEffect(() => {
  //   const el = tableScrollRef.current;
  //   if (!el) return;

  //   let isDown = false;
  //   let startX;
  //   let scrollLeft;

  //   const mouseDown = (e) => {
  //     isDown = true;
  //     el.classList.add("cursor-grabbing");
  //     startX = e.pageX - el.offsetLeft;
  //     scrollLeft = el.scrollLeft;
  //   };

  //   const mouseLeave = () => {
  //     isDown = false;
  //     el.classList.remove("cursor-grabbing");
  //   };

  //   const mouseUp = () => {
  //     isDown = false;
  //     el.classList.remove("cursor-grabbing");
  //   };

  //   const mouseMove = (e) => {
  //     if (!isDown) return;
  //     e.preventDefault();
  //     const x = e.pageX - el.offsetLeft;
  //     const walk = (x - startX) * 1.2; // speed
  //     el.scrollLeft = scrollLeft - walk;
  //   };

  //   el.addEventListener("mousedown", mouseDown);
  //   el.addEventListener("mouseleave", mouseLeave);
  //   el.addEventListener("mouseup", mouseUp);
  //   el.addEventListener("mousemove", mouseMove);

  //   return () => {
  //     el.removeEventListener("mousedown", mouseDown);
  //     el.removeEventListener("mouseleave", mouseLeave);
  //     el.removeEventListener("mouseup", mouseUp);
  //     el.removeEventListener("mousemove", mouseMove);
  //   };
  // }, []);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const mouseDown = (e) => {
      isDown = true;
      el.classList.add("cursor-grabbing");
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };

    const mouseLeave = () => {
      isDown = false;
      el.classList.remove("cursor-grabbing");
    };

    const mouseUp = () => {
      isDown = false;
      el.classList.remove("cursor-grabbing");
    };

    const mouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.2;
      el.scrollLeft = scrollLeft - walk;
    };

    el.addEventListener("mousedown", mouseDown);
    el.addEventListener("mouseleave", mouseLeave);
    el.addEventListener("mouseup", mouseUp);
    el.addEventListener("mousemove", mouseMove);

    return () => {
      el.removeEventListener("mousedown", mouseDown);
      el.removeEventListener("mouseleave", mouseLeave);
      el.removeEventListener("mouseup", mouseUp);
      el.removeEventListener("mousemove", mouseMove);
    };
  }, [tab, filtered.length]);

  const moveToTrash = async (c) => {
    try {
      await updateDoc(doc(db, "existingCustomers", c.id), {
        status: STATUS.TRASH,
        trashedAt: serverTimestamp(),
        trashedBy: currentName,
        updatedAt: serverTimestamp(),
      });

      showToast(`Moved ${selectedIds.size} customers to Trash 🗑️`, "success");
    } catch (e) {
      console.error(e);
      showToast("Action failed ❌", "error");
    }
  };

  const bulkDeleteCustomers = async () => {
    if (!isTL) {
      showToast("Only TL/Admin can delete customers", "error");
      return;
    }

    if (selectedIds.size === 0) {
      showToast("Please select customers first", "error");
      return;
    }

    const confirmMsg =
      `🗑️ Are you sure you want to move ${selectedIds.size} customers to TRASH?\n\n` +
      `✔ Customers can be restored later.\n` +
      `❌ They will be hidden from active lists.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const batch = writeBatch(db);

      selectedIds.forEach((id) => {
        batch.update(doc(db, "existingCustomers", id), {
          status: STATUS.TRASH,
          trashedAt: serverTimestamp(),
          trashedBy: currentName,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      showToast(
        `Deleted ${selectedIds.size} customers permanently ✅`,
        "success",
      );
      clearSelection();
    } catch (e) {
      console.error(e);
      showToast("Permanent delete failed ❌", "error");
    }
  };
  const bulkDeleteForever = async () => {
    if (!isTL) {
      showToast("Only TL/Admin can delete permanently", "error");
      return;
    }

    if (selectedIds.size === 0) {
      showToast("No customers selected", "error");
      return;
    }

    const ok = window.confirm(
      `⚠️ PERMANENT DELETE\n\n` +
        `${selectedIds.size} customers will be permanently deleted.\n\n` +
        `❌ This action CANNOT be undone.`,
    );

    if (!ok) return;

    try {
      const batch = writeBatch(db);

      selectedIds.forEach((id) => {
        batch.delete(doc(db, "existingCustomers", id));
      });

      await batch.commit();

      showToast(
        `${selectedIds.size} customers deleted permanently 🔥`,
        "success",
      );

      clearSelection();
    } catch (e) {
      console.error(e);
      showToast("Permanent delete failed ❌", "error");
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      showToast("Group name required", "error");
      return;
    }

    try {
      await addDoc(collection(db, "customerGroups"), {
        name: groupName.trim(),
        description: groupDesc,
        customerIds: Array.from(selectedIds),
        totalCustomers: selectedIds.size,
        createdById: uid,
        createdByName: currentName,
        createdAt: serverTimestamp(),
      });

      showToast("Group created 📁", "success");
      setShowCreateGroup(false);
      setGroupName("");
      setGroupDesc("");
      clearSelection();
    } catch (e) {
      console.error(e);
      showToast("Group create failed ❌", "error");
    }
  };

  const restoreCustomer = async (c) => {
    try {
      await updateDoc(doc(db, "existingCustomers", c.id), {
        status: STATUS.NEW, // ✅ correct
        restoredAt: serverTimestamp(),
        restoredBy: currentName,
        updatedAt: serverTimestamp(),
      });

      showToast("Customer restored ✅", "success");
    } catch (e) {
      console.error(e);
      showToast("Restore failed ❌", "error");
    }
  };

  const permanentlyDeleteCustomer = async (c) => {
    if (!isTL) {
      showToast("Only TL/Admin can delete permanently", "error");
      return;
    }

    const ok = window.confirm(
      `⚠️ PERMANENT DELETE\n\n` +
        `Customer: ${c.name}\n` +
        `Mobile: ${c.mobile}\n\n` +
        `❌ This action CANNOT be undone.\n` +
        `Are you sure?`,
    );

    if (!ok) return;

    try {
      await deleteDoc(doc(db, "existingCustomers", c.id));
      showToast("Customer permanently deleted 🔥", "success");
    } catch (e) {
      console.error(e);
      showToast("Permanent delete failed ❌", "error");
    }
  };

  const bulkPermanentDelete = async () => {
    if (!isTL || selectedIds.size === 0) return;

    const ok = window.confirm(
      `⚠️ PERMANENT DELETE\n\n` +
        `${selectedIds.size} customers will be permanently deleted.\n\n` +
        `This action CANNOT be undone.`,
    );

    if (!ok) return;

    try {
      const batch = writeBatch(db);

      selectedIds.forEach((id) => {
        batch.delete(doc(db, "existingCustomers", id));
      });

      await batch.commit();
      showToast("Customers permanently deleted 🔥", "success");
      clearSelection();
    } catch (e) {
      console.error(e);
      showToast("Bulk delete failed ❌", "error");
    }
  };

  useEffect(() => {
    if (!detail) return;
    setFollowUpMode(
      detail.followUpStatus === "NOT_REQUIRED" ? "NOT_REQUIRED" : "LATER",
    );
    setFollowUpAt(toInputDateTime(detail.followUpAt));
    setFollowUpNote(detail.followUpNote || "");
  }, [detail?.id]);

  const importExcelSalesRaw = async (file) => {
    if (!file) return;

    try {
      const uid = localStorage.getItem("uid") || "SYSTEM";

      // 1️⃣ Read Excel
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];

      // 👇 header + body rows
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      if (rows.length <= 1) {
        alert("Excel sheet is empty");
        return;
      }

      /* ================= HEADER BASED PARSING ================= */

      // 2️⃣ Header row normalize
      const header = rows[0].map((h) => h.toString().trim().toLowerCase());

      const body = rows.slice(1);

      // 3️⃣ Column index detection (ORDER DOES NOT MATTER)
      const idxSales = header.findIndex((h) => h.includes("sales"));
      const idxDate = header.findIndex((h) => h.includes("date"));
      const idxAmount = header.findIndex((h) => h.includes("amount"));

      if (idxSales === -1 || idxAmount === -1) {
        alert("Required columns not found.\nExpected: Sales Person, Amount");
        console.error("❌ HEADER:", header);
        return;
      }

      // 4️⃣ Parse rows
      let lastPerson = "";
      const parsed = [];

      body.forEach((r, i) => {
        const salesPerson = String(r[idxSales] || "").trim() || lastPerson;

        if (!salesPerson) return;
        lastPerson = salesPerson;

        const rawAmount = r[idxAmount];
        const amount = Number(String(rawAmount).replace(/[^0-9.-]/g, ""));

        if (!amount || isNaN(amount)) return;

        const rawDate = idxDate !== -1 ? r[idxDate] : "";
        const dateMs = toDateMs(rawDate);

        parsed.push({
          rowIndex: i + 1,
          salesPerson,
          dateStr: rawDate?.toString?.() || "",
          dateMs,
          amount,
        });
      });

      console.log("✅ PARSED SALES ROWS:", parsed);

      if (!parsed.length) {
        alert("No valid rows found after parsing");
        return;
      }

      /* ================= FIRESTORE WRITE ================= */

      const batch = writeBatch(db);
      const batchId = new Date().toISOString();

      // for (const r of parsed) {
      //   // 🔍 check same Sales Person + Date already exists?
      //   const q = query(
      //     collection(db, "excel_sales_raw"),
      //     where("salesPerson", "==", r.salesPerson),
      //     where("dateMs", "==", r.dateMs),
      //     limit(1),
      //   );

      //   const snap = await getDocs(q);

      //   if (!snap.empty) {
      //     // ✅ UPDATE existing row (no duplicate)
      //     const ref = snap.docs[0].ref;
      //     batch.update(ref, {
      //       amount: r.amount,
      //       dateStr: r.dateStr,
      //       batchId, // latest batch
      //       updatedAt: serverTimestamp(),
      //       uploadedBy: uid,
      //     });
      //   } else {
      //     const ref = doc(collection(db, "excel_sales_raw"));
      //     batch.set(ref, {
      //       batchId,
      //       rowIndex: r.rowIndex,
      //       salesPerson: r.salesPerson,
      //       dateStr: r.dateStr,
      //       dateMs: r.dateMs,
      //       amount: r.amount,
      //       uploadedAt: serverTimestamp(),
      //       uploadedBy: uid,
      //     });
      //   }
      // }

      for (const r of parsed) {
        const docId = `${batchId}_${r.salesPerson}_${r.dateMs}`;

        batch.set(
          doc(db, "excel_sales_raw", docId),
          {
            batchId,
            rowIndex: r.rowIndex,
            salesPerson: r.salesPerson,
            dateStr: r.dateStr,
            dateMs: r.dateMs,
            amount: r.amount,
            uploadedAt: serverTimestamp(),
            uploadedBy: uid,
          },
          { merge: true }, // 🔥 KEY LINE
        );
      }

      await batch.commit();
      alert(
        `✅ Excel Sales Imported Successfully\nBatch: ${batchId}\nRows: ${parsed.length}`,
      );
    } catch (err) {
      console.error("❌ IMPORT ERROR:", err);
      alert("Import failed. Check console.");
    }
  };

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xl font-semibold text-slate-900">
                Existing Customer Detail
              </div>
              <div className="text-sm text-slate-500">
                Cycle-based calling • Premium marking • VOID/DND lists • TL
                forwarding
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                Role: <span className="font-semibold">{role || "NA"}</span>
              </div>

              <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm">
                <span className="text-sm text-slate-500">Cycle</span>
                <select
                  className="rounded-lg border px-2 py-1 text-sm outline-none"
                  value={cycleDays}
                  onChange={(e) =>
                    setCycleDays(Number(e.target.value) || DEFAULT_CYCLE_DAYS)
                  }
                >
                  <option value={3}>3 days</option>
                  <option value={4}>4 days</option>
                </select>
              </div>

              {isAdmin && (
                <>
                  <button
                    onClick={openFilePicker}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
                  >
                    Import Excel/CSV
                  </button>
                  {/* <button
                    onClick={() => setShowAddCustomer(true)}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
                  >
                    + Add Customer Detail
                  </button> */}
                  <button
                    onClick={() => setShowAddCustomer(true)}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    + Assign Customer
                  </button>

                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => importFile(e.target.files?.[0])}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-3 md:grid-cols-5">
          <SummaryCard
            title="Total"
            value={stats.total}
            sub="Imported + assigned"
          />
          <SummaryCard
            title="Active"
            value={stats.active}
            sub="Excluding VOID/DND"
          />
          <SummaryCard
            title="Premium 🟢"
            value={stats.premium}
            sub="High potential"
          />
          <SummaryCard
            title="Follow-up 🟡"
            value={stats.follow}
            sub="Need revisit"
          />
          <SummaryCard
            title="VOID/DND"
            value={stats.voids + stats.dnd}
            sub="Hidden from active"
          />
          <SummaryCard
            title="Trash 🗑️"
            value={trashCount}
            sub="Moved to trash"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <TabButton
            active={tab === TAB.ACTIVE}
            onClick={() => setTab(TAB.ACTIVE)}
            label="Active"
          />
          {role !== "EMPLOYEE" && (
            <TabButton
              active={tab === TAB.ASSIGN}
              onClick={() => setTab(TAB.ASSIGN)}
              label="Assign 📋"
            />
          )}
          <TabButton
            active={tab === TAB.PREMIUM}
            onClick={() => setTab(TAB.PREMIUM)}
            label="Premium 🟢"
          />
          <TabButton
            active={tab === TAB.FOLLOWUP}
            onClick={() => setTab(TAB.FOLLOWUP)}
            label="Follow-up ⏰"
          />

          <TabButton
            active={tab === TAB.VOID}
            onClick={() => setTab(TAB.VOID)}
            label="VOID ❌"
          />
          <TabButton
            active={tab === TAB.DND}
            onClick={() => setTab(TAB.DND)}
            label="DND 🚫"
          />
          {isTL && (
            <TabButton
              active={tab === TAB.TRASH}
              onClick={() => setTab(TAB.TRASH)}
              label="Trash 🗑️"
            />
          )}
          {isTL && (
            <TabButton
              active={tab === TAB.GROUPS}
              onClick={() => setTab(TAB.GROUPS)}
              label="Groups 📁"
            />
          )}
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-4">
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-500">
                  TL
                </div>
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={tlFilter}
                  onChange={(e) => setTlFilter(e.target.value)}
                  disabled={role === "TL"}
                >
                  <option value="ALL">All</option>
                  {tls.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-slate-500">
                  Status
                </div>
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All</option>
                  {Object.values(STATUS).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-semibold text-slate-500">
                  Search
                </div>
                <input
                  placeholder="Search name, mobile, product, tag, city…"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {isTL && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={selectAllVisible}
                  className="rounded-xl border px-3 py-2 text-sm font-semibold"
                >
                  Select All (Visible)
                </button>

                <select
                  placeholder=""
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                >
                  <option value="">Select TL / Employee</option>
                  {assignees.map((a) => (
                    <option key={a.type + a.id} value={a.id}>
                      {a.type === "TL" ? `TL - ${a.name}` : `EMP - ${a.name}`}
                    </option>
                  ))}
                </select>

                <button
                  onClick={bulkAssignToEmployee}
                  disabled={!assignEmployeeId || assigning}
                  className={cn(
                    "rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white",
                    (!assignEmployeeId || assigning) && "opacity-60",
                  )}
                >
                  Assign ({selectedIds.size})
                </button>
                <button
                  onClick={() => autoSelectForEmployee()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Auto Select (Available)
                </button>
              </div>
            )}
            {isTL && (
              <button
                onClick={handleExport}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Export
              </button>
            )}
            {isTL && selectedIds.size > 0 && tab !== TAB.TRASH && (
              <button
                onClick={() => setShowCreateGroup(true)}
                className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Create Group 📁 ({selectedIds.size})
              </button>
            )}

            {isTL && selectedIds.size > 0 && (
              <button
                onClick={bulkDeleteCustomers}
                className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete Selected ({selectedIds.size})
              </button>
            )}
            {tab === TAB.TRASH && selectedIds.size > 0 && (
              <button
                onClick={bulkDeleteForever}
                className="rounded-xl bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete Forever ({selectedIds.size})
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between"></div>

          {showAdvanced && (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {/* Location Type */}
              <select
                className="rounded-xl border px-3 py-2 text-sm"
                value={adv.locationType}
                onChange={(e) =>
                  setAdv((p) => ({
                    ...p,
                    locationType: e.target.value,
                    locationValue: "",
                  }))
                }
              >
                <option value="ALL">All Locations</option>
                <option value="STATE">State</option>
                <option value="COUNTRY">Country</option>
                <option value="PINCODE">Pincode</option>
              </select>

              {/* Location Value */}
              {adv.locationType !== "ALL" && (
                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder={
                    adv.locationType === "STATE"
                      ? "Enter State (Rajasthan)"
                      : adv.locationType === "COUNTRY"
                        ? "Enter Country (India)"
                        : "Enter Pincode"
                  }
                  value={adv.locationValue}
                  onChange={(e) =>
                    setAdv((p) => ({ ...p, locationValue: e.target.value }))
                  }
                />
              )}

              {/* Sort Order */}
              <select
                className="rounded-xl border px-3 py-2 text-sm"
                value={adv.sortDir}
                onChange={(e) =>
                  setAdv((p) => ({ ...p, sortDir: e.target.value }))
                }
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          )}
        </div>

        {/* 🔥 DO / DO NOT COLUMN FILTERS */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
          <input
            placeholder="DO: name, product, city"
            value={doFilter}
            onChange={(e) => setDoFilter(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <input
            placeholder="DO NOT: country, employee"
            value={doNotFilter}
            onChange={(e) => setDoNotFilter(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Min Amount ₹ (e.g. 5000)"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
        </div>

        {toast.show && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2">
            <div className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">
              {toast.msg}
            </div>
          </div>
        )}

        {showCreateGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold mb-2">
                Create Customer Group
              </h3>

              <input
                placeholder="Group name"
                className="w-full rounded-lg border px-3 py-2 mb-2"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />

              <textarea
                placeholder="Description (optional)"
                className="w-full rounded-lg border px-3 py-2 mb-3"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateGroup(false)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={createGroup}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
        {tab === TAB.GROUPS && (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {groups.map((g) => (
              <div
                key={g.id}
                onClick={() => setActiveGroup(g)}
                className="cursor-pointer rounded-xl border bg-white p-4 shadow-sm hover:shadow"
              >
                <div className="font-semibold">{g.name}</div>
                <div className="text-xs text-slate-500">{g.description}</div>
                <div className="mt-2 text-sm">
                  👥 {g.totalCustomers} customers
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Table */}
        {/* Table / Assign Logs */}
        {tab === TAB.ASSIGN ? (
          /* ================= ASSIGN TAB TABLE ================= */
          <div className="mt-4 rounded-2xl border bg-white shadow-sm overflow-x-auto">
            <thead className="bg-slate-50">
              <tr className="text-xs font-semibold text-slate-600">
                <th className="px-6 py-3 text-left">Assigned By (TL)</th>
                <th className="px-6 py-3 text-left">Assigned To</th>
                <th className="px-6 py-3 text-center">Customers</th>
                <th className="px-6 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assignLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {log.assignedByName}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-800">
                    {log.assignedToName}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {Array.isArray(log.customers) &&
                    log.customers.length > 0 ? (
                      <ul className="space-y-1">
                        {log.customers.slice(0, 5).map((c) => (
                          <li
                            key={c.id}
                            className="font-semibold text-slate-800"
                          >
                            {c.name}
                          </li>
                        ))}
                        {log.customers.length > 5 && (
                          <li className="text-xs text-indigo-600 font-semibold">
                            +{log.customers.length - 5} more
                          </li>
                        )}
                      </ul>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Old record (no customer list)
                      </span>
                    )}
                  </td>

                  {/* <td className="px-6 py-4 text-right text-xs text-slate-500 whitespace-nowrap">
                    {log.createdAt?.toDate
                      ? log.createdAt.toDate().toLocaleString()
                      : "-"}
                  </td> */}
                  <td className="px-6 py-4 text-right text-xs whitespace-nowrap">
                    {/* Date */}
                    <div className="text-slate-600">
                      {log.createdAt?.toDate
                        ? log.createdAt.toDate().toLocaleString()
                        : "-"}
                    </div>

                    {/* Assigned Count */}
                    {(() => {
                      const count = getEmployeeAssignedCount(log.assignedToId);
                      const color =
                        count >= 150
                          ? "text-red-600"
                          : count >= 120
                            ? "text-orange-600"
                            : "text-green-600";

                      return (
                        <div
                          className={`mt-1 text-[11px] font-semibold ${color}`}
                        >
                          {count} / 150
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">
                Showing <span className="text-slate-900">{availableCount}</span>{" "}
                available customers
                {role !== "EMPLOYEE" && (
                  <span className="ml-2 text-xs text-slate-500">
                    (Assigned: {assignedCount})
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                Tip: Premium customers stay green & should not be forwarded.
              </div>
            </div>

            <div
              ref={tableScrollRef}
              className="overflow-x-auto cursor-grab select-none"
            >
              {latestImport && (
                <div className="mb-3 ml-4 text-sm text-slate-700">
                  <div>
                    <span className="font-semibold">Date:</span>{" "}
                    {latestImport.importedAt.toLocaleString()}
                  </div>

                  <div>
                    <span className="font-semibold">Imported By:</span>{" "}
                    {latestImport.importedByName}
                    {latestImport.importedByRole && (
                      <span className="text-xs text-slate-500">
                        {" "}
                        ({latestImport.importedByRole})
                      </span>
                    )}
                  </div>
                </div>
              )}

              <table className="min-w-[980px] w-full">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold text-slate-600">
                    {/* Index */}
                    <th className="px-4 py-3 w-10">#</th>

                    {/* Select All */}
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        onChange={selectAllVisible}
                        checked={
                          filtered.length > 0 &&
                          filtered.every((c) => selectedIds.has(c.id))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </th>

                    {/* Dynamic columns (DO / DO NOT) */}
                    {visibleColumns.map((col) => (
                      <th key={col.key} className="px-4 py-3">
                        {col.label}
                      </th>
                    ))}

                    {/* Cycle column – ALWAYS visible */}
                    <th className="px-4 py-3">Cycle</th>

                    {/* Actions */}
                    <th className="px-4 py-3 text-center ">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={visibleColumns.length + 4}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColumns.length + 4}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        No customers found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c, idx) => {
                      const isQuick = c.isQuickAssign === true;
                      const eligible = isForwardEligible(c);
                      const cycleStart =
                        typeof c.cycleStartAt === "number"
                          ? c.cycleStartAt
                          : c.cycleStartAt?.toMillis
                            ? c.cycleStartAt.toMillis()
                            : c.cycleStartAt?.seconds
                              ? c.cycleStartAt.seconds * 1000
                              : null;

                      const nextEligible =
                        typeof c.nextEligibleAt === "number"
                          ? c.nextEligibleAt
                          : c.nextEligibleAt?.toMillis
                            ? c.nextEligibleAt.toMillis()
                            : c.nextEligibleAt?.seconds
                              ? c.nextEligibleAt.seconds * 1000
                              : null;

                      const days = Number(
                        c.cycleDays || cycleDays || DEFAULT_CYCLE_DAYS,
                      );

                      const dayIndex = cycleStart
                        ? Math.min(
                            days,
                            Math.max(
                              1,
                              Math.floor(
                                (nowMs() - cycleStart) / (24 * 3600 * 1000),
                              ) + 1,
                            ),
                          )
                        : 1;

                      return (
                        <tr
                          key={c.id}
                          className={cn(
                            "hover:bg-slate-50/50",
                            rowTint(c.status),
                          )}
                        >
                          {/* # */}
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {idx + 1}
                          </td>

                          {/* checkbox */}
                          <td className="px-4 py-3">
                            {isTL && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(c.id)}
                                onChange={() => toggleSelect(c.id)}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            )}
                          </td>

                          {/* 🔥 DYNAMIC COLUMNS (DO / DO NOT) */}
                          {visibleColumns.map((col) => {
                            switch (col.key) {
                              case "name":
                                return (
                                  <td key={col.key} className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                                        {(c.name || "U")[0]}
                                      </div>
                                      <div>
                                        <div className="text-sm font-semibold text-slate-900">
                                          {c.name || "Unknown"}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          Purchases:{" "}
                                          <b>{(c.purchases || []).length}</b>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                );

                              case "email":
                                return (
                                  <td className="px-4 py-3">
                                    {c.email || "-"}
                                  </td>
                                );

                              case "mobile":
                                return (
                                  <td className="px-4 py-3 text-sm">
                                    {openContactId === c.id ? (
                                      <span
                                        className="font-semibold text-slate-900 cursor-pointer"
                                        onClick={() => setOpenContactId(null)}
                                      >
                                        {c.mobile}
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => setOpenContactId(c.id)}
                                        className="text-indigo-600 font-semibold hover:underline"
                                      >
                                        Contact
                                      </button>
                                    )}
                                  </td>
                                );

                              case "product": {
                                const products = (c.purchases || [])
                                  .map((p) => p.product)
                                  .filter(Boolean);

                                return (
                                  <td
                                    key={col.key}
                                    className="px-4 py-3 text-sm max-w-[320px]"
                                  >
                                    <div className="line-clamp-2 text-slate-700">
                                      {/* {products.join(", ") || "-"} */}
                                      {isQuick
                                        ? "—"
                                        : products.join(", ") || "-"}
                                    </div>

                                    {products.length > 3 && (
                                      <button
                                        onClick={() => openDetail(c)}
                                        className="mt-1 text-xs font-semibold text-indigo-600 hover:underline"
                                      >
                                        +{products.length - 3} more
                                      </button>
                                    )}
                                  </td>
                                );
                              }
                              case "tags": {
                                const groups = getProductGroups(c); // 🔥 PRODUCT MAP LOGIC

                                return (
                                  <td className="px-4 py-3">
                                    {groups.length === 0
                                      ? "-"
                                      : groups.map((g) => (
                                          <span
                                            key={g}
                                            className="mr-1 inline-block rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700"
                                          >
                                            {g}
                                          </span>
                                        ))}
                                  </td>
                                );
                              }

                              // Product category
                              case "category":
                                return (
                                  <td className="px-4 py-3">
                                    {c.category || "-"}
                                  </td>
                                );

                              case "clientType":
                                return (
                                  <td className="px-4 py-3">
                                    {isDomesticClient(c.country) ? (
                                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                        DOMESTIC
                                      </span>
                                    ) : (
                                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                                        EXPORT
                                      </span>
                                    )}
                                  </td>
                                );

                              case "city":
                                return (
                                  <td key={col.key} className="px-4 py-3">
                                    {c.city || "-"}
                                  </td>
                                );
                              case "district":
                                return (
                                  <td className="px-4 py-3">
                                    {c.district || "-"}
                                  </td>
                                );

                              case "state":
                                return (
                                  <td className="px-4 py-3">
                                    {c.state || "-"}
                                  </td>
                                );

                              case "pincode":
                                return (
                                  <td className="px-4 py-3">
                                    {c.pincode || "-"}
                                  </td>
                                );

                              case "area":
                                return (
                                  <td className="px-4 py-3">{c.area || "-"}</td>
                                );

                              case "country":
                                return (
                                  <td key={col.key} className="px-4 py-3">
                                    {c.country || "-"}
                                  </td>
                                );
                              case "address":
                                return (
                                  <td className="px-4 py-3 max-w-[240px]">
                                    <div className="line-clamp-2">
                                      {c.address || "-"}
                                    </div>
                                  </td>
                                );

                              case "salesPerson":
                                return (
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                                        {
                                          (c.salesPerson ||
                                            c.importedByName ||
                                            "S")[0]
                                        }
                                      </div>
                                      <div className="text-sm font-semibold text-slate-800">
                                        {c.salesPerson || "-"}
                                      </div>
                                    </div>
                                  </td>
                                );

                              case "status":
                                return (
                                  <td key={col.key} className="px-4 py-3">
                                    <span
                                      className={cn(
                                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                                        statusBadge(c.status),
                                      )}
                                    >
                                      {c.status}
                                    </span>
                                  </td>
                                );

                              // case "tl":
                              //   return (
                              //     <td key={col.key} className="px-4 py-3">
                              //       {c.currentTLName || "-"}
                              //     </td>
                              //   );
                              case "tl":
                                return (
                                  <td className="px-4 py-3">
                                    {isQuick ? (
                                      <span className="font-semibold text-purple-600">
                                        Urgently Assigned by TL –{" "}
                                        {c.assignedByTLName ||
                                          c.currentTLName ||
                                          "—"}
                                      </span>
                                    ) : (
                                      c.currentTLName ||
                                      c.assignedByTLName ||
                                      "-"
                                    )}
                                  </td>
                                );

                              case "employee":
                                return (
                                  <td key={col.key} className="px-4 py-3">
                                    {c.assignedEmployeeName || "-"}
                                  </td>
                                );
                              case "totalAmount":
                                return (
                                  <td className="px-4 py-3 font-semibold text-slate-900">
                                    {isQuick
                                      ? "—"
                                      : `₹${Number(c.totalAmount || 0).toLocaleString()}`}
                                  </td>
                                );

                              case "purchaseDate":
                                return (
                                  <td className="px-4 py-3 text-sm">
                                    {c.purchaseDate
                                      ? new Date(
                                          c.purchaseDate,
                                        ).toLocaleDateString()
                                      : "-"}
                                  </td>
                                );
                              case "group":
                                return (
                                  <td className="px-4 py-3">
                                    {c.group || "-"}
                                  </td>
                                );
                              case "sellerCompanyName":
                                return (
                                  <td className="px-4 py-3">
                                    {c.sellerCompanyName || "-"}
                                  </td>
                                );
                              case "salesType":
                                return (
                                  <td className="px-4 py-3">
                                    {c.salesType || "-"}
                                  </td>
                                );

                              case "source":
                                return (
                                  <td className="px-4 py-3">
                                    {c.source || "-"}
                                  </td>
                                );

                              default:
                                return (
                                  <td className="px-4 py-3">
                                    {c[col.key] ?? "-"}
                                  </td>
                                );
                            }
                          })}

                          {/* Cycle – FIXED */}
                          <td className="px-4 py-3">
                            <div className="text-xs text-slate-600">
                              Day <b>{dayIndex}</b> / {days}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {eligible ? (
                                <span className="text-green-600 font-semibold">
                                  Forward eligible
                                </span>
                              ) : (
                                <span>
                                  Eligible at{" "}
                                  <b>
                                    {nextEligible
                                      ? new Date(nextEligible).toLocaleString()
                                      : "—"}
                                  </b>
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {/* 👁 View */}
                              <button
                                onClick={() => openDetail(c)}
                                className="rounded-xl border px-3 py-2 text-xs font-semibold"
                              >
                                View
                              </button>

                              {/* More actions – hide in TRASH */}
                              {tab !== TAB.TRASH && (
                                <MenuButton
                                  label="More"
                                  items={[
                                    {
                                      label: "Follow-up",
                                      onClick: () =>
                                        updateStatus(c, STATUS.FOLLOWUP),
                                    },
                                    {
                                      label: "No Response",
                                      onClick: () =>
                                        updateStatus(c, STATUS.NO_RESPONSE),
                                    },
                                    {
                                      label: "Not Interested",
                                      onClick: () =>
                                        updateStatus(c, STATUS.NOT_INTERESTED),
                                    },
                                    {
                                      label: "VOID",
                                      onClick: () =>
                                        updateStatus(c, STATUS.VOID),
                                      danger: true,
                                    },
                                    {
                                      label: "DND",
                                      onClick: () =>
                                        updateStatus(c, STATUS.DND),
                                      danger: true,
                                    },
                                  ]}
                                />
                              )}
                              {/* ⭐ Premium – hide in TRASH */}
                              {tab !== TAB.TRASH && (
                                <button
                                  onClick={() =>
                                    updateStatus(c, STATUS.PREMIUM)
                                  }
                                  className="rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white"
                                >
                                  Premium
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setEditCustomer(c);
                                  setShowUpdateModal(true);
                                }}
                                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                              >
                                Update
                              </button>

                              {/* 🔁 Forward – hide in TRASH */}
                              {isTL && tab !== TAB.TRASH && (
                                <button
                                  onClick={() => forwardToNextTL(c)}
                                  disabled={
                                    !eligible ||
                                    c.status === STATUS.PREMIUM ||
                                    c.status === STATUS.VOID ||
                                    c.status === STATUS.DND
                                  }
                                  className={cn(
                                    "rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white",
                                    (!eligible ||
                                      c.status === STATUS.PREMIUM ||
                                      c.status === STATUS.VOID ||
                                      c.status === STATUS.DND) &&
                                      "opacity-40 cursor-not-allowed",
                                  )}
                                >
                                  Forward
                                </button>
                              )}

                              {/* 🗑 Delete → move to TRASH (not in TRASH tab) */}
                              {tab !== TAB.TRASH && role !== "EMPLOYEE" && (
                                <button
                                  onClick={() => moveToTrash(c)}
                                  className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white"
                                >
                                  Delete
                                </button>
                              )}

                              {/* ♻️ Restore – ONLY in TRASH tab */}
                              {tab === TAB.TRASH && role !== "EMPLOYEE" && (
                                <>
                                  <button
                                    onClick={() => restoreCustomer(c)}
                                    className="rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white"
                                  >
                                    Restore
                                  </button>

                                  <button
                                    onClick={() => permanentlyDeleteCustomer(c)}
                                    className="rounded-xl bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
                                  >
                                    Delete Forever
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {detail && (
                <Drawer onClose={closeDetail}>
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        Customer Detail
                      </h2>
                      <p className="text-xs text-slate-500">
                        Complete customer overview
                      </p>
                    </div>

                    <button
                      onClick={closeDetail}
                      className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-100"
                    >
                      Close ✕
                    </button>
                  </div>

                  <div className="rounded-xl bg-white p-4 shadow-sm border mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-lg font-bold">
                        {detail.name?.[0]}
                      </div>

                      <div>
                        <div className="text-base font-semibold">
                          {detail.name}
                        </div>
                        <div className="text-sm text-slate-500">
                          {detail.mobile}
                        </div>
                      </div>

                      <span className="ml-auto inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                        {detail.status}
                      </span>
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <InfoBox label="Owner TL" value={detail.currentTLName} />
                    <InfoBox
                      label="Assigned Employee"
                      value={detail.assignedEmployeeName || "—"}
                    />
                    <InfoBox
                      label="Purchases"
                      value={(detail.purchases || []).length}
                    />
                    <InfoBox
                      label="Cycle Day"
                      value={`${detail.cycleDays || 4} Days`}
                    />
                  </div>

                  {/* Purchases Section */}
                  <div className="rounded-xl bg-white p-4 shadow-sm border">
                    <div className="mb-2 text-sm font-semibold text-slate-700">
                      Purchase History
                    </div>

                    {(detail.purchases || []).length === 0 ? (
                      <div className="text-sm text-slate-400">
                        No purchases found.
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {detail.purchases.map((p, i) => (
                          <li
                            key={i}
                            className="rounded-lg border px-3 py-2 text-sm bg-slate-50"
                          >
                            <div className="font-semibold">
                              {p.product || "Product"}
                            </div>
                            <div className="text-xs text-slate-500">
                              Qty: {p.quantity || "-"} | ₹{p.price || "-"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* 📝 Remarks Section */}
                  <div className="rounded-xl bg-white p-4 shadow-sm border mt-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">
                      📝 Latest Remark
                    </h3>

                    {detail.remarks ? (
                      <>
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
                          {detail.remarks}
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                          Updated by{" "}
                          <span className="font-semibold">
                            {detail.lastUpdatedBy || "—"}
                          </span>
                          {detail.lastUpdatedByRole && (
                            <> ({detail.lastUpdatedByRole})</>
                          )}
                          {detail.updatedAt?.toDate && (
                            <>
                              {" "}
                              on {detail.updatedAt.toDate().toLocaleString()}
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-slate-400 italic">
                        No remarks added yet.
                      </div>
                    )}
                  </div>
                  {!editFollowUp && (
                    <div className="rounded-xl border bg-white p-4 mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-slate-700">
                          ⏰ Follow-up Reminder
                        </h3>

                        <button
                          onClick={() => setEditFollowUp(true)}
                          className="text-xs font-semibold text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                      </div>

                      {detail.followUpAt ? (
                        <div className="space-y-2">
                          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                            FOLLOW-UP REQUIRED
                          </span>

                          <div className="text-sm text-slate-800">
                            📅 Next Call:
                            <span className="ml-1 font-semibold">
                              {formatDateTime(detail.followUpAt)}
                            </span>
                          </div>

                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                            📝 {detail.followUpNote || "No note added"}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 italic">
                          No follow-up scheduled.
                        </div>
                      )}
                    </div>
                  )}

                  {editFollowUp && (
                    <div className="rounded-xl border bg-white p-4 mt-4">
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">
                        ⏰ Edit Follow-up
                      </h3>

                      <select
                        className="w-full rounded-lg border px-3 py-2 text-sm mb-2"
                        value={followUpMode}
                        onChange={(e) => setFollowUpMode(e.target.value)}
                      >
                        <option value="LATER">Follow-up Required</option>
                        <option value="NOT_REQUIRED">
                          Follow-up Not Required
                        </option>
                      </select>

                      {followUpMode === "LATER" && (
                        <input
                          type="datetime-local"
                          className="w-full rounded-lg border px-3 py-2 text-sm mb-2"
                          value={followUpAt}
                          onChange={(e) => setFollowUpAt(e.target.value)}
                        />
                      )}

                      <textarea
                        rows={3}
                        className="w-full rounded-lg border px-3 py-2 text-sm mb-3"
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        placeholder="Follow-up note"
                      />

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditFollowUp(false)}
                          className="rounded-lg border px-3 py-2 text-sm"
                        >
                          Cancel
                        </button>

                        <button
                          onClick={() => {
                            saveFollowUp();
                            setEditFollowUp(false);
                          }}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </Drawer>
              )}
            </div>
          </div>
        )}
      </div>
      {showAddCustomer && (
        <AddCustomerModal
          onClose={() => setShowAddCustomer(false)}
          employees={employees}
          customers={customers}
        />
      )}

      {showUpdateModal && editCustomer && (
        <UpdateCustomerModal
          customer={editCustomer}
          onClose={() => {
            setShowUpdateModal(false);
            setEditCustomer(null);
          }}
        />
      )}
    </div>
  );
}

/* ===================== SMALL UI PARTS =====================  */

function SummaryCard({ title, value, sub }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-slate-900 text-white shadow"
          : "bg-white border text-slate-700 hover:bg-slate-50",
      )}
    >
      {label}
    </button>
  );
}

function Drawer({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-slate-50 shadow-2xl">
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function MenuButton({ label, items = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        {label}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl border bg-white shadow-lg">
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                it.onClick?.();
              }}
              className={cn(
                "w-full px-4 py-2 text-left text-sm hover:bg-slate-50",
                it.danger ? "text-rose-700 font-semibold" : "text-slate-700",
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl bg-white border p-3 shadow-sm">
      <div className="text-[11px] text-slate-500 font-semibold uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">
        {value || "—"}
      </div>
    </div>
  );
}
