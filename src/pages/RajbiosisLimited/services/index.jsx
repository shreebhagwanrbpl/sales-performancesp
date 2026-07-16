
import { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import "./services.css";
import toast, { Toaster } from "react-hot-toast";
import Modal from "react-modal";
import { useLocation } from "react-router-dom";

export default function ServicesAdmin() {
  const [services, setServices] = useState([{ title: "", desc: "" }]);
  const [savedServices, setSavedServices] = useState([]);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  useEffect(() => {
    Modal.setAppElement("body");
  }, []);

  // 🔥 LOAD DATA
  useEffect(() => {
    const fetchData = async () => {
      const snap = await getDoc(
        doc(db, "websites", "rajbiosislimited", "pages", "services")
      );

      if (snap.exists()) {
        const data = snap.data().services || [];

        //  deep copy
        setSavedServices(data.map((item) => ({ ...item })));
      }
    };

    fetchData();
  }, []);

  // 🔥 INPUT CHANGE
  const handleChange = (index, field, value) => {
    const updated = [...services];
    updated[index][field] = value;
    setServices(updated);
  };

  // 🔥 ADD FIELD
  const addService = () => {
    setServices([...services, { title: "", desc: "" }]);
  };

  // 🔥 DELETE FIELD (FORM)
  const deleteService = (index) => {
    if (services.length === 1) return toast.error("At least one required");

    const updated = services.filter((_, i) => i !== index);
    setServices(updated);
  };

  // 🔥 SAVE (APPEND FIX)
  const saveServices = async () => {
    const docRef = doc(db, "websites", "rajbiosislimited", "pages", "services");

    const snap = await getDoc(docRef);

    let existing = [];

    if (snap.exists()) {
      existing = snap.data().services || [];
    }

    let updatedServices = [];

    if (editIndex !== null) {
      // 🔥 UPDATE MODE
      updatedServices = [...existing];
      updatedServices[editIndex] = services[0];
    } else {
      // 🔥 ADD MODE
      updatedServices = [...existing, ...services];
    }

    try {
      await setDoc(docRef, {
        services: updatedServices,
      });

      setSavedServices(updatedServices.map(item => ({ ...item })));

      setServices([{ title: "", desc: "" }]);
      setEditIndex(null);

      if (editIndex !== null) {
        toast.success("Updated Successfully");
      } else {
        toast.success("Saved Successfully");
      }

    } catch (error) {
      toast.error("Something went wrong");
      console.error(error);
    }

  };

  // 🔥 EDIT (LOAD ALL DATA)
  const handleEdit = (index) => {
    const selected = savedServices[index];

    setServices([{ ...selected }]); // sirf ek item
    setEditIndex(index);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 🔥 DELETE CONFIRM
  const confirmDelete = async () => {
    if (deleteIndex === null) return;

    const updated = savedServices.filter((_, i) => i !== deleteIndex);

    await setDoc(
      doc(db, "websites", "rajbiosislimited", "pages", "services"),
      { services: updated }
    );

    setSavedServices(updated);

    if (updated.length === 0) {
      setServices([{ title: "", desc: "" }]);
    }

    setDeleteIndex(null);
  };

  const { pathname } = useLocation();

  const pathParts = pathname
    .split("/")
    .filter(Boolean);

  return (
    <div className="service-page-wrapper">
      <div className="service-page-main">

        <div className="service-page-top-header">

          <div className="service-page-path">
            {pathParts.map((part, index) => (
              <span key={index}>
                {part.charAt(0).toUpperCase() + part.slice(1)}
                {index !== pathParts.length - 1 && " > "}
              </span>
            ))}
          </div>

          <h1 className="service-page-heading">
            Services Admin
          </h1>

        </div>

        {/* FORM */}
        <div className="service-page-card">

          <h2>Add / Edit Services</h2>

          {services.map((item, i) => (
            <div className="service-page-row" key={i}>

              <input
                className="service-page-input"
                placeholder="Title"
                value={item.title}
                onChange={(e) =>
                  handleChange(i, "title", e.target.value)
                }
              />

              <input
                className="service-page-input"
                placeholder="Description"
                value={item.desc}
                onChange={(e) =>
                  handleChange(i, "desc", e.target.value)
                }
              />

              <button
                type="button"
                className="service-page-btn service-page-delete-btn"
                onClick={() => deleteService(i)}
              >
                Delete
              </button>

            </div>
          ))}

          <div className="service-page-actions">

            <button
              type="button"
              className="service-page-btn"
              onClick={addService}
            >
              + Add Service
            </button>

            <button
              type="button"
              className="service-page-btn service-page-add-btn"
              onClick={saveServices}
            >
              {editIndex !== null ? "Update" : "Save"}
            </button>

          </div>

        </div>

        {/* PREVIEW */}
        <div className="service-page-preview">

          <h2>Saved Services</h2>

          <div className="service-page-preview-grid">

            {savedServices.map((item, i) => (
              <div
                className="service-page-preview-card"
                key={i}
              >
                <h4>{item.title}</h4>

                <p>{item.desc}</p>

                <div className="service-page-preview-actions">

                  <button
                    type="button"
                    className="service-page-btn service-page-edit-btn"
                    onClick={() => handleEdit(i)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="service-page-btn service-page-delete-btn"
                    onClick={() => {
                      setDeleteIndex(i);
                      setIsModalOpen(true);
                    }}
                  >
                    Delete
                  </button>

                </div>

              </div>
            ))}

          </div>

        </div>

      </div>

      {/* REACT MODAL */}

      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        className="service-page-modal-box"
        overlayClassName="service-page-modal-overlay"
      >

        <div className="service-page-modal-content">

          <h2>Delete Service</h2>

          <p>
            Are you sure you want to delete this service?
          </p>

          <div className="service-page-modal-actions">

            <button
              className="service-page-btn service-page-cancel-btn"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>

            <button
              className="service-page-btn service-page-delete-btn"
              onClick={async () => {
                await confirmDelete();
                toast.success("Deleted successfully");
                setIsModalOpen(false);
              }}
            >
              Delete
            </button>

          </div>

        </div>

      </Modal>

    </div>
  );
}