import React, { useState, useEffect } from "react";
import {
  UserCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  SparklesIcon,
  BuildingOffice2Icon,
  CurrencyRupeeIcon,
  ClockIcon,
  TagIcon,
  ArrowPathIcon,
  EyeIcon,
  PhotoIcon,
  DocumentCheckIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  CalendarIcon,
  MapPinIcon,
  ShoppingBagIcon,
  PencilSquareIcon,
  CheckIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  UserIcon,
  CheckBadgeIcon,
  FunnelIcon,
  XMarkIcon,
  BellIcon,
  ArrowsPointingOutIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  loadInquiriesFromStorage,
  saveInquiriesToStorage,
} from "../data/procurementStore";
import { db } from "../firebase";
import { collection, onSnapshot, doc, setDoc, query, orderBy } from "firebase/firestore";

// Default Product Image for fallback
const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80";

export default function ItemInquiry() {
  // 1️⃣ DETECT LOGGED-IN USER CREDENTIALS FROM LOCALSTORAGE (Set during Login)
  const loggedInUser = React.useMemo(() => {
    const name = localStorage.getItem("employeeName") || "RajBiosis User";
    const rawRole = (localStorage.getItem("role") || "MANAGER").toUpperCase();
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

    const role =
      rawRole === "ADMIN" || rawRole === "TL" || rawRole === "MANAGER"
        ? "MANAGER"
        : rawRole === "PURCHASING" || rawRole === "PROCUREMENT"
        ? "PROCUREMENT"
        : "EMPLOYEE";

    return { name, role, rawRole, initials };
  }, []);

  // Current active user role toggle: 'EMPLOYEE' | 'PROCUREMENT' | 'MANAGER'
  const [currentRole, setCurrentRole] = useState(() => loggedInUser.role);

  // Load Inquiries State from Shared Store (Starts clean / empty if no data)
  const [inquiries, setInquiries] = useState(() => loadInquiriesFromStorage());

  // Real-time Firestore sync across all users / browsers
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const q = query(collection(db, "item_inquiries"), orderBy("createdAtTimestamp", "desc"));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetched = snapshot.docs.map((d) => ({
            ...d.data(),
            docId: d.id,
          }));
          if (fetched.length > 0) {
            setInquiries(fetched);
            saveInquiriesToStorage(fetched);
          }
        },
        (err) => {
          console.error("Firestore inquiry fetch error:", err);
        }
      );
    } catch (e) {
      console.error("Firestore setup error:", e);
    }
    return () => unsubscribe();
  }, []);

  // Registered Purchasing Users State from Firestore
  const [purchasingUsers, setPurchasingUsers] = useState([]);

  useEffect(() => {
    let unsub = () => {};
    try {
      const qUsers = query(collection(db, "users"));
      unsub = onSnapshot(qUsers, (snap) => {
        const pUsers = [];
        snap.docs.forEach((docSnap) => {
          const u = docSnap.data();
          if (u.role === "PURCHASING" || u.role === "PROCUREMENT") {
            pUsers.push(u);
          }
        });
        setPurchasingUsers(pUsers);
      });
    } catch (e) {
      console.error("Error fetching purchasing users:", e);
    }
    return () => unsub();
  }, []);

  // Active Inquiry Selection
  const [selectedInquiryId, setSelectedInquiryId] = useState("");

  // Auto select first inquiry if available
  useEffect(() => {
    if (inquiries.length > 0 && (!selectedInquiryId || !inquiries.some((i) => i.id === selectedInquiryId))) {
      setSelectedInquiryId(inquiries[0].id);
    }
  }, [inquiries, selectedInquiryId]);

  // Inner Sidebar Tab State: 'ALL' | 'NEW' | 'PENDING' | 'COMPLETED'
  const [sidebarTab, setSidebarTab] = useState("PENDING");

  // Employee Filter State (default null so Purchasing & Manager see ALL inquiries)
  const [selectedEmpFilter, setSelectedEmpFilter] = useState(null);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Mode: 'VIEW' | 'CREATE' | 'EDIT'
  const [viewMode, setViewMode] = useState("VIEW");

  // Image Lightbox Modal State
  const [lightboxImage, setLightboxImage] = useState(null);

  // Notifications Toast & Permission State
  const [activeToast, setActiveToast] = useState(null);
  const [desktopPermission, setDesktopPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );

  // Register Service Worker for Native Windows Action Center Notifications
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.log("Service Worker registration skipped:", err);
      });
    }
  }, []);

  // Universal Push Notification Trigger
  const triggerPushNotification = (title, message) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted") {
      const notifObj = {
        id: Date.now(),
        title,
        message,
        time: "Just now",
      };
      setActiveToast(notifObj);
      setTimeout(() => {
        setActiveToast((current) => (current?.id === notifObj.id ? null : current));
      }, 5000);
    } else {
      setActiveToast(null);
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      const notifTag = `windows-os-alert-${Date.now()}`;
      const options = {
        body: message,
        icon: "https://cdn-icons-png.flaticon.com/512/1827/1827504.png",
        tag: notifTag,
        requireInteraction: false,
        silent: false,
      };

      const fireNativeOSNotif = () => {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, options);
            setTimeout(() => {
              reg.getNotifications({ tag: notifTag }).then((notifs) => {
                notifs.forEach((n) => n.close());
              });
            }, 8000);
          });
        } else {
          try {
            const notif = new Notification(title, options);
            notif.onclick = () => {
              window.focus();
              notif.close();
            };
            setTimeout(() => {
              try {
                notif.close();
              } catch (e) {}
            }, 8000);
          } catch (e) {
            console.log("Native OS Notification Error:", e);
          }
        }
      };

      if (Notification.permission === "granted") {
        fireNativeOSNotif();
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          setDesktopPermission(permission);
          if (permission === "granted") {
            fireNativeOSNotif();
          }
        });
      }
    }
  };

  // Scheduled Push Notification engine for pending tasks
  useEffect(() => {
    const pendingNotifTimer = setInterval(() => {
      const now = Date.now();

      inquiries.forEach((item) => {
        const itemCreatedTime =
          item.createdAtTimestamp || (item.date ? new Date(item.date).getTime() : now - 360000);
        const pendingMins = Math.floor((now - itemCreatedTime) / (60 * 1000));

        if (pendingMins >= 5) {
          if (item.status === "PENDING_PROCUREMENT" || item.status === "NEW") {
            triggerPushNotification(
              `⏰ Pending Procurement Alert (${pendingMins}m)`,
              `Inquiry ${item.id} (${item.product}) by ${item.employeeFullName} has been pending Procurement for ${pendingMins} mins.`
            );
          } else if (item.status === "PENDING_MANAGER") {
            triggerPushNotification(
              `⏰ Pending Manager Approval Alert (${pendingMins}m)`,
              `Inquiry ${item.id} (${item.product}) is pending Manager selling price approval for ${pendingMins} mins.`
            );
          }
        }
      });
    }, 60000);

    return () => clearInterval(pendingNotifTimer);
  }, [inquiries]);

  // Multiple Vendor Quotes State
  const [procQuotes, setProcQuotes] = useState([
    { vendorName: "", price: "", phone: "", email: "", remarks: "", date: new Date().toISOString().split("T")[0] },
  ]);

  // Selected Vendor Quote Index by Manager
  const [selectedVendorIndexByManager, setSelectedVendorIndexByManager] = useState(0);

  // Form States for Manager
  const [inputSellingPrice, setInputSellingPrice] = useState("");
  const [inputMgrRemarks, setInputMgrRemarks] = useState("");

  // Create / Edit New Inquiry Form Fields
  const [newCustName, setNewCustName] = useState("");
  const [newFirmName, setNewFirmName] = useState("");
  const [newProdName, setNewProdName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newTargetPrice, setNewTargetPrice] = useState("");
  const [newEmpName, setNewEmpName] = useState(() => loggedInUser.name);
  const [newEmpInitials, setNewEmpInitials] = useState(() => loggedInUser.initials);
  const [newProdImage, setNewProdImage] = useState(DEFAULT_PRODUCT_IMAGE);
  const [newProcUser, setNewProcUser] = useState("Vikram Sharma (Procurement Officer)");

  // Active Inquiry Object
  const activeInquiry = inquiries.find((item) => item.id === selectedInquiryId) || inquiries[0];

  // Sync Form inputs when activeInquiry changes
  useEffect(() => {
    if (activeInquiry) {
      if (activeInquiry.vendorQuotes && activeInquiry.vendorQuotes.length > 0) {
        setProcQuotes(activeInquiry.vendorQuotes);
      } else {
        setProcQuotes([
          { vendorName: "", price: "", phone: "", email: "", remarks: "", date: new Date().toISOString().split("T")[0] },
        ]);
      }

      setSelectedVendorIndexByManager(
        activeInquiry.selectedVendorIndex !== null && activeInquiry.selectedVendorIndex !== undefined
          ? activeInquiry.selectedVendorIndex
          : 0
      );

      setInputSellingPrice(activeInquiry.sellingPrice ? String(activeInquiry.sellingPrice) : "");
      setInputMgrRemarks(activeInquiry.managerRemarks || "");
    }
  }, [selectedInquiryId, inquiries]);

  // Save to Shared Store whenever inquiries state changes
  useEffect(() => {
    saveInquiriesToStorage(inquiries);
  }, [inquiries]);

  // Sidebar Counts
  const countNew = inquiries.filter((i) => i.status === "NEW" || i.status === "PENDING_PROCUREMENT").length;
  const countPending = inquiries.filter(
    (i) => i.status === "PENDING_PROCUREMENT" || i.status === "PENDING_MANAGER"
  ).length;
  const countCompleted = inquiries.filter((i) => i.status === "COMPLETED").length;

  // Filtered List for Inner Sidebar
  const filteredInquiries = inquiries.filter((item) => {
    if (selectedEmpFilter && item.employeeFullName !== selectedEmpFilter) {
      return false;
    }

    let matchesTab = true;
    if (sidebarTab === "NEW") {
      matchesTab = item.status === "NEW" || item.status === "PENDING_PROCUREMENT";
    } else if (sidebarTab === "PENDING") {
      matchesTab = item.status === "PENDING_PROCUREMENT" || item.status === "PENDING_MANAGER";
    } else if (sidebarTab === "COMPLETED") {
      matchesTab = item.status === "COMPLETED";
    }

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.id.toLowerCase().includes(q) ||
      item.customer.toLowerCase().includes(q) ||
      item.product.toLowerCase().includes(q) ||
      item.employeeFullName.toLowerCase().includes(q) ||
      item.procurementUser.toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  // Handler: Image File Upload via FileReader
  const handleImageFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProdImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handler: Add another Vendor Quote input (up to 3 quotes)
  const handleAddVendorQuoteInput = () => {
    if (procQuotes.length < 3) {
      setProcQuotes([
        ...procQuotes,
        { vendorName: "", price: "", phone: "", email: "", remarks: "", date: new Date().toISOString().split("T")[0] },
      ]);
    }
  };

  // Handler: Remove a vendor quote input
  const handleRemoveVendorQuoteInput = (index) => {
    if (procQuotes.length > 1) {
      const updated = procQuotes.filter((_, idx) => idx !== index);
      setProcQuotes(updated);
    }
  };

  // Handler: Change field in vendor quote
  const handleVendorQuoteChange = (index, field, value) => {
    const updated = [...procQuotes];
    updated[index][field] = value;
    setProcQuotes(updated);
  };

  // Handler: Procurement Submits Multiple Vendor Quotes
  const handleProcurementSubmit = (e) => {
    e.preventDefault();
    if (!activeInquiry) return;

    const validQuotes = procQuotes
      .filter((q) => q.vendorName.trim() !== "" && q.price !== "" && Number(q.price) > 0)
      .map((q) => ({
        ...q,
        procurementUser: activeInquiry.procurementUser || "Vikram Sharma (Procurement Officer)",
        date: q.date || new Date().toISOString().split("T")[0],
      }));

    if (validQuotes.length === 0) return;

    const primaryQuote = validQuotes[0];

    const updatedInquiries = inquiries.map((item) => {
      if (item.id === activeInquiry.id) {
        const payload = {
          ...item,
          vendorQuotes: validQuotes,
          vendorPrice: Number(primaryQuote.price),
          procurementVendorName: primaryQuote.vendorName,
          procurementRemarks: primaryQuote.remarks || "Vendor quotation submitted.",
          selectedVendorIndex: 0,
          status: "PENDING_MANAGER",
          updatedAt: "Just now",
        };
        setDoc(doc(db, "item_inquiries", activeInquiry.id), payload, { merge: true }).catch(console.error);
        return payload;
      }
      return item;
    });

    setInquiries(updatedInquiries);

    triggerPushNotification(
      "Inquiry Pending from Manager",
      `Procurement submitted ${validQuotes.length} vendor quote(s) for ${activeInquiry.product}. Pending Manager approval.`
    );
  };

  // Handler: Manager Approves Inquiry & Sets Selling Price
  const handleManagerApprove = (e) => {
    e.preventDefault();
    if (!activeInquiry || !inputSellingPrice || Number(inputSellingPrice) <= 0) return;

    const chosenQuote = activeInquiry.vendorQuotes[selectedVendorIndexByManager] || activeInquiry.vendorQuotes[0];
    const costPriceToUse = chosenQuote ? Number(chosenQuote.price) : Number(activeInquiry.vendorPrice);
    const vendorNameToUse = chosenQuote ? chosenQuote.vendorName : activeInquiry.procurementVendorName;

    const currentMgrUser = `${loggedInUser.name} (${loggedInUser.rawRole || "Manager"})`;

    const updatedInquiries = inquiries.map((item) => {
      if (item.id === activeInquiry.id) {
        const payload = {
          ...item,
          vendorPrice: costPriceToUse,
          procurementVendorName: vendorNameToUse,
          selectedVendorIndex: selectedVendorIndexByManager,
          sellingPrice: Number(inputSellingPrice),
          managerUser: currentMgrUser,
          managerRemarks: inputMgrRemarks || "Price approved by manager.",
          status: "COMPLETED",
          updatedAt: "Just now",
        };
        setDoc(doc(db, "item_inquiries", activeInquiry.id), payload, { merge: true }).catch(console.error);
        return payload;
      }
      return item;
    });

    setInquiries(updatedInquiries);

    triggerPushNotification(
      "Inquiry Completed & Approved!",
      `${currentMgrUser} approved selling price ₹${Number(inputSellingPrice).toLocaleString("en-IN")} for ${activeInquiry.product}. Task completed!`
    );
  };

  // Handler: Create New Inquiry (Employee Only)
  const handleCreateNewInquirySubmit = (e) => {
    e.preventDefault();
    if (!newCustName || !newProdName || !newQty) return;

    const initials = newEmpInitials || newEmpName.split(" ").map((n) => n[0]).join("").toUpperCase();
    const nextSeq = inquiries.length + 1;
    const newId = `INQ-2026-0${nextSeq < 10 ? "0" + nextSeq : nextSeq}`;

    const newInquiryObj = {
      id: newId,
      employee: initials,
      employeeFullName: newEmpName,
      date: new Date().toISOString().split("T")[0],
      createdAtTimestamp: Date.now(),
      customer: newCustName,
      firm: newFirmName || newCustName,
      product: newProdName,
      qty: newQty,
      location: newLocation || "Jaipur",
      targetPrice: newTargetPrice ? Number(newTargetPrice) : 0,
      image: newProdImage || DEFAULT_PRODUCT_IMAGE,
      status: "PENDING_PROCUREMENT",
      procurementUser: newProcUser,
      vendorQuotes: [],
      selectedVendorIndex: null,
      procurementVendorName: "",
      vendorPrice: "",
      procurementRemarks: "",
      managerUser: `${loggedInUser.name} (${loggedInUser.rawRole || "Manager"})`,
      sellingPrice: "",
      managerRemarks: "",
      updatedAt: "Just now",
    };

    setDoc(doc(db, "item_inquiries", newId), newInquiryObj).catch(console.error);

    const updated = [newInquiryObj, ...inquiries];
    setInquiries(updated);
    setSelectedInquiryId(newId);
    setViewMode("VIEW");

    setNewCustName("");
    setNewFirmName("");
    setNewProdName("");
    setNewQty("");
    setNewLocation("");
    setNewTargetPrice("");
    setNewProdImage(DEFAULT_PRODUCT_IMAGE);

    triggerPushNotification(
      "New Inquiry Received!",
      `New inquiry ${newId} created for ${newProdName} by ${newEmpName}.`
    );

    setTimeout(() => {
      triggerPushNotification(
        "Inquiry Pending from Procurement",
        `Inquiry ${newId} assigned to ${newProcUser}.`
      );
    }, 1200);
  };

  // Handler: Update Existing Inquiry (Employee Edit Mode)
  const handleUpdateInquirySubmit = (e) => {
    e.preventDefault();
    if (!activeInquiry || !newCustName || !newProdName || !newQty) return;

    const initials = newEmpInitials || newEmpName.split(" ").map((n) => n[0]).join("").toUpperCase();

    const updatedInquiries = inquiries.map((item) => {
      if (item.id === activeInquiry.id) {
        const payload = {
          ...item,
          employee: initials,
          employeeFullName: newEmpName,
          customer: newCustName,
          firm: newFirmName || newCustName,
          product: newProdName,
          qty: newQty,
          location: newLocation || "Jaipur",
          targetPrice: newTargetPrice ? Number(newTargetPrice) : 0,
          image: newProdImage || DEFAULT_PRODUCT_IMAGE,
          procurementUser: newProcUser,
          updatedAt: "Just now",
        };
        setDoc(doc(db, "item_inquiries", activeInquiry.id), payload, { merge: true }).catch(console.error);
        return payload;
      }
      return item;
    });

    setInquiries(updatedInquiries);
    setViewMode("VIEW");

    triggerPushNotification(
      "Inquiry Updated!",
      `Inquiry ${activeInquiry.id} (${newProdName}) was updated by ${newEmpName}.`
    );
  };

  // Helper for Status Badge styling
  const renderStatusBadge = (status) => {
    if (status === "NEW" || status === "PENDING_PROCUREMENT") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Pending Procurement
        </span>
      );
    }
    if (status === "PENDING_MANAGER") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
          Pending Manager Approval
        </span>
      );
    }
    if (status === "COMPLETED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
          <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
          Price Approved & Completed
        </span>
      );
    }
    return null;
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 font-sans text-slate-800 pb-16 relative">
      {/* IN-APP TOAST FALLBACK (If OS desktop notifications blocked) */}
      {activeToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-bounceIn">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                <BellIcon className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-extrabold text-amber-400">
                  {activeToast.title}
                </h4>
                <p className="text-[11.5px] text-slate-200 font-medium leading-snug">
                  {activeToast.message}
                </p>
                <span className="text-[9.5px] text-slate-400 block pt-1 font-mono">
                  Desktop Notification • {activeToast.time}
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* IMAGE LIGHTBOX MODAL */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full border border-slate-200 space-y-4 p-5 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {lightboxImage.title}
                </h3>
                <p className="text-xs text-slate-500">{lightboxImage.customer}</p>
              </div>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center max-h-[500px]">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.title}
                className="w-full h-full object-contain max-h-[480px]"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>High Resolution Spec Preview</span>
              <button
                onClick={() => setLightboxImage(null)}
                className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN 2-COLUMN LAYOUT: LEFT SIDEBAR & RIGHT CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[720px]">
        {/* LEFT COLUMN: INNER SIDEBAR */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col sticky top-6 h-[calc(100vh-120px)] min-h-[650px] max-h-[820px]">
          {/* FIXED TOP HEADER: TITLE, NEW INQUIRY BUTTON, SEARCH & TABS */}
          <div className="p-4 border-b border-slate-100 space-y-3.5 bg-white flex-shrink-0 sticky top-0 z-10 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FunnelIcon className="w-4 h-4 text-indigo-600" />
                Inquiries Directory
              </span>
              <button
                onClick={() => {
                  setCurrentRole("EMPLOYEE");
                  setNewCustName("");
                  setNewFirmName("");
                  setNewProdName("");
                  setNewQty("");
                  setNewLocation("");
                  setNewTargetPrice("");
                  setNewProdImage(DEFAULT_PRODUCT_IMAGE);
                  setViewMode("CREATE");
                }}
                className="px-3 py-1.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title="Create New Item Inquiry (Employee Only)"
              >
                <PlusIcon className="w-4 h-4 stroke-[3]" />
                + New Inquiry
              </button>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ID, customer, product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* SIDEBAR CATEGORY TABS */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/60 rounded-xl text-[11px] font-bold">
              <button
                onClick={() => setSidebarTab("NEW")}
                className={`py-1.5 rounded-lg text-center transition-all flex flex-col items-center justify-center ${
                  sidebarTab === "NEW" ? "bg-white text-indigo-700 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>New</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] mt-0.5 ${sidebarTab === "NEW" ? "bg-amber-100 text-amber-800 font-extrabold" : "bg-slate-300 text-slate-700"}`}>
                  {countNew}
                </span>
              </button>

              <button
                onClick={() => setSidebarTab("PENDING")}
                className={`py-1.5 rounded-lg text-center transition-all flex flex-col items-center justify-center ${
                  sidebarTab === "PENDING" ? "bg-white text-indigo-700 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Pending</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] mt-0.5 ${sidebarTab === "PENDING" ? "bg-indigo-100 text-indigo-800 font-extrabold" : "bg-slate-300 text-slate-700"}`}>
                  {countPending}
                </span>
              </button>

              <button
                onClick={() => setSidebarTab("COMPLETED")}
                className={`py-1.5 rounded-lg text-center transition-all flex flex-col items-center justify-center ${
                  sidebarTab === "COMPLETED" ? "bg-white text-emerald-700 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Done</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] mt-0.5 ${sidebarTab === "COMPLETED" ? "bg-emerald-100 text-emerald-800 font-extrabold" : "bg-slate-300 text-slate-700"}`}>
                  {countCompleted}
                </span>
              </button>

              <button
                onClick={() => setSidebarTab("ALL")}
                className={`py-1.5 rounded-lg text-center transition-all flex flex-col items-center justify-center ${
                  sidebarTab === "ALL" ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>All</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] mt-0.5 ${sidebarTab === "ALL" ? "bg-slate-900 text-white font-extrabold" : "bg-slate-300 text-slate-700"}`}>
                  {inquiries.length}
                </span>
              </button>
            </div>
          </div>

          {/* SCROLLABLE INQUIRIES LIST */}
          <div className="p-3 space-y-2.5 overflow-y-auto flex-1 custom-scrollbar">
            {filteredInquiries.length === 0 ? (
              <div className="p-6 text-center space-y-2 my-auto text-slate-400">
                <ShoppingBagIcon className="w-10 h-10 mx-auto opacity-40 text-indigo-500" />
                <p className="text-xs font-bold text-slate-600">No Inquiries Found</p>
                <p className="text-[11px] text-slate-400">
                  Switch to Employee persona & click "+ New Inquiry" to create a new requirement.
                </p>
              </div>
            ) : (
              filteredInquiries.map((item) => {
                const isSelected = item.id === selectedInquiryId;
                const isPendingProc = item.status === "NEW" || item.status === "PENDING_PROCUREMENT";
                const isPendingMgr = item.status === "PENDING_MANAGER";

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedInquiryId(item.id);
                      setViewMode("VIEW");
                    }}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all space-y-2 relative ${
                      isSelected
                        ? "bg-indigo-50/80 border-indigo-600 shadow-xs ring-1 ring-indigo-200"
                        : "bg-white hover:bg-slate-50/80 border-slate-200/90"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-indigo-700 font-mono text-[11px]">
                        {item.id}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                          {item.employee}
                        </span>
                        <span className="text-[10.5px] font-bold text-slate-700">
                          {item.employeeFullName}
                        </span>
                      </div>
                    </div>

                    <h4 className="font-extrabold text-slate-900 text-xs line-clamp-1">
                      {item.product}
                    </h4>

                    <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
                      <span className="truncate max-w-[150px]">{item.customer}</span>
                      <span className="font-bold text-slate-800">Qty: {item.qty}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                      {isPendingProc ? (
                        <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending Procurement
                        </span>
                      ) : isPendingMgr ? (
                        <span className="text-[10px] font-extrabold text-indigo-800 bg-indigo-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                          Pending Manager
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckIcon className="w-3 h-3 text-emerald-600 stroke-[3]" />
                          Approved
                        </span>
                      )}

                      <span className="text-[11px] font-extrabold text-slate-800">
                        {item.vendorPrice
                          ? `₹${Number(item.vendorPrice).toLocaleString("en-IN")}`
                          : `T: ₹${Number(item.targetPrice).toLocaleString("en-IN")}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DYNAMIC CONTROLS TOOLBAR & DETAIL VIEW */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* TOP CONTROLS TOOLBAR WITH LOGGED-IN ACCOUNT BADGE */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* LOGGED IN USER ACCOUNT BADGE */}
            <div className="flex items-center gap-2">
              <div className="px-3.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200/90 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-slate-800">
                  {loggedInUser.name}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
                  {loggedInUser.rawRole || loggedInUser.role}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="px-3 py-1 bg-slate-100 rounded-lg border border-slate-200">
                Item Inquiry & Procurement Portal
              </span>
            </div>
          </div>

          {viewMode === "CREATE" || viewMode === "EDIT" ? (
            /* CREATE / EDIT INQUIRY FORM FOR EMPLOYEE */
            <div className="bg-white p-7 rounded-2xl border border-slate-200/90 shadow-xs space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                    {viewMode === "EDIT" ? `Editing Inquiry: ${activeInquiry?.id}` : "Employee Action"}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">
                    {viewMode === "EDIT" ? `Edit Inquiry Requirement details` : "Create New Item Requirement Inquiry"}
                  </h2>
                </div>
                <button
                  onClick={() => setViewMode("VIEW")}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel & Back
                </button>
              </div>

              {/* VERTICAL FORM GRID WITH 4 INPUTS PER ROW */}
              <form
                onSubmit={viewMode === "EDIT" ? handleUpdateInquirySubmit : handleCreateNewInquirySubmit}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  {/* FIELD 1: CUSTOMER NAME */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">1. Customer Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. SMS Hospital Jaipur"
                      required
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* FIELD 2: FIRM / COMPANY NAME */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">2. Firm / Company Name</label>
                    <input
                      type="text"
                      placeholder="e.g. SMS Healthcare Infra"
                      value={newFirmName}
                      onChange={(e) => setNewFirmName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* FIELD 3: PRODUCT NAME & SPECS */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">3. Product Name & Specs *</label>
                    <input
                      type="text"
                      placeholder="e.g. LG 32-inch Commercial Display"
                      required
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* FIELD 4: QUANTITY REQUIRED */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">4. Quantity Required *</label>
                    <input
                      type="number"
                      placeholder="e.g. 4"
                      required
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* FIELD 5: LOCATION / CITY */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">5. Location / Delivery City</label>
                    <input
                      type="text"
                      placeholder="e.g. Jaipur"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* FIELD 6: TARGET PRICE */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">6. Target Price (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 28000"
                      value={newTargetPrice}
                      onChange={(e) => setNewTargetPrice(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* FIELD 7: ASSIGN PROCUREMENT OFFICER */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="font-bold text-slate-700 block">7. Assign to Purchasing / Procurement Officer *</label>
                    <select
                      value={newProcUser}
                      onChange={(e) => setNewProcUser(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {purchasingUsers.length > 0 ? (
                        purchasingUsers.map((u, idx) => (
                          <option key={idx} value={u.name}>
                            {u.name} (Purchasing)
                          </option>
                        ))
                      ) : (
                        <option value={loggedInUser.role === "PROCUREMENT" ? loggedInUser.name : "Purchasing Department"}>
                          {loggedInUser.role === "PROCUREMENT" ? `${loggedInUser.name} (Purchasing)` : "Purchasing Department"}
                        </option>
                      )}
                    </select>
                  </div>

                  {/* FIELD 8: PRODUCT SPEC PHOTO / IMAGE UPLOAD FIELD (SPANS ALL COLS) */}
                  <div className="space-y-2 sm:col-span-2 lg:col-span-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="font-bold text-slate-800 text-xs flex items-center justify-between">
                      <span>8. Product Spec Photo / Image Upload *</span>
                      <span className="text-[10.5px] font-medium text-slate-500">Upload image file or select preset</span>
                    </label>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* LIVE THUMBNAIL PREVIEW */}
                      <div className="relative group shrink-0">
                        <img
                          src={newProdImage || DEFAULT_PRODUCT_IMAGE}
                          alt="Preview"
                          className="w-20 h-20 object-cover rounded-xl border-2 border-indigo-200 shadow-xs"
                        />
                        <span className="absolute -top-1 -right-1 bg-indigo-600 text-white p-1 rounded-full text-[9px] font-black">
                          ✓
                        </span>
                      </div>

                      {/* UPLOAD FILE BUTTON & IMAGE URL INPUT */}
                      <div className="flex-1 space-y-2.5 w-full">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs">
                            <PhotoIcon className="w-4 h-4 text-white" />
                            <span>Choose Photo / Image File</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageFileUpload}
                              className="hidden"
                            />
                          </label>

                          <span className="text-xs text-slate-400 font-bold">OR Paste Image URL:</span>
                        </div>

                        <input
                          type="text"
                          placeholder="e.g. https://images.unsplash.com/photo-..."
                          value={newProdImage}
                          onChange={(e) => setNewProdImage(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />

                        {/* QUICK PRESET SAMPLES */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] font-bold text-slate-400">Sample Presets:</span>
                          <button
                            type="button"
                            onClick={() => setNewProdImage("https://images.unsplash.com/photo-1547119957-637f8679db1e?w=600&auto=format&fit=crop&q=80")}
                            className="px-2.5 py-1 bg-white border border-slate-200 text-[10.5px] font-bold rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            🖥️ Commercial Display
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewProdImage("https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80")}
                            className="px-2.5 py-1 bg-white border border-slate-200 text-[10.5px] font-bold rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            💻 Laptop
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewProdImage("https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&auto=format&fit=crop&q=80")}
                            className="px-2.5 py-1 bg-white border border-slate-200 text-[10.5px] font-bold rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            🖨️ Printer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>{viewMode === "EDIT" ? "Save & Update Inquiry Details" : "Submit New Inquiry & Send to Procurement"}</span>
                    <PaperAirplaneIcon className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          ) : !activeInquiry ? (
            /* EMPTY STATE WHEN NO INQUIRIES EXIST YET */
            <div className="bg-white p-12 rounded-2xl border border-slate-200/90 shadow-xs text-center space-y-5 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <ShoppingBagIcon className="w-8 h-8 stroke-[2]" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-slate-900">No Active Inquiries Available</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Start the sales & procurement workflow! Switch to <strong>Employee Persona</strong> and click <strong>"+ New Inquiry"</strong> to create a new requirement.
                </p>
              </div>
              <button
                onClick={() => {
                  setCurrentRole("EMPLOYEE");
                  setNewCustName("");
                  setNewFirmName("");
                  setNewProdName("");
                  setNewQty("");
                  setNewLocation("");
                  setNewTargetPrice("");
                  setNewProdImage(DEFAULT_PRODUCT_IMAGE);
                  setViewMode("CREATE");
                }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <PlusIcon className="w-4 h-4 stroke-[3]" />
                <span>+ Create First Item Inquiry</span>
              </button>
            </div>
          ) : (
            /* VIEW SELECTED INQUIRY DETAIL & WORKFLOW STEPS */
            <div className="space-y-6">
              {/* TOP HEADER CARD FOR SELECTED INQUIRY */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-5">
                    <div
                      onClick={() =>
                        setLightboxImage({
                          src: activeInquiry.image,
                          title: activeInquiry.product,
                          customer: `${activeInquiry.customer} (${activeInquiry.firm})`,
                        })
                      }
                      className="relative group cursor-pointer flex-shrink-0"
                      title="Click to view large product image"
                    >
                      <img
                        src={activeInquiry.image}
                        alt={activeInquiry.product}
                        className="w-28 h-28 object-cover rounded-2xl border-2 border-slate-200 shadow-md group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-slate-900/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <ArrowsPointingOutIcon className="w-6 h-6 stroke-[2.5]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
                          {activeInquiry.id}
                        </span>

                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center">
                            {activeInquiry.employee}
                          </span>
                          {activeInquiry.employeeFullName}
                        </span>

                        <span className="text-xs text-slate-400 font-medium">
                          Created: {activeInquiry.date}
                        </span>
                      </div>

                      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-2">
                        {activeInquiry.product}
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Customer: <strong className="text-slate-800">{activeInquiry.customer}</strong> ({activeInquiry.firm}) • Location: {activeInquiry.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <div className="flex items-center gap-2">
                      {renderStatusBadge(activeInquiry.status)}

                      {/* EDIT INQUIRY BUTTON FOR EMPLOYEE WHEN PENDING */}
                      {currentRole === "EMPLOYEE" && activeInquiry.status !== "COMPLETED" && (
                        <button
                          onClick={() => {
                            setNewCustName(activeInquiry.customer || "");
                            setNewFirmName(activeInquiry.firm || "");
                            setNewProdName(activeInquiry.product || "");
                            setNewQty(activeInquiry.qty || "");
                            setNewLocation(activeInquiry.location || "");
                            setNewTargetPrice(activeInquiry.targetPrice ? String(activeInquiry.targetPrice) : "");
                            setNewEmpName(activeInquiry.employeeFullName || loggedInUser.name);
                            setNewEmpInitials(activeInquiry.employee || loggedInUser.initials);
                            setNewProdImage(activeInquiry.image || DEFAULT_PRODUCT_IMAGE);
                            setNewProcUser(activeInquiry.procurementUser || "Vikram Sharma (Procurement Officer)");
                            setViewMode("EDIT");
                          }}
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Edit this Inquiry"
                        >
                          <PencilSquareIcon className="w-4 h-4 text-indigo-600" />
                          <span>Edit Inquiry</span>
                        </button>
                      )}
                    </div>

                    <span className="text-[11px] font-semibold text-slate-400">
                      Assigned Procurement: <strong className="text-slate-700">{activeInquiry.procurementUser}</strong>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Quantity</span>
                    <span className="text-sm font-extrabold text-slate-900">{activeInquiry.qty} Pcs</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Target Budget Price</span>
                    <span className="text-sm font-extrabold text-indigo-700">₹{Number(activeInquiry.targetPrice).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Selected Vendor Cost</span>
                    <span className="text-sm font-extrabold text-amber-800">
                      {activeInquiry.vendorPrice ? `₹${Number(activeInquiry.vendorPrice).toLocaleString("en-IN")}` : "Not Entered"}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Selling Price</span>
                    <span className="text-sm font-extrabold text-emerald-800">
                      {activeInquiry.sellingPrice ? `₹${Number(activeInquiry.sellingPrice).toLocaleString("en-IN")}` : "Not Approved"}
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 1: PROCUREMENT VENDOR PRICE QUOTATIONS FORM */}
              <div
                className={`p-6 rounded-2xl border transition-all ${
                  activeInquiry.status === "PENDING_PROCUREMENT" || activeInquiry.status === "NEW"
                    ? "bg-white border-amber-300 shadow-sm ring-1 ring-amber-200"
                    : "bg-white border-slate-200/90 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                      1
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Procurement Vendor Price Quotations Form (Up to 3 Vendors)
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Procurement Officer enters vendor quotes for Manager review.
                      </p>
                    </div>
                  </div>

                  {activeInquiry.vendorQuotes && activeInquiry.vendorQuotes.length > 0 ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                      ✓ Procurement Sourcing Completed
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                      Pending Sourcing Entry
                    </span>
                  )}
                </div>

                <div className="mt-5 space-y-4">
                  {(loggedInUser.role === "PROCUREMENT" || loggedInUser.rawRole === "PURCHASING" || currentRole === "PROCUREMENT") && activeInquiry.status !== "COMPLETED" ? (
                    /* EDITABLE PROCUREMENT FORM FOR PURCHASING / PROCUREMENT ROLE */
                    <form onSubmit={handleProcurementSubmit} className="space-y-5">
                      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-900 flex items-center gap-2">
                        <InformationCircleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <span>
                          Logged in as Purchasing: <strong>{loggedInUser.name}</strong>. Enter vendor quotes and click "Save Vendor Quotes & Send to Manager".
                        </span>
                      </div>

                      <div className="space-y-4">
                        {procQuotes.map((quote, qIdx) => (
                          <div
                            key={qIdx}
                            className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3 relative transition-all hover:bg-slate-50"
                          >
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                              <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                                  {qIdx + 1}
                                </span>
                                Vendor Quotation #{qIdx + 1}
                              </span>

                              {procQuotes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVendorQuoteInput(qIdx)}
                                  className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-lg border border-red-200 transition-colors cursor-pointer"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                  Remove Quote
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div className="space-y-1">
                                <label className="font-bold text-slate-700">Vendor / Supplier Name *</label>
                                <input
                                  type="text"
                                  placeholder="e.g. LG Commercial India"
                                  required
                                  value={quote.vendorName}
                                  onChange={(e) => handleVendorQuoteChange(qIdx, "vendorName", e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-slate-700">Vendor Cost Price (₹) *</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                                    ₹
                                  </span>
                                  <input
                                    type="number"
                                    placeholder="e.g. 25500"
                                    required
                                    value={quote.price}
                                    onChange={(e) => handleVendorQuoteChange(qIdx, "price", e.target.value)}
                                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-slate-700">Vendor Phone / Contact</label>
                                <input
                                  type="text"
                                  placeholder="e.g. +91 98290 12345"
                                  value={quote.phone}
                                  onChange={(e) => handleVendorQuoteChange(qIdx, "phone", e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-slate-700">Vendor Email</label>
                                <input
                                  type="email"
                                  placeholder="e.g. sales@vendor.com"
                                  value={quote.email}
                                  onChange={(e) => handleVendorQuoteChange(qIdx, "email", e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                              </div>

                              <div className="space-y-1 md:col-span-2">
                                <label className="font-bold text-slate-700">Remarks / Delivery Terms</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Next day delivery with 3 yrs warranty..."
                                  value={quote.remarks}
                                  onChange={(e) => handleVendorQuoteChange(qIdx, "remarks", e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        {procQuotes.length < 3 ? (
                          <button
                            type="button"
                            onClick={handleAddVendorQuoteInput}
                            className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <PlusIcon className="w-4 h-4 text-amber-700 stroke-[3]" />
                            Add Another Vendor Quote ({procQuotes.length}/3)
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-semibold italic">
                            Maximum 3 vendor quotes added.
                          </span>
                        )}

                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <span>Save Vendor Quotes & Send to Manager</span>
                          <PaperAirplaneIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* READ-ONLY STATUS CALLOUT / QUOTES LIST FOR NON-PROCUREMENT USERS */
                    <div className="space-y-3">
                      {activeInquiry.vendorQuotes && activeInquiry.vendorQuotes.length > 0 ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                              <span>Procurement Sourcing Completed by {activeInquiry.procurementUser}</span>
                            </div>
                            <span className="text-[10px] bg-emerald-200 text-emerald-950 font-black px-2.5 py-0.5 rounded">
                              ✓ COMPLETED
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {activeInquiry.vendorQuotes.map((q, idx) => (
                              <div
                                key={idx}
                                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                                  activeInquiry.selectedVendorIndex === idx
                                    ? "bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-200"
                                    : "bg-slate-50 border-slate-200"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 truncate">{q.vendorName}</span>
                                  {activeInquiry.selectedVendorIndex === idx && (
                                    <span className="bg-emerald-600 text-white text-[9.5px] font-black px-2 py-0.5 rounded">
                                      ACCEPTED
                                    </span>
                                  )}
                                </div>
                                <div className="text-base font-extrabold text-amber-900">
                                  ₹{Number(q.price).toLocaleString("en-IN")}
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium italic line-clamp-2">
                                  "{q.remarks || "No remarks"}"
                                </p>
                                {q.phone && <p className="text-[10px] text-slate-400">Contact: {q.phone}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl text-xs font-semibold text-amber-900 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <LockClosedIcon className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              Awaiting Procurement Sourcing from <strong>{activeInquiry.procurementUser}</strong>.
                            </span>
                          </div>
                          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-md bg-amber-200 text-amber-900 uppercase">
                            Pending Sourcing
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 2: MANAGER APPROVAL & SELLING PRICE FORM */}
              <div
                className={`p-6 rounded-2xl border transition-all ${
                  activeInquiry.status === "PENDING_MANAGER"
                    ? "bg-white border-indigo-400 shadow-md ring-2 ring-indigo-100"
                    : "bg-white border-slate-200/90 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                      2
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      Manager Vendor Selection & Selling Price Form
                    </h3>
                  </div>

                  {activeInquiry.status === "COMPLETED" ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                      <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
                      ✓ Approved & Closed
                    </span>
                  ) : activeInquiry.status === "PENDING_MANAGER" ? (
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
                      Ready for Manager Review
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 flex items-center gap-1">
                      <LockClosedIcon className="w-3.5 h-3.5 text-slate-400" />
                      Waiting for Sourcing Cost
                    </span>
                  )}
                </div>

                <div className="mt-5 space-y-4">
                  {activeInquiry.status === "PENDING_PROCUREMENT" || activeInquiry.status === "NEW" ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LockClosedIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Disabled for Manager — Awaiting Vendor Quotations from {activeInquiry.procurementUser}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Waiting Sourcing</span>
                    </div>
                  ) : activeInquiry.status === "PENDING_MANAGER" && (loggedInUser.role === "MANAGER" || loggedInUser.rawRole === "ADMIN" || currentRole === "MANAGER") ? (
                    /* EDITABLE FORM FOR MANAGER ROLE ONLY */
                    <form onSubmit={handleManagerApprove} className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-800 block">
                          Compare & Pick Best Vendor Quotation for Sourcing:
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {activeInquiry.vendorQuotes && activeInquiry.vendorQuotes.length > 0 ? (
                            activeInquiry.vendorQuotes.map((quote, qIdx) => (
                              <div
                                key={qIdx}
                                onClick={() => setSelectedVendorIndexByManager(qIdx)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 relative ${
                                  selectedVendorIndexByManager === qIdx
                                    ? "bg-indigo-50/90 border-indigo-600 shadow-sm ring-2 ring-indigo-200"
                                    : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-slate-900 text-xs">
                                    {quote.vendorName}
                                  </span>
                                  <input
                                    type="radio"
                                    name="selectedVendorQuote"
                                    checked={selectedVendorIndexByManager === qIdx}
                                    onChange={() => setSelectedVendorIndexByManager(qIdx)}
                                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                  />
                                </div>

                                <div className="text-lg font-black text-amber-900">
                                  ₹{Number(quote.price).toLocaleString("en-IN")}
                                </div>

                                <p className="text-[11px] text-slate-600 font-medium italic line-clamp-2">
                                  "{quote.remarks || "Standard dealer rates"}"
                                </p>

                                <div className="text-[10.5px] text-slate-400 font-mono pt-1 border-t border-slate-200/60 flex justify-between">
                                  <span>{quote.phone || "No phone"}</span>
                                  <span>{quote.date}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                              Vendor: {activeInquiry.procurementVendorName} • Cost: ₹{activeInquiry.vendorPrice}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700 block">
                            Approved Selling Price (₹) *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                              ₹
                            </span>
                            <input
                              type="number"
                              placeholder="e.g. 28000"
                              required
                              value={inputSellingPrice}
                              onChange={(e) => setInputSellingPrice(e.target.value)}
                              className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-extrabold text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-700 block">
                            Manager Approval Remarks
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Approved with target margin"
                            value={inputMgrRemarks}
                            onChange={(e) => setInputMgrRemarks(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <CheckBadgeIcon className="w-4 h-4" />
                          <span>Approve Selling Price & Complete Inquiry</span>
                        </button>
                      </div>
                    </form>
                  ) : activeInquiry.status === "PENDING_MANAGER" && currentRole !== "MANAGER" ? (
                    /* READ ONLY STATUS FOR EMPLOYEE / PROCUREMENT */
                    <div className="p-4 bg-indigo-50/70 border border-indigo-200/90 rounded-2xl text-xs font-semibold text-indigo-900 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <LockClosedIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>
                          Awaiting Manager Selling Price Approval from <strong>{activeInquiry.managerUser || "Sales Manager"}</strong>.
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-md bg-indigo-200 text-indigo-900 uppercase">
                        Pending Manager
                      </span>
                    </div>
                  ) : (
                    /* COMPLETED SUMMARY */
                    <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl space-y-3 text-xs">
                      <div className="p-3 bg-emerald-100/80 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span>Manager Selling Price Approved by {activeInquiry.managerUser}</span>
                        </div>
                        <span className="text-[10px] bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded">
                          ✓ APPROVED & CLOSED
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Target Price</span>
                          <span className="text-base font-bold text-slate-800 mt-0.5 block">
                            ₹{Number(activeInquiry.targetPrice).toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-amber-200 text-center">
                          <span className="text-[10px] font-bold text-amber-800 uppercase block">
                            Accepted Cost ({activeInquiry.procurementVendorName})
                          </span>
                          <span className="text-base font-bold text-amber-900 mt-0.5 block">
                            ₹{Number(activeInquiry.vendorPrice).toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="bg-emerald-600 text-white p-3 rounded-xl text-center shadow-xs">
                          <span className="text-[10px] font-bold uppercase block text-emerald-100">
                            Approved Selling Price
                          </span>
                          <span className="text-lg font-black mt-0.5 block">
                            ₹{Number(activeInquiry.sellingPrice).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-emerald-200/60 pt-2 font-medium text-slate-700 space-y-1">
                        <p>
                          <strong>Manager Remarks ({activeInquiry.managerUser}):</strong> "{activeInquiry.managerRemarks || "Approved"}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
