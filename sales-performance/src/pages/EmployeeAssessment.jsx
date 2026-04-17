import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  CheckCircleIcon,
  UserCircleIcon,
  ClipboardDocumentCheckIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

/* ---------------- Helpers ---------------- */
const getMonthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const n = (v) => {
  const num = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isNaN(num) ? 0 : num;
};

/* ---------------- Scoring Options (Rules) ---------------- */
const SCORE_OPTIONS = {
  punctuality: [
    { label: "100% Punctuality", points: 5 },
    { label: "95% to <100% Punctuality", points: 0 },
    { label: "<95% Punctuality", points: -5 },
  ],
  attendance: [
    { label: "100% Attendance", points: 5 },
    { label: "95% to <100% Attendance", points: 2 },
    { label: "<90% Attendance", points: 0 },
    { label: "<85% Attendance (Half-day half points)", points: -10 },
  ],
  sales: [
    { label: "100% to 149%", points: 10 },
    { label: ">150%", points: 10 },
    { label: "80% to 99%", points: 3 },
    { label: "50% to 79%", points: 1 },
    { label: "40% to 49%", points: 0 },
    { label: "25% to 39%", points: -5 },
    { label: "<25%", points: -10 },
    { label: "<10%", points: -20 },
  ],
  behavior: [
    { label: "No Controversial Behavior", points: 5 },
    { label: "Single Controversial Behavior", points: -2 },
    { label: "Frequent Controversial Behavior", points: -10 },
  ],
  customerFeedback: [
    { label: "Excellent Customer Feedback", points: 10 },
    { label: "Not Excellent / Needs Improvement", points: 0 },
  ],
};

const MAX_POSITIVE = 65; // 5 + 5 + 10 + 5 + 10 + 10 + 10 + 10 + 10 = 75? (but 7 fixed 10, 8 max +10, 9 max +10)
// We'll compute max dynamically below to be safe.

/* ---------------- Component ---------------- */
export default function EmployeeAssessmentReview() {
  const auth = getAuth();

  const [uid, setUid] = useState(null);
  const [role, setRole] = useState(""); // "TL" | "ADMIN" | "EMPLOYEE"
  const [loading, setLoading] = useState(true);

  const [monthKey, setMonthKey] = useState(getMonthKey());
  const [listLoading, setListLoading] = useState(false);

  const [submittedList, setSubmittedList] = useState([]); // {id, uid, status, employeeName?}
  const [selectedId, setSelectedId] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docLoading, setDocLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  // TL review state (scores + remarks per question)
  const [tlReview, setTlReview] = useState({
    punctualityPoints: "",
    attendancePoints: "",
    salesPoints: "",
    behaviorPoints: "",
    teamworkPoints: "",
    taskCompletionPoints: "",
    customerFeedbackPoints: "",
    tlRemarks: {
      punctuality: "",
      attendance: "",
      sales: "",
      behavior: "",
      teamwork: "",
      taskCompletion: "",
      customerFeedback: "",
      customerReviews: "",
      repeatOrders: "",
      overall: "",
    },
  });

  // Admin remark + approval
  const [adminRemark, setAdminRemark] = useState("");
  const [adminDecision, setAdminDecision] = useState("APPROVE"); // APPROVE / HOLD

  /* -------- Auth + Role from /users/{uid} -------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setRole("");
        setLoading(false);
        return;
      }
      setUid(user.uid);

      try {
        const uref = doc(db, "users", user.uid);
        const usnap = await getDoc(uref);
        const r = usnap.exists() ? usnap.data()?.role : "";
        setRole(r || "");
      } catch (e) {
        console.error("Role fetch error:", e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [auth]);

  /* -------- Load list of assessments for month -------- */
  useEffect(() => {
    if (!uid || !role) return;

    const loadList = async () => {
      setListLoading(true);
      setSubmittedList([]);
      setSelectedId("");
      setSelectedDoc(null);

      try {
        /* =======================
       1️⃣ FETCH USERS MAP
    ======================= */
        const userMap = {};
        const usersSnap = await getDocs(collection(db, "users"));
        usersSnap.forEach((u) => {
          userMap[u.id] = u.data();
        });

        /* =======================
       2️⃣ QUERY ASSESSMENTS
    ======================= */
        const qRef = query(
          collection(db, "selfAssessments"),
          where("monthKey", "==", monthKey),
          where("status", "in", ["SUBMITTED", "TL_REVIEWED", "APPROVED"]),
          orderBy("updatedAt", "desc")
        );

        const snap = await getDocs(qRef);

        /* =======================
       3️⃣ MERGE NAME + DATA
    ======================= */
        const items = snap.docs.map((d) => {
          const data = d.data() || {};
          const user = userMap[data.uid] || {};

          return {
            id: d.id,
            uid: data.uid,
            monthKey: data.monthKey,
            status: data.status,
            updatedAt: data.updatedAt,

            // 🔥 NAME FOR DROPDOWN
            employeeName:
              data.employeeName ||
              user.name ||
              user.displayName ||
              "Unknown Employee",

            employeeEmail: data.employeeEmail || user.email || "",

            form: data.form || {},
          };
        });

        setSubmittedList(items);
      } catch (e) {
        console.error("Load submitted list error:", e);
      } finally {
        setListLoading(false);
      }
    };

    loadList();
  }, [uid, role, monthKey]);

  /* -------- Load selected assessment -------- */
  useEffect(() => {
    if (!selectedId) return;

    const loadDoc = async () => {
      setDocLoading(true);
      try {
        const ref = doc(db, "selfAssessments", selectedId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setSelectedDoc(null);
          return;
        }

        const data = snap.data();
        setSelectedDoc({ id: selectedId, ...data });

        // preload TL review if present
        const existingTL = data?.tlReview || {};
        setTlReview((prev) => ({
          punctualityPoints:
            existingTL?.scores?.punctualityPoints ??
            prev.punctualityPoints ??
            "",
          attendancePoints:
            existingTL?.scores?.attendancePoints ?? prev.attendancePoints ?? "",
          salesPoints:
            existingTL?.scores?.salesPoints ?? prev.salesPoints ?? "",
          behaviorPoints:
            existingTL?.scores?.behaviorPoints ?? prev.behaviorPoints ?? "",
          teamworkPoints:
            existingTL?.scores?.teamworkPoints ?? prev.teamworkPoints ?? "",
          taskCompletionPoints:
            existingTL?.scores?.taskCompletionPoints ??
            prev.taskCompletionPoints ??
            "",
          customerFeedbackPoints:
            existingTL?.scores?.customerFeedbackPoints ??
            prev.customerFeedbackPoints ??
            "",
          tlRemarks: {
            ...prev.tlRemarks,
            ...(existingTL?.remarks || {}),
          },
        }));

        // preload admin remark if present
        const existingAdmin = data?.adminReview || {};
        setAdminRemark(existingAdmin?.remark || "");
      } catch (e) {
        console.error("Load assessment doc error:", e);
        setSelectedDoc(null);
      } finally {
        setDocLoading(false);
      }
    };

    loadDoc();
  }, [selectedId]);

  /* -------- Derived: employee form values -------- */
  const empForm = selectedDoc?.form || {};

  /* -------- Derived: auto-points from counts (reviews + repeat) -------- */
  const autoReviewPoints = useMemo(() => {
    const pos = clamp(n(empForm?.positiveReviews), 0, 10);
    const neg = n(empForm?.negativeReviews);
    const points = pos * 1 + neg * -2;
    return points;
  }, [empForm?.positiveReviews, empForm?.negativeReviews]);

  const autoRepeatPoints = useMemo(() => {
    const rep = clamp(n(empForm?.repeatOrders), 0, 10);
    return rep * 1;
  }, [empForm?.repeatOrders]);

  /* -------- Max possible points (based on your rules) -------- */
  const maxPossible = useMemo(() => {
    // fixed maxima:
    const punctualityMax = 5;
    const attendanceMax = 5;
    const salesMax = 10;
    const behaviorMax = 5;
    const teamworkMax = 10;
    const taskMax = 10;
    const feedbackMax = 10;
    const reviewsMax = 10; // up to 10 positives/month
    const repeatMax = 10; // up to 10/month
    return (
      punctualityMax +
      attendanceMax +
      salesMax +
      behaviorMax +
      teamworkMax +
      taskMax +
      feedbackMax +
      reviewsMax +
      repeatMax
    );
  }, []);

  /* -------- Total points from TL selections + auto parts -------- */
  const totalPoints = useMemo(() => {
    const tl = tlReview;
    const sumTL =
      n(tl.punctualityPoints) +
      n(tl.attendancePoints) +
      n(tl.salesPoints) +
      n(tl.behaviorPoints) +
      clamp(n(tl.teamworkPoints), 0, 10) +
      clamp(n(tl.taskCompletionPoints), 0, 10) +
      n(tl.customerFeedbackPoints);

    const total = sumTL + autoReviewPoints + autoRepeatPoints;
    return total;
  }, [tlReview, autoReviewPoints, autoRepeatPoints]);

  const percentage = useMemo(() => {
    const pct = (totalPoints / maxPossible) * 100;
    return clamp(pct, 0, 100);
  }, [totalPoints, maxPossible]);

  /* -------- Graph Data (Admin approval ke baad employee ko dikhana) -------- */
  const radarData = useMemo(() => {
    return [
      { skill: "Punctuality", value: n(tlReview.punctualityPoints) },
      { skill: "Attendance", value: n(tlReview.attendancePoints) },
      { skill: "Targets", value: n(tlReview.salesPoints) },
      { skill: "Behavior", value: n(tlReview.behaviorPoints) },
      { skill: "Teamwork", value: clamp(n(tlReview.teamworkPoints), 0, 10) },
      { skill: "Tasks", value: clamp(n(tlReview.taskCompletionPoints), 0, 10) },
      { skill: "Feedback", value: n(tlReview.customerFeedbackPoints) },
      { skill: "Reviews", value: autoReviewPoints },
      { skill: "Repeat", value: autoRepeatPoints },
    ];
  }, [tlReview, autoReviewPoints, autoRepeatPoints]);

  /* ---------------- Actions ---------------- */

  const onTLSubmit = async () => {
    if (!selectedDoc?.id) return;

    setSaving(true);
    try {
      const ref = doc(db, "selfAssessments", selectedDoc.id);

      await updateDoc(ref, {
        status: "TL_REVIEWED",
        tlReview: {
          reviewedBy: uid,
          reviewedAt: serverTimestamp(),
          scores: {
            punctualityPoints: n(tlReview.punctualityPoints),
            attendancePoints: n(tlReview.attendancePoints),
            salesPoints: n(tlReview.salesPoints),
            behaviorPoints: n(tlReview.behaviorPoints),
            teamworkPoints: clamp(n(tlReview.teamworkPoints), 0, 10),
            taskCompletionPoints: clamp(
              n(tlReview.taskCompletionPoints),
              0,
              10
            ),
            customerFeedbackPoints: n(tlReview.customerFeedbackPoints),
            autoCustomerReviewPoints: autoReviewPoints,
            autoRepeatOrderPoints: autoRepeatPoints,
          },
          remarks: tlReview.tlRemarks,
        },
        tlComputed: {
          totalPoints,
          maxPossible,
          percentage,
        },
        updatedAt: serverTimestamp(),
      });

      alert("TL Review Submitted ✅");
    } catch (e) {
      console.error("TL submit error:", e);
      alert("TL submit failed ❌");
    } finally {
      setSaving(false);
    }
  };

  const onAdminApprove = async () => {
    if (!selectedDoc?.id) return;

    setSaving(true);
    try {
      const ref = doc(db, "selfAssessments", selectedDoc.id);

      const nextStatus =
        adminDecision === "APPROVE" ? "APPROVED" : "TL_REVIEWED";

      await updateDoc(ref, {
        status: nextStatus,
        adminReview: {
          decision: adminDecision,
          remark: adminRemark,
          approvedBy: uid,
          approvedAt: serverTimestamp(),
        },
        // final output for employee view (only meaningful when APPROVED)
        finalResult: {
          totalPoints,
          maxPossible,
          percentage,
          radarData,
        },
        updatedAt: serverTimestamp(),
      });

      alert(adminDecision === "APPROVE" ? "Approved ✅" : "Saved (Hold) ✅");
    } catch (e) {
      console.error("Admin approval error:", e);
      alert("Admin action failed ❌");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- UI ---------------- */

  if (loading) return <div className="p-6">Loading...</div>;
  if (!uid) return <div className="p-6">Please login.</div>;
  if (!(role === "TL" || role === "ADMIN"))
    return <div className="p-6">Access denied (TL/Admin only).</div>;

  const showNoSubmitted = !listLoading && submittedList.length === 0;
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Employee Assessment Review</h1>
          <p className="text-sm text-gray-500">
            Review submitted assessments • Add remarks • Approve (Admin)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="input max-w-[180px]"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            disabled={saving}
          >
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
              role === "ADMIN"
                ? "border-purple-200 bg-purple-50 text-purple-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {role}
          </span>
        </div>
      </div>

      {/* Top Filters */}
      <div className="bg-white rounded-xl shadow p-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <UserCircleIcon className="h-6 w-6 text-gray-600" />
          <div>
            <div className="font-semibold">Select Employee (Submitted)</div>
            <div className="text-xs text-gray-500">
              Only submitted/review-ready employees are shown here.
            </div>
          </div>
        </div>

        <div className="flex-1 md:flex md:justify-end">
          <select
            className="input md:max-w-[420px]"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={listLoading || saving}
          >
            <option value="">
              {listLoading
                ? "Loading submissions..."
                : "Select employee assessment"}
            </option>

            {submittedList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.employeeName || a.employeeEmail || a.uid} • {a.status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showNoSubmitted && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <div className="font-semibold">No submissions yet</div>
          <div className="text-sm text-yellow-800">
            No employee has submitted a self-assessment for the selected month (
            {monthKey}).
          </div>
        </div>
      )}

      {/* Main */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Employee Answers + TL/Admin scoring */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-6 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
              Review Sheet
            </h2>

            <span className="text-xs px-3 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
              {selectedDoc?.status || "—"}
            </span>
          </div>

          {!selectedId ? (
            <div className="text-gray-500">
              Select an employee to view the assessment details.
            </div>
          ) : docLoading ? (
            <div className="text-gray-500">Loading assessment...</div>
          ) : !selectedDoc ? (
            <div className="text-red-600">
              No data found for this selection.
            </div>
          ) : (
            <>
              {/* Employee Answer Card */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-2">
                <div className="font-semibold flex items-center gap-2">
                  <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-700" />
                  Employee Submitted Inputs (Read-only)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">UID:</span>{" "}
                    {selectedDoc.uid}
                  </div>
                  <div>
                    <span className="text-gray-500">Month:</span>{" "}
                    {selectedDoc.monthKey}
                  </div>
                  <div>
                    <span className="text-gray-500">Punctuality:</span>{" "}
                    {empForm.punctuality || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Attendance %:</span>{" "}
                    {empForm.attendancePercent || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Sales %:</span>{" "}
                    {empForm.salesAchievement || "-"}
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-500">Behavior Incidents:</span>{" "}
                    {empForm.behavior || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Teamwork (self):</span>{" "}
                    {empForm.teamwork || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Task (self):</span>{" "}
                    {empForm.taskCompletion || "-"}
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-500">Customer Feedback:</span>{" "}
                    {empForm.customerFeedback || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Pos Reviews:</span>{" "}
                    {empForm.positiveReviews || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Neg Reviews:</span>{" "}
                    {empForm.negativeReviews || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Repeat Orders:</span>{" "}
                    {empForm.repeatOrders || "-"}
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-500">Strengths:</span>{" "}
                    {empForm.strengths || "-"}
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-500">Improvement Plan:</span>{" "}
                    {empForm.improvements || "-"}
                  </div>
                </div>
              </div>

              {/* TL Scoring Section */}
              <div className="space-y-5">
                <div className="font-semibold">TL Review & Scoring</div>

                {/* 1 */}
                <ReviewRow
                  title="1. Time Punctuality"
                  options={SCORE_OPTIONS.punctuality}
                  value={tlReview.punctualityPoints}
                  onValue={(v) =>
                    setTlReview((p) => ({ ...p, punctualityPoints: v }))
                  }
                  remarkValue={tlReview.tlRemarks.punctuality}
                  onRemark={(v) =>
                    setTlReview((p) => ({
                      ...p,
                      tlRemarks: { ...p.tlRemarks, punctuality: v },
                    }))
                  }
                  disabled={saving}
                />

                {/* 2 */}
                <ReviewRow
                  title="2. Daily Attendance"
                  options={SCORE_OPTIONS.attendance}
                  value={tlReview.attendancePoints}
                  onValue={(v) =>
                    setTlReview((p) => ({ ...p, attendancePoints: v }))
                  }
                  remarkValue={tlReview.tlRemarks.attendance}
                  onRemark={(v) =>
                    setTlReview((p) => ({
                      ...p,
                      tlRemarks: { ...p.tlRemarks, attendance: v },
                    }))
                  }
                  disabled={saving}
                />

                {/* 3 */}
                <ReviewRow
                  title="3. Sales Targets Achievement"
                  options={SCORE_OPTIONS.sales}
                  value={tlReview.salesPoints}
                  onValue={(v) =>
                    setTlReview((p) => ({ ...p, salesPoints: v }))
                  }
                  remarkValue={tlReview.tlRemarks.sales}
                  onRemark={(v) =>
                    setTlReview((p) => ({
                      ...p,
                      tlRemarks: { ...p.tlRemarks, sales: v },
                    }))
                  }
                  disabled={saving}
                />

                {/* 4 */}
                <ReviewRow
                  title="4. Behavior"
                  options={SCORE_OPTIONS.behavior}
                  value={tlReview.behaviorPoints}
                  onValue={(v) =>
                    setTlReview((p) => ({ ...p, behaviorPoints: v }))
                  }
                  remarkValue={tlReview.tlRemarks.behavior}
                  onRemark={(v) =>
                    setTlReview((p) => ({
                      ...p,
                      tlRemarks: { ...p.tlRemarks, behavior: v },
                    }))
                  }
                  disabled={saving}
                />

                {/* 5 */}
                <ManualScoreRow
                  title="5. Teamwork (0–10)"
                  value={tlReview.teamworkPoints}
                  onValue={(v) =>
                    setTlReview((p) => ({ ...p, teamworkPoints: v }))
                  }
                  remarkValue={tlReview.tlRemarks.teamwork}
                  onRemark={(v) =>
                    setTlReview((p) => ({
                      ...p,
                      tlRemarks: { ...p.tlRemarks, teamwork: v },
                    }))
                  }
                  disabled={saving}
                />

                {/* 6 */}
                <ManualScoreRow
                  title="6. Task Completion / Responsiveness (0–10)"
                  value={tlReview.taskCompletionPoints}
                  onValue={(v) =>
                    setTlReview((p) => ({ ...p, taskCompletionPoints: v }))
                  }
                  remarkValue={tlReview.tlRemarks.taskCompletion}
                  onRemark={(v) =>
                    setTlReview((p) => ({
                      ...p,
                      tlRemarks: { ...p.tlRemarks, taskCompletion: v },
                    }))
                  }
                  disabled={saving}
                />

                {/* 7 */}
                <ReviewRow
                  title="7. Customer Feedback"
                  options={SCORE_OPTIONS.customerFeedback}
                  value={tlReview.customerFeedbackPoints}
                  onValue={(v) =>
                    setTlReview((p) => ({ ...p, customerFeedbackPoints: v }))
                  }
                  remarkValue={tlReview.tlRemarks.customerFeedback}
                  onRemark={(v) =>
                    setTlReview((p) => ({
                      ...p,
                      tlRemarks: { ...p.tlRemarks, customerFeedback: v },
                    }))
                  }
                  disabled={saving}
                />

                {/* 8+9 auto */}
                <div className="rounded-xl border border-gray-200 p-4 bg-white">
                  <div className="font-medium">8. Customer Reviews (Auto)</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Positive: <b>{clamp(n(empForm.positiveReviews), 0, 10)}</b>{" "}
                    • Negative: <b>{n(empForm.negativeReviews)}</b> • Points:{" "}
                    <b>{autoReviewPoints}</b>
                  </div>
                  <textarea
                    className="textarea mt-3"
                    rows={2}
                    placeholder="TL Remark (Customer Reviews)"
                    value={tlReview.tlRemarks.customerReviews}
                    onChange={(e) =>
                      setTlReview((p) => ({
                        ...p,
                        tlRemarks: {
                          ...p.tlRemarks,
                          customerReviews: e.target.value,
                        },
                      }))
                    }
                    disabled={saving}
                  />
                </div>

                <div className="rounded-xl border border-gray-200 p-4 bg-white">
                  <div className="font-medium">9. Repeat Orders (Auto)</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Repeat Orders (0–10 considered):{" "}
                    <b>{clamp(n(empForm.repeatOrders), 0, 10)}</b> • Points:{" "}
                    <b>{autoRepeatPoints}</b>
                  </div>
                  <textarea
                    className="textarea mt-3"
                    rows={2}
                    placeholder="TL Remark (Repeat Orders)"
                    value={tlReview.tlRemarks.repeatOrders}
                    onChange={(e) =>
                      setTlReview((p) => ({
                        ...p,
                        tlRemarks: {
                          ...p.tlRemarks,
                          repeatOrders: e.target.value,
                        },
                      }))
                    }
                    disabled={saving}
                  />
                </div>

                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="Overall TL Remarks"
                  value={tlReview.tlRemarks.overall}
                  onChange={(e) =>
                    setTlReview((p) => ({
                      ...p,
                      tlRemarks: { ...p.tlRemarks, overall: e.target.value },
                    }))
                  }
                  disabled={saving}
                />

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    className="btn-primary"
                    onClick={onTLSubmit}
                    disabled={saving || role !== "TL"}
                    title={role !== "TL" ? "Only TL can submit TL review" : ""}
                  >
                    {saving ? "Submitting..." : "Submit TL Review"}
                  </button>
                </div>

                {/* Admin section */}
                {role === "ADMIN" && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 space-y-3">
                    <div className="font-semibold flex items-center gap-2 text-purple-800">
                      <ShieldCheckIcon className="h-5 w-5" />
                      Admin Approval
                    </div>

                    <select
                      className="input"
                      value={adminDecision}
                      onChange={(e) => setAdminDecision(e.target.value)}
                      disabled={saving}
                    >
                      <option value="APPROVE">Approve</option>
                      <option value="HOLD">Hold / Need Changes</option>
                    </select>

                    <textarea
                      className="textarea"
                      rows={3}
                      placeholder="Admin Remark (Only Admin)"
                      value={adminRemark}
                      onChange={(e) => setAdminRemark(e.target.value)}
                      disabled={saving}
                    />

                    <button
                      className="btn-purple"
                      onClick={onAdminApprove}
                      disabled={saving}
                    >
                      {saving
                        ? "Saving..."
                        : adminDecision === "APPROVE"
                        ? "Approve & Publish Result"
                        : "Save (Hold)"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: Score Summary + Graph */}
        <div className="bg-white rounded-xl shadow p-6 text-center space-y-4">
          <h3 className="text-lg font-semibold">Performance Summary</h3>

          <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
            <div className="text-sm text-gray-600">Total Points</div>
            <div className="text-3xl font-bold">{totalPoints.toFixed(0)}</div>
            <div className="text-sm text-gray-500">
              Max: {maxPossible} • Score %: <b>{percentage.toFixed(1)}%</b>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
              <div
                className="bg-blue-600 h-3 rounded-full"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="font-medium mb-2">Radar Overview</div>
            <div className="flex justify-center">
              <RadarChart width={300} height={300} data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="skill" />
                <PolarRadiusAxis domain={[-20, 10]} />
                <Radar
                  dataKey="value"
                  stroke="#2563eb"
                  fill="#3b82f6"
                  fillOpacity={0.55}
                />
              </RadarChart>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Employee will see this graph only after Admin approval.
            </p>
          </div>

          <div className="text-xs text-gray-500">
            Tip: TL should complete all dropdown scores before submitting.
          </div>
        </div>
      </div>

      {selectedId && !docLoading && !selectedDoc && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="font-semibold text-red-700">No submitted yet</div>
          <div className="text-sm text-red-700">
            Selected employee ka assessment abhi submit nahi hua (ya access
            issue).
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Small UI Components ---------------- */
function ReviewRow({
  title,
  options,
  value,
  onValue,
  remarkValue,
  onRemark,
  disabled,
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <div className="font-medium">{title}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <select
          className="input"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          disabled={disabled}
        >
          <option value="">Select score</option>
          {options.map((o) => (
            <option key={o.label} value={o.points}>
              {o.label} ({o.points})
            </option>
          ))}
        </select>

        <input
          className="input bg-gray-50"
          value={value === "" ? "" : `Points: ${value}`}
          readOnly
          disabled
        />
      </div>

      <textarea
        className="textarea mt-3"
        rows={2}
        placeholder="TL Remark"
        value={remarkValue}
        onChange={(e) => onRemark(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function ManualScoreRow({
  title,
  value,
  onValue,
  remarkValue,
  onRemark,
  disabled,
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white">
      <div className="font-medium">{title}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <input
          type="number"
          min="0"
          max="10"
          className="input"
          placeholder="0 - 10"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          disabled={disabled}
        />
        <input
          className="input bg-gray-50"
          value={value === "" ? "" : `Points: ${clamp(n(value), 0, 10)}`}
          readOnly
          disabled
        />
      </div>

      <textarea
        className="textarea mt-3"
        rows={2}
        placeholder="TL Remark"
        value={remarkValue}
        onChange={(e) => onRemark(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
