import React from "react";
import { renderToString } from "react-dom/server";
import type { AppUser } from "../types";

interface PageProps {
  user: AppUser | null;
  path: string;
}

export function renderPage(props: PageProps): string {
  const app = renderToString(<App {...props} />);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Markitome AI Notetaker</title>
  <style>${css}</style>
</head>
<body>
  <div id="root">${app}</div>
  <script>${clientScript}</script>
</body>
</html>`;
}

function App({ user, path }: PageProps) {
  if (path === "/login") return <LoginPage />;
  if (path === "/unauthorized") return <UnauthorizedPage />;
  if (!user) return <LoginPage />;
  const page = selectPage(path, user);
  return (
    <div>
      <Shell user={user}>{page}</Shell>
    </div>
  );
}

function Shell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const isAdmin = user.roles.includes("admin") || user.roles.includes("super_admin");
  const isSuperAdmin = user.roles.includes("super_admin");
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/dashboard">Markitome AI Notetaker</a>
        <nav>
          <a href="/meetings">Meetings</a>
          <a href="/recordings">Recordings</a>
          <a href="/upload">Upload</a>
          <a href="/screen-recording">Screen Record</a>
          <a href="/action-items">Actions</a>
          <a href="/search">Search</a>
          {isAdmin ? <a href="/admin">Admin</a> : null}
          {isSuperAdmin ? <a href="/settings">Settings</a> : null}
        </nav>
        <form method="post" action="/api/auth/logout">
          <button type="submit">Sign out</button>
        </form>
      </header>
      <main>{children}</main>
    </>
  );
}

function selectPage(path: string, user: AppUser) {
  if (path === "/" || path === "/dashboard") return <Dashboard user={user} />;
  if (path === "/meetings") return <Library title="My Meetings" endpoint="/api/meetings" />;
  if (path === "/recordings") return <Library title="My Recordings" endpoint="/api/meetings" />;
  if (path === "/upload") return <UploadPage />;
  if (path === "/screen-recording") return <ScreenRecorderPage />;
  if (path.startsWith("/meetings/")) return <MeetingDetail meetingId={path.split("/")[2]} />;
  if (path === "/action-items") return <ActionItemsPage />;
  if (path === "/search") return <SearchPage />;
  if (path === "/admin") return <AdminDashboard />;
  if (path === "/admin/meetings") return <Library title="All Meetings" endpoint="/api/admin/meetings" />;
  if (path === "/admin/recordings") return <Library title="All Recordings" endpoint="/api/admin/recordings" />;
  if (path === "/admin/users") return <AdminUsers />;
  if (path === "/admin/failures") return <ProcessingFailures />;
  if (path === "/admin/audit-logs") return <AuditLogs />;
  if (path === "/settings") return <SuperAdminSettings />;
  if (path === "/integrations") return <SuperAdminPanel title="Integrations" />;
  if (path === "/api-usage") return <SuperAdminPanel title="API Usage" />;
  if (path === "/storage-usage") return <SuperAdminPanel title="Storage Usage" />;
  if (path === "/queue-logs") return <SuperAdminPanel title="Queue / Job Logs" />;
  return <Dashboard user={user} />;
}

function LoginPage() {
  return (
    <main className="auth">
      <section>
        <p className="eyebrow">Internal workspace</p>
        <h1>Markitome AI Notetaker</h1>
        <p>Secure meeting recording library, transcription pipeline, Claude-generated notes, and admin audit controls.</p>
        <a className="primary" href="/api/auth/login">Continue with Google</a>
      </section>
    </main>
  );
}

function UnauthorizedPage() {
  return (
    <main className="auth">
      <section>
        <p className="eyebrow">Access pending</p>
        <h1>Unauthorized</h1>
        <p>Normal access is restricted to @markitome.com accounts unless an admin approves an external user.</p>
        <a className="primary" href="/login">Back to login</a>
      </section>
    </main>
  );
}

function Dashboard({ user }: { user: AppUser }) {
  const isAdmin = user.roles.includes("admin") || user.roles.includes("super_admin");
  const isSuperAdmin = user.roles.includes("super_admin");
  return (
    <section className="stack" data-page="dashboard">
      <div className="heading">
        <p className="eyebrow">Dashboard</p>
        <h1>{isSuperAdmin ? "Super Admin Dashboard" : isAdmin ? "Admin Dashboard" : "Employee Dashboard"}</h1>
      </div>
      <div className="grid">
        <Metric label="My upcoming meetings" value="-" />
        <Metric label="My uploaded recordings" value="-" />
        <Metric label="Recent AI notes" value="-" />
        <Metric label="Pending action items" value="-" />
      </div>
      <div className="actions">
        <a className="primary" href="/upload">Upload recording</a>
        <a className="secondary" href="/screen-recording">Start screen recording</a>
      </div>
      {isAdmin ? (
        <section className="panel" data-load="/api/admin/dashboard">
          <h2>Admin overview</h2>
          <div className="json-output">Loading admin metrics...</div>
          <div className="actions">
            <a href="/admin/meetings">All meetings</a>
            <a href="/admin/recordings">All recordings</a>
            <a href="/admin/users">User management</a>
            <a href="/admin/audit-logs">Audit logs</a>
          </div>
        </section>
      ) : null}
      {isSuperAdmin ? (
        <section className="panel">
          <h2>System controls</h2>
          <div className="actions">
            <a href="/settings">System settings</a>
            <a href="/integrations">Integrations</a>
            <a href="/api-usage">API usage</a>
            <a href="/storage-usage">Storage usage</a>
            <a href="/queue-logs">Queue logs</a>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Library({ title, endpoint }: { title: string; endpoint: string }) {
  return (
    <section className="stack">
      <div className="heading">
        <p className="eyebrow">Library</p>
        <h1>{title}</h1>
      </div>
      <div className="toolbar">
        <input data-filter="keyword" placeholder="Keyword" />
        <select data-filter="platform">
          <option value="">Any platform</option>
          <option value="google_meet">Google Meet</option>
          <option value="zoom">Zoom</option>
          <option value="microsoft_teams">Microsoft Teams</option>
          <option value="screen_recording">Screen Recording</option>
          <option value="phone_call_upload">Phone Call</option>
        </select>
        <select data-filter="processing_status">
          <option value="">Any status</option>
          <option value="uploaded">Uploaded</option>
          <option value="transcribing">Transcribing</option>
          <option value="transcribed">Transcribed</option>
          <option value="generating_notes">Generating notes</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <section className="panel" data-load={endpoint}>
        <div className="json-output">Loading library...</div>
      </section>
    </section>
  );
}

function UploadPage() {
  return (
    <section className="stack">
      <div className="heading">
        <p className="eyebrow">Upload</p>
        <h1>Upload Recording</h1>
      </div>
      <div className="notice">Only upload recordings where consent has been obtained. Admin historical imports must be clearly marked.</div>
      <form id="uploadForm" className="form">
        <label>Recording file<input name="file" type="file" accept=".mp3,.wav,.m4a,.mp4,.mov,.webm,.mkv" required /></label>
        <label>Source type<select name="source_type" required>
          <option value="phone_call_upload">Phone Call Recording</option>
          <option value="google_meet">Google Meet</option>
          <option value="zoom">Zoom</option>
          <option value="microsoft_teams">Microsoft Teams</option>
          <option value="screen_recording">Screen Recording</option>
          <option value="audio_upload">Other Audio</option>
          <option value="video_upload">Other Video</option>
          <option value="other">Other</option>
        </select></label>
        <label>Meeting title<input name="title" required /></label>
        <label>Date/time<input name="meeting_datetime" type="datetime-local" required /></label>
        <label>Participants<textarea name="participants" placeholder="One name or email per line" /></label>
        <label>Agenda<textarea name="agenda" /></label>
        <label>Manual notes<textarea name="manual_notes" /></label>
        <label className="check"><input name="consent" type="checkbox" required /> I confirm recording consent has been obtained.</label>
        <progress id="uploadProgress" value="0" max="100" />
        <button type="submit">Upload and process</button>
      </form>
      <pre id="uploadResult" className="json-output"></pre>
    </section>
  );
}

function ScreenRecorderPage() {
  return (
    <section className="stack">
      <div className="heading">
        <p className="eyebrow">Fallback recorder</p>
        <h1>Start Screen Recording</h1>
      </div>
      <div className="notice">Use browser screen recording only when recording consent has been obtained. The recorder will ask your browser for full screen, window, or tab access.</div>
      <form id="screenRecorderForm" className="form">
        <label>Meeting title<input name="title" required /></label>
        <label>Date/time<input name="meeting_datetime" type="datetime-local" required /></label>
        <label>Participants<textarea name="participants" /></label>
        <label>Agenda<textarea name="agenda" /></label>
        <label>Manual notes<textarea name="manual_notes" /></label>
        <label className="check"><input name="microphone" type="checkbox" /> Include microphone if browser permits</label>
        <label className="check"><input name="consent" type="checkbox" required /> I confirm recording consent has been obtained.</label>
      </form>
      <div className="recorder">
        <strong id="recordingTimer">00:00</strong>
        <button id="startRecording">Start</button>
        <button id="pauseRecording" disabled>Pause</button>
        <button id="resumeRecording" disabled>Resume</button>
        <button id="stopRecording" disabled>Stop</button>
      </div>
      <video id="recordingPreview" controls muted playsInline></video>
      <pre id="screenRecordingResult" className="json-output"></pre>
    </section>
  );
}

function MeetingDetail({ meetingId }: { meetingId: string }) {
  return (
    <section className="stack">
      <div className="heading">
        <p className="eyebrow">Meeting detail</p>
        <h1>Meeting</h1>
      </div>
      <section className="panel" data-load={`/api/meetings/${meetingId}`}>
        <div className="json-output">Loading meeting detail...</div>
      </section>
      <div className="actions">
        <a href={`/api/meetings/${meetingId}/export/markdown`}>Download Markdown</a>
        <a href={`/api/meetings/${meetingId}/export/json`}>Download JSON</a>
        <a href={`/api/meetings/${meetingId}/export/transcript`}>Download transcript TXT</a>
        <a href={`/api/meetings/${meetingId}/export/pdf-ready-html`}>Download PDF-ready HTML</a>
        <a href={`/api/meetings/${meetingId}/export/google-docs-text`}>Google Docs-ready text</a>
      </div>
    </section>
  );
}

function ActionItemsPage() {
  return <Library title="Action Items" endpoint="/api/search?q=action" />;
}

function SearchPage() {
  return (
    <section className="stack">
      <div className="heading">
        <p className="eyebrow">Search</p>
        <h1>Search Meetings</h1>
      </div>
      <form id="searchForm" className="toolbar">
        <input name="q" placeholder="Search title, participants, transcript, notes, actions, decisions, or topics" required />
        <button type="submit">Search</button>
      </form>
      <pre id="searchResult" className="json-output"></pre>
    </section>
  );
}

function AdminDashboard() {
  return (
    <section className="stack">
      <div className="heading">
        <p className="eyebrow">Admin</p>
        <h1>Admin Dashboard</h1>
      </div>
      <section className="panel" data-load="/api/admin/dashboard">
        <div className="json-output">Loading admin dashboard...</div>
      </section>
      <div className="actions">
        <a href="/admin/meetings">All Meetings</a>
        <a href="/admin/recordings">All Recordings</a>
        <a href="/admin/users">Employee Libraries</a>
        <a href="/admin/failures">Processing Failures</a>
        <a href="/admin/audit-logs">Audit Logs</a>
      </div>
    </section>
  );
}

function AdminUsers() {
  return <Library title="User Management" endpoint="/api/users" />;
}

function ProcessingFailures() {
  return <Library title="Processing Failures" endpoint="/api/admin/processing-failures" />;
}

function AuditLogs() {
  return <Library title="Audit Logs" endpoint="/api/admin/audit-logs" />;
}

function SuperAdminSettings() {
  return (
    <section className="stack">
      <div className="heading">
        <p className="eyebrow">Super admin</p>
        <h1>System Settings</h1>
      </div>
      <section className="panel">
        <h2>Configurable controls</h2>
        <ul>
          <li>Default consent requirement</li>
          <li>Retention period</li>
          <li>Download permissions</li>
          <li>Employee recording deletion</li>
          <li>Allowed file types</li>
          <li>Maximum upload size</li>
        </ul>
      </section>
    </section>
  );
}

function SuperAdminPanel({ title }: { title: string }) {
  return (
    <section className="stack">
      <div className="heading">
        <p className="eyebrow">Super admin</p>
        <h1>{title}</h1>
      </div>
      <section className="panel">
      <div className="json-output">Configuration and usage data will be loaded from system settings, integrations, usage logs, storage metrics, and processing jobs.</div>
      </section>
    </section>
  );
}

const css = `
:root { color-scheme: light; --ink:#172026; --muted:#5d6b74; --line:#d8e0e5; --bg:#f7f8f5; --panel:#ffffff; --accent:#0f766e; --accent2:#1d4ed8; --warn:#8a4b08; }
* { box-sizing: border-box; }
body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--bg); }
a { color:inherit; text-decoration:none; }
.topbar { height:64px; display:flex; align-items:center; gap:20px; padding:0 24px; border-bottom:1px solid var(--line); background:#fff; position:sticky; top:0; z-index:3; }
.brand { font-weight:800; white-space:nowrap; }
nav { display:flex; gap:14px; flex:1; overflow:auto; }
nav a { color:var(--muted); font-size:14px; }
button, .primary, .secondary, .actions a { border:1px solid var(--line); background:#fff; border-radius:6px; padding:10px 14px; font-weight:650; cursor:pointer; }
.primary, button[type=submit] { background:var(--accent); color:#fff; border-color:var(--accent); }
.secondary { color:var(--accent2); }
main { width:min(1180px, calc(100% - 32px)); margin:28px auto 64px; }
.auth { min-height:100vh; display:grid; place-items:center; margin:0 auto; }
.auth section { width:min(620px, calc(100% - 32px)); }
.auth h1 { font-size:48px; line-height:1.05; margin:8px 0 16px; }
.auth p { color:var(--muted); font-size:18px; line-height:1.55; }
.eyebrow { margin:0; text-transform:uppercase; font-size:12px; letter-spacing:0; color:var(--accent); font-weight:800; }
.heading h1 { margin:4px 0 0; font-size:34px; }
.stack { display:grid; gap:20px; }
.grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
.metric, .panel, .form, .recorder { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; }
.metric span { color:var(--muted); display:block; font-size:13px; }
.metric strong { display:block; font-size:28px; margin-top:8px; }
.actions, .toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.form { display:grid; gap:14px; max-width:760px; }
label { display:grid; gap:6px; color:var(--muted); font-size:14px; font-weight:650; }
.check { display:flex; align-items:center; color:var(--ink); }
input, select, textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:10px 12px; font:inherit; background:#fff; color:var(--ink); }
textarea { min-height:96px; resize:vertical; }
.notice { border:1px solid #e7c995; color:var(--warn); background:#fff8ea; padding:14px 16px; border-radius:8px; font-weight:650; }
.json-output { white-space:pre-wrap; overflow:auto; color:#23313a; background:#f0f4f2; padding:12px; border-radius:6px; min-height:80px; }
progress { width:100%; height:12px; }
video { width:100%; max-height:420px; background:#111; border-radius:8px; }
@media (max-width: 780px) { .topbar { align-items:flex-start; height:auto; padding:14px; flex-wrap:wrap; } .grid { grid-template-columns:1fr; } .auth h1 { font-size:36px; } }
`;

const clientScript = `
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

async function loadPanels() {
  for (const panel of $$("[data-load]")) {
    const output = panel.querySelector(".json-output") || panel;
    try {
      const response = await fetch(panel.dataset.load, { headers: { accept: "application/json" } });
      const json = await response.json();
      output.textContent = JSON.stringify(json, null, 2);
    } catch (error) {
      output.textContent = error.message || String(error);
    }
  }
}

function parseParticipants(text) {
  return (text || "").split("\\n").map((line) => line.trim()).filter(Boolean).map((line) => line.includes("@") ? { email: line } : { name: line });
}

async function uploadBlob(blob, metadata, filename) {
  const uploadUrlResponse = await fetch("/api/recordings/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...metadata,
      original_filename: filename,
      mime_type: blob.type || "video/webm",
      file_size: blob.size,
      consent_status: "confirmed"
    })
  });
  const uploadInfo = await uploadUrlResponse.json();
  if (!uploadUrlResponse.ok) throw new Error(JSON.stringify(uploadInfo));
  await fetch(uploadInfo.upload_url, { method: "PUT", body: blob, headers: { "content-type": blob.type || "application/octet-stream" } });
  const completeResponse = await fetch("/api/recordings/complete-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ upload_session_id: uploadInfo.upload_session_id })
  });
  return completeResponse.json();
}

$("#uploadForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const file = form.file.files[0];
  const result = $("#uploadResult");
  const progress = $("#uploadProgress");
  try {
    progress.value = 10;
    const sourceType = form.source_type.value;
    const response = await uploadBlob(file, {
      source_type: sourceType,
      platform: sourceType,
      title: form.title.value,
      meeting_datetime: new Date(form.meeting_datetime.value).toISOString(),
      participants: parseParticipants(form.participants.value),
      agenda: form.agenda.value,
      manual_notes: form.manual_notes.value,
      meeting_url: null
    }, file.name);
    progress.value = 100;
    result.textContent = JSON.stringify(response, null, 2);
  } catch (error) {
    result.textContent = error.message || String(error);
  }
});

$("#searchForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await fetch("/api/search?q=" + encodeURIComponent(event.currentTarget.q.value));
  $("#searchResult").textContent = JSON.stringify(await response.json(), null, 2);
});

let recorder, chunks = [], startedAt = 0, timerId = 0, stream;
function setRecorderButtons(state) {
  $("#startRecording").disabled = state !== "idle";
  $("#pauseRecording").disabled = state !== "recording";
  $("#resumeRecording").disabled = state !== "paused";
  $("#stopRecording").disabled = state === "idle";
}
function updateTimer() {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  $("#recordingTimer").textContent = String(Math.floor(elapsed / 60)).padStart(2, "0") + ":" + String(elapsed % 60).padStart(2, "0");
}
$("#startRecording")?.addEventListener("click", async () => {
  const form = $("#screenRecorderForm");
  const result = $("#screenRecordingResult");
  if (!form.consent.checked) { result.textContent = "Consent confirmation is required."; return; }
  try {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const tracks = [...display.getTracks()];
    if (form.microphone.checked) {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        tracks.push(...mic.getAudioTracks());
      } catch (error) {
        result.textContent = "Microphone capture was not granted. Recording screen/tab audio only.";
      }
    }
    stream = new MediaStream(tracks);
    $("#recordingPreview").srcObject = stream;
    chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm" });
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      clearInterval(timerId);
      setRecorderButtons("idle");
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: "video/webm" });
      const response = await uploadBlob(blob, {
        source_type: "screen_recording",
        platform: "screen_recording",
        title: form.title.value,
        meeting_datetime: new Date(form.meeting_datetime.value).toISOString(),
        participants: parseParticipants(form.participants.value),
        agenda: form.agenda.value,
        manual_notes: form.manual_notes.value,
        meeting_url: null
      }, "screen-recording-" + Date.now() + ".webm");
      result.textContent = JSON.stringify(response, null, 2);
    };
    recorder.start(1000);
    startedAt = Date.now();
    timerId = setInterval(updateTimer, 1000);
    updateTimer();
    setRecorderButtons("recording");
  } catch (error) {
    result.textContent = error.message || String(error);
  }
});
$("#pauseRecording")?.addEventListener("click", () => { recorder?.pause(); setRecorderButtons("paused"); });
$("#resumeRecording")?.addEventListener("click", () => { recorder?.resume(); setRecorderButtons("recording"); });
$("#stopRecording")?.addEventListener("click", () => recorder?.stop());
setRecorderButtons("idle");
loadPanels();
`;
