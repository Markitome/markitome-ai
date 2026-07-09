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
  return <Shell user={user} path={path}>{page}</Shell>;
}

function Shell({ user, path, children }: { user: AppUser; path: string; children: React.ReactNode }) {
  const isAdmin = user.roles.includes("admin") || user.roles.includes("super_admin");
  const isSuperAdmin = user.roles.includes("super_admin");
  const navItems = [
    { href: "/dashboard", label: "Home" },
    { href: "/today", label: "Today" },
    { href: "/library", label: "Library" },
    { href: "/recordings", label: "Recordings" },
    { href: "/clips", label: "Clips" },
    { href: "/ask", label: "Ask AI" },
    { href: "/templates", label: "Templates" },
    { href: "/automations", label: "Automations" },
    { href: "/upload", label: "Upload" },
    { href: "/screen-recording", label: "Screen recorder" },
    { href: "/action-items", label: "Action items" },
    { href: "/search", label: "Search" }
  ];
  const adminItems = [
    { href: "/admin", label: "Admin dashboard" },
    { href: "/admin/meetings", label: "All meetings" },
    { href: "/admin/recordings", label: "All recordings" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/failures", label: "Failures" },
    { href: "/admin/audit-logs", label: "Audit logs" }
  ];
  const superAdminItems = [
    { href: "/settings", label: "System settings" },
    { href: "/integrations", label: "Integrations" },
    { href: "/api-usage", label: "API usage" },
    { href: "/storage-usage", label: "Storage usage" },
    { href: "/queue-logs", label: "Queue logs" }
  ];
  const initials = getInitials(user.name || user.email);
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <a className="brand" href="/dashboard" aria-label="Markitome AI Notetaker dashboard">
          <span className="brand-mark">M</span>
          <span>
            <strong>Markitome</strong>
            <small>AI Notetaker</small>
          </span>
        </a>
        <nav className="side-nav">
          {navItems.map((item) => <a key={item.href} className={isActive(path, item.href) ? "active" : ""} href={item.href}>{item.label}</a>)}
        </nav>
        {isAdmin ? (
          <div className="nav-section">
            <p>Admin</p>
            <nav className="side-nav">
              {adminItems.map((item) => <a key={item.href} className={isActive(path, item.href) ? "active" : ""} href={item.href}>{item.label}</a>)}
            </nav>
          </div>
        ) : null}
        {isSuperAdmin ? (
          <div className="nav-section">
            <p>Super admin</p>
            <nav className="side-nav">
              {superAdminItems.map((item) => <a key={item.href} className={isActive(path, item.href) ? "active" : ""} href={item.href}>{item.label}</a>)}
            </nav>
          </div>
        ) : null}
        <div className="sidebar-footer">
          <div className="user-chip">
            <span>{initials}</span>
            <div>
              <strong>{user.name || "Markitome user"}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <form method="post" action="/api/auth/logout">
            <button className="ghost-button" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-topbar">
          <form className="global-search" action="/search">
            <input name="q" placeholder="Search meetings, transcripts, decisions..." />
          </form>
          <div className="quick-actions">
            <a className="secondary" href="/meetings/new">New meeting</a>
            <a className="secondary" href="/screen-recording">Record screen</a>
            <a className="primary" href="/upload">Upload recording</a>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

function isActive(path: string, href: string) {
  if (href === "/dashboard") return path === "/" || path === "/dashboard";
  if (href === "/library") return path === "/library" || path === "/library/" || path === "/meetings" || path.startsWith("/meetings/");
  return path === href || path.startsWith(`${href}/`);
}

function getInitials(value: string) {
  const parts = value.split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M";
}

function selectPage(path: string, user: AppUser) {
  if (path === "/" || path === "/dashboard") return <Dashboard user={user} />;
  if (path === "/today") return <TodayPage />;
  if (path === "/meetings" || path === "/library" || path === "/library/") return <Library title="Meeting Library" endpoint="/api/meetings" />;
  if (path === "/meetings/new") return <NewMeetingPage />;
  if (path === "/recordings") return <Library title="My Recordings" endpoint="/api/recordings" />;
  if (path === "/clips") return <ClipsPage />;
  if (path === "/ask") return <AskAiPage />;
  if (path === "/templates") return <TemplatesPage />;
  if (path === "/automations") return <AutomationsPage />;
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
    <main className="auth auth-split">
      <section className="auth-welcome">
        <div>
          <p className="eyebrow">Internal workspace</p>
          <h1>Welcome to Markitome</h1>
          <p>Record, transcribe, search, and share meeting knowledge with consent-first controls.</p>
        </div>
      </section>
      <section className="auth-card">
        <div className="login-mark">M</div>
        <h1>Log in to Markitome</h1>
        <p className="workspace-url">notetaker.markitome.ai</p>
        <a className="google-button" href="/api/auth/login"><span>G</span>Continue with Google</a>
        <p className="auth-copy">Use your Markitome Google account. External access requires admin approval.</p>
        <p className="legal-copy">By continuing, you acknowledge Markitome recording consent and retention policies.</p>
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

function TodayPage() {
  return (
    <section className="stack">
      <div className="heading">
        <div>
          <p className="eyebrow">Today</p>
          <h1>Meeting Command Center</h1>
        </div>
        <div className="actions">
          <a className="primary" href="/meetings/new">Create agenda</a>
          <a href="/ask">Ask AI</a>
        </div>
      </div>
      <div className="feature-grid">
        <article className="feature-card">
          <span>Prep</span>
          <h2>Pre-meeting brief</h2>
          <p>Review agenda, participants, previous notes, open action items, and consent status before the call.</p>
        </article>
        <article className="feature-card">
          <span>Run</span>
          <h2>Collaborative notes</h2>
          <p>Use agendas, manual notes, decisions, and action items as the live meeting workspace.</p>
        </article>
        <article className="feature-card">
          <span>Follow-up</span>
          <h2>AI recap</h2>
          <p>Generate summaries, decisions, topics, action items, risks, blockers, and follow-up email drafts.</p>
        </article>
      </div>
      <Library title="Upcoming and recent meetings" endpoint="/api/meetings" />
    </section>
  );
}

function NewMeetingPage() {
  return (
    <section className="stack">
      <div className="heading">
        <div>
          <p className="eyebrow">Agenda builder</p>
          <h1>New Meeting Note</h1>
        </div>
        <a className="secondary" href="/templates">Browse templates</a>
      </div>
      <form id="newMeetingForm" className="form">
        <label>Meeting title<input name="title" required placeholder="Weekly growth review" /></label>
        <label>Date/time<input name="meeting_datetime" type="datetime-local" required /></label>
        <label>Platform<select name="platform" required>
          <option value="google_meet">Google Meet</option>
          <option value="zoom">Zoom</option>
          <option value="microsoft_teams">Microsoft Teams</option>
          <option value="other">Other</option>
        </select></label>
        <label>Visibility<select name="visibility">
          <option value="private">Private</option>
          <option value="shared">Shared</option>
          <option value="company">Company</option>
        </select></label>
        <label>Meeting URL<input name="meeting_url" type="url" placeholder="https://meet.google.com/..." /></label>
        <label>Participants<textarea name="participants" placeholder="One name or email per line" /></label>
        <label>Agenda<textarea name="agenda" placeholder="1. Wins and blockers&#10;2. Pipeline review&#10;3. Decisions needed" /></label>
        <label>Private/manual notes<textarea name="manual_notes" placeholder="Context, reminders, or notes to bring into the meeting" /></label>
        <button type="submit">Create meeting note</button>
      </form>
      <pre id="newMeetingResult" className="json-output"></pre>
    </section>
  );
}

function AskAiPage() {
  return (
    <section className="stack">
      <div className="heading">
        <div>
          <p className="eyebrow">Ask AI</p>
          <h1>Ask Markitome</h1>
        </div>
      </div>
      <section className="panel">
        <h2>Meeting knowledge search</h2>
        <form id="searchForm" className="ask-form">
          <textarea name="q" placeholder="Ask about any meeting you can access. Example: What decisions did we make about Q3 pipeline?" required />
          <button type="submit">Search meetings</button>
        </form>
        <div className="suggestion-row">
          <button data-ask="Show open action items from the last 30 days">Open actions</button>
          <button data-ask="Find risks or blockers mentioned in recent meetings">Risks and blockers</button>
          <button data-ask="Draft follow-up points from client calls">Follow-up points</button>
        </div>
      </section>
      <pre id="searchResult" className="json-output"></pre>
    </section>
  );
}

function TemplatesPage() {
  const templates = [
    ["1:1", "Wins, blockers, feedback, growth, next steps"],
    ["Team standup", "Priorities, blockers, metrics, owners"],
    ["Customer call", "Pain points, requirements, objections, follow-up"],
    ["Pipeline review", "Deals, risks, next actions, forecast decisions"],
    ["Project retro", "What worked, what did not, experiments"],
    ["Board update", "Metrics, decisions, asks, risks"]
  ];
  return (
    <section className="stack">
      <div className="heading">
        <div>
          <p className="eyebrow">Templates</p>
          <h1>Meeting Template Library</h1>
        </div>
        <a className="primary" href="/meetings/new">Use template</a>
      </div>
      <div className="feature-grid">
        {templates.map(([title, copy]) => (
          <article className="feature-card" key={title}>
            <span>Template</span>
            <h2>{title}</h2>
            <p>{copy}</p>
            <a href={`/meetings/new?template=${encodeURIComponent(title)}`}>Create note</a>
          </article>
        ))}
      </div>
    </section>
  );
}

function AutomationsPage() {
  return (
    <section className="stack">
      <div className="heading">
        <div>
          <p className="eyebrow">Automations</p>
          <h1>Meeting Automations</h1>
        </div>
      </div>
      <div className="notice">Automation controls are consent-first. Bot recording still requires confirmed consent before joining or recording.</div>
      <section className="panel">
        <h2>Rules</h2>
        <form id="automationForm" className="settings-list">
          <label className="toggle-row"><input type="checkbox" name="auto_agenda" /> Auto-create meeting notes from calendar events</label>
          <label className="toggle-row"><input type="checkbox" name="agenda_reminders" /> Remind participants to add agenda items before meetings</label>
          <label className="toggle-row"><input type="checkbox" name="auto_summary" /> Generate AI recap after transcript completion</label>
          <label className="toggle-row"><input type="checkbox" name="follow_up_email" /> Draft follow-up email after each completed meeting</label>
          <label className="toggle-row"><input type="checkbox" name="crm_update" /> Prepare CRM update suggestions for customer calls</label>
          <button type="submit">Save automation draft</button>
        </form>
        <pre id="automationResult" className="json-output"></pre>
      </section>
    </section>
  );
}

function ClipsPage() {
  return (
    <section className="stack">
      <div className="heading">
        <div>
          <p className="eyebrow">Clips</p>
          <h1>Recordings and Shareable Moments</h1>
        </div>
        <a className="primary" href="/recordings">View recordings</a>
      </div>
      <div className="feature-grid">
        <article className="feature-card">
          <span>Recording library</span>
          <h2>Centralized recordings</h2>
          <p>Recordings are stored in R2 with role-based access, download controls, audit logs, and processing status.</p>
        </article>
        <article className="feature-card">
          <span>Clips</span>
          <h2>Clip workflow</h2>
          <p>Create short shareable moments from recordings after transcript timestamps are available.</p>
        </article>
        <article className="feature-card">
          <span>Privacy</span>
          <h2>Consent and sharing</h2>
          <p>Recording access follows owner, sharing, admin, and super admin permissions.</p>
        </article>
      </div>
      <Library title="Recording Library" endpoint="/api/recordings" />
    </section>
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
        <div>
          <p className="eyebrow">Meeting workspace</p>
          <h1>Meeting Note</h1>
        </div>
        <button className="secondary" data-regenerate-notes={meetingId}>Regenerate AI notes</button>
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
:root {
  color-scheme: light;
  --ink:#171426;
  --muted:#726f7f;
  --soft:#8b8797;
  --line:#e6e2eb;
  --bg:#f7f4fb;
  --panel:#ffffff;
  --nav:#2b174f;
  --nav-2:#392064;
  --accent:#6f4bd8;
  --accent-2:#4d2fb4;
  --accent-soft:#f0ebff;
  --success:#15803d;
  --warn:#9a5b12;
  --danger:#b42318;
  --shadow:0 18px 45px rgba(52, 35, 91, .10);
}
* { box-sizing:border-box; }
html { min-height:100%; background:var(--bg); }
body {
  min-height:100vh;
  margin:0;
  font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color:var(--ink);
  background:
    radial-gradient(circle at top left, rgba(111, 75, 216, .10), transparent 34rem),
    linear-gradient(180deg, #faf8fd 0%, #f3eff9 100%);
}
a { color:inherit; text-decoration:none; }
button, input, select, textarea { font:inherit; }
button, .primary, .secondary, .actions a {
  min-height:38px;
  border:1px solid var(--line);
  background:#fff;
  border-radius:8px;
  padding:9px 14px;
  font-weight:700;
  cursor:pointer;
  box-shadow:0 1px 1px rgba(30, 23, 52, .04);
}
.primary, .actions a.primary, button[type=submit] {
  background:var(--accent);
  color:#fff;
  border-color:var(--accent);
}
.primary:hover, button[type=submit]:hover { background:var(--accent-2); border-color:var(--accent-2); }
.secondary { color:var(--accent-2); background:#fff; }
.ghost-button { width:100%; color:#ede8ff; background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.14); }
.app-shell { min-height:100vh; display:grid; grid-template-columns:280px minmax(0, 1fr); }
.sidebar {
  position:sticky;
  top:0;
  height:100vh;
  display:flex;
  flex-direction:column;
  gap:18px;
  padding:20px 16px;
  color:#f8f5ff;
  background:linear-gradient(180deg, var(--nav) 0%, #241142 100%);
  overflow:auto;
}
.brand {
  display:flex;
  align-items:center;
  gap:12px;
  padding:4px 6px 16px;
  border-bottom:1px solid rgba(255,255,255,.10);
}
.brand-mark, .login-mark {
  display:grid;
  place-items:center;
  width:42px;
  height:42px;
  border-radius:50%;
  background:#fff;
  color:var(--accent-2);
  font-weight:900;
  box-shadow:0 12px 28px rgba(23, 12, 48, .24);
}
.brand strong { display:block; font-size:16px; line-height:1.15; }
.brand small { display:block; margin-top:2px; color:#cfc6ef; font-size:12px; }
.side-nav { display:grid; gap:4px; }
.side-nav a {
  min-height:38px;
  display:flex;
  align-items:center;
  padding:9px 12px;
  color:#dfd8f5;
  border-radius:8px;
  font-size:14px;
  font-weight:650;
}
.side-nav a:hover, .side-nav a.active { color:#fff; background:rgba(255,255,255,.12); }
.nav-section { display:grid; gap:8px; }
.nav-section p {
  margin:0 12px;
  color:#b8addb;
  font-size:11px;
  font-weight:900;
  text-transform:uppercase;
  letter-spacing:.08em;
}
.sidebar-footer { margin-top:auto; display:grid; gap:12px; }
.user-chip {
  display:grid;
  grid-template-columns:38px minmax(0, 1fr);
  gap:10px;
  align-items:center;
  padding:10px;
  border:1px solid rgba(255,255,255,.12);
  border-radius:12px;
  background:rgba(255,255,255,.07);
}
.user-chip > span {
  display:grid;
  place-items:center;
  width:38px;
  height:38px;
  border-radius:50%;
  background:#fff;
  color:var(--accent-2);
  font-weight:900;
}
.user-chip strong, .user-chip small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.user-chip strong { font-size:13px; }
.user-chip small { margin-top:2px; color:#d8d0f3; font-size:12px; }
.workspace { min-width:0; }
.workspace-topbar {
  position:sticky;
  top:0;
  z-index:3;
  min-height:74px;
  display:flex;
  gap:16px;
  align-items:center;
  justify-content:space-between;
  padding:16px 32px;
  background:rgba(250,248,253,.86);
  border-bottom:1px solid rgba(230,226,235,.78);
  backdrop-filter:blur(16px);
}
.global-search { flex:1; max-width:640px; }
.quick-actions, .actions, .toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
main { width:min(1180px, calc(100% - 48px)); margin:30px auto 72px; }
.auth { width:100%; max-width:none; min-height:100vh; margin:0; }
.auth-split { display:grid; grid-template-columns:minmax(320px, 43%) minmax(0, 1fr); background:#fff; }
.auth-welcome {
  display:grid;
  place-items:center;
  min-height:100vh;
  padding:48px;
  color:#fff;
  background:
    linear-gradient(150deg, rgba(45, 21, 85, .96), rgba(100, 67, 192, .94)),
    radial-gradient(circle at 30% 18%, rgba(255,255,255,.22), transparent 18rem);
}
.auth-welcome div { width:min(420px, 100%); }
.auth-welcome h1 { margin:10px 0 16px; font-size:48px; line-height:1.04; }
.auth-welcome p:not(.eyebrow) { color:#ebe7ff; font-size:18px; line-height:1.55; }
.auth-card {
  min-height:100vh;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  width:min(440px, calc(100% - 48px));
  margin:0 auto;
  text-align:center;
}
.auth-card h1 { margin:22px 0 6px; font-size:30px; line-height:1.15; }
.workspace-url { margin:0 0 24px; color:var(--muted); font-size:14px; }
.google-button {
  width:100%;
  min-height:48px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:12px;
  white-space:nowrap;
  border:1px solid var(--line);
  border-radius:8px;
  color:var(--ink);
  background:#fff;
  font-weight:800;
  box-shadow:0 8px 22px rgba(52, 35, 91, .08);
}
.google-button span {
  display:grid;
  place-items:center;
  width:24px;
  height:24px;
  border:1px solid var(--line);
  border-radius:50%;
  color:#4285f4;
  font-weight:900;
}
.auth-copy, .legal-copy { color:var(--muted); line-height:1.55; }
.auth-copy { margin:18px 0 8px; font-size:14px; }
.legal-copy { margin:0; font-size:12px; }
.eyebrow {
  margin:0;
  color:var(--accent-2);
  font-size:12px;
  font-weight:900;
  text-transform:uppercase;
  letter-spacing:.08em;
}
.auth-welcome .eyebrow { color:#dcd4ff; }
.heading {
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:18px;
}
.heading h1 { margin:5px 0 0; font-size:34px; line-height:1.15; letter-spacing:0; }
.stack { display:grid; gap:20px; }
.grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
.feature-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
.feature-card {
  display:grid;
  gap:10px;
  align-content:start;
  min-height:160px;
  padding:18px;
  border:1px solid var(--line);
  border-radius:12px;
  background:#fff;
  box-shadow:0 8px 24px rgba(52,35,91,.06);
}
.feature-card span {
  color:var(--accent-2);
  font-size:11px;
  font-weight:900;
  text-transform:uppercase;
  letter-spacing:.08em;
}
.feature-card h2 { margin:0; font-size:18px; }
.feature-card p { margin:0; color:var(--muted); line-height:1.5; }
.feature-card a { color:var(--accent-2); font-weight:850; }
.metric, .panel, .form, .recorder {
  background:rgba(255,255,255,.92);
  border:1px solid rgba(230,226,235,.95);
  border-radius:12px;
  padding:20px;
  box-shadow:var(--shadow);
}
.metric span { color:var(--muted); display:block; font-size:13px; font-weight:750; }
.metric strong { display:block; margin-top:10px; font-size:30px; line-height:1; }
.panel h2 { margin:0 0 14px; font-size:20px; }
.form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; max-width:920px; }
.form label:has(textarea), .form label:has(input[type=file]), .form .check, .form progress, .form button, .form + .json-output { grid-column:1 / -1; }
label { display:grid; gap:7px; color:var(--muted); font-size:13px; font-weight:750; }
.check { display:flex; align-items:center; gap:8px; color:var(--ink); }
input, select, textarea {
  width:100%;
  border:1px solid var(--line);
  border-radius:8px;
  padding:10px 12px;
  background:#fff;
  color:var(--ink);
  outline:none;
}
input:focus, select:focus, textarea:focus {
  border-color:#b5a2ee;
  box-shadow:0 0 0 3px rgba(111,75,216,.16);
}
textarea { min-height:106px; resize:vertical; }
.toolbar {
  padding:12px;
  border:1px solid rgba(230,226,235,.92);
  border-radius:12px;
  background:rgba(255,255,255,.72);
  box-shadow:0 8px 24px rgba(52,35,91,.06);
}
.toolbar input { flex:1 1 260px; }
.toolbar select { flex:0 1 210px; }
.notice {
  border:1px solid #ead29c;
  color:var(--warn);
  background:#fff8e7;
  padding:14px 16px;
  border-radius:10px;
  font-weight:750;
}
.meeting-hero {
  display:grid;
  gap:10px;
  padding:22px;
  border:1px solid var(--line);
  border-radius:14px;
  background:linear-gradient(135deg, #fff, #f8f4ff);
}
.meeting-hero h2 { margin:0; font-size:28px; }
.meeting-meta { display:flex; flex-wrap:wrap; gap:8px; color:var(--muted); }
.notes-layout { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:14px; }
.note-box {
  min-height:150px;
  padding:16px;
  border:1px solid var(--line);
  border-radius:12px;
  background:#fff;
  white-space:pre-wrap;
  line-height:1.55;
}
.section-list { display:grid; gap:10px; }
.section-item {
  padding:14px;
  border:1px solid var(--line);
  border-radius:10px;
  background:#fff;
}
.section-item strong { display:block; margin-bottom:5px; }
.section-item p { margin:0; color:var(--muted); line-height:1.5; }
.ask-form { display:grid; gap:12px; }
.ask-form textarea { min-height:120px; }
.suggestion-row { display:flex; flex-wrap:wrap; gap:10px; margin-top:12px; }
.suggestion-row button, .toggle-row {
  border:1px solid var(--line);
  border-radius:999px;
  background:#fff;
  color:var(--accent-2);
  font-size:13px;
}
.settings-list { display:grid; gap:12px; }
.toggle-row {
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px 14px;
  border-radius:10px;
  color:var(--ink);
}
.json-output {
  white-space:pre-wrap;
  overflow:auto;
  color:#332b43;
  background:#f3eff8;
  padding:14px;
  border:1px solid #e8e2f0;
  border-radius:10px;
  min-height:84px;
}
.status-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; }
.status-card {
  border:1px solid var(--line);
  border-radius:12px;
  padding:16px;
  background:#fff;
}
.status-card span { display:block; color:var(--muted); font-size:12px; text-transform:uppercase; font-weight:900; letter-spacing:.05em; }
.status-card strong { display:block; margin-top:8px; font-size:24px; }
.library-list {
  display:grid;
  gap:10px;
}
.library-row {
  display:grid;
  grid-template-columns:minmax(0, 1.5fr) minmax(180px, .75fr) minmax(160px, .6fr) auto;
  gap:16px;
  align-items:center;
  padding:16px;
  border:1px solid var(--line);
  border-radius:12px;
  background:#fff;
  box-shadow:0 8px 24px rgba(52,35,91,.06);
}
.library-row:hover { border-color:#d6c9f6; background:#fdfbff; }
.library-title {
  display:flex;
  flex-direction:column;
  min-width:0;
  gap:6px;
}
.library-title a { color:var(--ink); font-size:15px; font-weight:850; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.library-title small, .library-meta small { color:var(--muted); font-size:12px; line-height:1.4; }
.library-meta { display:grid; gap:5px; min-width:0; }
.library-meta strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; }
.table-wrap {
  overflow:auto;
  border:1px solid var(--line);
  border-radius:12px;
  background:#fff;
  box-shadow:0 8px 24px rgba(52,35,91,.06);
}
table { width:100%; border-collapse:separate; border-spacing:0; min-width:780px; background:#fff; }
th, td { text-align:left; border-bottom:1px solid var(--line); padding:13px 14px; vertical-align:middle; font-size:14px; }
th {
  position:sticky;
  top:0;
  color:#5b536d;
  background:#fbf9fd;
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:.06em;
}
tbody tr:hover { background:#fbf9ff; }
tr:last-child td { border-bottom:0; }
td a { color:var(--accent-2); font-weight:800; }
.pill {
  display:inline-flex;
  align-items:center;
  border-radius:999px;
  padding:5px 9px;
  background:var(--accent-soft);
  color:var(--accent-2);
  font-size:12px;
  font-weight:850;
}
.empty-state {
  color:var(--muted);
  background:#fff;
  border:1px dashed var(--line);
  border-radius:12px;
  padding:18px;
}
.error-state {
  color:var(--danger);
  background:#fff5f5;
  border:1px solid #ffd0d0;
  border-radius:10px;
  padding:14px;
  font-weight:750;
}
.mono { font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size:12px; }
progress { width:100%; height:12px; accent-color:var(--accent); }
video { width:100%; max-height:420px; background:#120c20; border-radius:12px; box-shadow:var(--shadow); }
@media (max-width: 980px) {
  .app-shell { grid-template-columns:1fr; }
  .sidebar { position:relative; height:auto; border-radius:0 0 18px 18px; }
  .side-nav { grid-template-columns:repeat(auto-fit,minmax(142px,1fr)); }
  .workspace-topbar { position:relative; padding:14px 20px; flex-direction:column; align-items:stretch; }
  .global-search { max-width:none; }
  main { width:min(100% - 28px, 980px); margin:22px auto 54px; }
  .grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .feature-grid { grid-template-columns:1fr; }
  .form { grid-template-columns:1fr; }
  .notes-layout { grid-template-columns:1fr; }
  .library-row { grid-template-columns:1fr; align-items:start; }
}
@media (max-width: 820px) {
  .auth-split { grid-template-columns:1fr; }
  .auth-welcome { min-height:34vh; padding:34px 24px; }
  .auth-welcome h1 { font-size:34px; }
  .auth-card { min-height:66vh; width:min(100% - 32px, 440px); }
}
@media (max-width: 720px) {
  .heading { align-items:flex-start; flex-direction:column; }
  .heading h1 { font-size:28px; }
  .grid { grid-template-columns:1fr; }
  .quick-actions { flex-direction:column; align-items:stretch; }
  .quick-actions a, .actions a, button { width:100%; text-align:center; }
}
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
  if (json.meeting) return renderMeetingBundle(json.meeting);
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
  if (!meetings.length) return emptyState("No meetings found.");
  return '<div class="library-list">' + meetings.map((meeting) => '<article class="library-row">' +
    '<div class="library-title">' +
      '<a href="/meetings/' + encodeURIComponent(meeting.id) + '">' + escapeHtml(meeting.title || "Untitled meeting") + '</a>' +
      '<small>' + escapeHtml(meeting.source_type || "-") + ' · ' + escapeHtml(meeting.owner_email || meeting.owner_user_id || "No owner") + '</small>' +
    '</div>' +
    '<div class="library-meta"><small>Date</small><strong>' + escapeHtml(formatDate(meeting.meeting_datetime)) + '</strong></div>' +
    '<div class="library-meta"><small>Platform</small><strong>' + pill(meeting.platform) + '</strong></div>' +
    '<div>' + pill(meeting.processing_status) + '</div>' +
  '</article>').join("") + '</div>';
}

function renderRecordings(recordings) {
  if (!recordings.length) return emptyState("No recordings found.");
  return '<div class="library-list">' + recordings.map((recording) => '<article class="library-row">' +
    '<div class="library-title">' +
      '<a href="/meetings/' + encodeURIComponent(recording.meeting_id) + '">' + escapeHtml(recording.meeting_title || recording.original_filename || recording.id) + '</a>' +
      '<small>' + escapeHtml(recording.original_filename || "Recording") + ' · ' + escapeHtml(recording.owner_email || recording.owner_user_id || "No owner") + '</small>' +
    '</div>' +
    '<div class="library-meta"><small>Type</small><strong>' + pill(recording.source_type) + '</strong></div>' +
    '<div class="library-meta"><small>Size</small><strong>' + escapeHtml(formatBytes(recording.file_size)) + '</strong></div>' +
    '<div>' + pill(recording.processing_status) + '</div>' +
    (recording.error_message ? '<div class="error-state">' + escapeHtml(recording.error_message) + '</div>' : "") +
  '</article>').join("") + '</div>';
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

function renderMeetingBundle(meeting) {
  const participants = meeting.participants || [];
  const recordings = meeting.recordings || [];
  const actions = meeting.action_items || [];
  const decisions = meeting.decisions || [];
  const topics = meeting.topics || [];
  const notes = safeJson(meeting.ai_notes?.parsed_notes_json);
  const manualNotes = meeting.manual_notes || meeting.manual_note || "";
  const hero = '<div class="meeting-hero">' +
    '<h2>' + escapeHtml(meeting.title || "Untitled meeting") + '</h2>' +
    '<div class="meeting-meta">' +
      pill(meeting.platform) + pill(meeting.source_type) + pill(meeting.processing_status) +
      '<span>' + escapeHtml(formatDate(meeting.meeting_datetime)) + '</span>' +
      '<span>' + escapeHtml(meeting.owner_email || "") + '</span>' +
    '</div>' +
  '</div>';
  const prep = '<div class="notes-layout">' +
    '<section><h2>Agenda</h2><div class="note-box">' + escapeHtml(meeting.agenda || "No agenda yet.") + '</div></section>' +
    '<section><h2>Manual notes</h2><div class="note-box">' + escapeHtml(manualNotes || "No manual notes yet.") + '</div></section>' +
  '</div>';
  const ai = '<section><h2>AI summary</h2><div class="note-box">' + escapeHtml(notes?.summary || meeting.ai_notes?.rendered_markdown || "AI notes will appear after transcription completes.") + '</div></section>';
  const followUp = '<section><h2>Follow-up email draft</h2><div class="note-box">' + escapeHtml(notes?.follow_up_email_draft || "No follow-up draft yet.") + '</div></section>';
  return hero +
    '<div class="status-grid">' +
      '<div class="status-card"><span>Participants</span><strong>' + escapeHtml(participants.length) + '</strong></div>' +
      '<div class="status-card"><span>Recordings</span><strong>' + escapeHtml(recordings.length) + '</strong></div>' +
      '<div class="status-card"><span>Action items</span><strong>' + escapeHtml(actions.length) + '</strong></div>' +
      '<div class="status-card"><span>Decisions</span><strong>' + escapeHtml(decisions.length) + '</strong></div>' +
    '</div>' +
    prep + ai +
    renderSectionList("Participants", participants, (item) => escapeHtml(item.name || item.email || "Participant"), (item) => escapeHtml(item.email || "")) +
    renderSectionList("Suggested action items", actions, (item) => escapeHtml(item.task), (item) => [item.assignee_text, item.due_date, item.priority, item.status].filter(Boolean).map(escapeHtml).join(" · ")) +
    renderSectionList("Decisions", decisions, (item) => escapeHtml(item.decision), (item) => escapeHtml(item.owner_text || item.source_quote || "")) +
    renderSectionList("Topic overview", topics, (item) => escapeHtml(item.topic), (item) => escapeHtml(item.summary || "")) +
    renderSectionList("Recordings", recordings, (item) => escapeHtml(item.original_filename || item.id), (item) => [item.source_type, item.processing_status, formatBytes(item.file_size)].filter(Boolean).map(escapeHtml).join(" · ")) +
    '<section><h2>Transcript</h2><div class="note-box">' + escapeHtml(meeting.transcript?.transcript_preview || "Transcript preview will appear after processing.") + '</div></section>' +
    followUp;
}

function renderSectionList(title, items, titleSelector, detailSelector) {
  if (!items?.length) return '<section><h2>' + escapeHtml(title) + '</h2>' + emptyState("Nothing here yet.") + '</section>';
  return '<section><h2>' + escapeHtml(title) + '</h2><div class="section-list">' + items.map((item) => '<div class="section-item"><strong>' + titleSelector(item) + '</strong><p>' + detailSelector(item) + '</p></div>').join("") + '</div></section>';
}

function safeJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
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

$("#newMeetingForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = $("#newMeetingResult");
  try {
    const platform = form.platform.value;
    const payload = {
      title: form.title.value,
      meeting_datetime: new Date(form.meeting_datetime.value).toISOString(),
      platform,
      source_type: platform,
      meeting_url: form.meeting_url.value || null,
      participants: parseParticipants(form.participants.value),
      agenda: form.agenda.value,
      manual_notes: form.manual_notes.value,
      visibility: form.visibility.value
    };
    const response = await fetch("/api/meetings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(json));
    result.textContent = "Meeting note created. Opening workspace...";
    window.location.href = "/meetings/" + encodeURIComponent(json.meeting.id);
  } catch (error) {
    result.textContent = error.message || String(error);
  }
});

$("#searchForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await fetch("/api/search?q=" + encodeURIComponent(event.currentTarget.q.value));
  $("#searchResult").textContent = JSON.stringify(await response.json(), null, 2);
});

for (const button of $$("[data-ask]")) {
  button.addEventListener("click", () => {
    const form = $("#searchForm");
    if (!form) return;
    form.q.value = button.dataset.ask;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

$("#automationForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(Array.from(form.elements).filter((el) => el.name).map((el) => [el.name, Boolean(el.checked)]));
  localStorage.setItem("markitomeAutomationDraft", JSON.stringify(values));
  $("#automationResult").textContent = JSON.stringify({ saved: true, scope: "browser_draft", values }, null, 2);
});

for (const button of $$("[data-regenerate-notes]")) {
  button.addEventListener("click", async () => {
    const meetingId = button.dataset.regenerateNotes;
    button.disabled = true;
    button.textContent = "Queueing...";
    try {
      const response = await fetch("/api/meetings/" + encodeURIComponent(meetingId) + "/regenerate-ai-notes", { method: "POST" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || JSON.stringify(json));
      button.textContent = "Queued";
    } catch (error) {
      button.textContent = error.message || "Failed";
    }
  });
}

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
