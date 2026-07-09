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
  if (path === "/setup-required") return <SetupRequiredPage />;
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
  if (path === "/recordings") return <Library title="My Recordings" endpoint="/api/recordings" />;
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
  if (path === "/integrations") return <SuperAdminPanel title="Integrations" endpoint="/api/admin/integrations" />;
  if (path === "/api-usage") return <SuperAdminPanel title="API Usage" endpoint="/api/admin/api-usage" />;
  if (path === "/storage-usage") return <SuperAdminPanel title="Storage Usage" endpoint="/api/admin/storage-usage" />;
  if (path === "/queue-logs") return <SuperAdminPanel title="Queue / Job Logs" endpoint="/api/admin/queue-logs" />;
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

function SetupRequiredPage() {
  return (
    <main className="auth">
      <section>
        <p className="eyebrow">Setup required</p>
        <h1>Google login is not configured</h1>
        <p>Set the production Google OAuth secrets in Cloudflare Workers, then retry login.</p>
        <pre className="json-output">npx wrangler secret put GOOGLE_CLIENT_ID{"\n"}npx wrangler secret put GOOGLE_CLIENT_SECRET</pre>
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
        <a href="/admin/failures">Processing failures</a>
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
      <section className="panel" data-load={endpoint} data-load-base={endpoint}>
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
      <section className="panel">
        <h2>Manual transcript</h2>
        <form id="manualTranscriptForm" className="form" data-meeting-id={meetingId}>
          <label>Transcript text<textarea name="transcript_text" required /></label>
          <label>Language<input name="language" placeholder="en" /></label>
          <button type="submit">Upload transcript and generate notes</button>
        </form>
        <pre id="manualTranscriptResult" className="json-output"></pre>
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
  return <Library title="Action Items" endpoint="/api/action-items" />;
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
      <section className="panel" data-load="/api/admin/system-settings">
        <h2>Saved settings</h2>
        <div className="json-output">Loading settings...</div>
      </section>
      <section className="panel" data-load="/api/admin/system-status">
        <h2>Production status</h2>
        <div className="json-output">Loading system status...</div>
      </section>
    </section>
  );
}

function SuperAdminPanel({ title, endpoint }: { title: string; endpoint: string }) {
  return (
    <section className="stack">
      <div className="heading">
        <p className="eyebrow">Super admin</p>
        <h1>{title}</h1>
      </div>
      <section className="panel" data-load={endpoint}>
        <div className="json-output">Loading {title.toLowerCase()}...</div>
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
.primary, .actions a.primary, button[type=submit] { background:var(--accent); color:#fff; border-color:var(--accent); }
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
.status-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
.status-card { border:1px solid var(--line); border-radius:8px; padding:14px; background:#fbfcfb; }
.status-card span { display:block; color:var(--muted); font-size:12px; text-transform:uppercase; font-weight:800; }
.status-card strong { display:block; margin-top:6px; font-size:22px; }
.table-wrap { overflow:auto; border:1px solid var(--line); border-radius:8px; }
table { width:100%; border-collapse:collapse; min-width:720px; background:#fff; }
th, td { text-align:left; border-bottom:1px solid var(--line); padding:10px 12px; vertical-align:top; font-size:14px; }
th { background:#f0f4f2; color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:0; }
tr:last-child td { border-bottom:0; }
.pill { display:inline-flex; align-items:center; border-radius:999px; padding:4px 8px; background:#eef5f4; color:var(--accent); font-size:12px; font-weight:800; }
.empty-state { color:var(--muted); background:#f0f4f2; border-radius:6px; padding:14px; }
.error-state { color:#7f1d1d; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:14px; font-weight:650; }
.mono { font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size:12px; }
progress { width:100%; height:12px; }
video { width:100%; max-height:420px; background:#111; border-radius:8px; }
@media (max-width: 780px) { .topbar { align-items:flex-start; height:auto; padding:14px; flex-wrap:wrap; } .grid { grid-template-columns:1fr; } .auth h1 { font-size:36px; } }
`;

const clientScript = `
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

async function loadPanels() {
  for (const panel of $$("[data-load]")) {
    await loadPanel(panel);
  }
}

async function loadPanel(panel) {
  const output = panel.querySelector(".json-output") || panel;
  try {
    const response = await fetch(panel.dataset.load, { headers: { accept: "application/json" } });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message || "Request failed with status " + response.status);
    output.outerHTML = renderData(panel.dataset.load || "", json);
  } catch (error) {
    output.outerHTML = '<div class="error-state">' + escapeHtml(error.message || String(error)) + '</div>';
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size = size / 1024; unit += 1; }
  return size.toFixed(unit ? 1 : 0) + " " + units[unit];
}

function pill(value) {
  return '<span class="pill">' + escapeHtml(value || "-") + '</span>';
}

function emptyState(message) {
  return '<div class="empty-state">' + escapeHtml(message) + '</div>';
}

function table(headers, rows) {
  if (!rows.length) return emptyState("No records found.");
  return '<div class="table-wrap"><table><thead><tr>' + headers.map((header) => '<th>' + escapeHtml(header) + '</th>').join("") + '</tr></thead><tbody>' + rows.join("") + '</tbody></table></div>';
}

function td(value, className) {
  return '<td' + (className ? ' class="' + className + '"' : "") + '>' + value + '</td>';
}

function renderData(endpoint, json) {
  if (json.total_meetings || json.failed_processing_jobs) return renderDashboard(json);
  if (json.google_oauth_configured !== undefined) return renderSystemStatus(json);
  if (json.meetings) return renderMeetings(json.meetings);
  if (json.recordings) return renderRecordings(json.recordings);
  if (json.users) return renderUsers(json.users);
  if (json.action_items) return renderActionItems(json.action_items);
  if (json.audit_logs) return renderAuditLogs(json.audit_logs);
  if (json.jobs) return renderJobs(json.jobs);
  if (json.settings) return renderSettings(json.settings);
  if (json.integrations || json.required_secrets) return renderIntegrations(json);
  if (json.usage) return renderUsage(json.usage);
  if (json.transcripts || endpoint.includes("storage-usage")) return renderStorage(json);
  if (json.results) return renderSearchResults(json);
  return '<pre class="json-output">' + escapeHtml(JSON.stringify(json, null, 2)) + '</pre>';
}

function renderDashboard(json) {
  const cards = [
    ["Total meetings", json.total_meetings?.count ?? 0],
    ["Recordings", json.recordings?.count ?? 0],
    ["Recording hours", ((Number(json.recordings?.durationSeconds || 0) / 3600).toFixed(1))],
    ["Failed jobs", json.failed_processing_jobs?.count ?? 0]
  ];
  return '<div class="status-grid">' + cards.map(([label, value]) => '<div class="status-card"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>').join("") + '</div>' + (json.configuration ? renderSystemStatus(json.configuration) : "");
}

function renderSystemStatus(json) {
  const checks = [
    ["Google OAuth", json.google_oauth_configured],
    ["Workers AI", json.cloudflare_workers_ai_configured],
    ["Claude API", json.claude_configured]
  ];
  const status = '<div class="status-grid">' + checks.map(([label, ok]) => '<div class="status-card"><span>' + escapeHtml(label) + '</span><strong>' + (ok ? "Configured" : "Missing") + '</strong></div>').join("") + '</div>';
  const models = '<p class="mono">Transcription: ' + escapeHtml(json.transcription_model) + '<br>Claude: ' + escapeHtml(json.claude_model) + '</p>';
  const actions = json.required_action?.length ? '<div class="notice">' + json.required_action.map(escapeHtml).join("<br>") + '</div>' : '<div class="empty-state">All required production configuration is present.</div>';
  return status + models + actions;
}

function renderMeetings(meetings) {
  return table(["Title", "Date", "Owner", "Platform", "Source", "Status"], meetings.map((meeting) => '<tr>' +
    td('<a href="/meetings/' + encodeURIComponent(meeting.id) + '">' + escapeHtml(meeting.title) + '</a>') +
    td(escapeHtml(formatDate(meeting.meeting_datetime))) +
    td(escapeHtml(meeting.owner_email || meeting.owner_user_id || "-")) +
    td(pill(meeting.platform)) +
    td(escapeHtml(meeting.source_type || "-")) +
    td(pill(meeting.processing_status)) +
  '</tr>'));
}

function renderRecordings(recordings) {
  return table(["File", "Meeting", "Owner", "Type", "Size", "Status", "Error"], recordings.map((recording) => '<tr>' +
    td('<a href="/meetings/' + encodeURIComponent(recording.meeting_id) + '">' + escapeHtml(recording.original_filename || recording.id) + '</a>') +
    td(escapeHtml(recording.meeting_title || "-")) +
    td(escapeHtml(recording.owner_email || recording.owner_user_id || "-")) +
    td(pill(recording.source_type)) +
    td(escapeHtml(formatBytes(recording.file_size))) +
    td(pill(recording.processing_status)) +
    td(escapeHtml(recording.error_message || "-")) +
  '</tr>'));
}

function renderUsers(users) {
  return table(["Email", "Name", "Approval", "Roles", "Last login"], users.map((user) => '<tr>' +
    td(escapeHtml(user.email)) +
    td(escapeHtml(user.name || "-")) +
    td(pill(user.approvalStatus || user.approval_status)) +
    td(escapeHtml(user.roles || "-")) +
    td(escapeHtml(formatDate(user.lastLoginAt || user.last_login_at))) +
  '</tr>'));
}

function renderActionItems(items) {
  return table(["Task", "Meeting", "Assignee", "Due", "Priority", "Status"], items.map((item) => '<tr>' +
    td(escapeHtml(item.task)) +
    td('<a href="/meetings/' + encodeURIComponent(item.meeting_id) + '">' + escapeHtml(item.meeting_title || item.meeting_id) + '</a>') +
    td(escapeHtml(item.assignee_text || "-")) +
    td(escapeHtml(item.due_date || "-")) +
    td(pill(item.priority)) +
    td(pill(item.status)) +
  '</tr>'));
}

function renderAuditLogs(logs) {
  return table(["Time", "Action", "Target", "Actor", "Metadata"], logs.map((log) => '<tr>' +
    td(escapeHtml(formatDate(log.created_at))) +
    td(pill(log.action)) +
    td(escapeHtml((log.target_type || "-") + (log.target_id ? ": " + log.target_id : ""))) +
    td(escapeHtml(log.actor_user_id || "-")) +
    td(escapeHtml(log.metadata_json || "{}"), "mono") +
  '</tr>'));
}

function renderJobs(jobs) {
  return table(["Created", "Type", "Status", "Attempts", "Meeting", "Error"], jobs.map((job) => '<tr>' +
    td(escapeHtml(formatDate(job.created_at))) +
    td(escapeHtml(job.job_type)) +
    td(pill(job.status)) +
    td(escapeHtml(job.attempts || 0)) +
    td(escapeHtml(job.meeting_id || "-")) +
    td(escapeHtml(job.error_message || "-")) +
  '</tr>'));
}

function renderSettings(settings) {
  return table(["Setting", "Value", "Updated"], settings.map((setting) => '<tr>' +
    td(escapeHtml(setting.key)) +
    td(escapeHtml(setting.value_json), "mono") +
    td(escapeHtml(formatDate(setting.updated_at))) +
  '</tr>'));
}

function renderIntegrations(json) {
  const secretRows = Object.entries(json.required_secrets || {}).map(([key, value]) => '<tr>' + td(escapeHtml(key)) + td(pill(value ? "configured" : "missing")) + td("") + '</tr>');
  const integrationRows = (json.integrations || []).map((integration) => '<tr>' + td(escapeHtml(integration.provider)) + td(pill(integration.status)) + td(escapeHtml(integration.config_json || "{}"), "mono") + '</tr>');
  return table(["Integration", "Status", "Details"], secretRows.concat(integrationRows));
}

function renderUsage(usage) {
  return table(["Provider", "Model", "Operation", "Calls", "Input", "Output", "Cost"], usage.map((row) => '<tr>' +
    td(escapeHtml(row.provider)) +
    td(escapeHtml(row.model || "-")) +
    td(escapeHtml(row.operation)) +
    td(escapeHtml(row.calls || 0)) +
    td(escapeHtml(row.input_tokens || 0)) +
    td(escapeHtml(row.output_tokens || 0)) +
    td(escapeHtml(row.cost_estimate_usd || 0)) +
  '</tr>'));
}

function renderStorage(json) {
  return '<div class="status-grid">' +
    '<div class="status-card"><span>Recording objects</span><strong>' + escapeHtml(json.recordings?.count || 0) + '</strong></div>' +
    '<div class="status-card"><span>Recording bytes</span><strong>' + escapeHtml(formatBytes(json.recordings?.bytes)) + '</strong></div>' +
    '<div class="status-card"><span>Transcripts</span><strong>' + escapeHtml(json.transcripts?.count || 0) + '</strong></div>' +
    '<div class="status-card"><span>Transcript words</span><strong>' + escapeHtml(json.transcripts?.word_count || 0) + '</strong></div>' +
  '</div>';
}

function renderSearchResults(json) {
  return table(["Meeting", "Date", "Snippet"], (json.results || []).map((result) => '<tr>' +
    td('<a href="/meetings/' + encodeURIComponent(result.id) + '">' + escapeHtml(result.title) + '</a>') +
    td(escapeHtml(formatDate(result.meeting_datetime))) +
    td(escapeHtml(result.transcript_preview || result.parsed_notes_json || "-")) +
  '</tr>'));
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
  const putResponse = await fetch(uploadInfo.upload_url, { method: "PUT", body: blob, headers: { "content-type": blob.type || "application/octet-stream" } });
  if (!putResponse.ok) {
    const putText = await putResponse.text();
    throw new Error(putText || "Recording upload failed with status " + putResponse.status);
  }
  const completeResponse = await fetch("/api/recordings/complete-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ upload_session_id: uploadInfo.upload_session_id })
  });
  const completeJson = await completeResponse.json();
  if (!completeResponse.ok) throw new Error(JSON.stringify(completeJson));
  return completeJson;
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

$("#manualTranscriptForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = $("#manualTranscriptResult");
  try {
    const payload = { transcript_text: form.transcript_text.value };
    if (form.language.value) payload.language = form.language.value;
    const response = await fetch("/api/meetings/" + encodeURIComponent(form.dataset.meetingId) + "/transcript/manual-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(json));
    result.textContent = JSON.stringify(json, null, 2);
  } catch (error) {
    result.textContent = error.message || String(error);
  }
});

let recorder, chunks = [], startedAt = 0, timerId = 0, stream;
function setRecorderButtons(state) {
  if (!$("#startRecording")) return;
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
  if (!form.reportValidity()) return;
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

for (const toolbar of $$(".toolbar")) {
  const panel = toolbar.parentElement?.querySelector("[data-load-base]");
  if (!panel) continue;
  const reload = () => {
    const url = new URL(panel.dataset.loadBase, window.location.origin);
    for (const input of toolbar.querySelectorAll("[data-filter]")) {
      if (input.value) url.searchParams.set(input.dataset.filter, input.value);
    }
    panel.dataset.load = url.pathname + url.search;
    const existing = panel.querySelector(".table-wrap, .empty-state, .error-state, .json-output, .status-grid");
    if (existing) existing.outerHTML = '<div class="json-output">Loading...</div>';
    loadPanel(panel);
  };
  toolbar.addEventListener("input", reload);
  toolbar.addEventListener("change", reload);
}
`;
