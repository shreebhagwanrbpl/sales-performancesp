import { useEffect, useMemo, useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import { getAuth, onAuthStateChanged } from "firebase/auth";

/* ===== Helpers ===== */
const getMonthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const clampNum = (v, min, max) => {
  const num = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(num)) return 0;
  return Math.max(min, Math.min(max, num));
};

export default function SelfAssessment() {
  const auth = getAuth();

  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [monthKey, setMonthKey] = useState(getMonthKey());

  const [status, setStatus] = useState("DRAFT");

  const [form, setForm] = useState({
    punctuality: "", // YES/NO
    attendancePercent: "",
    salesAchievement: "",
    behavior: "",
    teamwork: "",
    taskCompletion: "",
    customerFeedback: "",
    customerReviews: "",
    repeatOrders: "",
    strengths: "",
    improvements: "",
  });

  const docId = useMemo(() => {
    if (!uid) return null;
    return `${uid}_${monthKey}`;
  }, [uid, monthKey]);

  /* ===== Auth + Fetch Existing ===== */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setLoading(false);
        return;
      }
      setUid(user.uid);
      setLoading(false);
    });

    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!uid || !docId) return;

    const fetchExisting = async () => {
      setLoading(true);
      try {
        const ref = doc(db, "selfAssessments", docId);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          setStatus(data?.status || "DRAFT");
          setForm((prev) => ({
            ...prev,
            ...(data?.form || {}),
          }));
        } else {
          setStatus("DRAFT");
          setForm({
            punctuality: "",
            attendancePercent: "",
            salesAchievement: "",
            behavior: "",
            teamwork: "",
            taskCompletion: "",
            customerFeedback: "",
            customerReviews: "",
            repeatOrders: "",
            strengths: "",
            improvements: "",
          });
        }
      } catch (err) {
        console.error("Fetch self assessment error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchExisting();
  }, [uid, docId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  /* ===== Graph Data (internal normalize, employee ko rules NAHI dikhte) ===== */
  const chartData = useMemo(() => {
    // bas overview ke liye normalized values:
    const punctualityScore =
      form.punctuality === "YES" ? 100 : form.punctuality === "NO" ? 30 : 0;

    return [
      { skill: "Punctuality", value: punctualityScore },
      { skill: "Attendance", value: clampNum(form.attendancePercent, 0, 100) },
      { skill: "Targets", value: clampNum(form.salesAchievement, 0, 200) / 2 }, // 0-100
      { skill: "Teamwork", value: clampNum(form.teamwork, 0, 10) * 10 },
      { skill: "Tasks", value: clampNum(form.taskCompletion, 0, 10) * 10 },
      { skill: "Repeat", value: clampNum(form.repeatOrders, 0, 10) * 10 },
    ];
  }, [form]);

  /* ===== Save Draft ===== */
  const saveDraft = async () => {
    if (!uid || !docId) return;

    setSaving(true);
    try {
      const ref = doc(db, "selfAssessments", docId);
      const snap = await getDoc(ref);

      const user = auth.currentUser;
      const employeeName = user?.displayName || "";
      const employeeEmail = user?.email || "";

      if (!snap.exists()) {
        // FIRST TIME → CREATE
        await setDoc(ref, {
          uid,
          employeeName, // ✅ ADD
          employeeEmail, // ✅ ADD
          monthKey,
          status: "DRAFT",
          form,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // UPDATE DRAFT
        await setDoc(
          ref,
          {
            employeeName, // ✅ ADD (important)
            employeeEmail, // ✅ ADD
            status: "DRAFT",
            form,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      setStatus("DRAFT");
      alert("Draft saved ✅");
    } catch (err) {
      console.error("Save draft error:", err);
      alert("Draft save failed ❌");
    } finally {
      setSaving(false);
    }
  };

  /* ===== Submit ===== */
  const submitFinal = async () => {
    if (!uid || !docId) return;

    setSaving(true);
    try {
      const ref = doc(db, "selfAssessments", docId);

      const user = auth.currentUser;
      const employeeName = user?.displayName || "";
      const employeeEmail = user?.email || "";

      await setDoc(
        ref,
        {
          uid, // 🔥 ENSURE
          monthKey, // 🔥 ENSURE
          employeeName, // 🔥 TL ko naam dikhane ke liye
          employeeEmail, // optional but useful
          status: "SUBMITTED",
          form, // 🔥 same form object (no change)
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setStatus("SUBMITTED");
      alert("Assessment submitted successfully ✅");
    } catch (err) {
      console.error("Submit error:", err);
      alert("Submit failed ❌");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!uid) {
    return <div className="p-6">Please login to fill self assessment.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold">Sales Self Assessment</h1>

        <div className="flex items-center gap-3">
          <select
            className="input max-w-[180px]"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            disabled={saving}
          >
            {/* last 12 months */}
            {Array.from({ length: 12 }).map((_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              const key = getMonthKey(d);
              return (
                <option key={key} value={key}>
                  {key}
                </option>
              );
            })}
          </select>

          <span
            className={`text-xs px-3 py-1 rounded-full border ${
              status === "SUBMITTED"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-gray-200 bg-gray-50 text-gray-700"
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORM */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-6 space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CheckCircleIcon className="h-6 w-6 text-green-600" />
            Performance Evaluation
          </h2>

          <div>
            <label className="block font-medium mb-1">
              1. Time Punctuality
            </label>
            <select
              name="punctuality"
              value={form.punctuality}
              onChange={handleChange}
              className="input"
              disabled={saving}
            >
              <option value="">Select</option>
              <option value="YES">Yes</option>
              <option value="NO">No</option>
            </select>
          </div>

          <div>
            <label className="block font-medium mb-1">
              2. Daily Attendance (% of Working Days Attended)
            </label>
            <input
              type="number"
              name="attendancePercent"
              value={form.attendancePercent}
              onChange={handleChange}
              className="input"
              placeholder="e.g. 96"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              3. Sales Targets Achievement (%)
            </label>
            <input
              type="number"
              name="salesAchievement"
              value={form.salesAchievement}
              onChange={handleChange}
              className="input"
              placeholder="e.g. 120"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              4. Behavior (Specify incidents if any)
            </label>
            <textarea
              name="behavior"
              rows="3"
              className="textarea"
              value={form.behavior}
              onChange={handleChange}
              placeholder="Write details or 'No incidents'"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              5. Contribution to Team / Teamwork (0–10)
            </label>
            <input
              type="number"
              min="0"
              max="10"
              name="teamwork"
              value={form.teamwork}
              onChange={handleChange}
              className="input"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              6. Task Completion / Responsiveness (0–10)
            </label>
            <input
              type="number"
              min="0"
              max="10"
              name="taskCompletion"
              value={form.taskCompletion}
              onChange={handleChange}
              className="input"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              7. Customer Feedback
            </label>
            <textarea
              name="customerFeedback"
              rows="3"
              className="textarea"
              value={form.customerFeedback}
              onChange={handleChange}
              placeholder="Complaints, follow-up quality, info sharing, etc."
              disabled={saving}
            />
          </div>

          <div>
            <label className="block font-medium mb-1">8. Customer Review</label>
            <textarea
              name="customerReviews"
              rows="2"
              className="textarea"
              value={form.customerReviews}
              onChange={handleChange}
              placeholder="Positive & negative reviews summary"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              9. Repeat Orders (Count) (≥ ₹25,000)
            </label>
            <input
              type="number"
              name="repeatOrders"
              value={form.repeatOrders}
              onChange={handleChange}
              className="input"
              placeholder="e.g. 3"
              disabled={saving}
            />
          </div>

          <div>
            <label className="font-medium">Key Strengths</label>
            <textarea
              name="strengths"
              rows="3"
              className="textarea"
              value={form.strengths}
              onChange={handleChange}
              disabled={saving}
            />
          </div>

          <div>
            <label className="font-medium">Improvement Plan</label>
            <textarea
              name="improvements"
              rows="3"
              className="textarea"
              value={form.improvements}
              onChange={handleChange}
              disabled={saving}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving}
              className="px-4 py-2 rounded-lg border bg-gray-50 hover:bg-gray-100"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>

            <button
              type="button"
              onClick={submitFinal}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              {saving ? "Submitting..." : "Submit Final"}
            </button>
          </div>
        </div>

        {/* GRAPH */}
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>

          <div className="mt-6 flex justify-center">
            <RadarChart width={260} height={260} data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="skill" />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar
                dataKey="value"
                stroke="#2563eb"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
            </RadarChart>
          </div>

          <p className="mt-3 text-sm text-gray-500">
            Overview is indicative and subject to manager review.
          </p>
        </div>
      </div>
    </div>
  );
}
