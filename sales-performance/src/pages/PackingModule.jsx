// PackingModule.jsx
// ✅ Premium UI + Firestore Integrated (No Pricing Anywhere)
// Flow: PI_CREATED → ACCOUNTS_VERIFIED → READY_FOR_PACKING → PACKED → READY_FOR_DISPATCH
// Data Source: orders collection (accountsVerified === true)

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  addDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";

/* ------------------ Helpers ------------------ */
const cn = (...classes) => classes.filter(Boolean).join(" ");

const Badge = ({ tone = "slate", children }) => {
  const map = {
    green: "bg-green-50 text-green-700 ring-green-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    purple: "bg-purple-50 text-purple-700 ring-purple-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        map[tone]
      )}
    >
      {children}
    </span>
  );
};

const SectionTitle = ({ title, subtitle }) => (
  <div className="mb-4">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
  </div>
);

const FieldLabel = ({ children }) => (
  <div className="text-xs font-semibold text-slate-600 mb-1">{children}</div>
);

const Input = (props) => (
  <input
    {...props}
    className={cn(
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
      "placeholder:text-slate-400 shadow-sm outline-none",
      "focus:border-slate-400 focus:ring-2 focus:ring-slate-200",
      props.className
    )}
  />
);

const Select = (props) => (
  <select
    {...props}
    className={cn(
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
      "shadow-sm outline-none",
      "focus:border-slate-400 focus:ring-2 focus:ring-slate-200",
      props.className
    )}
  />
);

const Checkbox = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
    />
    <span className="text-sm text-slate-700">{label}</span>
  </label>
);

const Divider = () => <div className="h-px bg-slate-200 my-5" />;

const EmptyState = ({ title, hint }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
    <div className="mx-auto mb-2 h-10 w-10 rounded-2xl bg-slate-100" />
    <div className="text-sm font-semibold text-slate-900">{title}</div>
    <div className="text-sm text-slate-500 mt-1">{hint}</div>
  </div>
);

/* ------------------ Status Mapping ------------------ */
const statusLabel = (s) => {
  const map = {
    READY_FOR_PACKING: "Ready for Packing",
    PACKING_IN_PROGRESS: "Packing in progress",
    PICKED: "Picked",
    PACKED: "Packed",
    QC_FAILED: "QC Failed",
    REPACK_REQUIRED: "Re-pack required",
    READY_FOR_DISPATCH: "Ready for Dispatch",
  };
  return map[s] || s || "-";
};

const statusTone = (s) => {
  if (s === "READY_FOR_PACKING") return "blue";
  if (s === "PACKING_IN_PROGRESS") return "purple";
  if (s === "PICKED") return "amber";
  if (s === "PACKED" || s === "READY_FOR_DISPATCH") return "green";
  if (s === "QC_FAILED") return "red";
  if (s === "REPACK_REQUIRED") return "amber";
  return "slate";
};

/* ------------------ Default Packing Form ------------------ */
const defaultPackingForm = (order) => ({
  orderId: order?.orderId || order?.id || "",
  packagingType: "BOX", // BOX | POLYBAG | ENVELOPE | GIFT
  boxSize: "M", // S | M | L | CUSTOM
  materials: {
    bubbleWrap: true,
    paperFill: false,
    foam: false,
    fragileSticker: false,
  },
  weight: { gross: "" }, // gross only, pricing not shown
  dimensions: { length: "", width: "", height: "" },
  fragile: false,
  packageCount: 1,
  qc: {
    productOk: true,
    quantityMatch: true,
    damageCheck: true,
    labelClear: true,
  },
});

/* ------------------ Main Component ------------------ */
export default function PackingModule() {
  const auth = getAuth();

  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [packingForm, setPackingForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  /* ============== LOAD: Orders that are Accounts Verified ============== */
  useEffect(() => {
    // Orders should already have orderId created at PI time.
    // Packing pulls from orders where accountsVerified true.
    const q = query(
      collection(db, "orders"),
      where("accountsVerified", "==", true),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setOrders(list);
      },
      (e) => setErr(e?.message || "Failed to load orders")
    );

    return () => unsub();
  }, []);

  /* ============== Derived UI List ============== */
  const filteredOrders = useMemo(() => {
    const s = search.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (statusFilter === "ALL") return true;
        return (o.packingStatus || "READY_FOR_PACKING") === statusFilter;
      })
      .filter((o) => {
        if (!s) return true;
        const orderId = String(o.orderId || "").toLowerCase();
        const customer = String(o.customerName || o.customer?.name || "").toLowerCase();
        const phone = String(o.customerPhone || o.customer?.phone || "").toLowerCase();
        return orderId.includes(s) || customer.includes(s) || phone.includes(s);
      });
  }, [orders, search, statusFilter]);

  /* ============== Selection Handling ============== */
  const openOrder = (o) => {
    setErr("");
    setSelectedOrder(o);
    setPackingForm(defaultPackingForm(o));
  };

  const closeOrder = () => {
    setSelectedOrder(null);
    setPackingForm(null);
    setErr("");
  };

  /* ============== Validation ============== */
  const isQcPassed = useMemo(() => {
    const qc = packingForm?.qc || {};
    return !!(qc.productOk && qc.quantityMatch && qc.damageCheck && qc.labelClear);
  }, [packingForm]);

  const requiredOkForPacked = useMemo(() => {
    if (!packingForm) return false;
    const { packagingType, boxSize, weight, dimensions, packageCount } = packingForm;

    const dimsRequired = packagingType === "BOX";
    const dimsOk = !dimsRequired
      ? true
      : !!dimensions.length && !!dimensions.width && !!dimensions.height;

    return (
      !!packagingType &&
      !!boxSize &&
      !!weight.gross &&
      dimsOk &&
      Number(packageCount) >= 1 &&
      isQcPassed
    );
  }, [packingForm, isQcPassed]);

  /* ============== Actions ============== */

  // 1) Start Packing → update order packingStatus
  const startPacking = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setErr("");
    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        packingStatus: "PACKING_IN_PROGRESS",
        packingStartedAt: serverTimestamp(),
        packingStartedBy: auth?.currentUser?.displayName || auth?.currentUser?.email || "User",
      });
    } catch (e) {
      setErr(e?.message || "Failed to start packing");
    } finally {
      setSaving(false);
    }
  };

  // 2) QC Failed
  const markQcFailed = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setErr("");
    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        packingStatus: "QC_FAILED",
        qcFailedAt: serverTimestamp(),
        qcFailedBy: auth?.currentUser?.displayName || auth?.currentUser?.email || "User",
      });
    } catch (e) {
      setErr(e?.message || "Failed to mark QC failed");
    } finally {
      setSaving(false);
    }
  };

  // 3) Re-pack
  const markRepackRequired = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setErr("");
    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        packingStatus: "REPACK_REQUIRED",
        repackAt: serverTimestamp(),
        repackBy: auth?.currentUser?.displayName || auth?.currentUser?.email || "User",
      });
    } catch (e) {
      setErr(e?.message || "Failed to mark re-pack required");
    } finally {
      setSaving(false);
    }
  };

  // 4) Mark Packed → create packing record + update order
  const markPacked = async () => {
    if (!selectedOrder || !packingForm) return;
    setSaving(true);
    setErr("");

    // Hard guard: if QC not passed, do not allow "Packed"
    if (!isQcPassed) {
      setSaving(false);
      setErr("QC failed. Please fix QC checks before marking packed.");
      return;
    }

    // Required fields guard
    if (!requiredOkForPacked) {
      setSaving(false);
      setErr("Please fill all required packing details before marking packed.");
      return;
    }

    try {
      // Create packing entry (audit record)
      await addDoc(collection(db, "packings"), {
        ...packingForm,
        orderDocId: selectedOrder.id,
        packedBy: auth?.currentUser?.displayName || auth?.currentUser?.email || "User",
        packedAt: serverTimestamp(),
        status: "PACKED",
      });

      // Update order status
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        packingStatus: "PACKED",
        packedAt: serverTimestamp(),
        packedBy: auth?.currentUser?.displayName || auth?.currentUser?.email || "User",
        packageCount: Number(packingForm.packageCount || 1),
        fragile: !!packingForm.fragile,
      });
    } catch (e) {
      setErr(e?.message || "Failed to mark packed");
    } finally {
      setSaving(false);
    }
  };

  // 5) Ready for Dispatch
  const sendToDispatch = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setErr("");
    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        packingStatus: "READY_FOR_DISPATCH",
        readyForDispatchAt: serverTimestamp(),
        readyForDispatchBy: auth?.currentUser?.displayName || auth?.currentUser?.email || "User",
      });
    } catch (e) {
      setErr(e?.message || "Failed to send to dispatch");
    } finally {
      setSaving(false);
    }
  };

  /* ============== UI ============== */
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Packing</h1>
              <p className="text-sm text-slate-500 mt-1">
                Only accounts verified orders appear here. (No pricing shown anywhere)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <Badge tone="green">Accounts Verified ✅</Badge>
              </div>
              <div className="hidden md:block">
                <Badge tone="slate">Status Flow: PI → Accounts → Packing</Badge>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-8">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Order ID / Customer / Phone…"
              />
            </div>
            <div className="md:col-span-4">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">All Status</option>
                <option value="READY_FOR_PACKING">Ready for Packing</option>
                <option value="PACKING_IN_PROGRESS">Packing in progress</option>
                <option value="PACKED">Packed</option>
                <option value="QC_FAILED">QC Failed</option>
                <option value="REPACK_REQUIRED">Re-pack required</option>
                <option value="READY_FOR_DISPATCH">Ready for Dispatch</option>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Orders Table */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <SectionTitle
                title="Accounts Verified Orders"
                subtitle="Select an order to start packing. Order ID comes from PI stage."
              />
            </div>

            {err ? (
              <div className="px-5 pb-5">
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {err}
                </div>
              </div>
            ) : null}

            {filteredOrders.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No orders found"
                  hint="Try changing filters or search. Only accounts verified orders appear."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left font-semibold px-5 py-3">Order</th>
                      <th className="text-left font-semibold px-5 py-3">Customer</th>
                      <th className="text-left font-semibold px-5 py-3">Status</th>
                      <th className="text-right font-semibold px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((o) => {
                      const st = o.packingStatus || "READY_FOR_PACKING";
                      return (
                        <tr
                          key={o.id}
                          className={cn(
                            "hover:bg-slate-50",
                            selectedOrder?.id === o.id && "bg-slate-50"
                          )}
                        >
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900">
                              {o.orderId || o.id}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              PI Generated → Accounts Verified → Packing
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-slate-900 font-medium">
                              {o.customerName || o.customer?.name || "-"}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {o.customerPhone || o.customer?.phone || ""}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <Badge tone={statusTone(st)}>{statusLabel(st)}</Badge>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => openOrder(o)}
                              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 active:scale-[0.99]"
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Note block */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Order ID rule</div>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600">
                <li>Order ID is created at <b>PI stage</b> (Proforma Invoice create).</li>
                <li>Accounts team verifies → sets <b>accountsVerified = true</b>.</li>
                <li>Packing module fetches those orders and continues the flow.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right: Packing Drawer */}
        <div className="lg:col-span-5">
          {!selectedOrder ? (
            <EmptyState
              title="Select an order to start packing"
              hint="Click 'Open' on any accounts verified order."
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500">ORDER</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {selectedOrder.orderId || selectedOrder.id}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone="green">Accounts Verified</Badge>
                    <Badge tone={statusTone(selectedOrder.packingStatus || "READY_FOR_PACKING")}>
                      {statusLabel(selectedOrder.packingStatus || "READY_FOR_PACKING")}
                    </Badge>
                  </div>
                </div>

                <button
                  onClick={closeOrder}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              {/* Body */}
              <div className="p-5">
                {/* Order Summary (READ ONLY) */}
                <SectionTitle title="Order Details" subtitle="Read-only information" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Customer Name</FieldLabel>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                      {selectedOrder.customerName || selectedOrder.customer?.name || "-"}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Phone</FieldLabel>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                      {selectedOrder.customerPhone || selectedOrder.customer?.phone || "-"}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Address</FieldLabel>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap">
                      {selectedOrder.shippingAddress ||
                        selectedOrder.address ||
                        selectedOrder.customer?.address ||
                        "-"}
                    </div>
                  </div>
                </div>

                <Divider />

                {/* Products (READ ONLY) */}
                <SectionTitle
                  title="Product List"
                  subtitle="Only product name & quantity (No pricing)"
                />

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left font-semibold px-4 py-3">Product</th>
                        <th className="text-left font-semibold px-4 py-3">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedOrder.items || selectedOrder.products || []).length ? (
                        (selectedOrder.items || selectedOrder.products).map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">
                                {it.name || it.productName || it.desc || "-"}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {it.sku ? `SKU: ${it.sku}` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-800">
                              {it.qty || it.quantity || "-"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-4 py-4 text-slate-500" colSpan={2}>
                            No items found in order. Ensure PI stage saved items list.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Divider />

                {/* Packing Form */}
                <SectionTitle title="Packing Details" subtitle="Fill these fields to mark packed" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Packaging Type</FieldLabel>
                    <Select
                      value={packingForm.packagingType}
                      onChange={(e) =>
                        setPackingForm((p) => ({
                          ...p,
                          packagingType: e.target.value,
                        }))
                      }
                    >
                      <option value="BOX">Box</option>
                      <option value="POLYBAG">Polybag</option>
                      <option value="ENVELOPE">Envelope</option>
                      <option value="GIFT">Gift Pack</option>
                    </Select>
                  </div>

                  <div>
                    <FieldLabel>Box Size</FieldLabel>
                    <Select
                      value={packingForm.boxSize}
                      onChange={(e) => setPackingForm((p) => ({ ...p, boxSize: e.target.value }))}
                    >
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="CUSTOM">Custom</option>
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <FieldLabel>Materials</FieldLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-slate-200 p-4">
                      <Checkbox
                        checked={packingForm.materials.bubbleWrap}
                        onChange={(v) =>
                          setPackingForm((p) => ({
                            ...p,
                            materials: { ...p.materials, bubbleWrap: v },
                          }))
                        }
                        label="Bubble wrap"
                      />
                      <Checkbox
                        checked={packingForm.materials.paperFill}
                        onChange={(v) =>
                          setPackingForm((p) => ({
                            ...p,
                            materials: { ...p.materials, paperFill: v },
                          }))
                        }
                        label="Paper fill"
                      />
                      <Checkbox
                        checked={packingForm.materials.foam}
                        onChange={(v) =>
                          setPackingForm((p) => ({
                            ...p,
                            materials: { ...p.materials, foam: v },
                          }))
                        }
                        label="Foam"
                      />
                      <Checkbox
                        checked={packingForm.materials.fragileSticker}
                        onChange={(v) =>
                          setPackingForm((p) => ({
                            ...p,
                            materials: { ...p.materials, fragileSticker: v },
                          }))
                        }
                        label="Fragile sticker"
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Gross Weight (kg) *</FieldLabel>
                    <Input
                      type="number"
                      value={packingForm.weight.gross}
                      onChange={(e) =>
                        setPackingForm((p) => ({
                          ...p,
                          weight: { ...p.weight, gross: e.target.value },
                        }))
                      }
                      placeholder="e.g. 1.50"
                    />
                  </div>

                  <div>
                    <FieldLabel>Package Count *</FieldLabel>
                    <Input
                      type="number"
                      min={1}
                      value={packingForm.packageCount}
                      onChange={(e) =>
                        setPackingForm((p) => ({
                          ...p,
                          packageCount: e.target.value,
                        }))
                      }
                      placeholder="e.g. 1"
                    />
                  </div>

                  {/* Dimensions only mandatory for BOX */}
                  <div className="sm:col-span-2">
                    <FieldLabel>
                      Dimensions (cm){" "}
                      {packingForm.packagingType === "BOX" ? "*" : "(optional)"}
                    </FieldLabel>
                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        type="number"
                        value={packingForm.dimensions.length}
                        onChange={(e) =>
                          setPackingForm((p) => ({
                            ...p,
                            dimensions: { ...p.dimensions, length: e.target.value },
                          }))
                        }
                        placeholder="L"
                      />
                      <Input
                        type="number"
                        value={packingForm.dimensions.width}
                        onChange={(e) =>
                          setPackingForm((p) => ({
                            ...p,
                            dimensions: { ...p.dimensions, width: e.target.value },
                          }))
                        }
                        placeholder="W"
                      />
                      <Input
                        type="number"
                        value={packingForm.dimensions.height}
                        onChange={(e) =>
                          setPackingForm((p) => ({
                            ...p,
                            dimensions: { ...p.dimensions, height: e.target.value },
                          }))
                        }
                        placeholder="H"
                      />
                    </div>
                    {packingForm.packagingType === "BOX" ? (
                      <div className="text-xs text-slate-500 mt-2">
                        Box type me dimensions required hai.
                      </div>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <Checkbox
                      checked={packingForm.fragile}
                      onChange={(v) => setPackingForm((p) => ({ ...p, fragile: v }))}
                      label="Fragile item"
                    />
                  </div>
                </div>

                <Divider />

                {/* QC */}
                <SectionTitle title="Quality Check" subtitle="All must be YES to mark packed" />

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Checkbox
                      checked={packingForm.qc.productOk}
                      onChange={(v) =>
                        setPackingForm((p) => ({ ...p, qc: { ...p.qc, productOk: v } }))
                      }
                      label="Product OK"
                    />
                    <Checkbox
                      checked={packingForm.qc.quantityMatch}
                      onChange={(v) =>
                        setPackingForm((p) => ({ ...p, qc: { ...p.qc, quantityMatch: v } }))
                      }
                      label="Quantity Match"
                    />
                    <Checkbox
                      checked={packingForm.qc.damageCheck}
                      onChange={(v) =>
                        setPackingForm((p) => ({ ...p, qc: { ...p.qc, damageCheck: v } }))
                      }
                      label="Damage Check"
                    />
                    <Checkbox
                      checked={packingForm.qc.labelClear}
                      onChange={(v) =>
                        setPackingForm((p) => ({ ...p, qc: { ...p.qc, labelClear: v } }))
                      }
                      label="Label Clear"
                    />
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Badge tone={isQcPassed ? "green" : "red"}>
                      {isQcPassed ? "QC Passed" : "QC Not Passed"}
                    </Badge>
                    {!isQcPassed ? (
                      <span className="text-xs text-slate-500">
                        QC failed me order ko QC_FAILED / REPACK_REQUIRED kar sakte ho.
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Error */}
                {err ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {err}
                  </div>
                ) : null}

                {/* Actions */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    disabled={saving}
                    onClick={startPacking}
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm",
                      "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                      saving && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    ▶ Start Packing
                  </button>

                  <button
                    disabled={saving || !requiredOkForPacked}
                    onClick={markPacked}
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm",
                      "bg-slate-900 text-white hover:bg-slate-800",
                      (saving || !requiredOkForPacked) && "opacity-60 cursor-not-allowed"
                    )}
                    title={!requiredOkForPacked ? "Fill required fields + QC pass" : ""}
                  >
                    ✅ Mark as Packed
                  </button>

                  <button
                    disabled={saving}
                    onClick={markQcFailed}
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm",
                      "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                      saving && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    ❌ QC Failed
                  </button>

                  <button
                    disabled={saving}
                    onClick={markRepackRequired}
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm",
                      "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                      saving && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    🔁 Re-Pack Required
                  </button>

                  <button
                    disabled={saving}
                    onClick={sendToDispatch}
                    className={cn(
                      "sm:col-span-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm",
                      "border border-green-200 bg-green-50 text-green-800 hover:bg-green-100",
                      saving && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    🚚 Send to Dispatch
                  </button>
                </div>

                <div className="mt-4 text-xs text-slate-500">
                  Note: Order ID yahin generate nahi hoti. Ye <b>PI create</b> time par
                  banti hai aur orders collection me save hoti hai.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
