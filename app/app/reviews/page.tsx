"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ReviewType = "Positive" | "Negative" | "Allegation" | "Request";
type Review = {
  id: string;
  profile: string;
  name: string;
  type: ReviewType;
  title: string;
  body: string;
  image?: string;
  votes?: { up: number; down: number };
  date: string;
};

const STORAGE_KEY = "tn-government-explorer-reviews-v1";
const VOTES_KEY = "tn-government-explorer-review-votes-v1";
const PROFILES = [
  "C. Joseph Vijay",
  "N. Anand",
  "Aadhav Arjuna",
  "Dr. K.G. Arunraj",
  "K.A. Sengottaiyan",
  "P. Venkataramanan",
  "R. Nirmalkumar",
  "Rajmohan",
  "Dr. T.K. Prabhu",
  "Selvi S. Keerthana",
  "P. Viswanathan",
  "S. Rajesh Kumar",
  "A.M. Shahjahan",
  "Vanni Arasu",
  "A. Vijay Tamilan Parthiban",
  "B. Rajkumar",
  "V. Sampath Kumar",
  "M. Vijay Balaji",
  "K. Vignesh",
  "K. Thennarasu",
  "J. Mohamed Farvas",
  "V. Gandhiraj",
  "Jagadeshwari K.",
  "R. Vinoth",
  "C. Vijayalakshmi",
  "D. Sarathkumar",
  "Ramesh",
  "P. Mathan Raja",
  "N. Marie Wilson",
  "A. Srinath",
  "S. Kamali",
  "Dr. Kumar R",
  "R.V. Ranjithkumar",
  "D. Logesh Tamilselvan",
  "Dr. V.K. Rajeev",
];

const typeStyles: Record<ReviewType, { color: string; background: string; description: string }> = {
  Positive: { color: "#166534", background: "#dcfce7", description: "Share a positive observation or outcome" },
  Negative: { color: "#991b1b", background: "#fee2e2", description: "Describe a concern or poor outcome" },
  Allegation: { color: "#991b1b", background: "#fee2e2", description: "State a claim clearly as an allegation and include evidence or sources" },
  Request: { color: "#1d4ed8", background: "#dbeafe", description: "Suggest an action or ask for a response" },
};

function RatingGauge({ value }: { value: number | null }) {
  const score = value === null ? null : Math.max(0, Math.min(100, Math.round(value)));
  const sentiment = score === null ? "Awaiting feedback" : score >= 70 ? "Mostly positive" : score >= 45 ? "Mixed feedback" : "Needs improvement";
  const color = score === null ? "#64748b" : score >= 70 ? "#15803d" : score >= 45 ? "#b45309" : "#b91c1c";
  const background = score === null ? "#f1f5f9" : score >= 70 ? "#dcfce7" : score >= 45 ? "#fef3c7" : "#fee2e2";
  return (
    <div style={{ width: "100%", maxWidth: 300, margin: "0 auto", padding: 18, boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 16, background: "white" }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>Public sentiment</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 }}>
        <div><span style={{ fontSize: 32, lineHeight: 1.1, fontWeight: 900, color: "#0f172a" }}>{score === null ? "—" : score}</span><span style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}> / 100</span></div>
        <span style={{ padding: "6px 9px", borderRadius: 999, background, color, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{sentiment}</span>
      </div>
      <div role="progressbar" aria-label="Positive public sentiment score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score ?? 0} style={{ height: 9, borderRadius: 999, overflow: "hidden", background: "#e2e8f0", marginTop: 14 }}>
        <div style={{ width: `${score ?? 0}%`, height: "100%", borderRadius: 999, background: score === null ? "#cbd5e1" : score >= 70 ? "#16a34a" : score >= 45 ? "#f59e0b" : "#ef4444", transition: "width 220ms ease" }} />
      </div>
      <p style={{ margin: "9px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{score === null ? "No positive or negative reviews yet." : "Based on positive and negative reviews only."}</p>
    </div>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) as Review[] : [];
    } catch {
      return [];
    }
  });
  const [votes, setVotes] = useState<Record<string, "up" | "down">>(() => {
    if (typeof window === "undefined") return {};
    try {
      const savedVotes = localStorage.getItem(VOTES_KEY);
      return savedVotes ? JSON.parse(savedVotes) as Record<string, "up" | "down"> : {};
    } catch {
      return {};
    }
  });
  const [profile, setProfile] = useState(() => {
    if (typeof window === "undefined") return PROFILES[0];
    const requestedProfile = new URLSearchParams(window.location.search).get("profile");
    return requestedProfile && PROFILES.includes(requestedProfile) ? requestedProfile : PROFILES[0];
  });
  const [filter, setFilter] = useState<"All" | ReviewType>("All");
  const [sortOrder, setSortOrder] = useState<"Newest first" | "Oldest first" | "Highest upvotes" | "Highest downvotes">("Newest first");
  const [name, setName] = useState("");
  const [type, setType] = useState<ReviewType>("Positive");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"Sign Up" | "Log In">("Log In");
  const [authSetupNotice, setAuthSetupNotice] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedAction = params.get("action");
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => {
        setIsAuthenticated(response.ok);
        if (requestedAction === "write" && response.ok) {
          setShowForm(true);
        } else if (requestedAction === "write") {
          setShowForm(false);
          setAuthMode("Log In");
          setAuthSetupNotice(false);
          setAuthModalOpen(true);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        if (requestedAction === "write") {
          setShowForm(false);
          setAuthMode("Log In");
          setAuthSetupNotice(false);
          setAuthModalOpen(true);
        }
      });
  }, []);

  const profileReviews = useMemo(() => reviews.filter((review) => review.profile === profile), [reviews, profile]);
  const visibleReviews = useMemo(() => profileReviews
    .filter((review) => filter === "All" || (filter === "Negative" ? review.type === "Negative" || review.type === "Allegation" : review.type === filter))
    .sort((a, b) => {
      if (sortOrder === "Highest upvotes") return (b.votes?.up ?? 0) - (a.votes?.up ?? 0) || new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortOrder === "Highest downvotes") return (b.votes?.down ?? 0) - (a.votes?.down ?? 0) || new Date(b.date).getTime() - new Date(a.date).getTime();
      return sortOrder === "Newest first" ? new Date(b.date).getTime() - new Date(a.date).getTime() : new Date(a.date).getTime() - new Date(b.date).getTime();
    }), [profileReviews, filter, sortOrder]);
  const scoredReviews = profileReviews.filter((review) => review.type !== "Request");
  const positiveCount = scoredReviews.filter((review) => review.type === "Positive").length;
  const negativeCount = scoredReviews.filter((review) => review.type === "Negative" || review.type === "Allegation").length;
  const score = scoredReviews.length ? (positiveCount / scoredReviews.length) * 100 : null;
  const overallScoredReviews = reviews.filter((review) => review.type !== "Request");
  const overallPositive = overallScoredReviews.filter((review) => review.type === "Positive").length;
  const overallScore = overallScoredReviews.length ? (overallPositive / overallScoredReviews.length) * 100 : null;

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!name.trim() || !title.trim() || !body.trim()) {
      setNotice("Please fill in your name, feedback headline and details.");
      return;
    }

    setIsSubmitting(true);
    setNotice("");
    try {
      let uploadedImageUrl: string | undefined;
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        const response = await fetch("/api/uploads/images", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });
        const result = await response.json().catch(() => ({})) as { imageUrl?: string; error?: string };
        if (!response.ok || !result.imageUrl) {
          if (response.status === 401) {
            throw new Error("Your sign-in session has expired. Please sign in again and retry.");
          }
          throw new Error(result.error || "Image upload failed. Please try again.");
        }
        uploadedImageUrl = result.imageUrl;
      }

      const next: Review = {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        profile, name: name.trim(), type, title: title.trim(), body: body.trim(),
        ...(uploadedImageUrl ? { image: uploadedImageUrl } : {}),
        date: new Date().toISOString(),
      };
      const updated = [next, ...reviews];
      setReviews(updated);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* The current session still works if storage is unavailable. */ }
      setName(""); setTitle(""); setBody(""); setImage(null); setImageFile(null);
      setNotice("Your review has been added in this browser. Its image is stored in S3.");
      setFilter("All"); setShowForm(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not publish feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function voteReview(id: string, direction: "up" | "down") {
    if (!isAuthenticated) {
      setAuthMode("Log In"); setAuthModalOpen(true);
      return;
    }
    const previous = votes[id];
    const nextDirection = previous === direction ? undefined : direction;
    const nextVotes = { ...votes };
    if (nextDirection) nextVotes[id] = nextDirection;
    else delete nextVotes[id];
    const updated = reviews.map((review) => {
      if (review.id !== id) return review;
      const counts = { up: review.votes?.up ?? 0, down: review.votes?.down ?? 0 };
      if (previous === "up") counts.up = Math.max(0, counts.up - 1);
      if (previous === "down") counts.down = Math.max(0, counts.down - 1);
      if (nextDirection === "up") counts.up += 1;
      if (nextDirection === "down") counts.down += 1;
      return { ...review, votes: counts };
    });
    setVotes(nextVotes);
    setReviews(updated);
    try {
      localStorage.setItem(VOTES_KEY, JSON.stringify(nextVotes));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch { /* Keep current UI state. */ }
  }

  function removeReview(id: string) {
    const updated = reviews.filter((review) => review.id !== id);
    setReviews(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* Keep current UI state. */ }
  }

  const panel: React.CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: 22, boxShadow: "0 8px 28px #0f172a08" };
  const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 7 };
  const input: React.CSSProperties = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 10, padding: "11px 12px", font: "inherit", fontSize: 14, background: "white", color: "#0f172a", boxSizing: "border-box" };

  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#0f172a", padding: "28px 18px 56px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#1d4ed8", textDecoration: "none", fontSize: 13, fontWeight: 800, marginBottom: 22 }}>← Back to Arasiyal Arattai</Link>
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 24 }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 11, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>Public voice · Accountability</div>
            <h1 style={{ fontSize: "clamp(30px, 4vw, 44px)", lineHeight: 1.1, letterSpacing: -1.5, margin: "9px 0", fontWeight: 900 }}>Public Feedback</h1>
            <p style={{ maxWidth: 650, color: "#64748b", lineHeight: 1.65, margin: 0 }}>Share a public assessment, raise a concern, or request action about a government representative. Keep comments specific, respectful and evidence-based.</p>
          </div>
          <button onClick={() => {
            if (showForm) {
              setShowForm(false);
            } else if (isAuthenticated) {
              setShowForm(true);
            } else {
              setAuthMode("Sign Up");
              setAuthModalOpen(true);
            }
          }} style={{ border: 0, borderRadius: 11, background: "#1d4ed8", color: "white", padding: "13px 18px", fontWeight: 700, cursor: "pointer" }}>{showForm ? "Close form" : "✍ Share feedback"}</button>
        </header>

        <section style={{ ...panel, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 20, alignItems: "center" }}>
            <div>
              <label style={label} htmlFor="profile-select">Choose a representative</label>
              <select id="profile-select" value={profile} onChange={(e) => { setProfile(e.target.value); setFilter("All"); setNotice(""); }} style={input}>{PROFILES.map((p) => <option key={p}>{p}</option>)}</select>
              <p style={{ color: "#64748b", fontSize: 11, margin: "8px 0 0" }}>Reviews and scores are shown separately for each profile.</p>
            </div>
            <RatingGauge value={score} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: 15 }}><div style={{ fontSize: 25, fontWeight: 900 }}>{profileReviews.length}</div><div style={{ color: "#64748b", fontSize: 12 }}>Total feedback</div></div>
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: 15 }}><div style={{ fontSize: 25, fontWeight: 900 }}>{positiveCount}</div><div style={{ color: "#166534", fontSize: 12 }}>Positive feedback</div></div>
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: 15 }}><div style={{ fontSize: 25, fontWeight: 900 }}>{negativeCount}</div><div style={{ color: "#991b1b", fontSize: 12 }}>Negative feedback</div></div>
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: 15 }}><div style={{ fontSize: 25, fontWeight: 900 }}>{profileReviews.filter((review) => review.type === "Request").length}</div><div style={{ color: "#1d4ed8", fontSize: 12 }}>Requests</div></div>
              <div style={{ gridColumn: "1 / -1", color: "#64748b", fontSize: 11 }}>Explorer-wide feedback score: {overallScore === null ? "Not enough positive/negative reviews yet" : `${Math.round(overallScore)} / 100 from ${overallScoredReviews.length} positive/negative submission(s)`}. Requests are counted separately and do not change the score.</div>
            </div>
          </div>
        </section>

        {showForm && <section style={{ ...panel, marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 5px", fontSize: 21, fontWeight: 900 }}>Share your feedback</h2>
          <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: 13 }}>You can submit more than one review, including multiple reviews for the same person.</p>
          <form onSubmit={submitReview}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div><label style={label} htmlFor="review-name">Your display name</label><input id="review-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter a name" maxLength={60} style={input} required /></div>
              <div><label style={label} htmlFor="review-type">Feedback type</label><select id="review-type" value={type} onChange={(e) => setType(e.target.value as ReviewType)} style={input}>{(["Positive", "Negative", "Allegation", "Request"] as ReviewType[]).map((t) => <option key={t} value={t}>{t} — {typeStyles[t].description}</option>)}</select></div>
            </div>
                        <div style={{ marginTop: 18 }}><label style={label} htmlFor="review-title">Review headline</label><input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summarise your point" maxLength={100} style={input} required /></div>
            <div style={{ marginTop: 18 }}><label style={label} htmlFor="review-body">Details and evidence</label><textarea id="review-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Explain the experience, outcome, source or action requested..." minLength={10} maxLength={1500} rows={5} style={{ ...input, resize: "vertical" }} required /></div>
            <div style={{ marginTop: 18 }}>
              <label style={label} htmlFor="review-image">Attach an image (optional)</label>
              <input id="review-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) { setImage(null); setImageFile(null); return; }
                if (file.size > 2 * 1024 * 1024) { setNotice("Please choose an image smaller than 2 MB."); e.target.value = ""; setImage(null); setImageFile(null); return; }
                setImageFile(file);
                const reader = new FileReader();
                reader.onload = () => { if (typeof reader.result === "string") { setImage(reader.result); setNotice(""); } };
                reader.onerror = () => { setNotice("Could not preview this image. Please try another file."); setImage(null); setImageFile(null); };
                reader.readAsDataURL(file);
              }} style={{ ...input, padding: 9 }} />
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>JPG, PNG, WEBP or GIF · maximum 2 MB. Images are uploaded to S3 when you publish feedback.</p>
              {image && <div style={{ marginTop: 10 }}><img src={image} alt="Review attachment preview" style={{ display: "block", maxWidth: "100%", maxHeight: 260, borderRadius: 12, border: "1px solid #e2e8f0", objectFit: "contain" }} /><button type="button" onClick={() => { setImage(null); setImageFile(null); const fileInput = document.getElementById("review-image") as HTMLInputElement | null; if (fileInput) fileInput.value = ""; }} style={{ marginTop: 7, border: "1px solid #cbd5e1", borderRadius: 8, background: "white", padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Remove image</button></div>}
            </div>
            <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>Do not post private information, threats, or unverified allegations as established facts. Clearly identify claims as allegations and include public sources where possible.</p>
            {notice && <p role="status" style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 700 }}>{notice}</p>}
            <button type="submit" disabled={isSubmitting} style={{ border: 0, borderRadius: 10, background: isSubmitting ? "#93c5fd" : "#1d4ed8", color: "white", padding: "12px 18px", fontWeight: 600, cursor: isSubmitting ? "wait" : "pointer" }}>{isSubmitting ? "Uploading and publishing…" : "Publish feedback"}</button>
          </form>
        </section>}

        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 23, fontWeight: 900 }}>Public feedback</h2>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, flexWrap: "wrap" }}>
              <select aria-label="Sort reviews" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)} style={{ border: "1px solid #cbd5e1", borderRadius: 9, padding: "9px 10px", fontSize: 12, background: "white", color: "#334155" }}><option>Newest first</option><option>Oldest first</option><option>Highest upvotes</option><option>Highest downvotes</option></select>
              {(["All", "Positive", "Negative", "Allegation", "Request"] as const).map((t) => <button key={t} onClick={() => setFilter(t)} style={{ border: filter === t ? "1px solid #1d4ed8" : "1px solid #cbd5e1", background: filter === t ? "#dbeafe" : "white", color: filter === t ? "#1d4ed8" : "#475569", borderRadius: 999, padding: "8px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{t}</button>)}
            </div>
          </div>
          {notice && !showForm && <p role="status" style={{ color: "#166534", fontSize: 13, fontWeight: 700 }}>{notice}</p>}
          {visibleReviews.length === 0 ? <div style={{ ...panel, textAlign: "center", padding: "42px 20px" }}><div style={{ fontSize: 34 }}>✦</div><h3 style={{ fontSize: 18, fontWeight: 900, margin: "10px 0 6px" }}>No public feedback yet</h3><p style={{ maxWidth: 430, margin: "0 auto 18px", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>Be the first to share specific, constructive feedback of {profile}.</p><button onClick={() => { setShowForm(false); setType("Positive"); setAuthMode("Sign Up"); setAuthModalOpen(true); }} style={{ border: 0, borderRadius: 10, background: "#1d4ed8", color: "white", padding: "11px 16px", fontWeight: 850, cursor: "pointer" }}>Share the first feedback</button></div> : <div style={{ display: "grid", gap: 12 }}>{visibleReviews.map((review) => <article key={review.id} className="feedback-card" style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}><div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: "#e2e8f0", color: "#334155", fontWeight: 400 }}>{review.name.slice(0, 1).toUpperCase()}</div><div><div style={{ fontWeight: 400 }}>{review.name}</div><div style={{ fontSize: 11, color: "#64748b", fontWeight: 400, marginTop: 3 }}>{new Date(review.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {review.profile}</div></div></div>
              <span style={{ borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 400, color: typeStyles[review.type].color, background: typeStyles[review.type].background }}>{review.type}</span>
            </div>
            <div style={{ marginTop: 15 }}><h3 style={{ margin: "7px 0", fontSize: 17, fontWeight: 900 }}>{review.title}</h3><p style={{ margin: 0, color: "#475569", fontSize: 14, fontWeight: 400, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{review.body}</p>{review.image && <img src={review.image} alt={`Image attached to review: ${review.title}`} style={{ display: "block", marginTop: 12, maxWidth: "100%", maxHeight: 440, borderRadius: 12, border: "1px solid #e2e8f0", objectFit: "contain" }} />}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ display: "inline-flex", alignItems: "stretch", gap: 0, padding: 1, border: "1px solid #dbe4ef", borderRadius: 999, background: "#f8fafc", overflow: "hidden" }}>
                <button type="button" aria-label="Upvote review" title="Upvote" aria-pressed={votes[review.id] === "up"} onClick={() => voteReview(review.id, "up")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 48, border: 0, borderRadius: 999, background: votes[review.id] === "up" ? "#dbeafe" : "transparent", color: votes[review.id] === "up" ? "#2563eb" : "#475569", padding: "4px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}><span style={{ fontSize: 14, lineHeight: 1 }}>↑</span><span>{review.votes?.up ?? 0}</span></button>
                <button type="button" aria-label="Downvote review" title="Downvote" aria-pressed={votes[review.id] === "down"} onClick={() => voteReview(review.id, "down")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 48, border: 0, borderRadius: 999, background: votes[review.id] === "down" ? "#ffedd5" : "transparent", color: votes[review.id] === "down" ? "#c2410c" : "#475569", padding: "4px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}><span style={{ fontSize: 14, lineHeight: 1 }}>↓</span><span>{review.votes?.down ?? 0}</span></button>
              </div>
              <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>Your vote is saved in this browser</span>
            </div>
            <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 15, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><span style={{ fontSize: 11, color: "#64748b" }}>Community-submitted · not independently verified</span><button onClick={() => removeReview(review.id)} style={{ border: "1px solid #cbd5e1", background: "white", color: "#64748b", borderRadius: 8, padding: "6px 9px", fontSize: 11, cursor: "pointer" }}>Remove from this browser</button></div>
          </article>)}</div>}
        </section>
        <footer style={{ marginTop: 28, color: "#94a3b8", fontSize: 11, lineHeight: 1.7 }}>Prototype note: reviews are stored in this browser only using local storage. They are not shared with other visitors or saved to a server yet. A backend and moderation system are needed for a public, shared review platform.</footer>
      </div>
      {authModalOpen && <div role="presentation" onClick={() => setAuthModalOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 20, background: "#0f172a99", backdropFilter: "blur(4px)", overflowY: "auto" }}><section role="dialog" aria-modal="true" aria-label={authMode === "Log In" ? "Log in" : "Create an account"} onClick={(event) => event.stopPropagation()} style={{ position: "relative", width: "min(100%, 430px)", boxSizing: "border-box", padding: "34px 32px 28px", background: "white", borderRadius: 8, boxShadow: "0 24px 80px #0005" }}><button type="button" aria-label="Close authentication" onClick={() => setAuthModalOpen(false)} style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, border: 0, borderRadius: 999, background: "#f1f5f9", color: "#334155", fontSize: 22, cursor: "pointer" }}>×</button><h2 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 900, color: "#111827" }}>{authMode === "Log In" ? "Login to your account" : "Create an account"}</h2><form onSubmit={(event) => { event.preventDefault(); window.location.href = "/auth/login"; }}><label style={{ display: "block", marginBottom: 7, fontSize: 13, color: "#64748b" }}>Email</label><input required type="email" aria-label="Email" placeholder="Enter your email" style={{ width: "100%", boxSizing: "border-box", padding: "12px", border: "2px solid #bfdbfe", borderRadius: 7, marginBottom: 17, color: "#111827", background: "white" }}/><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}><label style={{ fontSize: 13, color: "#64748b" }}>Password</label>{authMode === "Log In" && <button type="button" onClick={() => setAuthSetupNotice(true)} style={{ border: 0, background: "transparent", color: "#0784f9", fontSize: 12, cursor: "pointer" }}>Forgot?</button>}</div><input required type="password" aria-label="Password" placeholder="Enter your password" style={{ width: "100%", boxSizing: "border-box", padding: "12px", border: "1px solid #d1d5db", borderRadius: 7, marginBottom: 22, color: "#111827", background: "white" }}/><button type="submit" style={{ width: "100%", border: 0, borderRadius: 7, padding: "13px", background: "#0784f9", color: "white", fontWeight: 700, cursor: "pointer" }}>{authMode === "Log In" ? "Login now" : "Create account"}</button></form><button type="button" onClick={() => { window.location.href = "/auth/login?provider=Google"; }} style={{ width: "100%", marginTop: 12, border: 0, borderRadius: 7, padding: "13px", background: "#e0efff", color: "#0784f9", fontWeight: 700, cursor: "pointer" }}>🌐　Continue with Google</button><p style={{ margin: "20px 0 0", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{authMode === "Log In" ? "Don’t have an account?" : "Already have an account?"} <button type="button" onClick={() => { setAuthMode(authMode === "Log In" ? "Sign Up" : "Log In"); setAuthSetupNotice(false); }} style={{ border: 0, background: "transparent", color: "#0784f9", cursor: "pointer" }}>{authMode === "Log In" ? "Sign up" : "Log in"}</button></p>{authSetupNotice && <p role="status" style={{ marginTop: 14, padding: 10, borderRadius: 8, background: "#fff7ed", color: "#9a3412", fontSize: 12 }}>Use the sign-in form above to continue through Amazon Cognito.</p>}</section></div>}
    </main>
  );
}
