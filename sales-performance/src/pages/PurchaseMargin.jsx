import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

/* ================= HELPERS ================= */
const normalize = (v = "") =>
  String(v).toLowerCase().replace(/\s+/g, " ").trim();

const num = (v) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};

/* ================= PI STATUS ================= */

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const safeDiv = (a, b) => (b ? a / b : 0);

const money = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};
const recalc = ({ saleRate, purchaseRate, lastEdited, value }) => {
  let S = num(saleRate);
  let P = num(purchaseRate);
  const v = num(value);

  if (lastEdited === "saleRate") S = v;
  if (lastEdited === "purchaseRate") P = v;

  if (lastEdited === "marginPctSale") {
    const pct = clamp(v, 0, 100);
    P = S - (S * pct) / 100;
  }

  if (lastEdited === "marginPctPurchase") {
    const pct = Math.max(v, 0);
    P = safeDiv(S, 1 + pct / 100);
  }

  if (lastEdited === "marginValSale") {
    const m = Math.max(v, 0);
    P = S - m;
  }

  if (lastEdited === "marginValPurchase") {
    const m = Math.max(v, 0);
    P = S - m;
  }

  S = Math.max(S, 0);
  P = Math.max(P, 0);

  const marginVal = S - P;
  const marginPctSale = S ? (marginVal / S) * 100 : 0;
  const marginPctPurchase = P ? (marginVal / P) * 100 : 0;

  return {
    saleRate: Math.round(S),
    purchaseRate: Math.round(P),

    marginPctSale: Number(marginPctSale).toFixed(2),
    marginPctPurchase: Number(marginPctPurchase).toFixed(2),

    marginValSale: Math.round(marginVal),
    marginValPurchase: Math.round(marginVal),

    marginStatus: marginVal >= 0 ? "PROFIT" : "LOSS",
  };
};

export default function PurchaseMargin() {
  const [salesEntries, setSalesEntries] = useState([]);
  const [ledger, setLedger] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [savedLedger, setSavedLedger] = useState({});
  const [editRow, setEditRow] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [viewType, setViewType] = useState("ALL");
  const [expandedRow, setExpandedRow] = useState(null);
  const [productRates, setProductRates] = useState({});
  const [editingRows, setEditingRows] = useState({});
  const updateProductRate = (id, field, value) => {
    setProductRates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  // const parseProducts = (productsText, piNo) => {
  const parseProducts = (productsText, piNo, saleRate, purchaseRate) => {
    if (!productsText) return [];

    const list = productsText.split(",").map((p) => p.trim());

    return list.map((name, i) => {
      const pid = `${piNo}_${i}`; // 👈 id yaha define

      return {
        id: pid,
        name,
        sale: productRates[pid]?.sale ?? saleRate ?? "",
        purchase: productRates[pid]?.purchase ?? purchaseRate ?? "",
        vendor: productRates[pid]?.vendor ?? "",
      };
    });
  };

  
  const getVendorLabel = (items) => {
    const vendors = items
      .map((it) => it.vendor)
      .filter((v) => v && v.trim() !== "");

    if (!vendors.length) return "";

    const unique = [...new Set(vendors)];

    if (unique.length === 1) return unique[0]; // single vendor
    return "Multiple Vendors"; // multiple vendors
  };

  const isExpandedLocked = (piNo) => {
    return savedLedger[piNo] && !editingRows[piNo];
  };

  const tableRef = useRef(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const onMouseDown = (e) => {
    const tag = e.target.tagName?.toLowerCase();
    if (e.target.closest("[data-nodrag='true']")) return;

    isDown.current = true;
    tableRef.current.classList.add("dragging");
    startX.current = e.pageX - tableRef.current.offsetLeft;
    scrollLeft.current = tableRef.current.scrollLeft;
  };

  const onMouseLeave = () => {
    isDown.current = false;
    tableRef.current.classList.remove("dragging");
  };
  const onMouseUp = () => {
    isDown.current = false;
    tableRef.current.classList.remove("dragging");
  };
  const onMouseMove = (e) => {
    if (!isDown.current) return;
    e.preventDefault();
    const x = e.pageX - tableRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    tableRef.current.scrollLeft = scrollLeft.current - walk;
  };

  /* ================= FETCH SALES ================= */
  useEffect(() => {
    const q = query(collection(db, "sales"), orderBy("createdAtMs", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (!Array.isArray(data.pis)) return;
        const seen = new Set(rows.map((r) => r.piNo));
        data.pis.forEach((pi) => {
          if (!pi.piNo || seen.has(pi.piNo)) return;
          seen.add(pi.piNo);

          rows.push({
            piNo: pi.piNo,
            employeeId: data.employeeId,
            employeeName: data.employeeName,
            products: pi.products || "",
            saleAmount: num(pi.amount),
            qty: 1,
            piDate: data.createdAt?.toDate
              ? data.createdAt.toDate()
              : data.createdAtMs
                ? new Date(data.createdAtMs)
                : null,
          });
        });
      });
      setSalesEntries(rows);
    });

    return () => unsub();
  }, []);

  /* ================= UPDATE ROW (AUTO FILL) ================= */
  const updateRow = (piNo, rowSaleDefault, patch) => {
    setLedger((prev) => {
      const current = prev[piNo] || {};
      const saved = savedLedger[piNo] || {};

      const baseSale = current.saleRate ?? saved.saleRate ?? rowSaleDefault;

      const basePurchase =
        current.purchaseRate ??
        current.confirmedPurchaseRate ??
        saved.purchaseRate ??
        saved.confirmedPurchaseRate ??
        0;

      const nextCalc = recalc({
        saleRate: baseSale,
        purchaseRate: basePurchase,
        lastEdited: patch.lastEdited,
        value: patch.value,
      });

      return {
        ...prev,
        [piNo]: {
          ...current,
          ...nextCalc,
          vendorName: patch.vendorName ?? current.vendorName ?? "",
          lastEdited: patch.lastEdited,
        },
      };
    });
  };

  useEffect(() => {
    const q = query(collection(db, "piLedger"));

    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data();
      });
      setSavedLedger(map);
    });

    return () => unsub();
  }, []);

  const saveLedger = async (row) => {
    const key = row.piNo;
    const l = ledger[key] || {};

    /* ================= PRODUCT TABLE TOTAL ================= */
    const items = parseProducts(
      row.products,
      row.piNo,
      num(l.saleRate ?? row.saleAmount),
      num(l.purchaseRate ?? 0),
    );
    const vendorNameAuto = getVendorLabel(items);
    const totalProductSale = items.reduce((sum, it) => sum + num(it.sale), 0);
    const totalProductPurchase = items.reduce(
      (sum, it) => sum + num(it.purchase),
      0,
    );

    /* ================= FINAL RATES ================= */
    const saleRate = totalProductSale || num(l.saleRate ?? row.saleAmount);

    const purchaseRate =
      totalProductPurchase || num(l.purchaseRate ?? l.confirmedPurchaseRate);

    if (saleRate <= 0) return alert("Sale must be > 0");
    if (purchaseRate <= 0) return alert("Purchase must be > 0");

    setLoading(true);

    const qty = 1;
    const marginVal = saleRate - purchaseRate;

    try {
      await setDoc(
        doc(db, "piLedger", key),
        {
          piNo: key,
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          products: row.products,

          vendorName: vendorNameAuto || l.vendorName || "",

          saleRate,
          purchaseRate,

          saleAmount: saleRate * qty,
          purchaseAmount: purchaseRate * qty,

          marginValSale: marginVal,
          marginValPurchase: marginVal,
          marginPctSale: saleRate
            ? ((marginVal / saleRate) * 100).toFixed(2)
            : "0.00",
          marginPctPurchase: purchaseRate
            ? ((marginVal / purchaseRate) * 100).toFixed(2)
            : "0.00",
          marginStatus: marginVal >= 0 ? "PROFIT" : "LOSS",

          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      alert("Saved ✅");
    } catch (err) {
      console.error(err);
      alert("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  /* ================= DELETE LEDGER ================= */
  const handleDelete = async (piNo) => {
    const ok = window.confirm(`Are you sure you want to delete PI ${piNo}?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "piLedger", piNo));
      alert("Deleted successfully");
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  const handleReconfirm = (row, rate) => {
    const pr = num(rate);
    if (!pr) return alert("Invalid rate");

    // user edited purchaseRate => full recalc
    updateRow(row.piNo, row.saleAmount, {
      lastEdited: "purchaseRate",
      value: pr,
    });
    setShowModal(false);
  };

  /* ================= FILTER ================= */
  const filteredEntries = salesEntries.filter((r) => {
    if (search) {
      const q = normalize(search);
      const l = ledger[r.piNo] || {};
      const match =
        normalize(r.piNo).includes(q) ||
        normalize(r.employeeName).includes(q) ||
        normalize(r.products).includes(q) ||
        normalize(l.vendorName).includes(q);

      if (!match) return false;
    }

    const l = savedLedger[r.piNo];

    // if (viewType === "PURCHASED") return l?.purchaseRate > 0;
    // if (viewType === "PENDING") return !l || !l.purchaseRate;

    return true; // ALL
  });

  /* ================= UI ================= */
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">PI Purchase & Margin Register</h1>
          <p className="text-sm text-gray-500">
            Sale vs Purchase vs Margin (PI wise)
          </p>
        </div>

        <input
          className="input w-80"
          placeholder="Search PI / Employee / Product"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* TABLE */}
      <div
        ref={tableRef}
        className="drag-scroll border rounded-xl shadow-sm overflow-x-auto"
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
      >
        <table className="text-sm border-collapse min-w-[1200px]">
          <thead className="bg-slate-100 sticky top-0">
            {/* HEADER ROW 1 */}
            <tr>
              <th className="p-3 border" rowSpan={2}>
                PI Date
              </th>
              <th className="p-3 border" rowSpan={2}>
                PI No
              </th>
              <th className="p-3 border" rowSpan={2}>
                Employee
              </th>
              <th className="p-3 border" rowSpan={2}>
                Products
              </th>

              <th className="p-3 border" rowSpan={2}>
                Sale
              </th>
              <th className="p-3 border" rowSpan={2}>
                Vendor Name
              </th>
              <th className="p-3 border" rowSpan={2}>
                Purchase
              </th>

              <th className="p-3 border text-center" colSpan={2}>
                Margin in %
              </th>
              <th className="p-3 border text-center" colSpan={2}>
                Margin in Value
              </th>

              <th className="p-3 border" rowSpan={2}>
                Action
              </th>
            </tr>

            {/* HEADER ROW 2 */}
            <tr>
              <th className="p-3 border">Sale</th>
              <th className="p-3 border">Purchase</th>

              <th className="p-3 border">Sale</th>
              <th className="p-3 border">Purchase</th>
            </tr>
          </thead>

          <tbody>
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center p-6 text-gray-500">
                  No records found
                </td>
              </tr>
            )}

            {filteredEntries.map((row, index) => {
              const l = ledger[row.piNo] || savedLedger[row.piNo] || {};
              const saleRate = num(l.saleRate ?? row.saleAmount);
              const purchaseRate = num(
                l.purchaseRate ?? l.confirmedPurchaseRate ?? 0,
              );
              const itemsMain = parseProducts(
                row.products,
                row.piNo,
                saleRate,
                purchaseRate,
              );

              const vendorLabelMain = getVendorLabel(itemsMain);

              const marginVal = saleRate - purchaseRate;

              return (
                <React.Fragment key={`${row.piNo}-${index}`}>
                  {/* ===== MAIN ROW ===== */}
                  <tr
                    key={`${row.piNo}-${index}`}
                    onClick={() =>
                      setExpandedRow(expandedRow === row.piNo ? null : row.piNo)
                    }
                    className="hover:bg-slate-50 transition cursor-pointer"
                  >
                    <td className="p-3 border text-sm text-gray-600">
                      {row.piDate
                        ? row.piDate.toLocaleDateString("en-IN")
                        : "-"}
                    </td>
                    <td className="p-3 border font-semibold">{row.piNo}</td>

                    <td className="p-3 border">{row.employeeName}</td>
                    <td className="p-3 border">{row.products || "-"}</td>

                    {/* SALE */}
                    <td className="p-3 border">
                      <input
                        className="input input-md"
                        value={l.saleRate ?? row.saleAmount}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          updateRow(row.piNo, row.saleAmount, {
                            lastEdited: "saleRate",
                            value: e.target.value.replace(/[^0-9]/g, ""),
                          })
                        }
                      />
                    </td>

                    {/* VENDOR */}
                    <td className="p-3 border">
                      <input
                        className="input input-md"
                        value={
                          ledger[row.piNo]?.vendorName ??
                          savedLedger[row.piNo]?.vendorName ??
                          ""
                        }
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          setLedger((prev) => ({
                            ...prev,
                            [row.piNo]: {
                              ...(prev[row.piNo] || {}),
                              vendorName: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>

                    {/* PURCHASE */}
                    <td className="p-3 border">
                      <input
                        className="input input-md"
                        value={l.purchaseRate ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          updateRow(row.piNo, row.saleAmount, {
                            lastEdited: "purchaseRate",
                            value: e.target.value.replace(/[^0-9]/g, ""),
                          })
                        }
                      />
                    </td>

                    {/* MARGIN % SALE */}
                    <td className="p-3 border">
                      <input
                        className="input input-md"
                        value={l.marginPctSale ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          updateRow(row.piNo, row.saleAmount, {
                            lastEdited: "marginPctSale",
                            value: e.target.value.replace(/[^0-9.]/g, ""),
                          })
                        }
                      />
                    </td>

                    {/* MARGIN % PURCHASE */}
                    <td className="p-3 border">
                      <input
                        className="input input-md"
                        value={l.marginPctPurchase ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          updateRow(row.piNo, row.saleAmount, {
                            lastEdited: "marginPctPurchase",
                            value: e.target.value.replace(/[^0-9.]/g, ""),
                          })
                        }
                      />
                    </td>

                    {/* MARGIN VALUE SALE */}
                    <td className="p-3 border">
                      <input
                        className="input input-md"
                        value={
                          l.marginValSale ?? (purchaseRate ? marginVal : "")
                        }
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          updateRow(row.piNo, row.saleAmount, {
                            lastEdited: "marginValSale",
                            value: e.target.value.replace(/[^0-9]/g, ""),
                          })
                        }
                      />
                    </td>

                    {/* MARGIN VALUE PURCHASE */}
                    <td className="p-3 border">
                      <input
                        className="input input-md"
                        value={
                          l.marginValPurchase ?? (purchaseRate ? marginVal : "")
                        }
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          updateRow(row.piNo, row.saleAmount, {
                            lastEdited: "marginValPurchase",
                            value: e.target.value.replace(/[^0-9]/g, ""),
                          })
                        }
                      />
                    </td>

                    {/* ACTIONS */}
                    <td className="p-3 border">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveLedger(row);
                          }}
                          className="px-3 py-1 rounded bg-indigo-600 text-white"
                        >
                          Save
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const l =
                              ledger[row.piNo] || savedLedger[row.piNo] || {};
                            setEditRow(row);
                            setNewRate(
                              String(
                                l.purchaseRate ?? l.confirmedPurchaseRate ?? "",
                              ),
                            );
                            setShowModal(true);
                          }}
                          className="px-3 py-1 rounded bg-amber-500 text-white"
                        >
                          Edit
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(row.piNo);
                          }}
                          className="px-3 py-1 rounded bg-red-500 text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* ===== EXPAND ROW ===== */}
                  {expandedRow === row.piNo &&
                    (() => {
                      const items = parseProducts(
                        row.products,
                        row.piNo,
                        saleRate,
                        purchaseRate,
                      );

                      const allFilled = items.every(
                        (it) => it.sale && it.purchase,
                      );

                      const totalSale = items.reduce(
                        (a, b) => a + num(b.sale),
                        0,
                      );
                      const totalPurchase = items.reduce(
                        (a, b) => a + num(b.purchase),
                        0,
                      );

                      const canCalc = totalSale > 0 && totalPurchase > 0;
                      const totalProfit = canCalc
                        ? totalSale - totalPurchase
                        : 0;
                      const marginPct = canCalc
                        ? ((totalProfit / totalSale) * 100).toFixed(2)
                        : 0;

                      return (
                        <tr>
                          <td colSpan={12} className="bg-slate-50 p-6 border">
                            <div
                              className="bg-white border rounded-xl shadow-sm p-5 relative"
                              data-nodrag="true"
                            >
                              {/* ❌ CLOSE BUTTON */}
                              <div className="mt-4 pl-[950px]">
                                {" "}
                                <button
                                  className="px-4 py-2 text-slate-400 hover:text-red-500 text-lg font-bolde rounded-lg mb-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedRow(null);
                                  }}
                                >
                                  ✕
                                </button>
                              </div>

                              {/* TABLE */}
                              <div className="w-[1000px] ">
                                <table className="w-full text-sm border">
                                  <thead className="bg-slate-100">
                                    <tr>
                                      <th className="p-2 border text-left">
                                        Product Name
                                      </th>
                                      <th className="p-2 border text-left">
                                        Sale Price
                                      </th>
                                      <th className="p-2 border text-left">
                                        Vendor
                                      </th>
                                      <th className="p-2 border text-left">
                                        Purchase Price
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {items.map((it) => (
                                      <tr key={it.id}>
                                        <td className="p-2 border">
                                          {it.name}
                                        </td>
                                        {/* SALE */}
                                        <td className="p-2 border">
                                          <input
                                            className="input input-md text-left"
                                            disabled={isExpandedLocked(
                                              row.piNo,
                                            )}
                                            value={it.sale}
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) =>
                                              e.stopPropagation()
                                            }
                                            onChange={(e) =>
                                              updateProductRate(
                                                it.id,
                                                "sale",
                                                e.target.value.replace(
                                                  /[^0-9]/g,
                                                  "",
                                                ),
                                              )
                                            }
                                          />
                                        </td>

                                        {/* 🔥 VENDOR COLUMN */}
                                        <td className="p-2 border">
                                          {isExpandedLocked(row.piNo) ? (
                                            <span className="font-medium">
                                              {it.vendor || "-"}
                                            </span>
                                          ) : (
                                            <select
                                              className="input input-md text-left"
                                              value={it.vendor || ""}
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                              onMouseDown={(e) =>
                                                e.stopPropagation()
                                              }
                                              onChange={(e) =>
                                                updateProductRate(
                                                  it.id,
                                                  "vendor",
                                                  e.target.value,
                                                )
                                              }
                                            >
                                              <option value="">
                                                Select Vendor
                                              </option>
                                              <option>Finecare</option>
                                              <option>Neelu Diagnostics</option>
                                              <option>Medlife</option>
                                              <option>RBPL Direct</option>
                                            </select>
                                          )}
                                        </td>

                                        {/* PURCHASE */}
                                        <td className="p-2 border">
                                          <input
                                            className="input input-md text-left"
                                            disabled={isExpandedLocked(
                                              row.piNo,
                                            )}
                                            value={it.purchase}
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) =>
                                              e.stopPropagation()
                                            }
                                            onChange={(e) =>
                                              updateProductRate(
                                                it.id,
                                                "purchase",
                                                e.target.value.replace(
                                                  /[^0-9]/g,
                                                  "",
                                                ),
                                              )
                                            }
                                          />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {/* SUMMARY */}
                              <div className="mt-4 flex items-center">
                                <div className="space-y-1 text-sm">
                                  <div>
                                    Margin % = <b>{marginPct}%</b>
                                  </div>
                                  <div>
                                    Margin Value = <b>₹{money(totalProfit)}</b>
                                  </div>
                                  <div className="font-semibold">
                                    Total Profit =
                                    <span className="text-emerald-600 ml-1">
                                      ₹{money(totalProfit)}
                                    </span>
                                  </div>
                                </div>

                                {/* SAVE BUTTON */}
                                {allFilled && (
                                  <div className="mt-4 pl-[650px] flex gap-3">
                                    {isExpandedLocked(row.piNo) ? (
                                      <button
                                        className="px-4 py-2 bg-amber-500 text-white rounded-lg"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingRows((p) => ({
                                            ...p,
                                            [row.piNo]: true,
                                          }));
                                        }}
                                      >
                                        Edit
                                      </button>
                                    ) : (
                                      allFilled && (
                                        <button
                                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            saveLedger(row);
                                            setEditingRows((p) => ({
                                              ...p,
                                              [row.piNo]: false,
                                            }));
                                          }}
                                        >
                                          Save
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal &&
        editRow &&
        (() => {
          const l = ledger[editRow.piNo] || savedLedger[editRow.piNo] || {};
          const isProfit = l.marginStatus === "PROFIT";
          const saleRate = num(l.saleRate ?? editRow.saleAmount);
          const purchaseRate = num(
            l.purchaseRate ?? l.confirmedPurchaseRate ?? 0,
          );
          const marginVal = saleRate - purchaseRate;
          const marginPctSale = saleRate
            ? ((marginVal / saleRate) * 100).toFixed(2)
            : "0.00";
          const marginPctPurchase = purchaseRate
            ? ((marginVal / purchaseRate) * 100).toFixed(2)
            : "0.00";
          return (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white w-[560px] rounded-2xl shadow-xl p-6 space-y-5">
                {/* HEADER */}
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      Edit PI Purchase
                    </h2>
                    <p className="text-xs text-slate-500">
                      PI No: {editRow.piNo}
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      isProfit
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {l.marginStatus}
                  </span>
                </div>

                {/* BASIC INFO */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Employee</p>
                    <p className="font-medium text-slate-800">
                      {editRow.employeeName}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">Product</p>
                    <p className="font-medium text-slate-800">
                      {editRow.products}
                    </p>
                  </div>
                </div>

                {/* FINANCIAL SUMMARY */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4">
                  <div>
                    <p className="text-xs text-slate-500">Sale Amount</p>
                    <p className="text-lg font-bold text-slate-800">
                      ₹{money(l.saleRate ?? editRow.saleAmount)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Purchase Amount</p>
                    <p className="text-lg font-bold text-slate-800">
                      <b className="text-slate-800">₹{money(purchaseRate)}</b>
                    </p>
                  </div>
                </div>

                {/* MARGIN DETAILS */}
                {/* MARGIN DETAILS */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  {/* MARGIN ₹ */}
                  <div className="bg-white border rounded-xl p-3">
                    <p className="text-xs text-slate-500">Margin ₹</p>
                    <p
                      className={`text-lg font-bold ${
                        marginVal >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      ₹{money(marginVal)}
                    </p>
                  </div>

                  {/* MARGIN % SALE */}
                  <div className="bg-white border rounded-xl p-3">
                    <p className="text-xs text-slate-500">Margin % (Sale)</p>
                    <p className="text-lg font-bold text-indigo-600">
                      {marginPctSale}%
                    </p>
                  </div>

                  {/* MARGIN % PURCHASE */}
                  <div className="bg-white border rounded-xl p-3">
                    <p className="text-xs text-slate-500">
                      Margin % (Purchase)
                    </p>
                    <p className="text-lg font-bold text-indigo-600">
                      {marginPctPurchase}%
                    </p>
                  </div>
                </div>

                {/* EDIT INPUT */}
                <div className="border-t pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">
                      Re-confirm Purchase Rate
                    </p>
                    <span className="text-xs text-slate-500">
                      (Overwrite previous rate)
                    </span>
                  </div>

                  {/* OLD PURCHASE INFO */}
                  <div className="text-xs text-slate-600">
                    Previous Purchase:&nbsp;
                    <b className="text-slate-800">
                      ₹
                      {money(
                        ledger[editRow.piNo]?.purchaseRate ??
                          savedLedger[editRow.piNo]?.purchaseRate ??
                          0,
                      )}
                    </b>
                  </div>

                  {/* INPUT */}
                  <input
                    className="input input-lg"
                    placeholder="Enter new purchase rate"
                    value={newRate}
                    onChange={(e) =>
                      setNewRate(e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />

                  {/* HELPER TEXT */}
                  <p className="text-xs text-slate-500">
                    Updating this will recalculate margin % and margin value
                    automatically.
                  </p>
                </div>

                {/* ACTIONS */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      handleReconfirm(editRow, newRate);
                      await saveLedger(editRow);
                      setShowModal(false);
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      <style>
        {`
          .input {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 8px 12px;
            width: 100%;
            transition: all 0.2s ease;
            background: #fff;
          }
          .input:focus {
            outline: none;
            border-color: #6366f1;
            box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
          }
          table th {
            background: linear-gradient(to bottom, #f8fafc, #eef2ff);
            font-weight: 700;
            color: #334155;
            white-space: nowrap;
          }
          table td {
            vertical-align: middle;
          }
          .drag-scroll {
            cursor: grab;
            user-select: none;
          }
          .drag-scroll.dragging { cursor: grabbing; }
          .drag-scroll::-webkit-scrollbar { height: 8px; }
          .drag-scroll::-webkit-scrollbar-thumb {
            background: #c7d2fe;
            border-radius: 10px;
          }
          .drag-scroll::-webkit-scrollbar-track { background: transparent; }

          /* ===== INPUT SIZES ===== */
            .input-sm {
              width: 72px;
              text-align: right;
            }

            .input-md {
              width: 96px;
              text-align: right;
            }

            .input-lg {
              width: 120px;
              text-align: right;
            }

            .input-xl {
              width: 150px;
              text-align: right;
            }

        `}
      </style>
    </div>
  );
}
