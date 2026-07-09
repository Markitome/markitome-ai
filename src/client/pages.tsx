import React from "react";
import { renderToString } from "react-dom/server";
import type { AppUser } from "../types";

interface PageProps {
  user: AppUser | null;
  path: string;
}

type NavItem = { href: string; label: string };

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
  if (path === "/login") return <AuthPage />;
  if (path === "/unauthorized") return <AuthNotice title="Access pending" text="Access is restricted to approved Markitome users." />;
  if (path === "/setup-required") return <AuthNotice title="Google login is not configured" text="Set the production Google OAuth secrets in Cloudflare Workers, then retry login." />;
  if (!user) return <AuthPage />;
  return <Workspace user={user} path={path}>{selectPage(path, user)}</Workspace>;
}

function Workspace({ user, path, children }: { user: AppUser; path: string; children: React.ReactNode }) {
  const isAdmin = user.roles.includes("admin") || user.roles.includes("super_admin");
  const isSuperAdmin = user.roles.includes("super_admin");
  const primaryNav: NavItem[] = [
    { href: "/dashboard", label: "Home" },
    { href: "/today", label: "Today" },
    { href: "/calendar", label: "Calendar" },
    { href: "/library", label: "Library" },
    { href: "/recordings", label: "Recordings" },
    { href: "/action-items", label: "Action items" },
    { href: "/ask", label: "Ask AI" },
    { href: "/templates", label: "Templates" },
    { href: "/automations", label: "Automations" }
  ];
  const captureNav: NavItem[] = [
    { href: "/meetings/new", label: "New meeting note" },
    { href: "/upload", label: "Upload recording" },
    { href: "/screen-recorder", label: "Screen recorder" },
    { href: "/clips", label: "Clips" }
  ];
  const adminNav: NavItem[] = [
    { href: "/admin", label: "Admin dashboard" },
    { href: "/admin/meetings", label: "All meetings" },
    { href: "/admin/recordings", label: "All recordings" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/failures", label: "Failures" },
    { href: "/admin/audit-logs", label: "Audit logs" }
  ];
  const superNav: NavItem[] = [
    { href: "/settings", label: "Settings" },
    { href: "/integrations", label: "Integrations" },
    { href: "/api-usage", label: "API usage" },
    { href: "/storage-usage", label: "Storage usage" },
    { href: "/queue-logs", label: "Queue logs" }
  ];

  return (
    <div className="app">
      <aside className="rail">
        <a className="brand" href="/dashboard">
          <span className="brandMark">M</span>
          <span><strong>Markitome</strong><small>AI Notetaker</small></span>
        </a>
        <NavSection items={primaryNav} path={path} />
        <NavSection title="Capture" items={captureNav} path={path} />
        {isAdmin ? <NavSection title="Admin" items={adminNav} path={path} /> : null}
        {isSuperAdmin ? <NavSection title="Super admin" items={superNav} path={path} /> : null}
        <div className="railFooter">
          <div className="userCard"><span>{initials(user)}</span><div><strong>{user.name || "Markitome user"}</strong><small>{user.email}</small></div></div>
          <form method="post" action="/api/auth/logout"><button className="quietButton" type="submit">Sign out</button></form>
        </div>
      </aside>
      <section className="work">
        <header className="topbar">
          <form className="topSearch" action="/ask"><input name="q" placeholder="Search or ask across meetings..." /></form>
          <nav className="topActions">
            <a href="/calendar">Sync calendar</a>
            <a href="/meetings/new">New note</a>
            <a className="buttonPrimary" href="/upload">Upload</a>
          </nav>
        </header>
        <main>{children}</main>
      </section>
    </div>
  );
}

function NavSection({ title, items, path }: { title?: string; items: NavItem[]; path: string }) {
  return (
    <section className="navGroup">
      {title ? <p>{title}</p> : null}
      <nav>{items.map((item) => <a key={item.href} className={active(path, item.href) ? "active" : ""} href={item.href}>{item.label}</a>)}</nav>
    </section>
  );
}

function active(path: string, href: string) {
  if (href === "/dashboard") return path === "/" || path === "/dashboard";
  if (href === "/library") return path === "/library" || path === "/meetings" || path.startsWith("/meetings/");
  return path === href || path.startsWith(`${href}/`);
}

function initials(user: AppUser) {
  return (user.name || user.email).split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M";
}

function selectPage(path: string, user: AppUser) {
  if (path === "/" || path === "/dashboard") return <Dashboard user={user} />;
  if (path === "/today") return <TodayPage />;
  if (path === "/calendar") return <CalendarPage />;
  if (path === "/library" || path === "/meetings") return <LibraryPage eyebrow="Library" title="Meeting Library" endpoint="/api/meetings" />;
  if (path === "/meetings/new") return <NewMeetingPage />;
  if (path.startsWith("/meetings/")) return <MeetingDetail meetingId={path.split("/")[2]} />;
  if (path === "/recordings") return <LibraryPage eyebrow="Recordings" title="Recording Library" endpoint="/api/recordings" />;
  if (path === "/action-items") return <LibraryPage eyebrow="Accountability" title="Action Items" endpoint="/api/action-items" />;
  if (path === "/ask" || path === "/search") return <AskPage />;
  if (path === "/templates") return <TemplatesPage />;
  if (path === "/automations") return <AutomationsPage />;
  if (path === "/clips") return <ClipsPage />;
  if (path === "/upload") return <UploadPage />;
  if (path === "/screen-recorder" || path === "/screen-recording") return <ScreenRecorderPage />;
  if (path === "/admin") return <AdminDashboard />;
  if (path === "/admin/meetings") return <LibraryPage eyebrow="Admin" title="All Meetings" endpoint="/api/admin/meetings" />;
  if (path === "/admin/recordings") return <LibraryPage eyebrow="Admin" title="All Recordings" endpoint="/api/admin/recordings" />;
  if (path === "/admin/users") return <LibraryPage eyebrow="Admin" title="User Management" endpoint="/api/users" />;
  if (path === "/admin/failures") return <LibraryPage eyebrow="Admin" title="Processing Failures" endpoint="/api/admin/processing-failures" />;
  if (path === "/admin/audit-logs") return <LibraryPage eyebrow="Admin" title="Audit Logs" endpoint="/api/admin/audit-logs" />;
  if (path === "/settings") return <SettingsPage />;
  if (path === "/integrations") return <PanelPage eyebrow="Super admin" title="Integrations" endpoint="/api/admin/integrations" />;
  if (path === "/api-usage") return <PanelPage eyebrow="Super admin" title="API Usage" endpoint="/api/admin/api-usage" />;
  if (path === "/storage-usage") return <PanelPage eyebrow="Super admin" title="Storage Usage" endpoint="/api/admin/storage-usage" />;
  if (path === "/queue-logs") return <PanelPage eyebrow="Super admin" title="Queue / Job Logs" endpoint="/api/admin/queue-logs" />;
  return <Dashboard user={user} />;
}

function AuthPage() {
  return (
    <main className="auth">
      <section className="authHero">
        <div><p className="eyebrow light">Internal workspace</p><h1>Welcome to Markitome</h1><p>AI meeting notes, agendas, recordings, decisions, and follow-up workflows in one consent-first workspace.</p></div>
      </section>
      <section className="authPanel">
        <div className="loginMark">M</div>
        <h1>Log in to Markitome</h1>
        <p>notetaker.markitome.ai</p>
        <a className="googleButton" href="/api/auth/login"><span>G</span>Continue with Google</a>
        <small>Use your Markitome Google account. External users require admin approval.</small>
      </section>
    </main>
  );
}

function AuthNotice({ title, text }: { title: string; text: string }) {
  return (
    <main className="authNotice">
      <section className="card narrow"><p className="eyebrow">Workspace</p><h1>{title}</h1><p>{text}</p><a className="buttonPrimary" href="/login">Back to login</a></section>
    </main>
  );
}

function Dashboard({ user }: { user: AppUser }) {
  const isAdmin = user.roles.includes("admin") || user.roles.includes("super_admin");
  const isSuperAdmin = user.roles.includes("super_admin");
  return (
    <section className="stack">
      <PageHeader eyebrow="Home" title={isSuperAdmin ? "Super Admin Dashboard" : isAdmin ? "Admin Dashboard" : "My Meetings"} actions={<><a href="/calendar">Sync calendar</a><a className="buttonPrimary" href="/meetings/new">New meeting note</a></>} />
      <div className="metricGrid">
        <Metric label="Upcoming" value="-" />
        <Metric label="Recordings" value="-" />
        <Metric label="AI notes" value="-" />
        <Metric label="Action items" value="-" />
      </div>
      <div className="featureGrid">
        <Feature title="Prepare" label="Before meetings" text="Create collaborative agendas, add context, and review participant notes before the call." href="/today" />
        <Feature title="Capture" label="During meetings" text="Upload recordings, use the screen recorder, or invite the recording bot where platform policy allows." href="/upload" />
        <Feature title="Follow up" label="After meetings" text="Review AI summaries, decisions, tasks, topics, transcript previews, and draft emails." href="/library" />
      </div>
      {isAdmin ? <section className="card" data-load="/api/admin/dashboard"><h2>Admin overview</h2><div className="loading">Loading admin metrics...</div></section> : null}
    </section>
  );
}

function TodayPage() {
  return (
    <section className="stack">
      <PageHeader eyebrow="Today" title="Meeting Command Center" actions={<><a href="/calendar">Calendar sync</a><a className="buttonPrimary" href="/meetings/new">Create agenda</a></>} />
      <div className="featureGrid">
        <Feature title="Pre-meeting brief" label="Prep" text="Review agendas, participants, previous notes, and open tasks before calls." href="/calendar" />
        <Feature title="Collaborative note" label="Run" text="Use agenda and manual notes as the shared workspace for every meeting." href="/meetings/new" />
        <Feature title="AI recap" label="Follow-up" text="Generate summary, decisions, action items, topics, risks, and email drafts." href="/library" />
      </div>
      <LibraryPage eyebrow="Recent" title="Upcoming and recent meetings" endpoint="/api/meetings" compact />
    </section>
  );
}

function CalendarPage() {
  return (
    <section className="stack">
      <PageHeader eyebrow="Google Calendar" title="Calendar Integration" actions={<a className="buttonPrimary" href="/api/integrations/google-calendar/connect">Connect Google Calendar</a>} />
      <div className="notice">Uses Google Calendar read-only access. Markitome imports selected events as meeting notes and does not edit your calendar.</div>
      <section className="card" data-load="/api/integrations/google-calendar/status"><h2>Connection</h2><div className="loading">Loading status...</div></section>
      <section className="card">
        <div className="cardHeader"><div><p className="eyebrow">Upcoming</p><h2>Next 7 days</h2></div><button id="importCalendarEvents">Import as meeting notes</button></div>
        <div data-load="/api/integrations/google-calendar/events?days=7"><div className="loading">Loading calendar events...</div></div>
        <pre id="calendarImportResult" className="result"></pre>
      </section>
    </section>
  );
}

function LibraryPage({ eyebrow, title, endpoint, compact = false }: { eyebrow: string; title: string; endpoint: string; compact?: boolean }) {
  return (
    <section className={compact ? "stack compact" : "stack"}>
      <PageHeader eyebrow={eyebrow} title={title} actions={<><a href="/ask">Ask AI</a><a className="buttonPrimary" href="/upload">Upload</a></>} />
      <div className="filters">
        <input data-filter="keyword" placeholder="Search keyword" />
        <select data-filter="platform"><option value="">Any platform</option><option value="google_meet">Google Meet</option><option value="zoom">Zoom</option><option value="microsoft_teams">Microsoft Teams</option><option value="screen_recording">Screen Recording</option><option value="phone_call_upload">Phone Call</option></select>
        <select data-filter="processing_status"><option value="">Any status</option><option value="uploaded">Uploaded</option><option value="transcribing">Transcribing</option><option value="transcribed">Transcribed</option><option value="generating_notes">Generating notes</option><option value="completed">Completed</option><option value="failed">Failed</option></select>
      </div>
      <section className="card" data-load={endpoint} data-load-base={endpoint}><div className="loading">Loading...</div></section>
    </section>
  );
}

function NewMeetingPage() {
  return (
    <section className="stack">
      <PageHeader eyebrow="Agenda builder" title="New Meeting Note" actions={<a href="/templates">Templates</a>} />
      <form id="newMeetingForm" className="form card">
        <label>Title<input name="title" required placeholder="Weekly growth review" /></label>
        <label>Date/time<input name="meeting_datetime" type="datetime-local" required /></label>
        <label>Platform<select name="platform"><option value="google_meet">Google Meet</option><option value="zoom">Zoom</option><option value="microsoft_teams">Microsoft Teams</option><option value="other">Other</option></select></label>
        <label>Visibility<select name="visibility"><option value="private">Private</option><option value="shared">Shared</option><option value="company">Company</option></select></label>
        <label>Meeting URL<input name="meeting_url" type="url" placeholder="https://meet.google.com/..." /></label>
        <label>Participants<textarea name="participants" placeholder="One name or email per line" /></label>
        <label>Agenda<textarea name="agenda" placeholder="1. Wins and blockers&#10;2. Decisions needed&#10;3. Next steps" /></label>
        <label>Manual notes<textarea name="manual_notes" placeholder="Private context or working notes" /></label>
        <button type="submit">Create meeting note</button>
      </form>
      <pre id="newMeetingResult" className="result"></pre>
    </section>
  );
}

function MeetingDetail({ meetingId }: { meetingId: string }) {
  return (
    <section className="stack">
      <PageHeader eyebrow="Meeting workspace" title="Meeting Note" actions={<><button data-regenerate-notes={meetingId}>Regenerate AI notes</button><a href={`/api/meetings/${meetingId}/export/markdown`}>Export</a></>} />
      <section className="card" data-load={`/api/meetings/${meetingId}`}><div className="loading">Loading meeting...</div></section>
      <section className="card">
        <h2>Manual transcript</h2>
        <form id="manualTranscriptForm" className="form flat" data-meeting-id={meetingId}>
          <label>Transcript text<textarea name="transcript_text" required /></label>
          <label>Language<input name="language" placeholder="en" /></label>
          <button type="submit">Upload transcript and generate notes</button>
        </form>
        <pre id="manualTranscriptResult" className="result"></pre>
      </section>
      <div className="actionRow">
        <a href={`/api/meetings/${meetingId}/export/markdown`}>Markdown</a>
        <a href={`/api/meetings/${meetingId}/export/json`}>JSON</a>
        <a href={`/api/meetings/${meetingId}/export/transcript`}>Transcript TXT</a>
        <a href={`/api/meetings/${meetingId}/export/pdf-ready-html`}>PDF-ready HTML</a>
        <a href={`/api/meetings/${meetingId}/export/google-docs-text`}>Google Docs text</a>
      </div>
    </section>
  );
}

function AskPage() {
  return (
    <section className="stack">
      <PageHeader eyebrow="Ask AI" title="Ask Markitome" />
      <section className="card">
        <form id="searchForm" className="askBox"><textarea name="q" required placeholder="Ask about meetings, decisions, action items, risks, or customer follow-ups..." /><button type="submit">Search meetings</button></form>
        <div className="suggestions"><button data-ask="Show open action items from recent meetings">Open action items</button><button data-ask="Find risks or blockers mentioned in client calls">Risks and blockers</button><button data-ask="Draft follow-up points from recent meetings">Follow-up points</button></div>
      </section>
      <pre id="searchResult" className="result"></pre>
    </section>
  );
}

function TemplatesPage() {
  const templates = [
    ["1:1", "Wins, blockers, feedback, growth, and next steps"],
    ["Team standup", "Priorities, blockers, metrics, and owners"],
    ["Customer call", "Pain points, requirements, objections, and follow-up"],
    ["Pipeline review", "Deals, risks, next actions, and forecast decisions"],
    ["Project retro", "What worked, what did not, and experiments"],
    ["Board update", "Metrics, decisions, asks, and risks"]
  ];
  return (
    <section className="stack">
      <PageHeader eyebrow="Templates" title="Meeting Template Library" actions={<a className="buttonPrimary" href="/meetings/new">Create note</a>} />
      <div className="featureGrid">{templates.map(([title, text]) => <Feature key={title} title={title} label="Template" text={text} href={`/meetings/new?template=${encodeURIComponent(title)}`} />)}</div>
    </section>
  );
}

function AutomationsPage() {
  return (
    <section className="stack">
      <PageHeader eyebrow="Automations" title="Meeting Automations" />
      <div className="notice">Automation controls are consent-first. Recording bots still require confirmed consent before joining or recording.</div>
      <section className="card">
        <form id="automationForm" className="settingsList">
          <label><input type="checkbox" name="auto_agenda" /> Auto-create notes from calendar events</label>
          <label><input type="checkbox" name="agenda_reminders" /> Remind participants to add agenda items</label>
          <label><input type="checkbox" name="auto_summary" /> Generate AI recap after transcription</label>
          <label><input type="checkbox" name="follow_up_email" /> Draft follow-up email</label>
          <label><input type="checkbox" name="crm_update" /> Prepare CRM update suggestions</label>
          <button type="submit">Save automation draft</button>
        </form>
        <pre id="automationResult" className="result"></pre>
      </section>
    </section>
  );
}

function ClipsPage() {
  return (
    <section className="stack">
      <PageHeader eyebrow="Clips" title="Recordings and Shareable Moments" actions={<a className="buttonPrimary" href="/recordings">View recordings</a>} />
      <div className="featureGrid">
        <Feature title="Recording library" label="Centralized" text="Recordings live in R2 with RBAC, audit logs, and processing status." href="/recordings" />
        <Feature title="Clip workflow" label="Highlights" text="Create short shareable moments once timestamped transcripts are available." href="/recordings" />
        <Feature title="Consent controls" label="Privacy" text="All access follows owner, sharing, admin, and super-admin permissions." href="/settings" />
      </div>
      <LibraryPage eyebrow="Recordings" title="Recording Library" endpoint="/api/recordings" compact />
    </section>
  );
}

function UploadPage() {
  return (
    <section className="stack">
      <PageHeader eyebrow="Upload" title="Upload Recording" />
      <div className="notice">Only upload recordings where consent has been obtained. Admin historical imports must be clearly marked.</div>
      <form id="uploadForm" className="form card">
        <label>Recording file<input name="file" type="file" accept=".mp3,.wav,.m4a,.mp4,.mov,.webm,.mkv" required /></label>
        <label>Source type<select name="source_type" required><option value="phone_call_upload">Phone Call Recording</option><option value="google_meet">Google Meet</option><option value="zoom">Zoom</option><option value="microsoft_teams">Microsoft Teams</option><option value="screen_recording">Screen Recording</option><option value="audio_upload">Other Audio</option><option value="video_upload">Other Video</option><option value="other">Other</option></select></label>
        <label>Meeting title<input name="title" required /></label>
        <label>Date/time<input name="meeting_datetime" type="datetime-local" required /></label>
        <label>Participants<textarea name="participants" placeholder="One name or email per line" /></label>
        <label>Agenda<textarea name="agenda" /></label>
        <label>Manual notes<textarea name="manual_notes" /></label>
        <label className="check"><input name="consent" type="checkbox" required /> I confirm recording consent has been obtained.</label>
        <progress id="uploadProgress" value="0" max="100" />
        <button type="submit">Upload and process</button>
      </form>
      <pre id="uploadResult" className="result"></pre>
    </section>
  );
}

function ScreenRecorderPage() {
  return (
    <section className="stack">
      <PageHeader eyebrow="Fallback recorder" title="Start Screen Recording" />
      <div className="notice">Use browser screen recording only when recording consent has been obtained.</div>
      <form id="screenRecorderForm" className="form card">
        <label>Meeting title<input name="title" required /></label>
        <label>Date/time<input name="meeting_datetime" type="datetime-local" required /></label>
        <label>Participants<textarea name="participants" /></label>
        <label>Agenda<textarea name="agenda" /></label>
        <label>Manual notes<textarea name="manual_notes" /></label>
        <label className="check"><input name="microphone" type="checkbox" /> Include microphone if browser permits</label>
        <label className="check"><input name="consent" type="checkbox" required /> I confirm recording consent has been obtained.</label>
      </form>
      <div className="recorder card"><strong id="recordingTimer">00:00</strong><button id="startRecording">Start</button><button id="pauseRecording" disabled>Pause</button><button id="resumeRecording" disabled>Resume</button><button id="stopRecording" disabled>Stop</button></div>
      <video id="recordingPreview" controls muted playsInline></video>
      <pre id="screenRecordingResult" className="result"></pre>
    </section>
  );
}

function AdminDashboard() {
  return (
    <section className="stack">
      <PageHeader eyebrow="Admin" title="Admin Dashboard" />
      <section className="card" data-load="/api/admin/dashboard"><div className="loading">Loading admin dashboard...</div></section>
      <div className="actionRow"><a href="/admin/meetings">All meetings</a><a href="/admin/recordings">All recordings</a><a href="/admin/users">Employee libraries</a><a href="/admin/failures">Processing failures</a><a href="/admin/audit-logs">Audit logs</a></div>
    </section>
  );
}

function SettingsPage() {
  return (
    <section className="stack">
      <PageHeader eyebrow="Super admin" title="System Settings" />
      <section className="card"><h2>Configurable controls</h2><div className="settingsList"><label>Default consent requirement</label><label>Retention period</label><label>Download permissions</label><label>Employee recording deletion</label><label>Allowed file types</label><label>Maximum upload size</label></div></section>
      <section className="card" data-load="/api/admin/system-settings"><h2>Saved settings</h2><div className="loading">Loading settings...</div></section>
      <section className="card" data-load="/api/admin/system-status"><h2>Production status</h2><div className="loading">Loading status...</div></section>
    </section>
  );
}

function PanelPage({ eyebrow, title, endpoint }: { eyebrow: string; title: string; endpoint: string }) {
  return <section className="stack"><PageHeader eyebrow={eyebrow} title={title} /><section className="card" data-load={endpoint}><div className="loading">Loading...</div></section></section>;
}

function PageHeader({ eyebrow, title, actions }: { eyebrow: string; title: string; actions?: React.ReactNode }) {
  return <div className="pageHeader"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{actions ? <div className="actionRow">{actions}</div> : null}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong></article>;
}

function Feature({ title, label, text, href }: { title: string; label: string; text: string; href: string }) {
  return <article className="feature"><span>{label}</span><h2>{title}</h2><p>{text}</p><a href={href}>Open</a></article>;
}

const css = `
:root{color-scheme:light;--ink:#171426;--muted:#736d80;--soft:#f5f2fa;--bg:#f7f4fb;--panel:#fff;--line:#e5dfec;--purple:#6c4edb;--purple-dark:#2b174f;--purple-soft:#f0ebff;--danger:#b42318;--warn:#8a5a10;--shadow:0 18px 45px rgba(43,23,79,.10)}
*{box-sizing:border-box}html{min-height:100%;background:var(--bg)}body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:radial-gradient(circle at 0 0,rgba(108,78,219,.12),transparent 34rem),linear-gradient(180deg,#fbf9fe,#f4eff9)}a{color:inherit;text-decoration:none}button,input,select,textarea{font:inherit}button,.actionRow a,.buttonPrimary,.googleButton{min-height:38px;border:1px solid var(--line);border-radius:9px;background:#fff;padding:9px 14px;font-weight:800;cursor:pointer}.buttonPrimary,button[type=submit]{background:var(--purple);border-color:var(--purple);color:#fff}.app{display:grid;grid-template-columns:286px minmax(0,1fr);min-height:100vh}.rail{position:sticky;top:0;height:100vh;overflow:auto;display:flex;flex-direction:column;gap:18px;padding:22px 16px;color:#f8f5ff;background:linear-gradient(180deg,#2d1857,#201039)}.brand{display:flex;gap:12px;align-items:center;padding:0 6px 18px;border-bottom:1px solid rgba(255,255,255,.12)}.brandMark,.loginMark{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:#fff;color:var(--purple);font-weight:950;box-shadow:0 12px 28px rgba(23,12,48,.22)}.brand strong,.brand small{display:block}.brand small{color:#cfc5ef}.navGroup{display:grid;gap:8px}.navGroup p{margin:0 10px;color:#b9aed9;font-size:11px;text-transform:uppercase;font-weight:950;letter-spacing:.08em}.navGroup nav{display:grid;gap:4px}.navGroup a{min-height:38px;display:flex;align-items:center;padding:9px 12px;border-radius:9px;color:#e4ddf7;font-weight:750}.navGroup a.active,.navGroup a:hover{background:rgba(255,255,255,.13);color:#fff}.railFooter{margin-top:auto;display:grid;gap:12px}.userCard{display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.07)}.userCard>span{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#fff;color:var(--purple);font-weight:950}.userCard strong,.userCard small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.userCard small{color:#d9d0f4}.quietButton{width:100%;background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.14);color:#fff}.work{min-width:0}.topbar{position:sticky;top:0;z-index:3;display:flex;gap:16px;align-items:center;justify-content:space-between;min-height:74px;padding:16px 34px;background:rgba(250,248,253,.86);border-bottom:1px solid rgba(229,223,236,.85);backdrop-filter:blur(16px)}.topSearch{flex:1;max-width:680px}.topActions,.actionRow{display:flex;align-items:center;flex-wrap:wrap;gap:10px}main{width:min(1180px,calc(100% - 48px));margin:30px auto 70px}.stack{display:grid;gap:20px}.stack.compact .pageHeader{display:none}.pageHeader{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.eyebrow{margin:0;color:var(--purple);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.eyebrow.light{color:#e3dcff}.pageHeader h1,.auth h1{margin:6px 0 0;font-size:36px;line-height:1.08}.card,.metric,.feature{background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:var(--shadow)}.cardHeader{display:flex;align-items:center;justify-content:space-between;gap:16px}.metricGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.metric span{color:var(--muted);font-size:13px;font-weight:800}.metric strong{display:block;margin-top:10px;font-size:30px}.featureGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.feature{display:grid;gap:10px;align-content:start}.feature span{color:var(--purple);font-size:11px;text-transform:uppercase;font-weight:950;letter-spacing:.08em}.feature h2,.card h2{margin:0;font-size:20px}.feature p,.card p{margin:0;color:var(--muted);line-height:1.55}.feature a{color:var(--purple);font-weight:850}.filters{display:flex;gap:10px;flex-wrap:wrap;padding:12px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.76)}.filters input{flex:1 1 260px}.filters select{flex:0 1 215px}input,select,textarea{width:100%;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);padding:11px 12px;outline:none}input:focus,select:focus,textarea:focus{border-color:#b7a6ef;box-shadow:0 0 0 3px rgba(108,78,219,.16)}textarea{min-height:112px;resize:vertical}.form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.form.flat{padding:0;border:0;box-shadow:none}.form label{display:grid;gap:7px;color:var(--muted);font-size:13px;font-weight:800}.form label:has(textarea),.form label:has(input[type=file]),.form .check,.form progress,.form button{grid-column:1/-1}.check{display:flex!important;align-items:center;color:var(--ink)}.notice{border:1px solid #ead29c;border-radius:12px;background:#fff8e7;color:var(--warn);padding:14px 16px;font-weight:800}.loading,.result{white-space:pre-wrap;overflow:auto;min-height:72px;border:1px solid #e9e2f1;border-radius:12px;background:#f4f0f8;color:#30283f;padding:14px}.result:empty{display:none}.error-state{border:1px solid #ffd0d0;border-radius:12px;background:#fff5f5;color:var(--danger);padding:14px;font-weight:800}.empty-state{border:1px dashed var(--line);border-radius:12px;background:#fff;color:var(--muted);padding:18px}.libraryList{display:grid;gap:10px}.libraryRow{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(170px,.7fr) minmax(150px,.6fr) auto;align-items:center;gap:16px;padding:16px;border:1px solid var(--line);border-radius:14px;background:#fff}.libraryRow:hover{border-color:#d2c5f6;background:#fdfbff}.libraryTitle{display:grid;gap:6px;min-width:0}.libraryTitle a{font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.libraryTitle small,.libraryMeta small{color:var(--muted);font-size:12px}.libraryMeta{display:grid;gap:5px;min-width:0}.libraryMeta strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pill{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;background:var(--purple-soft);color:var(--purple);font-size:12px;font-weight:900}.tableWrap{overflow:auto;border:1px solid var(--line);border-radius:14px;background:#fff}table{width:100%;min-width:760px;border-collapse:separate;border-spacing:0}th,td{padding:13px 14px;text-align:left;border-bottom:1px solid var(--line);font-size:14px}th{font-size:11px;text-transform:uppercase;color:#5d536f;background:#fbf9fd;letter-spacing:.06em}tr:last-child td{border-bottom:0}td a{color:var(--purple);font-weight:900}.statusGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.statusCard{border:1px solid var(--line);border-radius:14px;background:#fff;padding:16px}.statusCard span{display:block;color:var(--muted);font-size:12px;text-transform:uppercase;font-weight:950;letter-spacing:.05em}.statusCard strong{display:block;margin-top:8px;font-size:22px}.meetingHero{display:grid;gap:10px;padding:22px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(135deg,#fff,#f8f4ff)}.meetingHero h2{margin:0;font-size:30px}.meetingMeta{display:flex;flex-wrap:wrap;gap:8px;color:var(--muted)}.notesLayout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.noteBox{min-height:150px;padding:16px;border:1px solid var(--line);border-radius:14px;background:#fff;white-space:pre-wrap;line-height:1.55}.sectionList{display:grid;gap:10px}.sectionItem{padding:14px;border:1px solid var(--line);border-radius:12px;background:#fff}.sectionItem strong{display:block;margin-bottom:5px}.sectionItem p{margin:0;color:var(--muted)}.askBox{display:grid;gap:12px}.askBox textarea{min-height:140px}.suggestions,.settingsList{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.suggestions button,.settingsList label{border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--purple);padding:10px 13px;font-weight:800}.settingsList{display:grid}.settingsList label{border-radius:12px;color:var(--ink)}.recorder{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.recorder strong{margin-right:auto;font-size:24px}progress{width:100%;height:12px;accent-color:var(--purple)}video{width:100%;max-height:420px;background:#120c20;border-radius:14px;box-shadow:var(--shadow)}.auth{min-height:100vh;display:grid;grid-template-columns:minmax(320px,43%) minmax(0,1fr);background:#fff}.authHero{display:grid;place-items:center;min-height:100vh;padding:48px;color:#fff;background:linear-gradient(150deg,rgba(45,21,85,.98),rgba(108,78,219,.94))}.authHero>div{width:min(430px,100%)}.authHero p:not(.eyebrow){font-size:18px;color:#eee8ff;line-height:1.55}.authPanel{width:min(430px,calc(100% - 48px));margin:auto;text-align:center;display:flex;flex-direction:column;align-items:center}.authPanel p{color:var(--muted)}.authPanel small{margin-top:18px;color:var(--muted);line-height:1.5}.googleButton{width:100%;display:flex;align-items:center;justify-content:center;gap:12px;min-height:50px}.googleButton span{display:grid;place-items:center;width:24px;height:24px;border:1px solid var(--line);border-radius:50%;color:#4285f4}.authNotice{min-height:100vh;display:grid;place-items:center;padding:24px}.narrow{width:min(560px,100%)}
.statusCard{min-width:0}.statusCard strong,.noteBox,.sectionItem p,.libraryMeta strong,td,.result{overflow-wrap:anywhere;word-break:break-word}
main.auth,main.authNotice{width:100%;max-width:none;margin:0}.actionRow a.buttonPrimary{background:var(--purple);border-color:var(--purple);color:#fff}
@media(max-width:980px){.app{grid-template-columns:1fr}.rail{position:relative;height:auto;border-radius:0 0 18px 18px}.navGroup nav{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.topbar{position:relative;padding:14px 20px;flex-direction:column;align-items:stretch}.topSearch{max-width:none}main{width:min(100% - 28px,980px);margin:22px auto 54px}.metricGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.featureGrid,.notesLayout{grid-template-columns:1fr}.form{grid-template-columns:1fr}.libraryRow{grid-template-columns:1fr;align-items:start}}
@media(max-width:760px){.auth{grid-template-columns:1fr}.authHero{min-height:34vh;padding:34px 24px}.authPanel{min-height:66vh}.pageHeader{align-items:flex-start;flex-direction:column}.pageHeader h1{font-size:29px}.metricGrid{grid-template-columns:1fr}.topActions,.actionRow{align-items:stretch;flex-direction:column}.topActions a,.actionRow a,.actionRow button,button{width:100%;text-align:center}}
`;

const clientScript = `
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!text) return {};
  if (contentType.includes("application/json")) {
    try { return JSON.parse(text); } catch { throw new Error("The server returned invalid JSON."); }
  }
  if (!response.ok) throw new Error(text.slice(0, 500));
  try { return JSON.parse(text); } catch { return { message: text }; }
}

async function loadPanels() {
  for (const panel of $$("[data-load]")) await loadPanel(panel);
}

async function loadPanel(panel) {
  const output = panel.querySelector(".loading, .result, .error-state, .empty-state") || panel;
  try {
    const response = await fetch(panel.dataset.load, { headers: { accept: "application/json" } });
    const json = await readApiResponse(response);
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

function td(value, className) {
  return '<td' + (className ? ' class="' + className + '"' : "") + '>' + value + '</td>';
}

function table(headers, rows) {
  if (!rows.length) return emptyState("No records found.");
  return '<div class="tableWrap"><table><thead><tr>' + headers.map((header) => '<th>' + escapeHtml(header) + '</th>').join("") + '</tr></thead><tbody>' + rows.join("") + '</tbody></table></div>';
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
  if (json.google_calendar) return renderGoogleCalendarStatus(json.google_calendar);
  if (json.events) return renderGoogleCalendarEvents(json.events);
  if (json.usage) return renderUsage(json.usage);
  if (json.transcripts || endpoint.includes("storage-usage")) return renderStorage(json);
  if (json.results) return renderSearchResults(json);
  if (json.meeting) return renderMeetingBundle(json.meeting);
  return '<pre class="result">' + escapeHtml(JSON.stringify(json, null, 2)) + '</pre>';
}

function renderDashboard(json) {
  const cards = [["Total meetings", json.total_meetings?.count ?? 0], ["Recordings", json.recordings?.count ?? 0], ["Recording hours", (Number(json.recordings?.durationSeconds || 0) / 3600).toFixed(1)], ["Failed jobs", json.failed_processing_jobs?.count ?? 0]];
  return '<div class="statusGrid">' + cards.map(([label, value]) => '<div class="statusCard"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>').join("") + '</div>' + (json.configuration ? renderSystemStatus(json.configuration) : "");
}

function renderSystemStatus(json) {
  const checks = [["Google OAuth", json.google_oauth_configured], ["Workers AI", json.cloudflare_workers_ai_configured], ["Claude API", json.claude_configured], ["MeetingBot", json.meetingbot_provider_configured]];
  return '<div class="statusGrid">' + checks.map(([label, ok]) => '<div class="statusCard"><span>' + escapeHtml(label) + '</span><strong>' + (ok ? "Configured" : "Missing") + '</strong></div>').join("") + '</div>' + (json.required_action?.length ? '<div class="notice">' + json.required_action.map(escapeHtml).join("<br>") + '</div>' : "");
}

function renderMeetings(meetings) {
  if (!meetings.length) return emptyState("No meetings found.");
  return '<div class="libraryList">' + meetings.map((meeting) => '<article class="libraryRow"><div class="libraryTitle"><a href="/meetings/' + encodeURIComponent(meeting.id) + '">' + escapeHtml(meeting.title || "Untitled meeting") + '</a><small>' + escapeHtml(meeting.source_type || "-") + ' · ' + escapeHtml(meeting.owner_email || meeting.owner_user_id || "No owner") + '</small></div><div class="libraryMeta"><small>Date</small><strong>' + escapeHtml(formatDate(meeting.meeting_datetime)) + '</strong></div><div class="libraryMeta"><small>Platform</small><strong>' + pill(meeting.platform) + '</strong></div><div>' + pill(meeting.processing_status) + '</div></article>').join("") + '</div>';
}

function renderRecordings(recordings) {
  if (!recordings.length) return emptyState("No recordings found.");
  return '<div class="libraryList">' + recordings.map((recording) => '<article class="libraryRow"><div class="libraryTitle"><a href="/meetings/' + encodeURIComponent(recording.meeting_id) + '">' + escapeHtml(recording.meeting_title || recording.original_filename || recording.id) + '</a><small>' + escapeHtml(recording.original_filename || "Recording") + ' · ' + escapeHtml(recording.owner_email || recording.owner_user_id || "No owner") + '</small></div><div class="libraryMeta"><small>Type</small><strong>' + pill(recording.source_type) + '</strong></div><div class="libraryMeta"><small>Size</small><strong>' + escapeHtml(formatBytes(recording.file_size)) + '</strong></div><div>' + pill(recording.processing_status) + '</div>' + (recording.error_message ? '<div class="error-state">' + escapeHtml(recording.error_message) + '</div>' : "") + '</article>').join("") + '</div>';
}

function renderUsers(users) {
  return table(["Email", "Name", "Approval", "Roles", "Last login"], users.map((user) => '<tr>' + td(escapeHtml(user.email)) + td(escapeHtml(user.name || "-")) + td(pill(user.approvalStatus || user.approval_status)) + td(escapeHtml(user.roles || "-")) + td(escapeHtml(formatDate(user.lastLoginAt || user.last_login_at))) + '</tr>'));
}

function renderActionItems(items) {
  return table(["Task", "Meeting", "Assignee", "Due", "Priority", "Status"], items.map((item) => '<tr>' + td(escapeHtml(item.task)) + td('<a href="/meetings/' + encodeURIComponent(item.meeting_id) + '">' + escapeHtml(item.meeting_title || item.meeting_id) + '</a>') + td(escapeHtml(item.assignee_text || "-")) + td(escapeHtml(item.due_date || "-")) + td(pill(item.priority)) + td(pill(item.status)) + '</tr>'));
}

function renderAuditLogs(logs) {
  return table(["Time", "Action", "Target", "Actor", "Metadata"], logs.map((log) => '<tr>' + td(escapeHtml(formatDate(log.created_at))) + td(pill(log.action)) + td(escapeHtml((log.target_type || "-") + (log.target_id ? ": " + log.target_id : ""))) + td(escapeHtml(log.actor_user_id || "-")) + td(escapeHtml(log.metadata_json || "{}"), "mono") + '</tr>'));
}

function renderJobs(jobs) {
  return table(["Created", "Type", "Status", "Attempts", "Meeting", "Error"], jobs.map((job) => '<tr>' + td(escapeHtml(formatDate(job.created_at))) + td(escapeHtml(job.job_type)) + td(pill(job.status)) + td(escapeHtml(job.attempts || 0)) + td(escapeHtml(job.meeting_id || "-")) + td(escapeHtml(job.error_message || "-")) + '</tr>'));
}

function renderSettings(settings) {
  return table(["Setting", "Value", "Updated"], settings.map((setting) => '<tr>' + td(escapeHtml(setting.key)) + td(escapeHtml(setting.value_json), "mono") + td(escapeHtml(formatDate(setting.updated_at))) + '</tr>'));
}

function renderIntegrations(json) {
  const secretRows = Object.entries(json.required_secrets || {}).map(([key, value]) => '<tr>' + td(escapeHtml(key)) + td(pill(value ? "configured" : "missing")) + td("") + '</tr>');
  const integrationRows = (json.integrations || []).map((integration) => '<tr>' + td(escapeHtml(integration.provider)) + td(pill(integration.status)) + td(escapeHtml(integration.config_json || "{}"), "mono") + '</tr>');
  return table(["Integration", "Status", "Details"], secretRows.concat(integrationRows));
}

function renderUsage(usage) {
  return table(["Provider", "Model", "Operation", "Calls", "Input", "Output", "Cost"], usage.map((row) => '<tr>' + td(escapeHtml(row.provider)) + td(escapeHtml(row.model || "-")) + td(escapeHtml(row.operation)) + td(escapeHtml(row.calls || 0)) + td(escapeHtml(row.input_tokens || 0)) + td(escapeHtml(row.output_tokens || 0)) + td(escapeHtml(row.cost_estimate_usd || 0)) + '</tr>'));
}

function renderStorage(json) {
  return '<div class="statusGrid"><div class="statusCard"><span>Recording objects</span><strong>' + escapeHtml(json.recordings?.count || 0) + '</strong></div><div class="statusCard"><span>Recording bytes</span><strong>' + escapeHtml(formatBytes(json.recordings?.bytes)) + '</strong></div><div class="statusCard"><span>Transcripts</span><strong>' + escapeHtml(json.transcripts?.count || 0) + '</strong></div><div class="statusCard"><span>Transcript words</span><strong>' + escapeHtml(json.transcripts?.word_count || 0) + '</strong></div></div>';
}

function renderSearchResults(json) {
  return table(["Meeting", "Date", "Snippet"], (json.results || []).map((result) => '<tr>' + td('<a href="/meetings/' + encodeURIComponent(result.id) + '">' + escapeHtml(result.title) + '</a>') + td(escapeHtml(formatDate(result.meeting_datetime))) + td(escapeHtml(result.transcript_preview || result.parsed_notes_json || "-")) + '</tr>'));
}

function renderGoogleCalendarStatus(status) {
  return '<div class="statusGrid"><div class="statusCard"><span>Status</span><strong>' + escapeHtml(status.connected ? "Connected" : "Not connected") + '</strong></div><div class="statusCard"><span>Account</span><strong>' + escapeHtml(status.email || "-") + '</strong></div><div class="statusCard"><span>Scope</span><strong>' + escapeHtml(status.scope || "calendar.readonly") + '</strong></div><div class="statusCard"><span>Updated</span><strong>' + escapeHtml(formatDate(status.updated_at)) + '</strong></div></div>';
}

function renderGoogleCalendarEvents(events) {
  if (!events.length) return emptyState("No upcoming Google Calendar events found.");
  return '<div class="libraryList">' + events.map((event) => '<article class="libraryRow"><div class="libraryTitle"><a href="' + escapeHtml(event.htmlLink || event.hangoutLink || "#") + '">' + escapeHtml(event.summary || "Untitled event") + '</a><small>' + escapeHtml((event.attendees || []).map((attendee) => attendee.email || attendee.name).filter(Boolean).slice(0, 4).join(", ") || "No attendees") + '</small></div><div class="libraryMeta"><small>Start</small><strong>' + escapeHtml(formatDate(event.start)) + '</strong></div><div class="libraryMeta"><small>End</small><strong>' + escapeHtml(formatDate(event.end)) + '</strong></div><div>' + pill(event.hangoutLink ? "Google Meet" : "Calendar") + '</div></article>').join("") + '</div>';
}

function renderMeetingBundle(meeting) {
  const participants = meeting.participants || [];
  const recordings = meeting.recordings || [];
  const actions = meeting.action_items || [];
  const decisions = meeting.decisions || [];
  const topics = meeting.topics || [];
  const notes = safeJson(meeting.ai_notes?.parsed_notes_json);
  const hero = '<div class="meetingHero"><h2>' + escapeHtml(meeting.title || "Untitled meeting") + '</h2><div class="meetingMeta">' + pill(meeting.platform) + pill(meeting.source_type) + pill(meeting.processing_status) + '<span>' + escapeHtml(formatDate(meeting.meeting_datetime)) + '</span><span>' + escapeHtml(meeting.owner_email || "") + '</span></div></div>';
  const prep = '<div class="notesLayout"><section><h2>Agenda</h2><div class="noteBox">' + escapeHtml(meeting.agenda || "No agenda yet.") + '</div></section><section><h2>Manual notes</h2><div class="noteBox">' + escapeHtml(meeting.manual_notes || "No manual notes yet.") + '</div></section></div>';
  return hero + '<div class="statusGrid"><div class="statusCard"><span>Participants</span><strong>' + escapeHtml(participants.length) + '</strong></div><div class="statusCard"><span>Recordings</span><strong>' + escapeHtml(recordings.length) + '</strong></div><div class="statusCard"><span>Action items</span><strong>' + escapeHtml(actions.length) + '</strong></div><div class="statusCard"><span>Decisions</span><strong>' + escapeHtml(decisions.length) + '</strong></div></div>' + prep + '<section><h2>AI summary</h2><div class="noteBox">' + escapeHtml(notes?.summary || meeting.ai_notes?.rendered_markdown || "AI notes will appear after transcription completes.") + '</div></section>' + renderSectionList("Participants", participants, (item) => escapeHtml(item.name || item.email || "Participant"), (item) => escapeHtml(item.email || "")) + renderSectionList("Suggested action items", actions, (item) => escapeHtml(item.task), (item) => [item.assignee_text, item.due_date, item.priority, item.status].filter(Boolean).map(escapeHtml).join(" · ")) + renderSectionList("Decisions", decisions, (item) => escapeHtml(item.decision), (item) => escapeHtml(item.owner_text || item.source_quote || "")) + renderSectionList("Topic overview", topics, (item) => escapeHtml(item.topic), (item) => escapeHtml(item.summary || "")) + renderSectionList("Recordings", recordings, (item) => escapeHtml(item.original_filename || item.id), (item) => [item.source_type, item.processing_status, formatBytes(item.file_size)].filter(Boolean).map(escapeHtml).join(" · ")) + '<section><h2>Transcript</h2><div class="noteBox">' + escapeHtml(meeting.transcript?.transcript_preview || "Transcript preview will appear after processing.") + '</div></section><section><h2>Follow-up email draft</h2><div class="noteBox">' + escapeHtml(notes?.follow_up_email_draft || "No follow-up draft yet.") + '</div></section>';
}

function renderSectionList(title, items, titleSelector, detailSelector) {
  if (!items?.length) return '<section><h2>' + escapeHtml(title) + '</h2>' + emptyState("Nothing here yet.") + '</section>';
  return '<section><h2>' + escapeHtml(title) + '</h2><div class="sectionList">' + items.map((item) => '<div class="sectionItem"><strong>' + titleSelector(item) + '</strong><p>' + detailSelector(item) + '</p></div>').join("") + '</div></section>';
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
  const uploadUrlResponse = await fetch("/api/recordings/upload-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...metadata, original_filename: filename, mime_type: blob.type || "video/webm", file_size: blob.size, consent_status: "confirmed" }) });
  const uploadInfo = await readApiResponse(uploadUrlResponse);
  if (!uploadUrlResponse.ok) throw new Error(JSON.stringify(uploadInfo));
  const putResponse = await fetch(uploadInfo.upload_url, { method: "PUT", body: blob, headers: { "content-type": blob.type || "application/octet-stream" } });
  if (!putResponse.ok) throw new Error((await putResponse.text()) || "Recording upload failed with status " + putResponse.status);
  const completeResponse = await fetch("/api/recordings/complete-upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ upload_session_id: uploadInfo.upload_session_id }) });
  const completeJson = await readApiResponse(completeResponse);
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
    const response = await uploadBlob(file, { source_type: sourceType, platform: sourceType, title: form.title.value, meeting_datetime: new Date(form.meeting_datetime.value).toISOString(), participants: parseParticipants(form.participants.value), agenda: form.agenda.value, manual_notes: form.manual_notes.value, meeting_url: null }, file.name);
    progress.value = 100;
    result.textContent = JSON.stringify(response, null, 2);
  } catch (error) { result.textContent = error.message || String(error); }
});

$("#newMeetingForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = $("#newMeetingResult");
  try {
    const platform = form.platform.value;
    const response = await fetch("/api/meetings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: form.title.value, meeting_datetime: new Date(form.meeting_datetime.value).toISOString(), platform, source_type: platform, meeting_url: form.meeting_url.value || null, participants: parseParticipants(form.participants.value), agenda: form.agenda.value, manual_notes: form.manual_notes.value, visibility: form.visibility.value }) });
    const json = await readApiResponse(response);
    if (!response.ok) throw new Error(JSON.stringify(json));
    result.textContent = "Meeting note created. Opening workspace...";
    window.location.href = "/meetings/" + encodeURIComponent(json.meeting.id);
  } catch (error) { result.textContent = error.message || String(error); }
});

$("#searchForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await fetch("/api/search?q=" + encodeURIComponent(event.currentTarget.q.value));
  $("#searchResult").textContent = JSON.stringify(await readApiResponse(response), null, 2);
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

$("#importCalendarEvents")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const result = $("#calendarImportResult");
  button.disabled = true;
  button.textContent = "Importing...";
  try {
    const response = await fetch("/api/integrations/google-calendar/import-upcoming", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ days: 7 }) });
    const json = await readApiResponse(response);
    if (!response.ok) throw new Error(json?.error?.message || JSON.stringify(json));
    result.textContent = JSON.stringify(json, null, 2);
    button.textContent = "Imported";
  } catch (error) {
    result.textContent = error.message || String(error);
    button.textContent = "Import as meeting notes";
  } finally { button.disabled = false; }
});

for (const button of $$("[data-regenerate-notes]")) {
  button.addEventListener("click", async () => {
    const meetingId = button.dataset.regenerateNotes;
    button.disabled = true;
    button.textContent = "Queueing...";
    try {
      const response = await fetch("/api/meetings/" + encodeURIComponent(meetingId) + "/regenerate-ai-notes", { method: "POST" });
      const json = await readApiResponse(response);
      if (!response.ok) throw new Error(json?.error?.message || JSON.stringify(json));
      button.textContent = "Queued";
    } catch (error) { button.textContent = error.message || "Failed"; }
  });
}

$("#manualTranscriptForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = $("#manualTranscriptResult");
  try {
    const payload = { transcript_text: form.transcript_text.value };
    if (form.language.value) payload.language = form.language.value;
    const response = await fetch("/api/meetings/" + encodeURIComponent(form.dataset.meetingId) + "/transcript/manual-upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const json = await readApiResponse(response);
    if (!response.ok) throw new Error(JSON.stringify(json));
    result.textContent = JSON.stringify(json, null, 2);
  } catch (error) { result.textContent = error.message || String(error); }
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
      } catch (error) { result.textContent = "Microphone capture was not granted. Recording screen/tab audio only."; }
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
      const response = await uploadBlob(blob, { source_type: "screen_recording", platform: "screen_recording", title: form.title.value, meeting_datetime: new Date(form.meeting_datetime.value).toISOString(), participants: parseParticipants(form.participants.value), agenda: form.agenda.value, manual_notes: form.manual_notes.value, meeting_url: null }, "screen-recording-" + Date.now() + ".webm");
      result.textContent = JSON.stringify(response, null, 2);
    };
    recorder.start(1000);
    startedAt = Date.now();
    timerId = setInterval(updateTimer, 1000);
    updateTimer();
    setRecorderButtons("recording");
  } catch (error) { result.textContent = error.message || String(error); }
});
$("#pauseRecording")?.addEventListener("click", () => { recorder?.pause(); setRecorderButtons("paused"); });
$("#resumeRecording")?.addEventListener("click", () => { recorder?.resume(); setRecorderButtons("recording"); });
$("#stopRecording")?.addEventListener("click", () => recorder?.stop());
setRecorderButtons("idle");
loadPanels();

for (const filters of $$(".filters")) {
  const panel = filters.parentElement?.querySelector("[data-load-base]");
  if (!panel) continue;
  const reload = () => {
    const url = new URL(panel.dataset.loadBase, window.location.origin);
    for (const input of filters.querySelectorAll("[data-filter]")) if (input.value) url.searchParams.set(input.dataset.filter, input.value);
    panel.dataset.load = url.pathname + url.search;
    const existing = panel.querySelector(".libraryList, .tableWrap, .empty-state, .error-state, .loading, .statusGrid");
    if (existing) existing.outerHTML = '<div class="loading">Loading...</div>';
    loadPanel(panel);
  };
  filters.addEventListener("input", reload);
  filters.addEventListener("change", reload);
}
`;
