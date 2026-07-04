import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const initialEmployee = {
  name: "",
  mobile: "",
  emergencyMobile: "",
  email: "",
  dob: "",
  bloodGroup: "",
  department: "",
  designation: "",
  company: "", // ✅ NEW
  currentAddress: {
    address: "",
    city: "",
    state: "",
    pincode: "",
  },

  permanentAddress: {
    address: "",
    city: "",
    state: "",
    pincode: "",
  },

  sameAsCurrent: false,
};

export default function EmployeeAdd() {
  const auth = getAuth();
  const [employee, setEmployee] = useState(initialEmployee);
  const [isEditable, setIsEditable] = useState(true);
  const [isExisting, setIsExisting] = useState(false);
  const [uid, setUid] = useState(null);

  const handleChange = (field, value) => {
    setEmployee((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (type, field, value) => {
    setEmployee((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      },
    }));
  };

  const handleSameAddress = (checked) => {
    setEmployee((prev) => ({
      ...prev,
      sameAsCurrent: checked,
      permanentAddress: checked
        ? { ...prev.currentAddress } // ✅ copy current
        : {
            address: "",
            city: "",
            state: "",
            pincode: "",
          }, // ✅ clear when unchecked
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isEditable) {
      setIsEditable(true); // Edit mode
      return;
    }

    const ref = doc(db, "employees", uid);

    if (isExisting) {
      // UPDATE
      await updateDoc(ref, {
        ...employee,
        updatedAt: serverTimestamp(),
      });
    } else {
      // FIRST SAVE
      await setDoc(ref, {
        ...employee,
        createdAt: serverTimestamp(),
      });
      setIsExisting(true);
    }

    setIsEditable(false); // lock again
    alert("Details saved successfully ✅");
  };
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (employee.sameAsCurrent) {
      setEmployee((prev) => ({
        ...prev,
        permanentAddress: { ...prev.currentAddress },
      }));
    }
  }, [employee.currentAddress, employee.sameAsCurrent]);

  useEffect(() => {
    if (!uid) return;

    const fetchEmployee = async () => {
      try {
        const ref = doc(db, "employees", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setEmployee(snap.data());
          setIsExisting(true);
          setIsEditable(false); // view mode
        } else {
          setIsEditable(true); // first time fill
        }
      } catch (error) {
        console.error("Fetch employee failed:", error);
      }
    };

    fetchEmployee();
  }, [uid]);

  return (
    <div className="w-full bg-white p-8 rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-6">Add Employee</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* BASIC DETAILS */}
        <div>
          <h3 className="font-semibold mb-4">Basic Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Employee Name</label>
              <input
                className="input"
                value={employee.name}
                disabled={!isEditable}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Emergency Mobile Number</label>
              <input
                className="input"
                value={employee.mobile}
                disabled={!isEditable}
                onChange={(e) => handleChange("mobile", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Personal Mobile Number</label>
              <input
                className="input"
                value={employee.emergencyMobile}
                disabled={!isEditable}
                onChange={(e) =>
                  handleChange("emergencyMobile", e.target.value)
                }
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                className="input"
                value={employee.email}
                disabled={!isEditable}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>
            {/*  */}
            <div>
              <label className="label">Date of Birth</label>
              <input
                className="input"
                type="date"
                value={employee.dob}
                disabled={!isEditable}
                onChange={(e) => handleChange("dob", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Blood Group</label>
              <input
                className="input"
                value={employee.bloodGroup}
                disabled={!isEditable}
                onChange={(e) => handleChange("bloodGroup", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Department</label>
              <input
                className="input"
                value={employee.department}
                disabled={!isEditable}
                onChange={(e) => handleChange("department", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Designation</label>
              <input
                className="input"
                value={employee.designation}
                disabled={!isEditable}
                onChange={(e) => handleChange("designation", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Company</label>
              <select
                className="input"
                value={employee.company}
                disabled={!isEditable}
                onChange={(e) => handleChange("company", e.target.value)}
              >
                <option value="">Select Company</option>
                <option value="Raj Biosis">Raj Biosis</option>
                <option value="Human">Human</option>
                <option value="Global">Global</option>
              </select>
            </div>
          </div>
        </div>

        {/* CURRENT ADDRESS */}
        <div>
          <h3 className="font-semibold mb-4">Current Address</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Address</label>
              <input
                className="input"
                value={employee.currentAddress.address}
                disabled={!isEditable}
                onChange={(e) =>
                  handleAddressChange(
                    "currentAddress",
                    "address",
                    e.target.value,
                  )
                }
              />
            </div>

            <div>
              <label className="label">City</label>
              <input
                className="input"
                value={employee.currentAddress.city}
                disabled={!isEditable}
                onChange={(e) =>
                  handleAddressChange("currentAddress", "city", e.target.value)
                }
              />
            </div>

            <div>
              <label className="label">State</label>
              <input
                className="input"
                value={employee.currentAddress.state}
                disabled={!isEditable}
                onChange={(e) =>
                  handleAddressChange("currentAddress", "state", e.target.value)
                }
              />
            </div>

            <div>
              <label className="label">Pincode</label>
              <input
                className="input"
                value={employee.currentAddress.pincode}
                disabled={!isEditable}
                onChange={(e) =>
                  handleAddressChange(
                    "currentAddress",
                    "pincode",
                    e.target.value,
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* SAME AS */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={employee.sameAsCurrent}
            disabled={!isEditable}
            onChange={(e) => handleSameAddress(e.target.checked)}
          />
          <label className="text-sm text-gray-700">
            Permanent address same as current
          </label>
        </div>

        {/* PERMANENT ADDRESS */}
        <div>
          <h3 className="font-semibold mb-4">Permanent Address</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Address</label>
              <input
                className="input"
                value={employee.permanentAddress.address}
                disabled={!isEditable || employee.sameAsCurrent}
                onChange={(e) =>
                  handleAddressChange(
                    "permanentAddress",
                    "address",
                    e.target.value,
                  )
                }
              />
            </div>

            <div>
              <label className="label">City</label>
              <input
                className="input"
                value={employee.permanentAddress.city}
                disabled={!isEditable || employee.sameAsCurrent}
                onChange={(e) =>
                  handleAddressChange(
                    "permanentAddress",
                    "city",
                    e.target.value,
                  )
                }
              />
            </div>

            <div>
              <label className="label">State</label>
              <input
                className="input"
                value={employee.permanentAddress.state}
                disabled={!isEditable || employee.sameAsCurrent}
                onChange={(e) =>
                  handleAddressChange(
                    "permanentAddress",
                    "state",
                    e.target.value,
                  )
                }
              />
            </div>

            <div>
              <label className="label">Pincode</label>
              <input
                className="input"
                value={employee.permanentAddress.pincode}
                disabled={!isEditable || employee.sameAsCurrent}
                onChange={(e) =>
                  handleAddressChange(
                    "permanentAddress",
                    "pincode",
                    e.target.value,
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* SUBMIT */}
        <div className="pt-4">
          <button
            type="submit"
            className={`text-center w-full py-3 rounded-lg font-medium transition
        ${
          isEditable
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-600 hover:bg-gray-700 text-white"
        }`}
          >
            {isEditable ? "Save Details" : "Edit"}
          </button>
        </div>
      </form>

      <style>{`
.input:disabled {
  background-color: #f9fafb;
  cursor: not-allowed;
}
        `}</style>
    </div>
  );
}
