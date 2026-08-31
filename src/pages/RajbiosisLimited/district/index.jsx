import "./district.css";
import { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
  doc,
  setDoc,
  serverTimestamp,
  writeBatch,
  collection,
  getDocs,
  deleteDoc
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";

// Static mapping of website groups and slugs matching SuperAdmin configuration
const WEBSITE_GROUPS = {
  "Human Biomedical": [
    { id: "humanbiomedicalcom", label: "humanbiomedical.com" },
    { id: "humanbiomedicalin", label: "humanbiomedical.in" },
    { id: "humanbiomedicalorg", label: "humanbiomedical.org" },
    { id: "humanbiomedicalsin", label: "humanbiomedicals.in" },
    { id: "humanbiomedicalsorg", label: "humanbiomedicals.org" },
    { id: "humanbiomedicalscoin", label: "humanbiomedicals.co.in" },
    { id: "humanbiomedicalsnet", label: "humanbiomedicals.net" }
  ],
  "Global Biomedical": [
    { id: "globalbiomedicalorg", label: "globalbiomedical.org" },
    { id: "globalbiomedicalin", label: "globalbiomedical.in" },
    { id: "globalbiomedicalcoin", label: "globalbiomedical.co.in" },
    { id: "globalbiomedicalsin", label: "globalbiomedicals.in" },
    { id: "globalbiomedicalsnet", label: "globalbiomedicals.net" },
    { id: "globalhealthkartcom", label: "globalhealthkart.com" }
  ],
  "RajBiosis": [
    { id: "rajbiosislimited", label: "rajbiosislimited" },
    { id: "humarilabin", label: "humarilab.in" },
    { id: "humarilabcom", label: "humarilab.com" },
    { id: "rajbiosisinfo", label: "rajbiosis.info" },
    { id: "rajbiosiscoin", label: "rajbiosis.co.in" },
    { id: "rajbiosisltd", label: "rajbiosis.ltd" },
    { id: "ozonexco", label: "ozonex.co" },
    { id: "aozellocom", label: "aozello.com" },
    { id: "aozallocom", label: "aozallo.com" },
    { id: "ozallecom", label: "ozalle.com" },
    { id: "ozallocom", label: "ozallo.com" },
    { id: "ozellein", label: "ozelle.in" },
    { id: "anylabtestin", label: "anylabtest.in" },
    { id: "radioimmunoassayin", label: "radioimmunoassay.in" },
    { id: "bloodmixerin", label: "bloodmixer.in" },
    { id: "glucostripscom", label: "glucostrips.com" },
    { id: "glucometersin", label: "glucometers.in" },
    { id: "safekitin", label: "safekit.in" },
    { id: "haemoglobinstripcom", label: "haemoglobinstrip.com" },
    { id: "haemoglobinstripscom", label: "haemoglobinstrips.com" },
    { id: "haemoglobinmetercom", label: "haemoglobinmeter.com" },
    { id: "hemoglobinstripcom", label: "hemoglobinstrip.com" },
    { id: "hemoglobinstripin", label: "hemoglobinstrip.in" },
    { id: "hemoglobinstripscom", label: "hemoglobinstrips.com" },
    { id: "hemoglobinmetercom", label: "hemoglobinmeter.com" },
    { id: "hemoglobinmeterin", label: "hemoglobinmeter.in" },
    { id: "cliakitscom", label: "cliakits.com" },
    { id: "clinicalchemistryin", label: "clinicalchemistry.in" },
    { id: "medicalsjobportalcom", label: "medicalsjobportal.com" },
    { id: "centralbiomedicals", label: "centralbiomedicals.com" },
    { id: "tublerin", label: "tubler.in" },
    { id: "indiandiagnostic", label: "indiandiagnostic.com" }
  ],
  "Qlyte": [
    { id: "qlyte", label: "qlyte.com" },
    { id: "qlytein", label: "qlyte.in" },
    { id: "qlyserin", label: "qlyser.in" }
  ]
};

export default function Page() {
  const [selectedGroup, setSelectedGroup] = useState("RajBiosis");
  const [selectedWebsite, setSelectedWebsite] = useState("rajbiosislimited");

  const [jsonData, setJsonData] = useState([]);
  const [dbDistricts, setDbDistricts] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  // Load existing districts from Firestore on website change
  useEffect(() => {
    fetchDistricts(selectedWebsite);
    // Clear any JSON preview state when website changes to prevent cross-website upload issues
    setJsonData([]);
    setFileName("");
    localStorage.removeItem("districtJson");
  }, [selectedWebsite]);

  // Load local storage JSON cache if present
  useEffect(() => {
    const saved = localStorage.getItem("districtJson");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setJsonData(parsed.data || []);
        setFileName(parsed.fileName || "");
      } catch (err) {
        console.error("Failed to parse cached JSON:", err);
      }
    }
  }, []);

  // Fetch districts from database
  const fetchDistricts = async (websiteId) => {
    setFetchLoading(true);
    try {
      const querySnapshot = await getDocs(
        collection(db, "websites", websiteId, "districts")
      );
      const districtsList = [];
      querySnapshot.forEach((doc) => {
        districtsList.push(doc.data());
      });
      // Sort alphabetically by district name
      districtsList.sort((a, b) => (a.district || "").localeCompare(b.district || ""));
      setDbDistricts(districtsList);
    } catch (error) {
      console.error("Error fetching districts:", error);
      toast.error("Failed to load existing districts");
    } finally {
      setFetchLoading(false);
    }
  };

  // JSON File Upload / Preview
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const text = await file.text();

    try {
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        toast.error("JSON Array Required");
        return;
      }

      setJsonData(parsed);

      localStorage.setItem(
        "districtJson",
        JSON.stringify({
          data: parsed,
          fileName: file.name,
        })
      );
      toast.success(`${parsed.length} districts loaded in preview`);
    } catch (err) {
      console.error(err);
      toast.error("Invalid JSON File");
    }
  };

  // Firebase Chunked Batch Upload
  const uploadToFirebase = async () => {
    if (jsonData.length === 0) return;
    const toastId = toast.loading("Uploading districts in batches...");

    try {
      setLoading(true);

      // Chunk the array into sizes of 400 documents to stay well below Firestore's 500 limit
      const chunkSize = 400;
      const chunks = [];
      for (let i = 0; i < jsonData.length; i += chunkSize) {
        chunks.push(jsonData.slice(i, i + chunkSize));
      }

      for (let c = 0; c < chunks.length; c++) {
        const batch = writeBatch(db);
        const currentChunk = chunks[c];

        currentChunk.forEach((item) => {
          if (!item.slug) return;
          const ref = doc(
            db,
            "websites",
            selectedWebsite,
            "districts",
            item.slug
          );

          batch.set(ref, {
            district: item.district || "",
            slug: item.slug || "",
            state: item.state || "",
            createdAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      toast.success("All data uploaded successfully!", { id: toastId });
      
      // Reset preview state
      setJsonData([]);
      setFileName("");
      localStorage.removeItem("districtJson");

      // Reload database list
      fetchDistricts(selectedWebsite);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Please try again.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Delete single district from Firestore
  const handleDeleteDistrict = async (slug, districtName) => {
    if (!window.confirm(`Are you sure you want to delete ${districtName}?`)) return;

    const toastId = toast.loading(`Deleting ${districtName}...`);
    try {
      await deleteDoc(
        doc(db, "websites", selectedWebsite, "districts", slug)
      );
      toast.success(`${districtName} deleted successfully`, { id: toastId });
      fetchDistricts(selectedWebsite);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete district", { id: toastId });
    }
  };

  // Remove single district from preview state
  const handleRemovePreviewItem = (index) => {
    const updated = jsonData.filter((_, i) => i !== index);
    setJsonData(updated);
    if (updated.length === 0) {
      setFileName("");
      localStorage.removeItem("districtJson");
      toast.success("Preview cleared");
    } else {
      localStorage.setItem(
        "districtJson",
        JSON.stringify({
          data: updated,
          fileName,
        })
      );
    }
  };

  const handleGroupChange = (e) => {
    const group = e.target.value;
    setSelectedGroup(group);
    // Automatically select the first website of the new group
    if (WEBSITE_GROUPS[group] && WEBSITE_GROUPS[group].length > 0) {
      setSelectedWebsite(WEBSITE_GROUPS[group][0].id);
    }
  };

  const { pathname } = useLocation();
  const pathParts = pathname.split("/").filter(Boolean);

  const isPreviewMode = jsonData.length > 0;
  const currentList = isPreviewMode ? jsonData : dbDistricts;

  return (
    <div className="district-page">
      {/* TOP HEADER */}
      <div className="district-top-header">
        <div className="district-page-path">
          {pathParts.map((part, index) => (
            <span key={index}>
              {part.charAt(0).toUpperCase() + part.slice(1)}
              {index !== pathParts.length - 1 && " > "}
            </span>
          ))}
        </div>
        <h1 className="district-heading">District Page Admin</h1>
      </div>

      <div className="district-container">
        {/* SELECT WEBSITE SECTION */}
        <div className="district-website-selector-card">
          <h2>Select Website</h2>
          <div className="district-dropdowns-row">
            <div className="district-select-wrapper">
              <label>Website Group</label>
              <select value={selectedGroup} onChange={handleGroupChange}>
                {Object.keys(WEBSITE_GROUPS).map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>

            <div className="district-select-wrapper">
              <label>Target Slug</label>
              <select
                value={selectedWebsite}
                onChange={(e) => setSelectedWebsite(e.target.value)}
              >
                {(WEBSITE_GROUPS[selectedGroup] || []).map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* UPLOAD FORM */}
        <div className="district-header">
          <div>
            <h1>District JSON Upload</h1>
            <p>Upload JSON file and push district data to Firebase</p>
          </div>

          <div className="district-buttons">
            <label className="district-choose-btn">
              Choose JSON File
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                hidden
              />
            </label>

            <button
              className="district-upload-btn"
              onClick={uploadToFirebase}
              disabled={loading || jsonData.length === 0}
            >
              {loading ? "Uploading..." : "Upload Firebase"}
            </button>
          </div>
        </div>

        {/* FILE INFO BOX */}
        {fileName && (
          <div className="district-file-box">
            <span>📁 Active JSON File:</span> {fileName}
          </div>
        )}

        {/* STATS INFO GRID */}
        <div className="district-stats-grid">
          <div className="district-card">
            <span>Target Website</span>
            <h2 className="district-highlight-text">{selectedWebsite}</h2>
          </div>

          <div className="district-card">
            <span>Collection</span>
            <h2>districts</h2>
          </div>

          <div className="district-card">
            <span>Status</span>
            <h2 className={isPreviewMode ? "district-yellow" : "district-green"}>
              {loading
                ? "Uploading..."
                : isPreviewMode
                ? "Ready to Upload"
                : "Ready"}
            </h2>
          </div>
        </div>

        {/* TABLE SECTION */}
        <div className="district-table-header-row">
          <h2 className="district-table-title">{selectedWebsite}</h2>
          <span className="district-count-badge">
            {currentList.length} {isPreviewMode ? "Districts (Preview)" : "Districts"}
          </span>
        </div>

        <div className="district-table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: "80px" }}>#</th>
                <th>District</th>
                <th>Slug</th>
                <th>State</th>
                <th style={{ width: "120px", textAlign: "center" }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {fetchLoading ? (
                <tr>
                  <td colSpan="5">
                    <div className="district-loading-state">
                      <div className="district-spinner"></div>
                      <p>Loading districts from database...</p>
                    </div>
                  </td>
                </tr>
              ) : currentList.length > 0 ? (
                currentList.map((item, index) => (
                  <tr key={item.slug || index}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{item.district}</strong>
                    </td>
                    <td>
                      <span className="district-slug">{item.slug}</span>
                    </td>
                    <td>{item.state}</td>
                    <td style={{ textAlign: "center" }}>
                      {isPreviewMode ? (
                        <button
                          className="district-remove-btn"
                          onClick={() => handleRemovePreviewItem(index)}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          className="district-delete-btn"
                          onClick={() =>
                            handleDeleteDistrict(item.slug, item.district)
                          }
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">
                    <div className="district-empty">
                      <div className="district-icon">📂</div>
                      <p>
                        {isPreviewMode
                          ? "No districts found in JSON preview"
                          : "No districts saved in database yet"}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}