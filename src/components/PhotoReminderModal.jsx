import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  CameraIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export default function PhotoReminderModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const [showModal, setShowModal] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // If user is currently on the profile edit page (/employee-detail), don't show popup
    if (location.pathname === "/employee-detail") {
      setShowModal(false);
      return;
    }

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setShowModal(false);
        setChecking(false);
        return;
      }

      // Check local storage first for quick response
      const localPhoto = localStorage.getItem("photoUrl");
      if (localPhoto) {
        setShowModal(false);
        setChecking(false);
        return;
      }

      // Query Firestore employees collection to double check
      try {
        const empSnap = await getDoc(doc(db, "employees", user.uid));
        if (empSnap.exists()) {
          const data = empSnap.data();
          if (data.photoUrl) {
            localStorage.setItem("photoUrl", data.photoUrl);
            setShowModal(false);
          } else {
            setShowModal(true);
          }
        } else {
          setShowModal(true);
        }
      } catch (err) {
        console.error("Photo reminder check failed:", err);
      } finally {
        setChecking(false);
      }
    });

    return () => unsubAuth();
  }, [location.pathname]);

  if (checking || !showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center relative border border-amber-200 animate-scaleUp">
        {/* Dismiss Button */}
        <button
          onClick={() => setShowModal(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center transition-all"
          title="Dismiss for now"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>

        {/* Camera Icon Badge */}
        <div className="relative mx-auto w-20 h-20 mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 p-1 shadow-lg mx-auto flex items-center justify-center animate-pulse">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-amber-600 shadow-inner">
              <CameraIcon className="w-10 h-10" />
            </div>
          </div>
          <span className="absolute bottom-0 right-0 bg-red-500 text-white p-1 rounded-full shadow-md border-2 border-white">
            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Modal Text */}
        <h3 className="text-lg font-black text-slate-900 leading-snug">
          Upload Your Profile Photo 📷
        </h3>

        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2">
          Your profile picture is missing! Please upload a photo to display your identity across EOTM rankings, leaderboards, and dashboard.
        </p>

        {/* Action Buttons */}
        <div className="mt-6 space-y-2">
          <button
            onClick={() => {
              setShowModal(false);
              navigate("/employee-detail");
            }}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white font-extrabold text-xs shadow-md hover:brightness-105 transition-all flex items-center justify-center gap-2"
          >
            <span>Upload Photo Now</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowModal(false)}
            className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors"
          >
            Remind Me Later
          </button>
        </div>
      </div>
    </div>
  );
}
