"use client";

import { useEffect, useMemo, useState } from "react";
import { clinicAdminApi, type AdminQuestionnaire, type AdminResponse } from "@/lib/clinic-admin";

type ViewId = "all" | "new" | "in_review" | "follow_up" | "reviewed" | "archived" | "kanban";
type SortDirection = "asc" | "desc";
type ToolbarPanel = "filter" | "sort" | "fields" | null;
type FieldColumn = { key: string; label: string; type?: string };
type SavedView = { search: string; statuses: string[]; sortKey: string; sortDirection: SortDirection; visibleFields: string[]; groupByStatus: boolean };

const statuses = [
  { id: "new", label: "New", dot: "bg-sky-500", badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { id: "in_review", label: "In review", dot: "bg-violet-500", badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  { id: "follow_up", label: "Follow-up", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { id: "reviewed", label: "Reviewed", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { id: "archived", label: "Archived", dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
] as const;

const views: Array<{ id: ViewId; label: string; icon: "grid" | "kanban"; status?: string }> = [
  { id: "all", label: "All submissions", icon: "grid" },
  { id: "new", label: "New intake", icon: "grid", status: "new" },
  { id: "in_review", label: "In review", icon: "grid", status: "in_review" },
  { id: "follow_up", label: "Follow-up due", icon: "grid", status: "follow_up" },
  { id: "reviewed", label: "Reviewed", icon: "grid", status: "reviewed" },
  { id: "archived", label: "Archived", icon: "grid", status: "archived" },
  { id: "kanban", label: "Kanban by status", icon: "kanban" },
];

function Icon({ name, className = "h-4 w-4" }: { name: "search" | "filter" | "sort" | "fields" | "group" | "refresh" | "grid" | "kanban" | "chevron" | "close" | "save"; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    filter: <path d="M4 5h16l-6.5 7.5V19l-3 1v-7.5z" />,
    sort: <><path d="M8 6h12M8 12h9M8 18h6" /><path d="m3 8 2-2 2 2M5 6v12" /></>,
    fields: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M9 5v14M15 5v14" /></>,
    group: <><rect x="4" y="4" width="16" height="6" rx="1" /><rect x="4" y="14" width="16" height="6" rx="1" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 1 0-2 5" /></>,
    grid: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 4v16" /></>,
    kanban: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><rect x="17" y="4" width="4" height="14" rx="1" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    save: <><path d="M5 4h12l2 2v14H5z" /><path d="M8 4v6h8V4M8 20v-6h8v6" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

function normalizedStatus(status?: string): string { return !status || status === "submitted" ? "new" : status; }
function statusConfig(status?: string) { return statuses.find((item) => item.id === normalizedStatus(status)) ?? statuses[0]; }
function titleFromKey(key: string): string { return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (typeof object.name === "string") return object.name;
    if (typeof object.url === "string") return object.url;
    if ("value" in object) return formatValue(object.value);
    return Object.values(object).map(formatValue).filter((item) => item !== "—").join(" · ") || "—";
  }
  return String(value);
}

function shortValue(value: unknown, length = 46): string {
  const formatted = formatValue(value);
  return formatted.length > length ? `${formatted.slice(0, length)}…` : formatted;
}

function responseTitle(response: AdminResponse, fields: FieldColumn[]): string {
  const preferred = fields.find((field) => /(name|patient|client)/i.test(field.key));
  const value = formatValue(preferred ? response.answers?.[preferred.key] : undefined);
  return value === "—" ? `Response #${response.id}` : value;
}

function dateLabel(value?: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function GridIcon({ type }: { type: "grid" | "kanban" }) { return <Icon name={type} className="h-3.5 w-3.5" />; }

export default function ClinicResponses() {
  const [forms, setForms] = useState<AdminQuestionnaire[]>([]);
  const [formId, setFormId] = useState("");
  const [responses, setResponses] = useState<AdminResponse[]>([]);
  const [activeView, setActiveView] = useState<ViewId>("all");
  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState("submittedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [groupByStatus, setGroupByStatus] = useState(false);
  const [panel, setPanel] = useState<ToolbarPanel>(null);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [openResponse, setOpenResponse] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fields = useMemo<FieldColumn[]>(() => {
    const columns = new Map<string, FieldColumn>();
    forms.filter((form) => !formId || String(form.id) === formId).forEach((form) => form.questions?.forEach((question) => {
      if (question.key) columns.set(question.key, { key: question.key, label: question.label || titleFromKey(question.key), type: question.type });
    }));
    responses.filter((response) => !formId || String(response.questionnaire?.id) === formId).forEach((response) => Object.keys(response.answers ?? {}).forEach((key) => {
      if (!columns.has(key)) columns.set(key, { key, label: titleFromKey(key) });
    }));
    return Array.from(columns.values());
  }, [formId, forms, responses]);

  const loadResponses = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    try { setResponses(await clinicAdminApi.allResponses()); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "We could not load responses."); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    clinicAdminApi.forms().then((items) => {
      setForms(items);
      setFormId(new URLSearchParams(window.location.search).get("form") ?? "");
      void loadResponses();
    }).catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : "We could not load clinic forms.");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setSelectedIds([]); setOpenResponse(null);
    const saved = window.localStorage.getItem("careflow.response-view.submissions");
    if (saved) {
      try {
        const view = JSON.parse(saved) as SavedView;
        setSearch(view.search ?? ""); setStatusFilters(view.statuses ?? []); setSortKey(view.sortKey ?? "submittedAt");
        setSortDirection(view.sortDirection ?? "desc"); setVisibleFields(view.visibleFields ?? []); setGroupByStatus(view.groupByStatus ?? false);
      } catch { window.localStorage.removeItem("careflow.response-view.submissions"); }
    } else {
      setSearch(""); setStatusFilters([]); setSortKey("submittedAt"); setSortDirection("desc"); setVisibleFields([]); setGroupByStatus(false);
    }
  }, [formId]);

  useEffect(() => {
    if (fields.length > 0 && !fields.some((field) => visibleFields.includes(field.key))) setVisibleFields(fields.slice(0, 8).map((field) => field.key));
  }, [fields, visibleFields]);

  const shownFields = fields.filter((field) => visibleFields.includes(field.key));
  const activeViewStatus = views.find((view) => view.id === activeView)?.status;
  const sourceResponses = useMemo(() => responses.filter((response) => !formId || String(response.questionnaire?.id) === formId), [formId, responses]);
  const displayedResponses = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = sourceResponses.filter((response) => {
      const responseStatus = normalizedStatus(response.status);
      if (activeViewStatus && responseStatus !== activeViewStatus) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(responseStatus)) return false;
      if (!query) return true;
      return [response.id, response.uuid, responseStatus, ...Object.values(response.answers ?? {})].map(formatValue).some((value) => value.toLowerCase().includes(query));
    });
    return filtered.sort((left, right) => {
      const leftValue = sortKey === "submittedAt" ? left.submittedAt : sortKey === "id" ? left.id : left.answers?.[sortKey];
      const rightValue = sortKey === "submittedAt" ? right.submittedAt : sortKey === "id" ? right.id : right.answers?.[sortKey];
      const result = formatValue(leftValue).localeCompare(formatValue(rightValue), undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? result : -result;
    });
  }, [activeViewStatus, search, sortDirection, sortKey, sourceResponses, statusFilters]);

  const counts = useMemo(() => sourceResponses.reduce<Record<string, number>>((result, response) => {
    const status = normalizedStatus(response.status); result[status] = (result[status] ?? 0) + 1; return result;
  }, {}), [sourceResponses]);

  const updateStatus = async (response: AdminResponse, status: string) => {
    const sourceFormId = response.questionnaire?.id;
    if (!sourceFormId || normalizedStatus(response.status) === status) return;
    const previous = response.status;
    setSavingId(response.id);
    setResponses((items) => items.map((item) => item.id === response.id ? { ...item, status } : item));
    setOpenResponse((item) => item?.id === response.id ? { ...item, status } : item);
    try {
      const updated = await clinicAdminApi.updateResponseStatus(sourceFormId, response.id, status);
      setResponses((items) => items.map((item) => item.id === response.id ? updated : item));
      setOpenResponse((item) => item?.id === response.id ? updated : item);
      setNotice("Response status updated"); window.setTimeout(() => setNotice(""), 2200);
    } catch (requestError) {
      setResponses((items) => items.map((item) => item.id === response.id ? { ...item, status: previous } : item));
      setOpenResponse((item) => item?.id === response.id ? { ...item, status: previous } : item);
      setError(requestError instanceof Error ? requestError.message : "We could not update the response.");
    } finally { setSavingId(null); }
  };

  const saveView = () => {
    const view: SavedView = { search, statuses: statusFilters, sortKey, sortDirection, visibleFields, groupByStatus };
    window.localStorage.setItem("careflow.response-view.submissions", JSON.stringify(view));
    setNotice("View preferences saved"); window.setTimeout(() => setNotice(""), 2200);
  };
  const toggleSelection = (id: string | number) => setSelectedIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const allSelected = displayedResponses.length > 0 && displayedResponses.every((response) => selectedIds.includes(response.id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : displayedResponses.map((response) => response.id));

  if (error && forms.length === 0) return <div className="rounded-2xl border border-error-200 bg-error-50 p-5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">{error}</div>;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
      {notice && <div className="absolute right-5 top-4 z-50 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg dark:bg-white dark:text-gray-900">{notice}</div>}
      <div className="border-b border-gray-200 bg-[#f7fbfc] px-3 pt-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Response tables">
          <button type="button" role="tab" aria-selected className="shrink-0 rounded-t-lg border-x border-t border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white">Form submissions<span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">{responses.length}</span></button>
          <button type="button" disabled title="Follow-up tables will plug into this workspace" className="shrink-0 px-3 py-2 text-xs font-medium text-gray-400">+ Follow-up table</button>
        </div>
      </div>

      <div className="flex min-h-[620px]">
        <aside className="hidden w-52 shrink-0 border-r border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/60 lg:block">
          <div className="relative mb-3"><Icon name="search" className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a view" className="h-8 w-full rounded-md border border-gray-200 bg-white pl-8 pr-2 text-xs text-gray-800 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></div>
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Views</p>
          <nav className="flex flex-col gap-0.5">{views.map((view) => {
            const count = view.status ? counts[view.status] ?? 0 : sourceResponses.length;
            return <button key={view.id} type="button" onClick={() => setActiveView(view.id)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition ${activeView === view.id ? "bg-white font-semibold text-gray-900 shadow-xs ring-1 ring-gray-200 dark:bg-gray-800 dark:text-white dark:ring-gray-700" : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"}`}><GridIcon type={view.icon} /><span className="min-w-0 flex-1 truncate">{view.label}</span>{view.id !== "kanban" && <span className="text-[10px] tabular-nums text-gray-400">{count}</span>}</button>;
          })}</nav>
          <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-800"><p className="px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Data sources</p><div className="mt-2 rounded-lg border border-dashed border-gray-300 p-3 text-[11px] leading-4 text-gray-500 dark:border-gray-700 dark:text-gray-400">Follow-up tables can be added here without changing the submission views.</div></div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
            <select value={activeView} onChange={(event) => setActiveView(event.target.value as ViewId)} className="h-8 rounded-md border-0 bg-transparent px-2 text-xs font-semibold text-gray-800 outline-none lg:hidden dark:text-white">{views.map((view) => <option key={view.id} value={view.id}>{view.label}</option>)}</select>
            <div className="hidden items-center gap-2 text-xs font-semibold text-gray-800 lg:flex dark:text-white"><GridIcon type={activeView === "kanban" ? "kanban" : "grid"} />{views.find((view) => view.id === activeView)?.label}</div><div className="h-5 w-px bg-gray-200 dark:bg-gray-800" />
            <ToolbarButton icon="filter" label={statusFilters.length ? `Filter · ${statusFilters.length}` : "Filter"} active={panel === "filter" || statusFilters.length > 0} onClick={() => setPanel(panel === "filter" ? null : "filter")} />
            <ToolbarButton icon="group" label="Group" active={groupByStatus} onClick={() => setGroupByStatus((value) => !value)} disabled={activeView === "kanban"} />
            <ToolbarButton icon="sort" label="Sort" active={panel === "sort" || sortKey !== "submittedAt" || sortDirection !== "desc"} onClick={() => setPanel(panel === "sort" ? null : "sort")} />
            <ToolbarButton icon="fields" label={fields.length - shownFields.length ? `${fields.length - shownFields.length} hidden` : "Fields"} active={panel === "fields" || fields.length !== shownFields.length} onClick={() => setPanel(panel === "fields" ? null : "fields")} />
            <div className="relative ml-auto min-w-[170px] grow sm:max-w-xs sm:grow-0"><Icon name="search" className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-800 outline-none focus:border-brand-400 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></div>
            <button type="button" onClick={saveView} className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"><Icon name="save" className="h-3.5 w-3.5" />Save view</button>
            <select value={formId} onChange={(event) => setFormId(event.target.value)} aria-label="Filter by form" className="h-8 max-w-40 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"><option value="">All forms</option>{forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}</select>
            <button type="button" onClick={() => void loadResponses(true)} disabled={refreshing} aria-label="Refresh responses" className="grid h-8 w-8 place-items-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"><Icon name="refresh" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></button>
          </div>
          <div className="relative">
            {panel === "filter" && <FilterPanel selected={statusFilters} onChange={setStatusFilters} onClose={() => setPanel(null)} />}
            {panel === "sort" && <SortPanel fields={fields} sortKey={sortKey} direction={sortDirection} onSortKey={setSortKey} onDirection={setSortDirection} onClose={() => setPanel(null)} />}
            {panel === "fields" && <FieldsPanel fields={fields} visible={visibleFields} onChange={setVisibleFields} onClose={() => setPanel(null)} />}
            {error && <div className="border-b border-error-200 bg-error-50 px-4 py-3 text-xs text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-300">{error}<button type="button" onClick={() => setError("")} className="ml-3 font-semibold underline">Dismiss</button></div>}
            {loading ? <div className="grid min-h-[520px] place-items-center"><div className="flex items-center gap-2 text-sm text-gray-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />Loading records…</div></div> : activeView === "kanban" ? <Kanban responses={displayedResponses} fields={fields} savingId={savingId} onOpen={setOpenResponse} onStatus={updateStatus} /> : <GridView responses={displayedResponses} fields={shownFields} selectedIds={selectedIds} allSelected={allSelected} groupByStatus={groupByStatus} savingId={savingId} onToggle={toggleSelection} onToggleAll={toggleAll} onOpen={setOpenResponse} onStatus={updateStatus} />}
          </div>
        </main>
      </div>
      {openResponse && <RecordDrawer response={openResponse} fields={fields} saving={savingId === openResponse.id} onClose={() => setOpenResponse(null)} onStatus={(status) => void updateStatus(openResponse, status)} />}
    </div>
  );
}

function ToolbarButton({ icon, label, active, disabled, onClick }: { icon: "filter" | "sort" | "fields" | "group"; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"}`}><Icon name={icon} className="h-3.5 w-3.5" />{label}</button>;
}

function FilterPanel({ selected, onChange, onClose }: { selected: string[]; onChange: (items: string[]) => void; onClose: () => void }) {
  return <Popover title="Filter records" onClose={onClose}><div className="flex flex-col gap-1">{statuses.map((status) => <label key={status.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"><input type="checkbox" checked={selected.includes(status.id)} onChange={() => onChange(selected.includes(status.id) ? selected.filter((item) => item !== status.id) : [...selected, status.id])} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" /><span className={`h-2 w-2 rounded-full ${status.dot}`} />{status.label}</label>)}</div>{selected.length > 0 && <button type="button" onClick={() => onChange([])} className="mt-2 text-xs font-medium text-brand-600">Clear filters</button>}</Popover>;
}

function SortPanel({ fields, sortKey, direction, onSortKey, onDirection, onClose }: { fields: FieldColumn[]; sortKey: string; direction: SortDirection; onSortKey: (key: string) => void; onDirection: (direction: SortDirection) => void; onClose: () => void }) {
  return <Popover title="Sort records" onClose={onClose}><div className="flex gap-2"><select value={sortKey} onChange={(event) => onSortKey(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="submittedAt">Submitted date</option><option value="id">Record ID</option>{fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select><select value={direction} onChange={(event) => onDirection(event.target.value as SortDirection)} className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="asc">Ascending</option><option value="desc">Descending</option></select></div></Popover>;
}

function FieldsPanel({ fields, visible, onChange, onClose }: { fields: FieldColumn[]; visible: string[]; onChange: (items: string[]) => void; onClose: () => void }) {
  return <Popover title="Visible fields" onClose={onClose} wide><div className="mb-2 flex gap-3 text-[11px]"><button type="button" onClick={() => onChange(fields.map((field) => field.key))} className="font-medium text-brand-600">Show all</button><button type="button" onClick={() => onChange([])} className="font-medium text-gray-500">Hide all</button></div><div className="max-h-72 overflow-y-auto">{fields.map((field) => <label key={field.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"><input type="checkbox" checked={visible.includes(field.key)} onChange={() => onChange(visible.includes(field.key) ? visible.filter((item) => item !== field.key) : [...visible, field.key])} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" /><span className="truncate">{field.label}</span><span className="ml-auto text-[10px] text-gray-400">{field.type ?? "field"}</span></label>)}</div></Popover>;
}

function Popover({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className={`absolute left-3 top-2 z-40 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900 ${wide ? "w-80" : "w-72"}`}><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-gray-900 dark:text-white">{title}</p><button type="button" onClick={onClose} className="grid h-6 w-6 place-items-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><Icon name="close" className="h-3.5 w-3.5" /></button></div>{children}</div>;
}

function StatusSelect({ value, disabled, onChange }: { value?: string; disabled?: boolean; onChange: (status: string) => void }) {
  const config = statusConfig(value);
  return <div className="relative inline-flex" onClick={(event) => event.stopPropagation()}><span className={`pointer-events-none absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${config.dot}`} /><select value={normalizedStatus(value)} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-label="Response status" className={`h-7 max-w-32 appearance-none rounded-full border-0 py-1 pl-6 pr-6 text-[11px] font-semibold outline-none ring-1 ring-inset ring-black/5 ${config.badge}`}>{statuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></div>;
}

function GridView({ responses, fields, selectedIds, allSelected, groupByStatus, savingId, onToggle, onToggleAll, onOpen, onStatus }: { responses: AdminResponse[]; fields: FieldColumn[]; selectedIds: Array<string | number>; allSelected: boolean; groupByStatus: boolean; savingId: string | number | null; onToggle: (id: string | number) => void; onToggleAll: () => void; onOpen: (response: AdminResponse) => void; onStatus: (response: AdminResponse, status: string) => void }) {
  if (responses.length === 0) return <EmptyState />;
  const grouped = groupByStatus ? statuses.map((status) => ({ status, items: responses.filter((response) => normalizedStatus(response.status) === status.id) })).filter((group) => group.items.length > 0) : [{ status: null, items: responses }];
  return <div className="max-h-[560px] overflow-auto">
    <table className="min-w-max border-separate border-spacing-0 text-left text-xs">
      <thead className="sticky top-0 z-20 bg-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
        <tr>
          <th className="sticky left-0 z-30 h-9 w-12 border-b border-r border-gray-200 bg-gray-50 px-3 dark:border-gray-800 dark:bg-gray-900"><input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Select all records" className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" /></th>
          <th className="sticky left-12 z-30 min-w-56 border-b border-r border-gray-200 bg-gray-50 px-3 dark:border-gray-800 dark:bg-gray-900">Primary field</th>
          <th className="min-w-52 border-b border-r border-gray-200 px-3 dark:border-gray-800">Form</th>
          <th className="min-w-36 border-b border-r border-gray-200 px-3 dark:border-gray-800">Status</th>
          <th className="min-w-44 border-b border-r border-gray-200 px-3 dark:border-gray-800">Submitted</th>
          {fields.map((field) => <th key={field.key} className="min-w-52 max-w-72 border-b border-r border-gray-200 px-3 normal-case tracking-normal dark:border-gray-800"><span className="flex items-center gap-1.5"><span className="text-gray-400">A</span>{field.label}</span></th>)}
        </tr>
      </thead>
      <tbody>{grouped.map((group) => <GridGroup key={group.status?.id ?? "all"} group={group} fields={fields} selectedIds={selectedIds} savingId={savingId} onToggle={onToggle} onOpen={onOpen} onStatus={onStatus} />)}</tbody>
    </table>
    <div className="sticky bottom-0 left-0 flex h-9 items-center border-t border-gray-200 bg-white/95 px-4 text-[11px] font-medium text-gray-500 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">{responses.length} records</div>
  </div>;
}

function GridGroup({ group, fields, selectedIds, savingId, onToggle, onOpen, onStatus }: { group: { status: typeof statuses[number] | null; items: AdminResponse[] }; fields: FieldColumn[]; selectedIds: Array<string | number>; savingId: string | number | null; onToggle: (id: string | number) => void; onOpen: (response: AdminResponse) => void; onStatus: (response: AdminResponse, status: string) => void }) {
  return <>
    {group.status && <tr><td colSpan={fields.length + 5} className="border-b border-gray-200 bg-gray-50/90 px-4 py-2 font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-900/90 dark:text-gray-300"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${group.status.dot}`} />{group.status.label}<span className="ml-2 font-normal text-gray-400">{group.items.length}</span></td></tr>}
    {group.items.map((response) => <tr key={response.id} onClick={() => onOpen(response)} className="group cursor-pointer bg-white text-gray-700 hover:bg-brand-50/40 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-brand-500/[0.04]">
      <td className="sticky left-0 z-10 h-10 border-b border-r border-gray-200 bg-inherit px-3 dark:border-gray-800"><input type="checkbox" checked={selectedIds.includes(response.id)} onClick={(event) => event.stopPropagation()} onChange={() => onToggle(response.id)} aria-label={`Select response ${response.id}`} className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" /></td>
      <td className="sticky left-12 z-10 max-w-72 border-b border-r border-gray-200 bg-inherit px-3 font-medium text-gray-900 dark:border-gray-800 dark:text-white"><span className="flex items-center gap-2"><span className="text-[10px] tabular-nums text-gray-400">{response.id}</span><span className="truncate">{responseTitle(response, fields)}</span><Icon name="chevron" className="ml-auto h-3 w-3 opacity-0 transition group-hover:opacity-100" /></span></td>
      <td className="max-w-56 border-b border-r border-gray-200 px-3 dark:border-gray-800"><div className="truncate font-medium text-gray-600 dark:text-gray-300">{response.questionnaire?.name ?? "—"}</div></td>
      <td className="border-b border-r border-gray-200 px-3 dark:border-gray-800"><StatusSelect value={response.status} disabled={savingId === response.id} onChange={(status) => onStatus(response, status)} /></td>
      <td className="whitespace-nowrap border-b border-r border-gray-200 px-3 text-gray-500 dark:border-gray-800 dark:text-gray-400">{dateLabel(response.submittedAt)}</td>
      {fields.map((field) => <td key={field.key} title={formatValue(response.answers?.[field.key])} className="max-w-72 border-b border-r border-gray-200 px-3 text-gray-600 dark:border-gray-800 dark:text-gray-300"><div className="truncate">{shortValue(response.answers?.[field.key])}</div></td>)}
    </tr>)}
  </>;
}

function Kanban({ responses, fields, savingId, onOpen, onStatus }: { responses: AdminResponse[]; fields: FieldColumn[]; savingId: string | number | null; onOpen: (response: AdminResponse) => void; onStatus: (response: AdminResponse, status: string) => void }) {
  return <div className="min-h-[560px] overflow-x-auto bg-gray-50/70 p-4 dark:bg-gray-900/50"><div className="flex min-w-max items-start gap-3">{statuses.map((status) => {
    const items = responses.filter((response) => normalizedStatus(response.status) === status.id);
    return <section key={status.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("text/plain"); const response = responses.find((item) => String(item.id) === id); if (response) void onStatus(response, status.id); }} className="w-72 rounded-xl border border-gray-200 bg-gray-100/80 p-2 dark:border-gray-700 dark:bg-gray-800/70">
      <header className="flex items-center gap-2 px-1 pb-2 pt-1"><span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} /><h3 className="text-xs font-semibold text-gray-800 dark:text-white">{status.label}</h3><span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-gray-500 shadow-xs dark:bg-gray-900 dark:text-gray-400">{items.length}</span></header>
      <div className="flex max-h-[490px] flex-col gap-2 overflow-y-auto">
        {items.map((response) => <article key={response.id} draggable={savingId !== response.id} onDragStart={(event) => event.dataTransfer.setData("text/plain", String(response.id))} onClick={() => onOpen(response)} className="cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-xs transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md active:cursor-grabbing dark:border-gray-700 dark:bg-gray-950 dark:hover:border-brand-600">
          <div className="flex items-start gap-2"><p className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-900 dark:text-white">{responseTitle(response, fields)}</p><span className="text-[10px] tabular-nums text-gray-400">#{response.id}</span></div>
          <p className="mt-1 truncate text-[10px] font-medium text-brand-600 dark:text-brand-400">{response.questionnaire?.name ?? "Unknown form"}</p>
          <div className="mt-3 flex flex-col gap-1.5">{fields.slice(0, 3).map((field) => <div key={field.key} className="flex items-start gap-2 text-[11px]"><span className="w-20 shrink-0 truncate text-gray-400">{field.label}</span><span className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300">{shortValue(response.answers?.[field.key], 28)}</span></div>)}</div>
          <div className="mt-3 border-t border-gray-100 pt-2 text-[10px] text-gray-400 dark:border-gray-800">{dateLabel(response.submittedAt)}</div>
        </article>)}
        {items.length === 0 && <div className="rounded-lg border border-dashed border-gray-300 px-3 py-8 text-center text-[11px] text-gray-400 dark:border-gray-700">Drop records here</div>}
      </div>
    </section>;
  })}</div></div>;
}

function RecordDrawer({ response, fields, saving, onClose, onStatus }: { response: AdminResponse; fields: FieldColumn[]; saving: boolean; onClose: () => void; onStatus: (status: string) => void }) {
  return <div className="absolute inset-0 z-50 flex justify-end bg-gray-950/25 backdrop-blur-[1px]" onClick={onClose}><aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-gray-950" onClick={(event) => event.stopPropagation()}><header className="flex items-start gap-3 border-b border-gray-200 p-5 dark:border-gray-800"><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">{response.questionnaire?.name ?? "Form submission"} · #{response.id}</p><h2 className="mt-1 truncate text-lg font-bold text-gray-900 dark:text-white">{responseTitle(response, fields)}</h2><p className="mt-1 text-xs text-gray-500">{dateLabel(response.submittedAt)} · {response.uuid}</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"><Icon name="close" className="h-5 w-5" /></button></header><div className="border-b border-gray-200 px-5 py-3 dark:border-gray-800"><div className="flex items-center gap-3"><span className="text-xs font-medium text-gray-500">Workflow status</span><StatusSelect value={response.status} disabled={saving} onChange={onStatus} /></div></div><div className="flex-1 overflow-y-auto p-5"><dl className="flex flex-col gap-3">{fields.map((field) => <div key={field.key} className="grid gap-1 rounded-xl border border-gray-100 p-3 sm:grid-cols-[160px_1fr] sm:gap-4 dark:border-gray-800"><dt className="text-xs font-medium text-gray-500">{field.label}</dt><dd className="break-words text-sm leading-5 text-gray-900 dark:text-gray-200">{formatValue(response.answers?.[field.key])}</dd></div>)}</dl></div></aside></div>;
}

function EmptyState() {
  return <div className="grid min-h-[520px] place-items-center p-8"><div className="max-w-sm text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800"><Icon name="grid" className="h-6 w-6" /></div><h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">No matching records</h3><p className="mt-1 text-xs leading-5 text-gray-500">Try another view or remove a filter to see more submissions.</p></div></div>;
}
