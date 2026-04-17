import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  collection,
  writeBatch,
  doc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

/* ====== MARGIN HELPERS (REUSED) ====== */
const num = (v) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const safeDiv = (a, b) => (b ? a / b : 0);

const recalc = ({ saleRate, purchaseRate, lastEdited, value }) => {
  let S = num(saleRate);
  let P = num(purchaseRate);
  let v = value === "" ? 0 : num(value);

  switch (lastEdited) {
    case "saleRate":
      S = v;
      break;

    case "purchaseRate":
      P = v;
      break;

    // ✅ PROFIT % ON SELLING
    case "marginPctSale":
      if (S === 0 && P > 0) {
        // selling empty hai → derive selling
        S = P / (1 - v / 100);
      } else if (S > 0) {
        P = S - (S * v) / 100;
      }
      break;

    // ✅ PROFIT % ON PURCHASE
    case "marginPctPurchase":
      if (P > 0) {
        S = P * (1 + v / 100);
      }
      break;

    // ✅ PROFIT VALUE
    case "marginVal":
      S = P + v;
      break;

    default:
      break;
  }

  const marginVal = S - P;
  const marginPctSale = S ? (marginVal / S) * 100 : 0;
  const marginPctPurchase = P ? (marginVal / P) * 100 : 0;

  return {
    saleRate: Math.round(S),
    purchaseRate: Math.round(P),
    marginVal: Math.round(marginVal),
    marginPctSale: +marginPctSale.toFixed(2),
    marginPctPurchase: +marginPctPurchase.toFixed(2),
    marginStatus: marginVal >= 0 ? "PROFIT" : "LOSS",
  };
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  const [existingIds, setExistingIds] = useState(new Set());
  const [form, setForm] = useState({
    itemName: "",
    sku: "",
    hsnSac: "",
    rate: "",
    status: "",
  });

  useEffect(() => {
    const colRef = collection(db, "inventory_items");

    const unsub = onSnapshot(colRef, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // 🔑 collect existing itemIds
      const ids = new Set(list.map((i) => String(i.itemId || "").trim()));

      setExistingIds(ids);
      setItems(list);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "inventory_items"),
      orderBy("itemName", "asc"), // ✅ A–Z
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setItems(list);
    });

    return () => unsub();
  }, []);

  /* ================= MANUAL ADD (TEST PURPOSE) ================= */
  const addItem = async () => {
    if (!form.itemName) return alert("Item name required");

    try {
      await addDoc(collection(db, "inventory_items"), {
        itemId: form.itemId || "",
        ...form,
        rate: Number(form.rate || 0),
        createdAt: serverTimestamp(),
      });

      setForm({
        itemName: "",
        sku: "",
        hsnSac: "",
        rate: "",
        status: "",
      });
    } catch (e) {
      console.error("❌ Add item failed", e);
    }
  };

  const parseRate = (val) => {
    if (!val) return 0;
    return Number(String(val).replace(/[^0-9.]/g, "")) || 0;
  };

  const handleExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);

      const colRef = collection(db, "inventory_items");

      let batch = writeBatch(db);
      let count = 0;
      let total = 0;

      for (let i = 0; i < data.length; i++) {
        const r = data[i];

        const ref = doc(colRef); // auto id
        batch.set(ref, {
          itemId: String(r["Item ID"] || "").trim(),
          itemName: r["Item Name"] || "",
          sku: r["SKU"] || "",
          hsnSac: r["HSN/SAC"] || "",
          rate: parseRate(r["Rate"]),
          status: r["Status"] || "Active",
          createdAt: serverTimestamp(),
        });

        count++;
        total++;

        // 🔥 Firestore limit
        if (count === 500) {
          await batch.commit(); // ⚡ ONE CALL
          batch = writeBatch(db);
          count = 0;
        }
      }

      // commit remaining
      if (count > 0) {
        await batch.commit();
      }

      alert(`🚀 Import completed\nTotal items imported: ${total}`);
    };

    reader.readAsBinaryString(file);
  };

  /* ================= SEARCH ================= */
  const filtered = useMemo(() => {
    const list = search
      ? items.filter((i) =>
          JSON.stringify(i).toLowerCase().includes(search.toLowerCase()),
        )
      : items;

    return [...list].sort((a, b) =>
      (a.itemName || "").localeCompare(b.itemName || ""),
    );
  }, [search, items]);

  function ProductDrillDown({ item, onClose }) {
    const [sales, setSales] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [isSaved, setIsSaved] = useState(false);

    const [margin, setMargin] = useState({
      saleRate: "",
      purchaseRate: item.rate ?? "",
      marginVal: "",
      marginPctSale: "",
      marginPctPurchase: "",
      marginStatus: "PROFIT",
    });

    const [saleForm, setSaleForm] = useState({
      qty: "",
      saleRate: "",
    });

    const [expenseForm, setExpenseForm] = useState({
      amount: "",
      remark: "",
    });

    const updateMargin = (field, val) => {
      setMargin((prev) =>
        recalc({
          saleRate: prev.saleRate,
          purchaseRate: prev.purchaseRate,
          lastEdited: field,
          value: val, // ❗ STRING PASS KAR — Number mat kar
        }),
      );
    };

    useEffect(() => {
      const unsubPricing = onSnapshot(
        query(
          collection(db, "inventory_pricing"),
          where("itemId", "==", item.itemId),
        ),
        (snap) => {
          if (!snap.empty && !isSaved) {
            // 👈 IMPORTANT FIX
            const data = snap.docs[0].data();

            setMargin({
              saleRate: data.saleRate || 0,
              purchaseRate: data.purchaseRate || item.rate || 0,
              marginVal: data.marginVal || 0,
              marginPctSale: data.marginPctSale || 0,
              marginPctPurchase: data.marginPctPurchase || 0,
              marginStatus: (data.marginVal || 0) >= 0 ? "PROFIT" : "LOSS",
            });

            setIsSaved(true);
          }
        },
      );

      return () => unsubPricing();
    }, [item.itemId, isSaved]);

    const savePricing = async () => {
      try {
        // 🔥 SAVE PRICING
        await addDoc(collection(db, "inventory_pricing"), {
          itemId: item.itemId,
          saleRate: margin.saleRate,
          purchaseRate: margin.purchaseRate,
          marginVal: margin.marginVal,
          marginPctSale: Number(margin.marginPctSale),
          marginPctPurchase: Number(margin.marginPctPurchase),
          createdAt: serverTimestamp(),
        });

        // 🔴 SAVE EXPENSE (ONLY IF ENTERED)
        if (expenseForm.amount && expenseForm.remark) {
          await addDoc(collection(db, "expenses"), {
            itemId: item.itemId,
            amount: Number(expenseForm.amount),
            remark: expenseForm.remark,
            createdAt: serverTimestamp(),
          });
        }

        setIsSaved(true);
      } catch (err) {
        console.error("Save failed", err);
      }
    };

    const saveSale = async () => {
      if (!saleForm.qty || !saleForm.saleRate)
        return alert("Fill sale details");

      await addDoc(collection(db, "sales"), {
        itemId: item.itemId,
        qty: Number(saleForm.qty),
        saleRate: Number(saleForm.saleRate),
        total: Number(saleForm.qty) * Number(saleForm.saleRate),
        createdAt: serverTimestamp(),
      });

      setSaleForm({ qty: "", saleRate: "" });
      setActiveTab("summary");
    };

    const saveExpense = async () => {
      if (!expenseForm.amount) return alert("Enter expense amount");
      if (!expenseForm.remark) return alert("Remark required");

      try {
        await addDoc(collection(db, "expenses"), {
          itemId: item.itemId,
          amount: Number(expenseForm.amount),
          remark: expenseForm.remark,
          createdAt: serverTimestamp(),
        });

        setExpenseForm({
          amount: "",
          remark: "",
        });
      } catch (err) {
        console.error(err);
      }
    };

    useEffect(() => {
      const unsubSales = onSnapshot(
        query(collection(db, "sales"), where("itemId", "==", item.itemId)),
        (snap) => setSales(snap.docs.map((d) => d.data())),
      );

      const unsubExpenses = onSnapshot(
        query(collection(db, "expenses"), where("itemId", "==", item.itemId)),
        (snap) => setExpenses(snap.docs.map((d) => d.data())),
      );

      return () => {
        unsubSales();
        unsubExpenses();
      };
    }, [item.itemId]);

    const totalSales = sales.reduce((a, b) => a + b.total, 0);
    const totalQty = sales.reduce((a, b) => a + b.qty, 0);

    const purchaseCost = totalQty * (item.rate || 0); // ✅ Excel Rate
    const totalExpenses = expenses.reduce((a, b) => a + b.amount, 0);

    const netMargin = totalSales - purchaseCost - totalExpenses;

    return (
      <div className="fixed inset-0 bg-black/30 flex justify-end">
        <div className="w-[420px] bg-white h-full p-5 overflow-y-auto">
          <button onClick={onClose}>✕</button>

          <h2 className="text-xl font-bold">{item.itemName}</h2>

          <>
            {/* ================= BASE PRICING ================= */}
            <Section title="💰 Base Pricing (Editable)">
              <label className="text-xs text-slate-500">Selling Price ₹</label>
              <input
                className="input mb-3"
                placeholder="Enter Selling Price"
                value={margin.saleRate ?? ""}
                onChange={(e) => updateMargin("saleRate", e.target.value)}
              />

              <label className="text-xs text-slate-500">Purchase Price ₹</label>
              <input
                className="input"
                placeholder="Enter Purchase Price"
                value={margin.purchaseRate ?? ""}
                onChange={(e) => updateMargin("purchaseRate", e.target.value)}
              />
            </Section>

            {/* ================= PROFIT CONTROL ================= */}
            <Section title="📊 Profit Control (Editable)">
              <label className="text-xs text-slate-500">
                Profit % on Selling Price
              </label>
              <input
                className="input mb-3"
                placeholder="Example: 20"
                value={margin.marginPctSale ?? ""}
                onChange={(e) => updateMargin("marginPctSale", e.target.value)}
              />

              <label className="text-xs text-slate-500">
                Profit % on Purchase Price
              </label>
              <input
                className="input mb-3"
                placeholder="Example: 25"
                value={margin.marginPctPurchase ?? ""}
                onChange={(e) =>
                  updateMargin("marginPctPurchase", e.target.value)
                }
              />

              <label className="text-xs text-slate-500">Profit Value ₹</label>
              <input
                className="input"
                placeholder="Example: 500"
                value={margin.marginVal ?? ""}
                onChange={(e) => updateMargin("marginVal", e.target.value)}
              />
            </Section>

            {/* ================= LIVE RESULT ================= */}
            <Section title="📈 Live Selling Result (Auto)">
              <Row label="Selling Price" value={`₹${margin.saleRate}`} />
              <Row label="Purchase Price" value={`₹${margin.purchaseRate}`} />
              <Row label="Profit ₹" value={`₹${margin.marginVal}`} />
              <Row label="Profit %" value={`${margin.marginPctPurchase}%`} />
            </Section>
            {/* ================= EXPENSE ================= */}
            <Section title="🔴 Expense (Add Cost + Remark)">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Expense ₹"
                  value={expenseForm.amount}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, amount: e.target.value })
                  }
                />

                <input
                  className="input flex-[2]"
                  placeholder="Remark (Reason of Expense)"
                  value={expenseForm.remark}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, remark: e.target.value })
                  }
                />
              </div>
            </Section>
            {expenses.length > 0 && (
              <div className="mt-3 space-y-2">
                {expenses.map((e, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-xs bg-red-50 px-2 py-1 rounded"
                  >
                    <span>
                      ₹{e.amount} • {e.remark}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ================= FINAL RESULT ================= */}
            <Section title="🟣 Final Net Profit">
              <div
                className={`text-xl font-bold ${
                  margin.marginStatus === "PROFIT"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {margin.marginStatus} : ₹{margin.marginVal - totalExpenses}
              </div>
            </Section>
          </>

          <div className="mt-6">
            {!isSaved ? (
              <button
                onClick={savePricing}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold text-center"
              >
                <center>💾 Save Pricing</center>
              </button>
            ) : (
              <button
                onClick={() => setIsSaved(false)}
                className="w-full bg-amber-500 text-white py-3 rounded-xl font-semibold"
              >
                <center>✏️ Edit Pricing</center>
              </button>
            )}
          </div>

          {/* 🔴 ADD EXPENSE FORM */}
          {/* {activeTab === "expense" && (
            <Section title="🔴 Add Expense">
              <select
                value={expenseForm.type}
                onChange={(e) =>
                  setExpenseForm({ ...expenseForm, type: e.target.value })
                }
                className="w-full border px-3 py-2 rounded mb-2"
              >
                <option>Logistics</option>
                <option>Packing</option>
                <option>Misc</option>
              </select>

              <input
                placeholder="Amount"
                value={expenseForm.amount}
                onChange={(e) =>
                  setExpenseForm({ ...expenseForm, amount: e.target.value })
                }
                className="w-full border px-3 py-2 rounded"
              />

              <button
                onClick={saveExpense}
                className="mt-3 bg-red-600 text-white px-4 py-2 rounded"
              >
                Save Expense
              </button>
            </Section>
          )} */}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-100 min-h-screen">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
        <p className="text-sm text-slate-500">Import & manage product master</p>
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-wrap gap-4 mb-6">
        <label className="cursor-pointer inline-flex items-center gap-2 bg-gradient-to-r from-slate-900 to-slate-700 text-white px-5 py-2.5 rounded-xl shadow hover:opacity-90 transition">
          Import Excel
          <input hidden type="file" onChange={handleExcel} />
        </label>

        <input
          placeholder="Search item, HSN, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm focus:ring-2 focus:ring-slate-400 outline-none"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
        <h3 className="font-semibold text-slate-700 mb-4">Add Item (Manual)</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {["itemName", "hsnSac", "rate", "status"].map((f) => (
            <input
              key={f}
              placeholder={f.toUpperCase()}
              value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-slate-400 outline-none"
            />
          ))}
        </div>

        <button
          onClick={addItem}
          className="mt-5 bg-slate-900 text-white px-6 py-2.5 rounded-xl shadow hover:bg-slate-800 transition"
        >
          Save Item
        </button>
      </div>

      {/* TABLE CARD */}
      {/* TABLE HEADER */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="font-semibold text-slate-700">Inventory List</h3>

        <div className="text-sm font-medium bg-slate-900 text-white px-4 py-1.5 rounded-full shadow">
          Total Items: {filtered.length}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Item</th>
                <th className="px-4 py-3 font-medium">HSN</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="3" className="py-10 text-center text-slate-400">
                    No inventory data
                  </td>
                </tr>
              )}

              {filtered.map((i, idx) => (
                <tr
                  key={i.id}
                  onClick={() => setSelectedItem(i)} // ✅ yahin
                  className={`cursor-pointer border-t ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                  } hover:bg-slate-100 transition`}
                >
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {i.itemName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{i.hsnSac}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-3 py-1 text-xs rounded-full bg-green-100 text-green-700">
                      {i.status || "Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedItem && (
        <ProductDrillDown
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
const Section = ({ title, children }) => (
  <div className="mt-4 p-4 border rounded-xl">
    <h4 className="font-semibold mb-2">{title}</h4>
    {children}
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex justify-between text-sm mb-1">
    <span>{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);
