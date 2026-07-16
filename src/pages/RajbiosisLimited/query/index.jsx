import { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc
} from "firebase/firestore";
import Modal from "react-modal";
import "./query.css";
import toast, { Toaster } from "react-hot-toast";
import { useLocation } from "react-router-dom";
export default function QueryPage() {

  const WEBSITE = "rajbiosislimited";
  const [activeTab, setActiveTab] = useState("contact");
  const [productQueries, setProductQueries] = useState([]);
  const [contactQueries, setContactQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewData, setViewData] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    Modal.setAppElement("body");
  }, []);

  // 🔥 CONTACT FIX
  useEffect(() => {
    const q = query(
      collection(
        db,
        "websites",
        WEBSITE,
        "pages",
        "contact",
        "queries"
      ),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setContactQueries(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 🔥 PRODUCT FIX
  useEffect(() => {
    const q = query(
      collection(
        db,
        "websites",
        WEBSITE,
        "pages",
        "products",
        "queries"
      ),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setProductQueries(data);
    });

    return () => unsub();
  }, []);

  // 🔥 DELETE FIX
  const handleDelete = async () => {
    if (!deleteId || !deleteType) return;

    try {
      const path =
        deleteType === "product"
          ? [
            "websites",
            WEBSITE,
            "pages",
            "products",
            "queries",
          ]
          : [
            "websites",
            WEBSITE,
            "pages",
            "contact",
            "queries",
          ];

      await deleteDoc(doc(db, ...path, deleteId));

      setShowDeleteModal(false);
      setDeleteId(null);
      setDeleteType(null);

      toast.success("Deleted successfully");

    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  };

  const { pathname } = useLocation();

  const pathParts = pathname
    .split("/")
    .filter(Boolean);

  return (
    <div className="flex">
      <div className="query-page-main">

        <div className="query-page-top-header">

          <div className="query-page-path">
            {pathParts.map((part, index) => (
              <span key={index}>
                {part.charAt(0).toUpperCase() + part.slice(1)}
                {index !== pathParts.length - 1 && " > "}
              </span>
            ))}
          </div>

          <div className="query-page-topbar">
            <h1>Query Dashboard</h1>
          </div>

        </div>

        {/* TABS */}
        <div className="query-page-tabs">

          <button
            className={
              activeTab === "contact"
                ? "query-page-tab query-page-active"
                : "query-page-tab"
            }
            onClick={() => setActiveTab("contact")}
          >
            Contact Queries
          </button>

          <button
            className={
              activeTab === "product"
                ? "query-page-tab query-page-active"
                : "query-page-tab"
            }
            onClick={() => setActiveTab("product")}
          >
            Product Queries
          </button>

        </div>

        {loading && (
          <div className="query-page-empty-box">
            Loading...
          </div>
        )}

        {!loading && (
          <div className="query-page-content-box">

            {/* CONTACT */}
            {activeTab === "contact" && (
              <div className="query-page-wrapper">

                {contactQueries.length === 0 ? (
                  <div className="query-page-empty-box">
                    No Contact Queries
                  </div>
                ) : (
                  <table className="query-page-table">

                    <thead>
                      <tr>
                        <th>S.R.</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {contactQueries.map((q, i) => (
                        <tr key={q.id}>

                          <td>{i + 1}</td>

                          <td>{q.name}</td>

                          <td>{q.email}</td>

                          <td>{q.phone}</td>

                          <td className="query-page-date">
                            {q.createdAt?.toDate
                              ? q.createdAt.toDate().toLocaleString()
                              : "-"}
                          </td>

                          <td>

                            <div className="query-page-action-btns">

                              <button
                                className="query-page-view-btn"
                                onClick={() => {
                                  setViewData(q);
                                  setShowViewModal(true);
                                }}
                              >
                                View
                              </button>

                              <button
                                className="query-page-delete-btn"
                                onClick={() => {
                                  setDeleteId(q.id);
                                  setDeleteType("contact");
                                  setShowDeleteModal(true);
                                }}
                              >
                                Delete
                              </button>

                            </div>

                          </td>

                        </tr>
                      ))}
                    </tbody>

                  </table>
                )}

              </div>
            )}

            {/* PRODUCT */}
            {activeTab === "product" && (
              <div className="query-page-wrapper">

                {productQueries.length === 0 ? (
                  <div className="query-page-empty-box">
                    No Product Queries
                  </div>
                ) : (
                  <table className="query-page-table">

                    <thead>
                      <tr>
                        <th>S.R.</th>
                        <th>Product</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {productQueries.map((q, i) => (
                        <tr key={q.id}>

                          <td>{i + 1}</td>

                          <td>{q.productName}</td>

                          <td>{q.email}</td>

                          <td>{q.phone}</td>

                          <td className="query-page-date">
                            {q.createdAt?.toDate
                              ? q.createdAt.toDate().toLocaleString()
                              : "-"}
                          </td>

                          <td>

                            <button
                              className="query-page-delete-btn"
                              onClick={() => {
                                setDeleteId(q.id);
                                setDeleteType("product");
                                setShowDeleteModal(true);
                              }}
                            >
                              Delete
                            </button>

                          </td>

                        </tr>
                      ))}
                    </tbody>

                  </table>
                )}

              </div>
            )}

          </div>
        )}

      </div>

      {/* DELETE MODAL */}
      <Modal
        isOpen={showDeleteModal}
        onRequestClose={() => setShowDeleteModal(false)}
        className="query-page-modal-base query-page-modal-box-delete"
        overlayClassName="query-page-modal-overlay"
      >
        <div className="query-page-modal-content">

          <h2>Delete Query?</h2>

          <p>Are you sure you want to delete this?</p>

          <div className="query-page-modal-actions">

            <button
              className="query-page-cancel-btn"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </button>

            <button
              className="query-page-delete-btn"
              onClick={handleDelete}
            >
              Yes, Delete
            </button>

          </div>

        </div>
      </Modal>

      {/* VIEW MODAL */}
      <Modal
        isOpen={showViewModal}
        onRequestClose={() => setShowViewModal(false)}
        className="query-page-modal-base query-page-modal-box-view"
        overlayClassName="query-page-modal-overlay"
      >
        {viewData && (
          <div className="query-page-modal-content">

            <h2>Query Details</h2>

            <div className="query-page-view-grid">

              <div><b>Name:</b> {viewData.name}</div>

              <div><b>Email:</b> {viewData.email}</div>

              <div><b>Phone:</b> {viewData.phone}</div>

              <div><b>Subject:</b> {viewData.subject}</div>

              <div className="query-page-full-msg">
                <b>Message:</b>
                <p>{viewData.message}</p>
              </div>

              <div>
                <b>Date:</b>{" "}
                {viewData.createdAt?.toDate
                  ? viewData.createdAt.toDate().toLocaleString()
                  : "-"}
              </div>

            </div>

            <div className="query-page-modal-actions">

              <button
                className="query-page-cancel-btn"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>

            </div>

          </div>
        )}
      </Modal>

      <Toaster position="top-right" />

    </div>
  );
}