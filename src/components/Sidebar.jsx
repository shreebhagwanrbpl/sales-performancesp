import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  HomeIcon,
  PlusCircleIcon,
  ChatBubbleLeftRightIcon,
  UserPlusIcon,
  UserCircleIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  DocumentChartBarIcon,
  CurrencyRupeeIcon,
  ChartBarIcon,
  ArchiveBoxIcon,
  TrophyIcon,
  ShoppingBagIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import logo from "../assets/logo.png";

export default function Sidebar() {
  const { pathname } = useLocation();
  const role = localStorage.getItem("role");
  const [openWebsite, setOpenWebsite] = useState(false);
  const [openAdmin, setOpenAdmin] = useState(false);
  const [openProcurement, setOpenProcurement] = useState(true);
  const isTeamPath = ["/feedback", "/admin/assign-tl", "/admin/excel-sales-detail", "/exsisting-customer"].includes(pathname);
  const [openTeamManagement, setOpenTeamManagement] = useState(isTeamPath);
  const isActive = (path) =>
    pathname === path
      ? "bg-indigo-50 text-indigo-600 font-semibold"
      : "text-gray-600 hover:bg-gray-100";

  return (
    <aside className="w-64 bg-white border-r h-screen sticky top-0 overflow-hidden flex flex-col">
      {/* LOGO */}
      <div className="h-16 flex items-center px-6 border-b gap-3">
        <img src={logo} alt="Logo" className="h-8" />
        <div>
          <h1 className="font-bold text-sm">RajBiosis</h1>
          <span className="text-xs text-gray-500">Daily Sales Tracker</span>
        </div>
      </div>

      <nav
        className="flex-1 p-4 space-y-2 overflow-y-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#6366f1 #f3f4f6",
        }}
      >
        {/* ================= COMMON ================= */}
        {(role === "EMPLOYEE" || role === "TL" || role === "ADMIN") && (
          <Link
            to="/dashboard"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
              "/dashboard",
            )}`}
          >
            <HomeIcon className="w-5 h-5" />
            Dashboard
          </Link>
        )}

        {(role === "EMPLOYEE" || role === "TL" || role === "ADMIN") && (
          <Link
            to="/eotm-list"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
              "/eotm-list",
            )}`}
          >
            <TrophyIcon className="w-5 h-5 text-amber-500" />
            EOTM List
          </Link>
        )}

        {(role === "EMPLOYEE" || role === "TL" || role === "ADMIN") && (
          <Link
            to="/add-sale"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("/add-sale")}`}
          >
            <PlusCircleIcon className="w-5 h-5" />
            Add Sale
          </Link>
        )}

        {(role === "EMPLOYEE" || role === "TL") && (
          <>
            <Link
              to="/employee-detail"
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                "/employee-detail",
              )}`}
            >
              <UserCircleIcon className="w-5 h-5" />
              Add Self Details
            </Link>
            <Link
              to="/self-assessment"
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                "/self-assessment",
              )}`}
            >
              <UserCircleIcon className="w-5 h-5" />
              Self Assessment
            </Link>
          </>
        )}

        {(role === "EMPLOYEE" || role === "ADMIN") && (
          <>
            <Link
              to="/leave-management"
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                "/leave-management",
              )}`}
            >
              <PlusCircleIcon className="w-5 h-5" />
              Leave
            </Link>
          </>
        )}
        {/* ================= TL + ADMIN ================= */}
        {/* ================= TEAM MANAGEMENT ================= */}
        {(role === "TL" || role === "ADMIN" || role === "EMPLOYEE") && (
          <div className="mt-4">
            <div
              onClick={() => setOpenTeamManagement(!openTeamManagement)}
              className="flex items-center justify-between px-4 py-2 text-xs uppercase text-gray-400 hover:text-gray-600 cursor-pointer rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span>Team Management</span>
              <ChevronDownIcon
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${openTeamManagement ? "rotate-180" : ""
                  }`}
              />
            </div>

            {openTeamManagement && (
              <div className="mt-1 space-y-1">
                {(role === "TL" || role === "ADMIN") && (
                  <Link
                    to="/feedback"
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                      "/feedback",
                    )}`}
                  >
                    <ChatBubbleLeftRightIcon className="w-5 h-5" />
                    Customer Feedback
                  </Link>
                )}

                {role === "ADMIN" && (
                  <Link
                    to="/admin/assign-tl"
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                      "/admin/assign-tl",
                    )}`}
                  >
                    <UserPlusIcon className="w-5 h-5" />
                    Assign TL
                  </Link>
                )}

                {role === "ADMIN" && (
                  <Link
                    to="/admin/excel-sales-detail"
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                      "/admin/excel-sales-detail",
                    )}`}
                    title="Excel Sales Detail"
                  >
                    <DocumentChartBarIcon className="w-5 h-5" />
                    Excel Sales Detail
                  </Link>
                )}

                {(role === "EMPLOYEE" || role === "TL" || role === "ADMIN") && (
                  <Link
                    to="/exsisting-customer"
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                      "/exsisting-customer",
                    )}`}
                  >
                    <ChatBubbleLeftRightIcon className="w-5 h-5" />
                    Add Existing Customer
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= ADMIN ONLY ================= */}

        {/* ================= ADMIN CONTROLS ================= */}
        {role === "ADMIN" && (
          <div className="mt-6">
            <div
              onClick={() => setOpenAdmin(!openAdmin)}
              className="flex items-center justify-between px-4 py-2 text-xs uppercase text-gray-400 cursor-pointer"
            >
              <span>Admin Controls</span>
              <span>{openAdmin ? "▲" : "▼"}</span>
            </div>

            {openAdmin && (
              <div className="mt-2 space-y-1">
                <Link
                  to="approve-users"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("approve-users")}`}
                >
                  <UserPlusIcon className="w-5 h-5" />
                  User Approval
                </Link>

                <Link
                  to="/add-ctc"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("/add-ctc")}`}
                >
                  <BanknotesIcon className="w-5 h-5" />
                  Add CTC
                </Link>

                <Link
                  to="/appraisal"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("/appraisal")}`}
                >
                  <ChartBarIcon className="w-5 h-5" />
                  Appraisal
                </Link>

                <Link
                  to="/inventory"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("/inventory")}`}
                >
                  <ArchiveBoxIcon className="w-5 h-5" />
                  Inventory
                </Link>

                <Link
                  to="reports"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("reports")}`}
                >
                  <UserPlusIcon className="w-5 h-5" />
                  Reports
                </Link>
              </div>
            )}
          </div>
        )}
        {/* ================= WEBSITE ================= */}
        {/* <div className="mt-6">
  <div
    onClick={() => setOpenWebsite(!openWebsite)}
    className="flex items-center justify-between px-4 py-2 text-sm cursor-pointer text-gray-600 hover:bg-gray-100 rounded-lg"
  >
    <span>🌐 Website</span>
    <span>{openWebsite ? "▲" : "▼"}</span>
  </div>

  {openWebsite && (
    <div className="ml-4 mt-2 space-y-1">

      <Link
        to="/home"
        className={`block px-4 py-2 text-sm rounded-lg ${isActive("/website/home")}`}
      >
        🏠 Home Page
      </Link>

      <Link
        to="/website/hero"
        className={`block px-4 py-2 text-sm rounded-lg ${isActive("/website/hero")}`}
      >
        🎯 Hero Section
      </Link>

      <Link
        to="/website/products"
        className={`block px-4 py-2 text-sm rounded-lg ${isActive("/website/products")}`}
      >
        📦 Products
      </Link>

      <Link
        to="/website/contact"
        className={`block px-4 py-2 text-sm rounded-lg ${isActive("/website/contact")}`}
      >
        📞 Contact Page
      </Link>

      <a
        href="https://sales.rajbiosis.app/products.html"
        target="_blank"
        className="block px-4 py-2 text-sm rounded-lg text-blue-600 hover:bg-gray-100"
      >
        🌍 View Live Website
      </a>

    </div>
  )}
</div> */}

        {(role === "ADMIN" || role === "PURCHASING" || true) && (
          <Link
            to="/purchaseform"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
              "/purchaseform",
            )}`}
          >
            <PlusCircleIcon className="w-5 h-5" />
            Purchase Entry
          </Link>
        )}

        {/* ================= PROCUREMENT ================= */}
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div
            onClick={() => setOpenProcurement(!openProcurement)}
            className="flex items-center justify-between px-4 py-2 text-xs uppercase font-extrabold text-slate-500 hover:text-indigo-600 cursor-pointer rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShoppingBagIcon className="w-5 h-5 text-indigo-600" />
              <span>PROCUREMENT</span>
            </div>
            <ChevronDownIcon
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openProcurement ? "rotate-180" : ""
                }`}
            />
          </div>

          {openProcurement && (
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-indigo-100 pl-2">
              <Link
                to="/procurement/vendors"
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${isActive(
                  "/procurement/vendors",
                )}`}
              >
                <UserGroupIcon className="w-4 h-4 text-indigo-500" />
                <span>1. Vendors</span>
              </Link>

              <Link
                to="/procurement/item-inquiry"
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${isActive(
                  "/procurement/item-inquiry",
                )}`}
              >
                <ClipboardDocumentListIcon className="w-4 h-4 text-indigo-500" />
                <span>2. Item Inquiry</span>
                {/* <span className="ml-auto text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  PROTOTYPE
                </span> */}
              </Link>
            </div>
          )}
        </div>

        {(role === "ADMIN" || role === "PURCHASING") && (
          <Link
            to="/officeexpense"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
              "/officeexpense",
            )}`}
          >
            <BanknotesIcon className="w-5 h-5" />
            Office Expense
          </Link>
        )}
        {(role === "ADMIN" || role === "PURCHASING") && (
          <Link
            to="/ProductsApprovel"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
              "/ProductsApprovel",
            )}`}
          >
            <PlusCircleIcon className="w-5 h-5" />
            Products Approvel
          </Link>
        )}
        {role === "ADMIN" && (
          <div className="mt-4">
            <div
              onClick={() => setOpenWebsite(!openWebsite)}
              className="flex items-center justify-between px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-100"
            >
              <span>🏢 Rajbiosis Limited</span>
              <span>{openWebsite ? "▲" : "▼"}</span>
            </div>

            {openWebsite && (
              <div className="ml-5 mt-2 space-y-1">

                <Link
                  to="/rajbiosis/home"
                  className={`block px-3 py-2 rounded-lg text-sm ${isActive("/rajbiosis/home")}`}
                >
                  Home
                </Link>

                <Link
                  to="/rajbiosis/products"
                  className={`block px-3 py-2 rounded-lg text-sm ${isActive("/rajbiosis/products")}`}
                >
                  Products
                </Link>

                <Link
                  to="/rajbiosis/services"
                  className={`block px-3 py-2 rounded-lg text-sm ${isActive("/rajbiosis/services")}`}
                >
                  Services
                </Link>

                <Link
                  to="/rajbiosis/contact"
                  className={`block px-3 py-2 rounded-lg text-sm ${isActive("/rajbiosis/contact")}`}
                >
                  Contact
                </Link>

                <Link
                  to="/rajbiosis/district"
                  className={`block px-3 py-2 rounded-lg text-sm ${isActive("/rajbiosis/district")}`}
                >
                  District
                </Link>

                <Link
                  to="/rajbiosis/query"
                  className={`block px-3 py-2 rounded-lg text-sm ${isActive("/rajbiosis/query")}`}
                >
                  Query
                </Link>

              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
