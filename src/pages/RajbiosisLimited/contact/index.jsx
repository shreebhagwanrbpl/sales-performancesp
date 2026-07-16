

import Modal from "react-modal";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import "./contact.css";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { db } from "../../../firebase";
export default function AdminContact() {
  const { pathname } = useLocation(); //  Top level hook
  const pathParts = pathname
    .split("/")
    .filter(Boolean);

  const docRef = doc(
    db,
    "websites",
    "rajbiosislimited",
    "pages",
    "contact"
  );

  const [contactInfo, setContactInfo] = useState([]);
  const [form, setForm] = useState({ label: "", value: "" });
  const [editIndex, setEditIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState(null);



  // LOAD
  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        setContactInfo(snap.data().contactInfo || []);
      }

      setLoading(false);
    };

    load();
  }, []);

  // Modal setup
  useEffect(() => {
    Modal.setAppElement("body");
  }, []);

  // INPUT CHANGE
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // SAVE / UPDATE
  const handleSave = async () => {
    let updated = [...contactInfo];

    try {
      if (editIndex !== null) {
        updated[editIndex] = form;
      } else {
        updated.push(form);
      }

      setContactInfo(updated);

      setForm({
        label: "",
        value: "",
      });

      setEditIndex(null);

      await setDoc(
        docRef,
        { contactInfo: updated },
        { merge: true }
      );

      toast.success(
        editIndex !== null
          ? "Updated successfully"
          : "Saved successfully"
      );
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    }
  };

  // EDIT
  const handleEdit = (index) => {
    setForm(contactInfo[index]);
    setEditIndex(index);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // DELETE
  const deleteField = (index) => {
    setDeleteIndex(index);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteIndex === null) return;

    const updated = contactInfo.filter(
      (_, i) => i !== deleteIndex
    );

    setContactInfo(updated);

    await setDoc(
      docRef,
      { contactInfo: updated },
      { merge: true }
    );

    setDeleteIndex(null);
    setIsModalOpen(false);

    toast.success("Deleted successfully");
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="contact-page">
      <div className="contact-main">

        {/* HEADER */}
        <div className="contact-top-header">

          <div className="contact-page-path">
            {pathParts.map((part, index) => (
              <span key={index}>
                {part.charAt(0).toUpperCase() + part.slice(1)}
                {index !== pathParts.length - 1 && " > "}
              </span>
            ))}
          </div>

          <h1 className="contact-heading">
            Contact Info Admin
          </h1>

        </div>

        {/* FORM */}
        <div className="contact-card">

          <h2>
            {editIndex !== null ? "Edit Field" : "Add Field"}
          </h2>

          <input
            name="label"
            placeholder="Label (Address, Phone...)"
            value={form.label}
            onChange={handleChange}
          />

          <input
            name="value"
            placeholder="Value"
            value={form.value}
            onChange={handleChange}
          />

          <div className="contact-actions">

            <button
              className="contact-add-btn"
              onClick={handleSave}
            >
              {editIndex !== null ? "Update" : "Save"}
            </button>

          </div>

        </div>

        {/* PREVIEW */}

        <div className="contact-card">

          <h2>Preview</h2>

          {contactInfo.length === 0 ? (
            <p>No Data</p>
          ) : (

            <table>

              <thead>
                <tr>
                  <th>Label</th>
                  <th>Value</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>

                {contactInfo.map((item, index) => (

                  <tr key={index}>

                    <td>{item.label}</td>

                    <td>{item.value}</td>

                    <td>

                      <button
                        className="contact-edit"
                        onClick={() => handleEdit(index)}
                      >
                        Edit
                      </button>

                      <button
                        className="contact-delete"
                        onClick={() => deleteField(index)}
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

      </div>

      {/* MODAL */}

      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        className="contact-modal-box"
        overlayClassName="contact-modal-overlay"
      >

        <div className="contact-modal-content">

          <h2>Delete Field</h2>

          <p>
            Are you sure you want to delete this?
          </p>

          <div className="contact-modal-actions">

            <button
              className="contact-cancel-btn"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>

            <button
              className="contact-delete-btn"
              onClick={confirmDelete}
            >
              Delete
            </button>

          </div>

        </div>

      </Modal>

    </div>
  );
}