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
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from "firebase/firestore";

// Default Product Image for fallback
const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80";

export default function ItemInquiry() {
  // 1️⃣ DETECT LOGGED-IN USER CREDENTIALS FROM LOCALSTORAGE (Set during Login)
  const loggedInUser = React.useMemo(() => {
    const name = localStorage.getItem("employeeName") || "RajBiosis User";
    const rawRole = (localStorage.getItem("role") || "EMPLOYEE").toUpperCase();
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

  // Helper boolean to test employee role logic
  const isEmployeeRole = currentRole === "EMPLOYEE";

  // Load Inquiries State from Shared Store
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

  // Active Inquiry Selection (STRICTLY empty by default - requires user click)
  const [selectedInquiryId, setSelectedInquiryId] = useState("");

  // Inner Sidebar Tab State: Default set to 'ALL' so inquiries show in list
  const [sidebarTab, setSidebarTab] = useState("ALL");

  // Employee Filter State
  const [selectedEmpFilter, setSelectedEmpFilter] = useState(null);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Reset selection whenever tab or search filters change so right panel shows empty state until item clicked
  useEffect(() => {
    setSelectedInquiryId("");
  }, [sidebarTab, searchQuery]);

  // Mode: 'VIEW' | 'CREATE' | 'EDIT'
  const [viewMode, setViewMode] = useState("VIEW");

  // Multi-step Form Step State (1: Customer, 2: Product, 3: Procurement & Photo, 4: Review)
  const [formStep, setFormStep] = useState(1);

  // Image Lightbox Modal State
  const [lightboxImage, setLightboxImage] = useState(null);

  // Notifications Toast & Permission State
  const [activeToast, setActiveToast] = useState(null);
  const [desktopPermission, setDesktopPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );

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

  // Multiple Vendor Quotes State
  const [procQuotes, setProcQuotes] = useState([
    { vendorName: "", price: "", phone: "", email: "", remarks: "", date: new Date().toISOString().split("T")[0] },
  ]);

  // Selected Vendor Quote Index by Manager (Defaults to 0 for radio selection)
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

  // Form step validation flags
  const canGoNextFromStep1 = newCustName.trim() !== "";
  const canGoNextFromStep2 = newProdName.trim() !== "" && newQty !== "";

  // Active Inquiry Object (STRICTLY null if selectedInquiryId is empty)
  const rawActiveInquiry = selectedInquiryId ? inquiries.find((item) => item.id === selectedInquiryId) || null : null;

  // Sanitize activeInquiry so that vendor quote is NOT treated as selected/accepted until status is COMPLETED
  const activeInquiry = React.useMemo(() => {
    if (!rawActiveInquiry) return null;
    if (rawActiveInquiry.status !== "COMPLETED") {
      return {
        ...rawActiveInquiry,
        selectedVendorIndex: null, // STRICTLY null until Manager completes and approves!
        vendorPrice: null, // STRICTLY null until Manager approves!
        procurementVendorName: "",
      };
    }
    return rawActiveInquiry;
  }, [rawActiveInquiry]);

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
        activeInquiry.status === "COMPLETED" && activeInquiry.selectedVendorIndex !== null && activeInquiry.selectedVendorIndex !== undefined
          ? activeInquiry.selectedVendorIndex
          : 0
      );

      setInputSellingPrice(activeInquiry.sellingPrice ? String(activeInquiry.sellingPrice) : "");
      setInputMgrRemarks(activeInquiry.managerRemarks || "");
    }
  }, [selectedInquiryId, inquiries, activeInquiry]);

  // Save to Shared Store whenever inquiries state changes
  useEffect(() => {
    saveInquiriesToStorage(inquiries);
  }, [inquiries]);

  // Handler: Delete Inquiry
  const handleDeleteInquiry = (e, inquiryId) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete inquiry ${inquiryId}?`)) return;

    deleteDoc(doc(db, "item_inquiries", inquiryId)).catch((err) =>
      console.error("Firestore delete error:", err)
    );

    const updated = inquiries.filter((item) => item.id !== inquiryId);
    setInquiries(updated);
    saveInquiriesToStorage(updated);

    if (selectedInquiryId === inquiryId) {
      setSelectedInquiryId("");
      setViewMode("VIEW");
    }

    triggerPushNotification("Inquiry Deleted", `Inquiry ${inquiryId} has been deleted.`);
  };

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
      (item.procurementUser && item.procurementUser.toLowerCase().includes(q));

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

    // NO VENDOR IS AUTOMATICALLY ACCEPTED OR SET AS VENDOR PRICE! Manager will choose.
    const updatedInquiries = inquiries.map((item) => {
      if (item.id === activeInquiry.id) {
        const payload = {
          ...item,
          vendorQuotes: validQuotes,
          vendorPrice: null, // STRICTLY null when Procurement submits! Manager will select.
          procurementVendorName: "", // DO NOT set accepted vendor name yet!
          procurementRemarks: validQuotes[0]?.remarks || "Vendor quotations submitted for manager review.",
          selectedVendorIndex: null, // STRICTLY null when Procurement submits!
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
      `Procurement submitted ${validQuotes.length} vendor quote(s) for ${activeInquiry.product}. Pending Manager selection & approval.`
    );
  };

  // Handler: Manager Approves Inquiry & Sets Selling Price
  const handleManagerApprove = (e) => {
    e.preventDefault();
    if (!activeInquiry || !inputSellingPrice || Number(inputSellingPrice) <= 0) return;

    const chosenQuote = activeInquiry.vendorQuotes[selectedVendorIndexByManager] || activeInquiry.vendorQuotes[0];
    if (!chosenQuote) return;

    const costPriceToUse = Number(chosenQuote.price);
    const vendorNameToUse = chosenQuote.vendorName;

    const currentMgrUser = `${loggedInUser.name} (${loggedInUser.rawRole || "Manager"})`;

    const updatedInquiries = inquiries.map((item) => {
      if (item.id === activeInquiry.id) {
        const payload = {
          ...item,
          vendorPrice: costPriceToUse,
          procurementVendorName: vendorNameToUse,
          selectedVendorIndex: selectedVendorIndexByManager, // Explicitly selected by Manager!
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
      vendorPrice: null,
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
    setFormStep(1);
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
    setFormStep(1);
    setViewMode("VIEW");

    triggerPushNotification(
      "Inquiry Updated!",
      `Inquiry ${activeInquiry.id} (${newProdName}) was updated by ${newEmpName}.`
    );
  };

  // Helper for Status Badge styling with clear text
  const renderStatusBadge = (status) => {
    if (status === "NEW" || status === "PENDING_PROCUREMENT") {
      return (
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs">
          <span className="w-3 h-3 rounded-full bg-amber-600 animate-pulse" />
          Pending Procurement Sourcing
        </span>
      );
    }
    if (status === "PENDING_MANAGER") {
      return (
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black bg-indigo-100 text-indigo-950 border border-indigo-300 shadow-2xs">
          <span className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse" />
          Pending Manager Approval
        </span>
      );
    }
    if (status === "COMPLETED") {
      return (
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs">
          <CheckCircleIcon className="w-5 h-5 text-emerald-700 stroke-[2.5]" />
          Price Approved & Completed
        </span>
      );
    }
    return null;
  };

  return (
    <div className="max-w-[1750px] mx-auto space-y-8 font-sans text-slate-900 pb-24 relative text-base">
      {/* IN-APP TOAST FALLBACK */}
      {activeToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-bounceIn">
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-2xl border border-slate-700 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                <BellIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-amber-400">
                  {activeToast.title}
                </h4>
                <p className="text-sm text-slate-200 font-medium leading-snug">
                  {activeToast.message}
                </p>
                <span className="text-xs text-slate-400 block pt-1 font-mono">
                  Desktop Notification • {activeToast.time}
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* IMAGE LIGHTBOX MODAL */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-3xl w-full border border-slate-200 space-y-4 p-6 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {lightboxImage.title}
                </h3>
                <p className="text-sm font-semibold text-slate-500">{lightboxImage.customer}</p>
              </div>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <XMarkIcon className="w-7 h-7" />
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center max-h-[550px]">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.title}
                className="w-full h-full object-contain max-h-[520px]"
              />
            </div>

            <div className="flex items-center justify-between text-sm text-slate-600 font-semibold pt-1">
              <span>High Resolution Spec Preview</span>
              <button
                onClick={() => setLightboxImage(null)}
                className="px-6 py-2.5 bg-slate-900 text-white font-extrabold text-sm rounded-xl hover:bg-slate-800 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN 2-COLUMN LAYOUT: LEFT SIDEBAR & RIGHT CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 min-h-[820px]">
        {/* LEFT COLUMN: INNER SIDEBAR */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col sticky top-6 h-[calc(100vh-90px)] min-h-[720px] max-h-[900px]">
          {/* FIXED TOP HEADER: TITLE, NEW INQUIRY BUTTON, SEARCH & TABS */}
          <div className="p-5 border-b border-slate-100 space-y-4 bg-white flex-shrink-0 sticky top-0 z-10 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FunnelIcon className="w-5 h-5 text-indigo-600" />
                Inquiries Directory
              </span>
              {isEmployeeRole && (
                <button
                  onClick={() => {
                    setSelectedInquiryId("");
                    setNewCustName("");
                    setNewFirmName("");
                    setNewProdName("");
                    setNewQty("");
                    setNewLocation("");
                    setNewTargetPrice("");
                    setNewProdImage(DEFAULT_PRODUCT_IMAGE);
                    setFormStep(1);
                    setViewMode("CREATE");
                  }}
                  className="px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md cursor-pointer"
                  title="Create New Item Inquiry"
                >
                  <PlusIcon className="w-4 h-4 stroke-[3]" />
                  + New Inquiry
                </button>
              )}
            </div>

            {/* SEARCH INPUT */}
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ID, customer, product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            {/* SIDEBAR CATEGORY TABS (Default ALL) */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/80 rounded-xl text-xs font-black">
              <button
                onClick={() => setSidebarTab("ALL")}
                className={`py-2 rounded-lg text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                  sidebarTab === "ALL" ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>All</span>
                <span className={`px-2 py-0.5 rounded-full text-xs mt-0.5 ${sidebarTab === "ALL" ? "bg-slate-900 text-white font-black" : "bg-slate-300 text-slate-700"}`}>
                  {inquiries.length}
                </span>
              </button>

              <button
                onClick={() => setSidebarTab("COMPLETED")}
                className={`py-2 rounded-lg text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                  sidebarTab === "COMPLETED" ? "bg-white text-emerald-800 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Done</span>
                <span className={`px-2 py-0.5 rounded-full text-xs mt-0.5 ${sidebarTab === "COMPLETED" ? "bg-emerald-100 text-emerald-900 font-black" : "bg-slate-300 text-slate-700"}`}>
                  {countCompleted}
                </span>
              </button>

              <button
                onClick={() => setSidebarTab("PENDING")}
                className={`py-2 rounded-lg text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                  sidebarTab === "PENDING" ? "bg-white text-indigo-800 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Pending</span>
                <span className={`px-2 py-0.5 rounded-full text-xs mt-0.5 ${sidebarTab === "PENDING" ? "bg-indigo-100 text-indigo-900 font-black" : "bg-slate-300 text-slate-700"}`}>
                  {countPending}
                </span>
              </button>

              <button
                onClick={() => setSidebarTab("NEW")}
                className={`py-2 rounded-lg text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                  sidebarTab === "NEW" ? "bg-white text-amber-800 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>New</span>
                <span className={`px-2 py-0.5 rounded-full text-xs mt-0.5 ${sidebarTab === "NEW" ? "bg-amber-100 text-amber-900 font-black" : "bg-slate-300 text-slate-700"}`}>
                  {countNew}
                </span>
              </button>
            </div>
          </div>

          {/* SCROLLABLE INQUIRIES LIST */}
          <div className="p-4 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar">
            {filteredInquiries.length === 0 ? (
              <div className="p-8 text-center space-y-3 my-auto text-slate-400">
                <ShoppingBagIcon className="w-14 h-14 mx-auto opacity-40 text-indigo-500" />
                <p className="text-base font-black text-slate-800">No Inquiries Found</p>
                <p className="text-xs text-slate-500 font-medium">
                  Click "+ New Inquiry" to create a new requirement.
                </p>
              </div>
            ) : (
              filteredInquiries.map((item) => {
                const isSelected = item.id === selectedInquiryId && viewMode === "VIEW";
                const isPendingProc = item.status === "NEW" || item.status === "PENDING_PROCUREMENT";
                const isPendingMgr = item.status === "PENDING_MANAGER";

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedInquiryId(item.id);
                      setViewMode("VIEW");
                    }}
                    className={`p-4 rounded-xl border text-sm cursor-pointer transition-all space-y-2.5 relative group ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-600 shadow-sm ring-2 ring-indigo-200"
                        : "bg-white hover:bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-indigo-700 font-mono text-xs">
                        {item.id}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shadow-xs">
                          {item.employee}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {item.employeeFullName}
                        </span>

                        {/* INSTANT DELETE BUTTON ON SIDEBAR CARD */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteInquiry(e, item.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1 cursor-pointer"
                          title="Delete Inquiry"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-black text-slate-900 text-base line-clamp-1">
                      {item.product}
                    </h4>

                    <div className="text-xs text-slate-600 font-bold flex items-center justify-between">
                      <span className="truncate max-w-[170px]">{item.customer}</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                        Qty: {item.qty}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-100">
                      {isPendingProc ? (
                        <span className="text-xs font-black text-amber-900 bg-amber-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                          Pending Procurement
                        </span>
                      ) : isPendingMgr ? (
                        <span className="text-xs font-black text-indigo-900 bg-indigo-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                          Pending Manager
                        </span>
                      ) : (
                        <span className="text-xs font-black text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-md flex items-center gap-1">
                          <CheckIcon className="w-4 h-4 text-emerald-700 stroke-[3]" />
                          Approved
                        </span>
                      )}

                      {/* VENDOR PRICE HIDDEN FOR EMPLOYEE & ONLY DISPLAYED FOR NON-EMPLOYEE IF COMPLETED */}
                      <span className="text-xs font-black text-slate-900">
                        {isEmployeeRole
                          ? item.sellingPrice
                            ? `Selling: ₹${Number(item.sellingPrice).toLocaleString("en-IN")}`
                            : `Target: ₹${Number(item.targetPrice || 0).toLocaleString("en-IN")}`
                          : item.status === "COMPLETED" && item.vendorPrice
                          ? `Vendor: ₹${Number(item.vendorPrice).toLocaleString("en-IN")}`
                          : `Target: ₹${Number(item.targetPrice || 0).toLocaleString("en-IN")}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DYNAMIC CONTROLS TOOLBAR & DETAIL VIEW */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-7">
          {/* TOP CONTROLS TOOLBAR WITH LOGGED-IN ACCOUNT BADGE & PERSONA SWITCHER */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* LOGGED IN USER ACCOUNT BADGE */}
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-base font-black text-slate-900">
                  {loggedInUser.name}
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded border border-indigo-100">
                  {loggedInUser.rawRole || loggedInUser.role}
                </span>
              </div>
            </div>

            {/* INTERACTIVE PERSONA ROLE SWITCHER */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-black">
              <span className="text-xs text-slate-600 font-black px-2 uppercase">View Persona:</span>
              <button
                onClick={() => setCurrentRole("EMPLOYEE")}
                className={`px-4 py-2 rounded-lg transition-all cursor-pointer text-xs ${
                  currentRole === "EMPLOYEE"
                    ? "bg-white text-indigo-700 shadow-2xs font-black ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Employee
              </button>
              <button
                onClick={() => setCurrentRole("PROCUREMENT")}
                className={`px-4 py-2 rounded-lg transition-all cursor-pointer text-xs ${
                  currentRole === "PROCUREMENT"
                    ? "bg-white text-amber-800 shadow-2xs font-black ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Procurement
              </button>
              <button
                onClick={() => setCurrentRole("MANAGER")}
                className={`px-4 py-2 rounded-lg transition-all cursor-pointer text-xs ${
                  currentRole === "MANAGER"
                    ? "bg-white text-purple-700 shadow-2xs font-black ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Manager
              </button>
            </div>
          </div>

          {viewMode === "CREATE" || viewMode === "EDIT" ? (
            /* MULTI-STEP GUIDED WIZARD FORM FOR EMPLOYEE NEW INQUIRY */
            <div className="bg-white p-7 sm:p-10 rounded-2xl border border-slate-200 shadow-xs space-y-8 animate-fadeIn">
              {/* TOP FORM HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-lg border border-indigo-100 uppercase tracking-wider">
                    {viewMode === "EDIT" ? `Editing Inquiry: ${activeInquiry?.id}` : "Employee Requirement Form"}
                  </span>
                  <h2 className="text-3xl font-black text-slate-900 mt-2.5">
                    {viewMode === "EDIT" ? "Edit Requirement Details" : "Create New Item Requirement Inquiry"}
                  </h2>
                  <p className="text-base text-slate-600 font-semibold mt-1">
                    Step-by-step form to submit requirement to Procurement & Sales Manager.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFormStep(1);
                    setViewMode("VIEW");
                  }}
                  className="px-6 py-3 text-sm font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all self-start sm:self-auto cursor-pointer"
                >
                  Cancel & Back
                </button>
              </div>

              {/* STEP PROGRESS INDICATOR */}
              <div className="grid grid-cols-4 gap-3 p-3 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFormStep(1)}
                  className={`p-4 rounded-xl transition-all text-left flex items-center gap-3.5 cursor-pointer ${
                    formStep === 1
                      ? "bg-white text-indigo-700 shadow-xs font-black ring-2 ring-indigo-200"
                      : formStep > 1
                      ? "bg-emerald-50 text-emerald-800 font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className={`w-10 h-10 rounded-full text-base font-black flex items-center justify-center shrink-0 ${
                    formStep === 1 ? "bg-indigo-600 text-white" : formStep > 1 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}>
                    {formStep > 1 ? "✓" : "1"}
                  </span>
                  <div className="hidden md:block">
                    <div className="text-xs uppercase font-mono tracking-wider opacity-70">Step 1</div>
                    <div className="text-base truncate font-black">Customer Info</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => canGoNextFromStep1 && setFormStep(2)}
                  disabled={!canGoNextFromStep1}
                  className={`p-4 rounded-xl transition-all text-left flex items-center gap-3.5 cursor-pointer ${
                    formStep === 2
                      ? "bg-white text-indigo-700 shadow-xs font-black ring-2 ring-indigo-200"
                      : formStep > 2
                      ? "bg-emerald-50 text-emerald-800 font-bold"
                      : "text-slate-500 hover:text-slate-800 disabled:opacity-50"
                  }`}
                >
                  <span className={`w-10 h-10 rounded-full text-base font-black flex items-center justify-center shrink-0 ${
                    formStep === 2 ? "bg-indigo-600 text-white" : formStep > 2 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}>
                    {formStep > 2 ? "✓" : "2"}
                  </span>
                  <div className="hidden md:block">
                    <div className="text-xs uppercase font-mono tracking-wider opacity-70">Step 2</div>
                    <div className="text-base truncate font-black">Product & Qty</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => canGoNextFromStep1 && canGoNextFromStep2 && setFormStep(3)}
                  disabled={!canGoNextFromStep1 || !canGoNextFromStep2}
                  className={`p-4 rounded-xl transition-all text-left flex items-center gap-3.5 cursor-pointer ${
                    formStep === 3
                      ? "bg-white text-indigo-700 shadow-xs font-black ring-2 ring-indigo-200"
                      : formStep > 3
                      ? "bg-emerald-50 text-emerald-800 font-bold"
                      : "text-slate-500 hover:text-slate-800 disabled:opacity-50"
                  }`}
                >
                  <span className={`w-10 h-10 rounded-full text-base font-black flex items-center justify-center shrink-0 ${
                    formStep === 3 ? "bg-indigo-600 text-white" : formStep > 3 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}>
                    {formStep > 3 ? "✓" : "3"}
                  </span>
                  <div className="hidden md:block">
                    <div className="text-xs uppercase font-mono tracking-wider opacity-70">Step 3</div>
                    <div className="text-base truncate font-black">Purchasing & Photo</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => canGoNextFromStep1 && canGoNextFromStep2 && setFormStep(4)}
                  disabled={!canGoNextFromStep1 || !canGoNextFromStep2}
                  className={`p-4 rounded-xl transition-all text-left flex items-center gap-3.5 cursor-pointer ${
                    formStep === 4
                      ? "bg-white text-indigo-700 shadow-xs font-black ring-2 ring-indigo-200"
                      : "text-slate-500 hover:text-slate-800 disabled:opacity-50"
                  }`}
                >
                  <span className={`w-10 h-10 rounded-full text-base font-black flex items-center justify-center shrink-0 ${
                    formStep === 4 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}>
                    4
                  </span>
                  <div className="hidden md:block">
                    <div className="text-xs uppercase font-mono tracking-wider opacity-70">Step 4</div>
                    <div className="text-base truncate font-black">Review & Submit</div>
                  </div>
                </button>
              </div>

              {/* STEP FORM BODIES */}
              <form onSubmit={viewMode === "EDIT" ? handleUpdateInquirySubmit : handleCreateNewInquirySubmit} className="space-y-7">
                {formStep === 1 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-base font-extrabold text-indigo-950 flex items-center gap-3">
                      <UserIcon className="w-6 h-6 text-indigo-600 shrink-0" />
                      <span>Step 1 of 4: Customer & Business Details</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                      <div className="space-y-2">
                        <label className="text-base font-black text-slate-900 block">1. Customer / Client Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. SMS Hospital Jaipur"
                          required
                          value={newCustName}
                          onChange={(e) => setNewCustName(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-4 font-extrabold text-slate-900 text-base focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-base font-black text-slate-900 block">2. Firm / Company Name</label>
                        <input
                          type="text"
                          placeholder="e.g. SMS Healthcare Infra Pvt Ltd"
                          value={newFirmName}
                          onChange={(e) => setNewFirmName(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-4 font-extrabold text-slate-900 text-base focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-base font-black text-slate-900 block">3. Delivery Location / City</label>
                        <input
                          type="text"
                          placeholder="e.g. Jaipur, Rajasthan"
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-4 font-extrabold text-slate-900 text-base focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        disabled={!canGoNextFromStep1}
                        onClick={() => setFormStep(2)}
                        className="px-9 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-base rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-3 cursor-pointer"
                      >
                        <span>Next: Product & Quantity</span>
                        <ArrowRightIcon className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                )}

                {formStep === 2 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-base font-extrabold text-indigo-950 flex items-center gap-3">
                      <ShoppingBagIcon className="w-6 h-6 text-indigo-600 shrink-0" />
                      <span>Step 2 of 4: Product Specifications & Quantity</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-base font-black text-slate-900 block">4. Product Name & Technical Specs *</label>
                        <input
                          type="text"
                          placeholder="e.g. LG 32-inch Commercial Display (Model: 32SE3KE)"
                          required
                          value={newProdName}
                          onChange={(e) => setNewProdName(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-4 font-extrabold text-slate-900 text-base focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-base font-black text-slate-900 block">5. Quantity Required *</label>
                        <input
                          type="number"
                          placeholder="e.g. 10"
                          required
                          value={newQty}
                          onChange={(e) => setNewQty(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-4 font-extrabold text-slate-900 text-base focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-base font-black text-slate-900 block">6. Target Budget Price (₹)</label>
                        <input
                          type="number"
                          placeholder="e.g. 28000"
                          value={newTargetPrice}
                          onChange={(e) => setNewTargetPrice(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-4 font-extrabold text-slate-900 text-base focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-between">
                      <button
                        type="button"
                        onClick={() => setFormStep(1)}
                        className="px-7 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-sm rounded-xl transition-all cursor-pointer"
                      >
                        ← Back: Customer Info
                      </button>

                      <button
                        type="button"
                        disabled={!canGoNextFromStep2}
                        onClick={() => setFormStep(3)}
                        className="px-9 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-base rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-3 cursor-pointer"
                      >
                        <span>Next: Purchasing & Photo</span>
                        <ArrowRightIcon className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                )}

                {formStep === 3 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-base font-extrabold text-indigo-950 flex items-center gap-3">
                      <PhotoIcon className="w-6 h-6 text-indigo-600 shrink-0" />
                      <span>Step 3 of 4: Procurement Assignment & Product Spec Image</span>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-base font-black text-slate-900 block">7. Assign to Purchasing / Procurement Officer *</label>
                        <select
                          value={newProcUser}
                          onChange={(e) => setNewProcUser(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-4 font-extrabold text-slate-900 text-base focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        >
                          {purchasingUsers.length > 0 ? (
                            purchasingUsers.map((u, idx) => (
                              <option key={idx} value={u.name}>
                                {u.name} (Purchasing Officer)
                              </option>
                            ))
                          ) : (
                            <option value={loggedInUser.role === "PROCUREMENT" ? loggedInUser.name : "Vikram Sharma (Procurement Officer)"}>
                              {loggedInUser.role === "PROCUREMENT" ? `${loggedInUser.name} (Purchasing)` : "Vikram Sharma (Procurement Officer)"}
                            </option>
                          )}
                        </select>
                      </div>

                      <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <label className="text-base font-black text-slate-900 flex items-center justify-between">
                          <span>8. Product Spec Photo / Image Upload *</span>
                          <span className="text-xs font-bold text-slate-600">Upload file, URL, or pick preset</span>
                        </label>

                        <div className="flex flex-col sm:flex-row items-center gap-6">
                          <div className="relative shrink-0">
                            <img
                              src={newProdImage || DEFAULT_PRODUCT_IMAGE}
                              alt="Preview"
                              className="w-32 h-32 object-cover rounded-xl border-2 border-indigo-500 shadow-md"
                            />
                          </div>

                          <div className="flex-1 space-y-3.5 w-full">
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl cursor-pointer transition-all flex items-center gap-2 shadow-2xs">
                                <PhotoIcon className="w-5 h-5 text-white" />
                                <span>Choose Photo File</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleImageFileUpload}
                                  className="hidden"
                                />
                              </label>
                              <span className="text-sm text-slate-600 font-extrabold">OR Image URL:</span>
                            </div>

                            <input
                              type="text"
                              placeholder="https://..."
                              value={newProdImage}
                              onChange={(e) => setNewProdImage(e.target.value)}
                              className="w-full bg-white border-2 border-slate-300 rounded-xl p-3.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />

                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              <span className="text-xs font-black text-slate-600">Presets:</span>
                              <button
                                type="button"
                                onClick={() => setNewProdImage("https://images.unsplash.com/photo-1547119957-637f8679db1e?w=600&auto=format&fit=crop&q=80")}
                                className="px-3.5 py-1.5 bg-white border border-slate-300 text-xs font-extrabold rounded-lg hover:bg-slate-100 transition-colors"
                              >
                                🖥️ Display
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewProdImage("https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80")}
                                className="px-3.5 py-1.5 bg-white border border-slate-300 text-xs font-extrabold rounded-lg hover:bg-slate-100 transition-colors"
                              >
                                💻 Laptop
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewProdImage("https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&auto=format&fit=crop&q=80")}
                                className="px-3.5 py-1.5 bg-white border border-slate-300 text-xs font-extrabold rounded-lg hover:bg-slate-100 transition-colors"
                              >
                                🖨️ Printer
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-between">
                      <button
                        type="button"
                        onClick={() => setFormStep(2)}
                        className="px-7 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-sm rounded-xl transition-all cursor-pointer"
                      >
                        ← Back: Product & Qty
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormStep(4)}
                        className="px-9 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-3 cursor-pointer"
                      >
                        <span>Review & Finalize</span>
                        <ArrowRightIcon className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                )}

                {formStep === 4 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-base font-extrabold text-emerald-950 flex items-center gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-emerald-600 shrink-0" />
                      <span>Step 4 of 4: Review Inquiry Information & Submit</span>
                    </div>

                    <div className="bg-slate-50 p-7 rounded-2xl border border-slate-200 space-y-6">
                      <div className="flex items-start gap-6">
                        <img
                          src={newProdImage || DEFAULT_PRODUCT_IMAGE}
                          alt="Preview"
                          className="w-28 h-28 object-cover rounded-xl border border-slate-300 shadow-xs"
                        />
                        <div className="space-y-2">
                          <h3 className="text-xl font-black text-slate-900">{newProdName || "Product Name"}</h3>
                          <p className="text-base text-slate-800 font-bold">
                            Customer: <strong>{newCustName || "N/A"}</strong> ({newFirmName || "No firm"})
                          </p>
                          <p className="text-sm text-slate-700 font-semibold">
                            Location: {newLocation || "Jaipur"} • Quantity: <strong>{newQty || 0} Pcs</strong>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-5 pt-4 border-t border-slate-200">
                        <div className="bg-white p-5 rounded-xl border border-slate-200">
                          <span className="text-xs font-extrabold text-slate-500 block uppercase">Target Budget Price</span>
                          <span className="text-lg font-black text-indigo-700 mt-1 block">
                            {newTargetPrice ? `₹${Number(newTargetPrice).toLocaleString("en-IN")}` : "Not Specified"}
                          </span>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200">
                          <span className="text-xs font-extrabold text-slate-500 block uppercase">Assigned Procurement</span>
                          <span className="text-base font-black text-slate-900 mt-1 block">{newProcUser}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-between">
                      <button
                        type="button"
                        onClick={() => setFormStep(3)}
                        className="px-7 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-sm rounded-xl transition-all cursor-pointer"
                      >
                        ← Back to Edit Steps
                      </button>

                      <button
                        type="submit"
                        className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-base rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-3 cursor-pointer"
                      >
                        <span>{viewMode === "EDIT" ? "Save & Update Inquiry Details" : "Submit New Inquiry & Send to Procurement"}</span>
                        <PaperAirplaneIcon className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          ) : !selectedInquiryId || !activeInquiry ? (
            /* EMPTY / INITIAL PLACEHOLDER STATE WHEN NO INQUIRY IS CLICKED */
            <div className="bg-white p-16 rounded-2xl border border-slate-200 shadow-xs text-center space-y-7 animate-fadeIn min-h-[550px] flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <ShoppingBagIcon className="w-12 h-12 stroke-[2]" />
              </div>
              <div className="space-y-2.5 max-w-xl mx-auto">
                <h3 className="text-2xl font-black text-slate-900">No Inquiry Selected</h3>
                <p className="text-base text-slate-600 font-medium leading-relaxed">
                  Please click on any inquiry item in the <strong>Inquiries Directory</strong> list on the left to view details, or click below to create a new requirement.
                </p>
              </div>
              {isEmployeeRole && (
                <button
                  onClick={() => {
                    setSelectedInquiryId("");
                    setNewCustName("");
                    setNewFirmName("");
                    setNewProdName("");
                    setNewQty("");
                    setNewLocation("");
                    setNewTargetPrice("");
                    setNewProdImage(DEFAULT_PRODUCT_IMAGE);
                    setFormStep(1);
                    setViewMode("CREATE");
                  }}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-xl shadow-md transition-all inline-flex items-center gap-3 cursor-pointer"
                >
                  <PlusIcon className="w-5 h-5 stroke-[3]" />
                  <span>+ Create New Inquiry</span>
                </button>
              )}
            </div>
          ) : (
            /* VIEW SELECTED INQUIRY DETAIL & WORKFLOW STEPS */
            <div className="space-y-7 animate-fadeIn">
              {/* TOP HEADER CARD FOR SELECTED INQUIRY */}
              <div className="bg-white p-7 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-7">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-6">
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
                        className="w-36 h-36 object-cover rounded-2xl border-2 border-slate-200 shadow-md group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-slate-900/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <ArrowsPointingOutIcon className="w-8 h-8 stroke-[2.5]" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-mono font-black text-indigo-700 bg-indigo-50 px-3.5 py-1 rounded border border-indigo-100">
                          {activeInquiry.id}
                        </span>

                        <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3.5 py-1 rounded-lg border border-slate-200 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                            {activeInquiry.employee}
                          </span>
                          {activeInquiry.employeeFullName}
                        </span>

                        <span className="text-sm text-slate-500 font-bold">
                          Created: {activeInquiry.date}
                        </span>
                      </div>

                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                        {activeInquiry.product}
                      </h2>
                      <p className="text-base text-slate-700 font-bold">
                        Customer: <strong className="text-slate-900">{activeInquiry.customer}</strong> ({activeInquiry.firm}) • Location: {activeInquiry.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      {renderStatusBadge(activeInquiry.status)}

                      {/* EDIT INQUIRY BUTTON FOR EMPLOYEE WHEN PENDING */}
                      {isEmployeeRole && activeInquiry.status !== "COMPLETED" && (
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
                            setFormStep(1);
                            setViewMode("EDIT");
                          }}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs rounded-xl border border-indigo-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                          title="Edit this Inquiry"
                        >
                          <PencilSquareIcon className="w-4 h-4 text-indigo-600" />
                          <span>Edit Inquiry</span>
                        </button>
                      )}

                      {/* DELETE INQUIRY BUTTON */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteInquiry(e, activeInquiry.id)}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-black text-xs rounded-xl border border-red-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                        title="Delete Inquiry completely"
                      >
                        <TrashIcon className="w-4 h-4 text-red-600" />
                        <span>Delete Inquiry</span>
                      </button>
                    </div>

                    <span className="text-xs font-bold text-slate-500">
                      Assigned Procurement: <strong className="text-slate-900">{activeInquiry.procurementUser}</strong>
                    </span>
                  </div>
                </div>

                {/* TOP HEADER STATS GRID: VENDOR COST CARD IS COMPLETELY REMOVED FOR EMPLOYEE */}
                <div className={`grid gap-5 ${isEmployeeRole ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <span className="text-xs font-extrabold text-slate-500 uppercase block">Quantity</span>
                    <span className="text-xl font-black text-slate-900 mt-1 block">{activeInquiry.qty} Pcs</span>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <span className="text-xs font-extrabold text-slate-500 uppercase block">Target Budget Price</span>
                    <span className="text-xl font-black text-indigo-700 mt-1 block">₹{Number(activeInquiry.targetPrice || 0).toLocaleString("en-IN")}</span>
                  </div>

                  {/* ONLY NON-EMPLOYEES (PROCUREMENT/MANAGER) SEE SELECTED VENDOR COST */}
                  {!isEmployeeRole && (
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                      <span className="text-xs font-extrabold text-slate-500 uppercase block">Selected Vendor Cost</span>
                      <span className="text-xl font-black text-amber-900 mt-1 block">
                        {activeInquiry.status === "COMPLETED" && activeInquiry.vendorPrice
                          ? `₹${Number(activeInquiry.vendorPrice).toLocaleString("en-IN")}`
                          : "Pending Manager Selection"}
                      </span>
                    </div>
                  )}

                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <span className="text-xs font-extrabold text-slate-500 uppercase block">Selling Price</span>
                    <span className="text-xl font-black text-emerald-800 mt-1 block">
                      {activeInquiry.sellingPrice ? `₹${Number(activeInquiry.sellingPrice).toLocaleString("en-IN")}` : "Not Approved"}
                    </span>
                  </div>
                </div>
              </div>

              {/* PROCUREMENT SECTION (SECTION 1) - COMPLETELY HIDDEN FOR EMPLOYEE ROLE */}
              {!isEmployeeRole && (
                <div
                  className={`p-8 rounded-2xl border transition-all ${
                    activeInquiry.status === "PENDING_PROCUREMENT" || activeInquiry.status === "NEW"
                      ? "bg-white border-amber-300 shadow-sm ring-1 ring-amber-200"
                      : "bg-white border-slate-200/90 shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                    <div className="flex items-center gap-3.5">
                      <span className="w-8 h-8 rounded-full bg-amber-600 text-white font-black text-base flex items-center justify-center">
                        1
                      </span>
                      <div>
                        <h3 className="text-lg font-black text-slate-900">
                          Procurement Vendor Price Quotations Form (Up to 3 Vendors)
                        </h3>
                        <p className="text-xs text-slate-500 font-semibold">
                          Procurement Officer enters vendor quotes for Manager review.
                        </p>
                      </div>
                    </div>

                    {activeInquiry.vendorQuotes && activeInquiry.vendorQuotes.length > 0 ? (
                      <span className="text-xs font-extrabold text-emerald-900 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200 flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                        ✓ Vendor Sourcing Submitted (Awaiting Manager Selection)
                      </span>
                    ) : (
                      <span className="text-xs font-extrabold text-amber-900 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
                        Pending Sourcing Entry
                      </span>
                    )}
                  </div>

                  <div className="mt-6 space-y-6">
                    {currentRole === "PROCUREMENT" && activeInquiry.status !== "COMPLETED" ? (
                      /* EDITABLE PROCUREMENT FORM FOR PURCHASING / PROCUREMENT ROLE */
                      <form onSubmit={handleProcurementSubmit} className="space-y-6">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs font-extrabold text-amber-950 flex items-center gap-3">
                          <InformationCircleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                          <span>
                            Logged in as Purchasing: <strong>{loggedInUser.name}</strong>. Enter vendor quotes and click "Save Vendor Quotes & Send to Manager".
                          </span>
                        </div>

                        <div className="space-y-5">
                          {procQuotes.map((quote, qIdx) => (
                            <div
                              key={qIdx}
                              className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 relative transition-all hover:bg-slate-50"
                            >
                              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                <span className="text-xs font-black text-amber-950 flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center">
                                    {qIdx + 1}
                                  </span>
                                  Vendor Quotation #{qIdx + 1}
                                </span>

                                {procQuotes.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVendorQuoteInput(qIdx)}
                                    className="text-xs text-red-600 hover:text-red-800 font-extrabold flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg border border-red-200 transition-colors cursor-pointer"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                    Remove Quote
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                                <div className="space-y-2">
                                  <label className="font-extrabold text-slate-900">Vendor / Supplier Name *</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. LG Commercial India"
                                    required
                                    value={quote.vendorName}
                                    onChange={(e) => handleVendorQuoteChange(qIdx, "vendorName", e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <label className="font-extrabold text-slate-900">Vendor Cost Price (₹) *</label>
                                  <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500">
                                      ₹
                                    </span>
                                    <input
                                      type="number"
                                      placeholder="e.g. 25500"
                                      required
                                      value={quote.price}
                                      onChange={(e) => handleVendorQuoteChange(qIdx, "price", e.target.value)}
                                      className="w-full pl-8 pr-4 py-3 bg-white border border-slate-300 rounded-xl font-black text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <label className="font-extrabold text-slate-900">Vendor Phone / Contact</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. +91 98290 12345"
                                    value={quote.phone}
                                    onChange={(e) => handleVendorQuoteChange(qIdx, "phone", e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <label className="font-extrabold text-slate-900">Vendor Email</label>
                                  <input
                                    type="email"
                                    placeholder="e.g. sales@vendor.com"
                                    value={quote.email}
                                    onChange={(e) => handleVendorQuoteChange(qIdx, "email", e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                                  />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                  <label className="font-extrabold text-slate-900">Remarks / Delivery Terms</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Next day delivery with 3 yrs warranty..."
                                    value={quote.remarks}
                                    onChange={(e) => handleVendorQuoteChange(qIdx, "remarks", e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-3">
                          {procQuotes.length < 3 ? (
                            <button
                              type="button"
                              onClick={handleAddVendorQuoteInput}
                              className="px-5 py-3 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-extrabold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                            >
                              <PlusIcon className="w-4 h-4 text-amber-700 stroke-[3]" />
                              Add Another Vendor Quote ({procQuotes.length}/3)
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500 font-bold italic">
                              Maximum 3 vendor quotes added.
                            </span>
                          )}

                          <button
                            type="submit"
                            className="px-8 py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <span>Save Vendor Quotes & Send to Manager</span>
                            <PaperAirplaneIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* READ-ONLY QUOTES LIST FOR MANAGER ROLE (NO AUTOMATIC ACCEPTED BADGE BEFORE MANAGER ACCEPTS) */
                      <div className="space-y-4">
                        {activeInquiry.vendorQuotes && activeInquiry.vendorQuotes.length > 0 ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-black text-indigo-950 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <CheckCircleIcon className="w-5 h-5 text-indigo-600 shrink-0" />
                                <span>Procurement Sourcing Completed by {activeInquiry.procurementUser}. Awaiting Manager Selection.</span>
                              </div>
                              <span className="text-xs bg-indigo-200 text-indigo-950 font-black px-3 py-1 rounded">
                                SOURCED
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {activeInquiry.vendorQuotes.map((q, idx) => {
                                const isManagerAccepted =
                                  activeInquiry.status === "COMPLETED" && activeInquiry.selectedVendorIndex === idx;

                                return (
                                  <div
                                    key={idx}
                                    className={`p-5 rounded-xl border text-xs space-y-2.5 ${
                                      isManagerAccepted
                                        ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200"
                                        : "bg-slate-50 border-slate-200"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-black text-slate-900 text-sm truncate">{q.vendorName}</span>
                                      {isManagerAccepted ? (
                                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded">
                                          ACCEPTED BY MANAGER
                                        </span>
                                      ) : (
                                        <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded">
                                          Vendor Quote #{idx + 1}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xl font-black text-amber-950">
                                      ₹{Number(q.price).toLocaleString("en-IN")}
                                    </div>
                                    <p className="text-xs text-slate-600 font-semibold italic line-clamp-2">
                                      "{q.remarks || "No remarks"}"
                                    </p>
                                    {q.phone && <p className="text-xs text-slate-500 font-semibold">Contact: {q.phone}</p>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="p-5 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs font-extrabold text-amber-950 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <LockClosedIcon className="w-5 h-5 text-amber-600 shrink-0" />
                              <span>
                                Awaiting Procurement Sourcing from <strong>{activeInquiry.procurementUser}</strong>.
                              </span>
                            </div>
                            <span className="text-xs font-black px-3 py-1 rounded-md bg-amber-200 text-amber-950 uppercase">
                              Pending Sourcing
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 2: MANAGER APPROVAL & STATUS FOR EMPLOYEE */}
              <div
                className={`p-8 rounded-2xl border transition-all ${
                  activeInquiry.status === "PENDING_MANAGER"
                    ? "bg-white border-indigo-400 shadow-md ring-2 ring-indigo-100"
                    : "bg-white border-slate-200/90 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-3.5">
                    <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-base flex items-center justify-center">
                      {isEmployeeRole ? "✓" : "2"}
                    </span>
                    <h3 className="text-lg font-black text-slate-900">
                      {isEmployeeRole ? "Inquiry Status & Approved Selling Price" : "Manager Vendor Selection & Selling Price Form"}
                    </h3>
                  </div>

                  {activeInquiry.status === "COMPLETED" ? (
                    <span className="text-xs font-extrabold text-emerald-900 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200 flex items-center gap-2">
                      <ShieldCheckIcon className="w-5 h-5 text-emerald-600" />
                      ✓ Approved & Closed
                    </span>
                  ) : activeInquiry.status === "PENDING_MANAGER" ? (
                    <span className="text-xs font-extrabold text-indigo-900 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200">
                      Pending Manager Review
                    </span>
                  ) : (
                    <span className="text-xs font-extrabold text-amber-900 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200 flex items-center gap-2">
                      <ClockIcon className="w-5 h-5 text-amber-600" />
                      Pending Procurement Sourcing
                    </span>
                  )}
                </div>

                <div className="mt-6 space-y-6">
                  {/* EMPLOYEE ROLE CUSTOM CLEAN VIEW (NO VENDOR COST/DETAILS SHOWN) */}
                  {isEmployeeRole ? (
                    activeInquiry.status === "NEW" || activeInquiry.status === "PENDING_PROCUREMENT" ? (
                      <div className="p-7 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-4 text-amber-950">
                        <div className="flex items-center justify-between border-b border-amber-200/60 pb-3.5">
                          <div className="flex items-center gap-3.5">
                            <ClockIcon className="w-7 h-7 text-amber-600 shrink-0" />
                            <div>
                              <h4 className="font-black text-lg text-amber-950">Status: Currently with Procurement Officer</h4>
                              <p className="text-sm text-amber-900 font-bold mt-0.5">Assigned Officer: <strong>{activeInquiry.procurementUser}</strong></p>
                            </div>
                          </div>
                          <span className="text-xs font-black bg-amber-200 text-amber-950 px-4 py-1.5 rounded-md uppercase tracking-wider">
                            Pending Sourcing
                          </span>
                        </div>
                        <p className="text-base text-amber-950 font-semibold leading-relaxed">
                          Your requirement is currently being processed by the Procurement team. Once vendor options are sourced, it will be sent to the Sales Manager to set the selling price.
                        </p>
                      </div>
                    ) : activeInquiry.status === "PENDING_MANAGER" ? (
                      <div className="p-7 bg-indigo-50/90 border border-indigo-200 rounded-2xl space-y-4 text-indigo-950">
                        <div className="flex items-center justify-between border-b border-indigo-200/60 pb-3.5">
                          <div className="flex items-center gap-3.5">
                            <ClockIcon className="w-7 h-7 text-indigo-600 shrink-0" />
                            <div>
                              <h4 className="font-black text-lg text-indigo-950">Status: Currently with Sales Manager</h4>
                              <p className="text-sm text-indigo-900 font-bold mt-0.5">Assigned Manager: <strong>{activeInquiry.managerUser || "Sales Manager"}</strong></p>
                            </div>
                          </div>
                          <span className="text-xs font-black bg-indigo-200 text-indigo-950 px-4 py-1.5 rounded-md uppercase tracking-wider">
                            Pending Manager Approval
                          </span>
                        </div>
                        <p className="text-base text-indigo-950 font-semibold leading-relaxed">
                          Procurement sourcing is completed. The Sales Manager is currently reviewing and setting the final selling price for this inquiry.
                        </p>
                      </div>
                    ) : (
                      /* COMPLETED STATUS FOR EMPLOYEE */
                      <div className="bg-emerald-50/80 border border-emerald-200 p-8 rounded-2xl space-y-6">
                        <div className="flex items-center justify-between bg-emerald-100 border border-emerald-300 p-5 rounded-xl">
                          <div className="flex items-center gap-4">
                            <CheckCircleIcon className="w-8 h-8 text-emerald-600 shrink-0" />
                            <div>
                              <h4 className="text-lg font-black text-emerald-950">Selling Price Approved</h4>
                              <p className="text-sm text-emerald-800 font-bold">Approved by {activeInquiry.managerUser}</p>
                            </div>
                          </div>
                          <span className="text-sm bg-emerald-600 text-white font-black px-4 py-2 rounded-lg shadow-2xs">
                            ✓ APPROVED & CLOSED
                          </span>
                        </div>

                        <div className="bg-white p-7 rounded-xl border border-emerald-200 shadow-2xs space-y-2">
                          <span className="text-sm font-extrabold text-slate-500 uppercase tracking-wider block">
                            Approved Selling Price for Customer
                          </span>
                          <div className="text-5xl font-black text-emerald-700 font-mono">
                            ₹{Number(activeInquiry.sellingPrice).toLocaleString("en-IN")}
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 text-slate-800 space-y-2">
                          <span className="text-xs font-extrabold text-slate-500 uppercase block">Manager Remarks</span>
                          <p className="text-base font-bold italic text-slate-900">
                            "{activeInquiry.managerRemarks || "Selling price approved."}"
                          </p>
                        </div>
                      </div>
                    )
                  ) : (
                    /* NON-EMPLOYEE (MANAGER / PROCUREMENT) VIEW */
                    activeInquiry.status === "PENDING_PROCUREMENT" || activeInquiry.status === "NEW" ? (
                      <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <LockClosedIcon className="w-5 h-5 text-slate-400 shrink-0" />
                          <span>Disabled for Manager — Awaiting Vendor Quotations from {activeInquiry.procurementUser}</span>
                        </div>
                        <span className="text-xs font-extrabold text-slate-500 uppercase">Waiting Sourcing</span>
                      </div>
                    ) : activeInquiry.status === "PENDING_MANAGER" && currentRole === "MANAGER" ? (
                      /* EDITABLE FORM FOR MANAGER ROLE ONLY */
                      <form onSubmit={handleManagerApprove} className="space-y-7">
                        <div className="space-y-3">
                          <label className="text-sm font-extrabold text-slate-900 block">
                            Compare & Select Best Vendor Quotation for Sourcing (Required):
                          </label>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {activeInquiry.vendorQuotes && activeInquiry.vendorQuotes.length > 0 ? (
                              activeInquiry.vendorQuotes.map((quote, qIdx) => (
                                <div
                                  key={qIdx}
                                  onClick={() => setSelectedVendorIndexByManager(qIdx)}
                                  className={`p-5 rounded-xl border cursor-pointer transition-all space-y-3 relative ${
                                    selectedVendorIndexByManager === qIdx
                                      ? "bg-indigo-50 border-indigo-600 shadow-sm ring-2 ring-indigo-200"
                                      : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-slate-900 text-sm">
                                      {quote.vendorName}
                                    </span>
                                    <input
                                      type="radio"
                                      name="selectedVendorQuote"
                                      checked={selectedVendorIndexByManager === qIdx}
                                      onChange={() => setSelectedVendorIndexByManager(qIdx)}
                                      className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                                    />
                                  </div>

                                  <div className="text-2xl font-black text-amber-950">
                                    ₹{Number(quote.price).toLocaleString("en-IN")}
                                  </div>

                                  <p className="text-xs text-slate-600 font-semibold italic line-clamp-2">
                                    "{quote.remarks || "Standard dealer rates"}"
                                  </p>

                                  <div className="text-xs text-slate-500 font-mono pt-2 border-t border-slate-200 flex justify-between font-bold">
                                    <span>{quote.phone || "No phone"}</span>
                                    <span>{quote.date}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-800">
                                Vendor: {activeInquiry.procurementVendorName} • Cost: ₹{activeInquiry.vendorPrice}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                          <div className="space-y-2">
                            <label className="text-base font-black text-slate-900 block">
                              Approved Selling Price (₹) *
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-base">
                                ₹
                              </span>
                              <input
                                type="number"
                                placeholder="e.g. 28000"
                                required
                                value={inputSellingPrice}
                                onChange={(e) => setInputSellingPrice(e.target.value)}
                                className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border-2 border-slate-300 rounded-xl font-black text-slate-900 text-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-base font-black text-slate-900 block">
                              Manager Approval Remarks
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Approved with target margin"
                              value={inputMgrRemarks}
                              onChange={(e) => setInputMgrRemarks(e.target.value)}
                              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-300 rounded-xl font-bold text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-3">
                          <button
                            type="submit"
                            className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <CheckBadgeIcon className="w-5 h-5" />
                            <span>Approve Selling Price & Complete Inquiry</span>
                          </button>
                        </div>
                      </form>
                    ) : activeInquiry.status === "PENDING_MANAGER" ? (
                      <div className="p-5 bg-indigo-50/90 border border-indigo-200 rounded-2xl text-xs font-bold text-indigo-950 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <LockClosedIcon className="w-5 h-5 text-indigo-600 shrink-0" />
                          <span>
                            Awaiting Manager Selling Price Approval from <strong>{activeInquiry.managerUser || "Sales Manager"}</strong>.
                          </span>
                        </div>
                        <span className="text-xs font-black px-3 py-1 rounded-md bg-indigo-200 text-indigo-950 uppercase">
                          Pending Manager
                        </span>
                      </div>
                    ) : (
                      /* COMPLETED SUMMARY FOR MANAGER / PROCUREMENT */
                      <div className="bg-emerald-50/80 border border-emerald-200 p-6 rounded-xl space-y-5">
                        <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-xl text-sm font-black text-emerald-950 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircleIcon className="w-6 h-6 text-emerald-600 shrink-0" />
                            <span>Manager Selling Price Approved by {activeInquiry.managerUser}</span>
                          </div>
                          <span className="text-xs bg-emerald-600 text-white font-black px-3.5 py-1.5 rounded">
                            ✓ APPROVED & CLOSED
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                          <div className="bg-white p-5 rounded-xl border border-slate-200 text-center">
                            <span className="text-xs font-extrabold text-slate-500 uppercase block">Target Price</span>
                            <span className="text-xl font-black text-slate-900 mt-1 block">
                              ₹{Number(activeInquiry.targetPrice || 0).toLocaleString("en-IN")}
                            </span>
                          </div>

                          <div className="bg-white p-5 rounded-xl border border-amber-200 text-center">
                            <span className="text-xs font-extrabold text-amber-900 uppercase block">
                              Accepted Cost ({activeInquiry.procurementVendorName})
                            </span>
                            <span className="text-xl font-black text-amber-950 mt-1 block">
                              ₹{Number(activeInquiry.vendorPrice || 0).toLocaleString("en-IN")}
                            </span>
                          </div>

                          <div className="bg-emerald-600 text-white p-5 rounded-xl text-center shadow-xs">
                            <span className="text-xs font-black uppercase block text-emerald-100">
                              Approved Selling Price
                            </span>
                            <span className="text-2xl font-black mt-1 block">
                              ₹{Number(activeInquiry.sellingPrice || 0).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-emerald-200 pt-3 font-semibold text-slate-800 space-y-1 text-sm">
                          <p>
                            <strong>Manager Remarks ({activeInquiry.managerUser}):</strong> "{activeInquiry.managerRemarks || "Approved"}"
                          </p>
                        </div>
                      </div>
                    )
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
