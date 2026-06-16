import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Power,
  LogIn,
  Search,
  ChevronDown,
  MousePointerClick,
  Maximize2,
  Mail,
  Trash2,
  CircleDot,
  Loader2,
  Bot,
  Hand,
  Download,
  Monitor,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/")({
  component: LeadEngine,
  head: () => ({
    meta: [
      { title: "LinkedIn Lead Engine — Hybrid Scraper Control" },
      {
        name: "description",
        content:
          "Dashboard to control a Selenium-based LinkedIn scraper with manual overrides, live logs, and extracted email results.",
      },
    ],
  }),
});

type LogLevel = "info" | "success" | "warn" | "error";
type LogEntry = { id: number; ts: string; level: LogLevel; message: string };
type EmailRow = { email: string; keyword: string; foundAt: string };

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {active && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            active ? "bg-primary" : "bg-muted-foreground/40"
          }`}
        />
      </span>
      <span className="text-sm text-muted-foreground">
        {label}:{" "}
        <span className={active ? "text-foreground font-medium" : "text-muted-foreground"}>
          {active ? "Active" : "Inactive"}
        </span>
      </span>
    </div>
  );
}

function LeadEngine() {
  const [browserActive, setBrowserActive] = useState(false);
  const [authActive, setAuthActive] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [queue, setQueue] = useState<string[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [paused, setPaused] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, level: LogLevel = "info") => {
    setLogs((prev) => [
      ...prev,
      {
        id: ++logIdRef.current,
        ts: new Date().toLocaleTimeString(),
        level,
        message,
      },
    ]);
  };

  useEffect(() => {
    addLog("Dashboard ready. Connecting to local backend at " + API_BASE, "info");

    // Initial status and email fetch
    const init = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (res.ok) {
          const data = await res.json();
          setBrowserActive(data.browser_active);
          setAuthActive(data.auth_active);
          setRunning(data.status === "Running");
          setCurrentKeyword(data.current_search);
        }
        
        const emailRes = await fetch(`${API_BASE}/api/emails`);
        if (emailRes.ok) {
          const emailData = await emailRes.json();
          if (emailData.emails) {
            setEmails(emailData.emails.map((e: string) => ({ email: e, keyword: "Existing", foundAt: "Historical" })));
          }
        }
      } catch (e) {
        addLog("Failed to connect to backend on startup.", "error");
      }
    };
    init();

    // Polling for status and logs
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (res.ok) {
          const data = await res.json();
          setBrowserActive(data.browser_active);
          setAuthActive(data.auth_active);
          const isRunning = data.status === "Running";
          if (isRunning !== running) setRunning(isRunning);
          setCurrentKeyword(data.current_search);
          
          // If we just finished running, refresh emails
          if (!isRunning && running) {
            const emailRes = await fetch(`${API_BASE}/api/emails`);
            const emailData = await emailRes.json();
            if (emailData.emails) {
              setEmails(emailData.emails.map((e: string) => ({ email: e, keyword: "Auto", foundAt: new Date().toLocaleTimeString() })));
            }
          }
        }

        // Fetch logs
        const logRes = await fetch(`${API_BASE}/api/logs`);
        if (logRes.ok) {
          const logData = await logRes.json();
          if (logData.logs && logData.logs.length > 0) {
            // Process raw log lines from backend
            const formattedLogs: LogEntry[] = logData.logs.map((line: string, index: number) => {
              // Example line: INFO 2024-04-21 12:00:00 main.py:100 - Message
              const parts = line.split(" - ");
              const meta = parts[0] || "";
              const message = parts[1] || line;
              
              let level: LogLevel = "info";
              if (meta.includes("ERROR")) level = "error";
              if (meta.includes("WARNING")) level = "warn";
              if (message.toLowerCase().includes("success") || message.toLowerCase().includes("ok")) level = "success";

              const tsPart = meta.split(" ")[1] || new Date().toLocaleTimeString();

              return {
                id: index,
                ts: tsPart,
                level,
                message: message.trim()
              };
            });
            setLogs(formattedLogs);
          }
        }
      } catch (e) {
        // Silent fail on polling
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!browserActive) {
      setScreenshot(null);
      setScreenshotUrl(null);
      return;
    }
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/screenshot`);
        if (res.ok) {
          const data = await res.json();
          if (data.screenshot) setScreenshot(data.screenshot);
          if (data.url) setScreenshotUrl(data.url);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [browserActive]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const parseKeywords = () =>
    keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

  const callBackend = async (path: string, body?: unknown) => {
    addLog(`→ POST ${path}`, "info");
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      addLog(`← ${path} ok`, "success");
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`✗ ${path} failed: ${msg} (is your local backend running?)`, "error");
      return null;
    }
  };

  const handleStartBrowser = async () => {
    await callBackend("/start_browser");
    setBrowserActive(true);
    addLog("Browser session initialized.", "success");
  };

  const handleAuth = async () => {
    await callBackend("/login");
    setAuthActive(true);
    addLog("Authentication handled via cookie injection.", "success");
  };

  const handleClose = async () => {
    await callBackend("/close_browser");
    setBrowserActive(false);
    setAuthActive(false);
    setRunning(false);
    setCurrentKeyword(null);
    setQueue([]);
    addLog("Chrome closed and session terminated.", "warn");
  };

  const handleStartWorkflow = async () => {
    const kws = parseKeywords();
    if (!kws.length) {
      addLog("No search terms provided.", "warn");
      return;
    }
    setQueue(kws);
    setCurrentKeyword(kws[0]);
    setRunning(true);
    addLog(`Workflow queued with ${kws.length} keyword(s): ${kws.join(", ")}`, "info");
    await callBackend("/start_workflow", { keywords: kws });
  };

  const handleManual = async (action: string, label: string) => {
    addLog(`Manual override: ${label}`, "info");
    await callBackend(`/manual/${action}`, { keyword: currentKeyword });
    if (action === "extract") {
      // Refresh the real email list from backend
      const res = await fetch(`${API_BASE}/api/emails`);
      const data = await res.json();
      if (data.emails) {
        setEmails(data.emails.map((e: string) => ({ email: e, keyword: currentKeyword ?? "Manual", foundAt: new Date().toLocaleTimeString() })));
      }
    }
  };

  const clearLogs = () => setLogs([]);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = `${API_BASE}/api/emails/download`;
    a.download = "extracted_emails.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleClearEmails = async () => {
    if (!window.confirm(`Delete all ${emails.length} emails from the database? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/emails`, { method: "DELETE" });
      if (res.ok) {
        setEmails([]);
        addLog("All emails cleared from database.", "warn");
      } else {
        addLog("Failed to clear emails.", "error");
      }
    } catch (e) {
      addLog("Error clearing emails.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <CircleDot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">LinkedIn Lead Engine</h1>
              <p className="text-xs text-muted-foreground">Hybrid manual + automated scraper</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <StatusDot active={browserActive} label="Browser" />
            <StatusDot active={authActive} label="Auth" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Browser Control</CardTitle>
              <CardDescription className="text-xs">
                Manage the local Selenium session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={handleStartBrowser}
                disabled={browserActive}
                className="w-full justify-start"
              >
                <Play /> Initialize Browser
              </Button>
              <Button
                onClick={handleAuth}
                disabled={!browserActive || authActive}
                variant="secondary"
                className="w-full justify-start"
              >
                <LogIn /> Handle Auth
              </Button>
              <Button
                onClick={handleClose}
                disabled={!browserActive}
                variant="destructive"
                className="w-full justify-start"
              >
                <Power /> Close Chrome
              </Button>
            </CardContent>
          </Card>
        </aside>

        {/* Main column */}
        <section className="space-y-6">
          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4" /> Search Keywords
              </CardTitle>
              <CardDescription>
                Single term or comma-separated list. The bot processes them sequentially.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kw">Keywords</Label>
                <div className="flex gap-2">
                  <Input
                    id="kw"
                    placeholder="e.g. PythonDeveloper, Hiring, ReactJobs"
                    value={keywordsInput}
                    onChange={(e) => setKeywordsInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleStartWorkflow}
                    disabled={!browserActive || !authActive}
                  >
                    {running ? <Loader2 className="animate-spin" /> : <Play />}
                    Start Workflow
                  </Button>
                </div>
              </div>

              {queue.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Queue
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {queue.map((k) => (
                      <Badge
                        key={k}
                        variant={k === currentKeyword ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {k === currentKeyword && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        {k}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mode + step controls */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Workflow Steps</CardTitle>
                  <CardDescription>
                    {autoMode
                      ? "Auto mode — steps run on a loop. Pause anytime or trigger a step manually."
                      : "Manual mode — nothing runs automatically. Click each step yourself."}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
                    {autoMode ? (
                      <Bot className="h-4 w-4 text-primary" />
                    ) : (
                      <Hand className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Label htmlFor="mode" className="text-xs cursor-pointer">
                      {autoMode ? "Auto" : "Manual"}
                    </Label>
                    <Switch
                      id="mode"
                      checked={autoMode}
                      onCheckedChange={(v) => {
                        setAutoMode(v);
                        setPaused(false);
                        addLog(`Switched to ${v ? "AUTO" : "MANUAL"} mode.`, "info");
                        callBackend("/set_mode", { mode: v ? "auto" : "manual" });
                      }}
                    />
                  </div>

                  {autoMode && (
                    <Button
                      size="sm"
                      variant={paused ? "default" : "secondary"}
                      onClick={() => {
                        const next = !paused;
                        setPaused(next);
                        addLog(next ? "Auto loop paused." : "Auto loop resumed.", "warn");
                        callBackend(next ? "/pause" : "/resume");
                      }}
                      disabled={!browserActive}
                    >
                      {paused ? <Play /> : <Pause />}
                      {paused ? "Resume" : "Pause"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button
                  variant="outline"
                  onClick={() => handleManual("scroll", "Scroll Down")}
                  disabled={!browserActive}
                >
                  <ChevronDown /> Scroll Down
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleManual("show_more", "Click Show More")}
                  disabled={!browserActive}
                >
                  <MousePointerClick /> Show More
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleManual("expand_posts", "Expand 'See More' on Posts")}
                  disabled={!browserActive}
                >
                  <Maximize2 /> Expand Posts
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleManual("extract", "Extract Emails")}
                  disabled={!browserActive}
                >
                  <Mail /> Extract Emails
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Manual triggers always work — even while auto mode is running or paused.
              </p>
            </CardContent>
          </Card>

          {/* Live Browser View */}
          {browserActive && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Monitor className="h-4 w-4" /> Live Browser View
                  </CardTitle>
                  <CardDescription className="max-w-lg truncate text-xs">
                    {screenshotUrl ?? "No page loaded"}
                  </CardDescription>
                </div>
                <Badge variant={screenshot ? "default" : "secondary"} className="text-xs">
                  {screenshot ? "Live" : "No signal"}
                </Badge>
              </CardHeader>
              <Separator />
              <CardContent className="p-2">
                {screenshot ? (
                  <img
                    src={`data:image/png;base64,${screenshot}`}
                    alt="Live browser view"
                    className="w-full rounded border border-border/40"
                  />
                ) : (
                  <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                    Waiting for browser...
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Logs + Results */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">Live Console</CardTitle>
                  <CardDescription>Streaming output from the backend.</CardDescription>
                </div>
                <Button size="sm" variant="ghost" onClick={clearLogs}>
                  <Trash2 /> Clear
                </Button>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <ScrollArea className="h-72">
                  <div className="space-y-1 p-4 font-mono text-xs">
                    {logs.map((l) => (
                      <div key={l.id} className="flex gap-2">
                        <span className="text-muted-foreground shrink-0">{l.ts}</span>
                        <span
                          className={
                            l.level === "success"
                              ? "text-primary"
                              : l.level === "error"
                                ? "text-destructive"
                                : l.level === "warn"
                                  ? "text-yellow-500"
                                  : "text-foreground/80"
                          }
                        >
                          {l.message}
                        </span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">Extracted Emails</CardTitle>
                  <CardDescription>
                    {emails.length} unique result{emails.length === 1 ? "" : "s"} this session.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownload}
                    disabled={emails.length === 0}
                  >
                    <Download /> Download
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleClearEmails}
                    disabled={emails.length === 0}
                  >
                    <Trash2 /> Clear
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <ScrollArea className="h-72">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-right">Found</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emails.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center text-sm text-muted-foreground py-10"
                          >
                            No emails extracted yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        emails.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{e.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {e.keyword}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {e.foundAt}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
