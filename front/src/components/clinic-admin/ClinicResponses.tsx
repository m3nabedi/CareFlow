"use client";

import { useEffect, useMemo, useState } from "react";
import { clinicAdminApi, type AdminQuestionnaire, type AdminResponse, type ResponseWorkspaceLayout } from "@/lib/clinic-admin";

type ViewId = "all" | "new" | "in_review" | "follow_up" | "reviewed" | "archived" | "kanban";
type SortDirection = "asc" | "desc";
type ToolbarPanel = "filter" | "sort" | "fields" | null;
type FieldColumn = { key: string; label: string; type?: string; sortOrder?: number };
type FilterOperator = "contains" | "equals" | "not_equals" | "empty" | "not_empty";
type FilterRule = { id: string; field: string; operator: FilterOperator; value: string };
type SavedView = { search: string; filters?: FilterRule[]; statuses?: string[]; sortKey: string; sortDirection: SortDirection; visibleFields: string[]; groupByStatus: boolean };

const systemFields: FieldColumn[] = [
  { key: "__status", label: "Status", type: "system" },
  { key: "__submittedAt", label: "Submitted", type: "date" },
];

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

function fieldValue(response: AdminResponse, field: string): unknown {
  if (field === "__form") return response.questionnaire?.name;
  if (field === "__status") return statusConfig(response.status).label;
  if (field === "__submittedAt") return response.submittedAt;
  return response.answers?.[field];
}

function matchesFilter(response: AdminResponse, rule: FilterRule): boolean {
  const raw = fieldValue(response, rule.field);
  const current = formatValue(raw);
  const normalized = current === "—" ? "" : current.toLowerCase();
  const expected = rule.value.trim().toLowerCase();

  if (rule.operator === "empty") return normalized === "";
  if (rule.operator === "not_empty") return normalized !== "";
  if (rule.operator === "equals") return normalized === expected;
  if (rule.operator === "not_equals") return normalized !== expected;
  return normalized.includes(expected);
}

function editableField(field: FieldColumn): boolean {
  return !["file", "upload", "signature", "html", "section", "page_break"].includes(field.type ?? "");
}

function GridIcon({ type }: { type: "grid" | "kanban" }) { return <Icon name={type} className="h-3.5 w-3.5" />; }

function responseWorkspaceLayout(form?: AdminQuestionnaire): ResponseWorkspaceLayout {
  const layout = form?.layout;
  if (!layout || typeof layout !== "object") return {};
  const workspace = (layout as Record<string, unknown>).response_workspace;
  return workspace && typeof workspace === "object" ? workspace as ResponseWorkspaceLayout : {};
}

function isResponseColumn(question: NonNullable<AdminQuestionnaire["questions"]>[number]): boolean {
  return Boolean(question.key && question.label?.trim()) && !["pagebreak", "content", "layout", "divider", "html", "hidden"].includes(question.type ?? "");
}

export default function ClinicResponses() {
  const [forms, setForms] = useState<AdminQuestionnaire[]>([]);
  const [formId, setFormId] = useState("");
  const [responses, setResponses] = useState<AdminResponse[]>([]);
  const [activeView, setActiveView] = useState<ViewId>("all");
  const [search, setSearch] = useState("");
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [sortKey, setSortKey] = useState("submittedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [groupByStatus, setGroupByStatus] = useState(false);
  const [panel, setPanel] = useState<ToolbarPanel>(null);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [openResponse, setOpenResponse] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [savingCell, setSavingCell] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedForm = forms.find((form) => String(form.id) === formId);

  const fields = useMemo<FieldColumn[]>(() => {
    return (selectedForm?.questions ?? [])
      .filter(isResponseColumn)
      .map((question) => ({ key: question.key as string, label: question.label as string, type: question.type, sortOrder: question.sortOrder }))
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
  }, [selectedForm]);
  const tableFields = useMemo(() => {
    const baseFields = [...systemFields, ...fields];
    const byKey = new Map(baseFields.map((field) => [field.key, field]));
    const ordered = columnOrder.map((key) => byKey.get(key)).filter((field): field is FieldColumn => Boolean(field));
    return [...ordered, ...baseFields.filter((field) => !columnOrder.includes(field.key))];
  }, [columnOrder, fields]);
  const orderedFields = tableFields.filter((field) => !field.key.startsWith("__"));
  const visibleTableFields = tableFields.filter((field) => visibleFields.includes(field.key));

  const loadResponses = async (questionnaireId: string, silent = false) => {
    if (!questionnaireId) return;
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    try { setResponses(await clinicAdminApi.responses(questionnaireId)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "We could not load responses."); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    clinicAdminApi.forms().then((items) => {
      setForms(items);
      const requested = new URLSearchParams(window.location.search).get("form");
      setFormId(items.some((form) => String(form.id) === requested) ? requested ?? "" : "");
      setLoading(false);
    }).catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : "We could not load clinic forms.");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!formId) {
      setResponses([]);
      return;
    }

    const workspace = responseWorkspaceLayout(selectedForm);
    const availableColumns = [...systemFields, ...fields].map((field) => field.key);
    const saved = window.localStorage.getItem(`careflow.response-view.${formId}`);
    let view: SavedView | null = null;
    try { view = saved ? JSON.parse(saved) as SavedView : null; } catch { window.localStorage.removeItem(`careflow.response-view.${formId}`); }
    setSelectedIds([]); setOpenResponse(null); setSearch(view?.search ?? ""); setFilterRules(view?.filters ?? []); setSortKey(view?.sortKey ?? "submittedAt"); setSortDirection(view?.sortDirection ?? "desc"); setGroupByStatus(view?.groupByStatus ?? false);
    setColumnOrder(workspace.columnOrder?.filter((key) => availableColumns.includes(key)) ?? []);
    setVisibleFields(availableColumns.filter((key) => !workspace.hiddenColumns?.includes(key)));
    void loadResponses(formId);
  }, [fields, formId, selectedForm]);

  const hiddenFieldCount = tableFields.filter((field) => !visibleFields.includes(field.key)).length;
  const activeViewStatus = views.find((view) => view.id === activeView)?.status;
  const sourceResponses = responses;
  const displayedResponses = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = sourceResponses.filter((response) => {
      const responseStatus = normalizedStatus(response.status);
      if (activeViewStatus && responseStatus !== activeViewStatus) return false;
      if (!filterRules.every((rule) => matchesFilter(response, rule))) return false;
      if (!query) return true;
      return [response.id, response.uuid, response.questionnaire?.name, responseStatus, ...Object.values(response.answers ?? {})].map(formatValue).some((value) => value.toLowerCase().includes(query));
    });
    return filtered.sort((left, right) => {
      const leftValue = sortKey === "submittedAt" ? left.submittedAt : sortKey === "id" ? left.id : left.answers?.[sortKey];
      const rightValue = sortKey === "submittedAt" ? right.submittedAt : sortKey === "id" ? right.id : right.answers?.[sortKey];
      const result = formatValue(leftValue).localeCompare(formatValue(rightValue), undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? result : -result;
    });
  }, [activeViewStatus, filterRules, search, sortDirection, sortKey, sourceResponses]);

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

  const updateAnswer = async (response: AdminResponse, field: FieldColumn, value: string) => {
    const sourceFormId = response.questionnaire?.id;
    if (!sourceFormId) return;
    const cellId = `${response.id}:${field.key}`;
    const previous = response.answers?.[field.key];
    const nextValue: unknown = field.type === "number" && value !== "" ? Number(value) : value;
    setSavingCell(cellId);
    setResponses((items) => items.map((item) => item.id === response.id ? { ...item, answers: { ...item.answers, [field.key]: nextValue } } : item));
    try {
      const updated = await clinicAdminApi.updateResponseAnswer(sourceFormId, response.id, field.key, nextValue);
      setResponses((items) => items.map((item) => item.id === response.id ? updated : item));
      setNotice(`${field.label} updated`); window.setTimeout(() => setNotice(""), 1800);
    } catch (requestError) {
      setResponses((items) => items.map((item) => item.id === response.id ? { ...item, answers: { ...item.answers, [field.key]: previous } } : item));
      setError(requestError instanceof Error ? requestError.message : "We could not update this cell.");
    } finally { setSavingCell(""); }
  };

  const persistWorkspace = async (nextOrder: string[], nextVisibleFields: string[]) => {
    if (!selectedForm) return;
    const availableColumns = [...systemFields, ...fields].map((field) => field.key);
    const existingLayout = selectedForm.layout ?? {};
    const workspace = responseWorkspaceLayout(selectedForm);
    setSavingWorkspace(true);
    try {
      const updated = await clinicAdminApi.updateResponseWorkspace(selectedForm.id, {
        ...existingLayout,
        response_workspace: {
          ...workspace,
          columnOrder: nextOrder.filter((key) => availableColumns.includes(key)),
          hiddenColumns: availableColumns.filter((key) => !nextVisibleFields.includes(key)),
        },
      });
      setForms((items) => items.map((form) => form.id === updated.id ? updated : form));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We could not save this table layout.");
    } finally { setSavingWorkspace(false); }
  };

  const updateVisibleFields = (nextVisibleFields: string[]) => {
    setVisibleFields(nextVisibleFields);
    void persistWorkspace(columnOrder, nextVisibleFields);
  };

  const moveColumn = (draggedKey: string, targetKey: string) => {
    if (draggedKey === targetKey) return;
    const keys = tableFields.map((field) => field.key);
    const from = keys.indexOf(draggedKey);
    const to = keys.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    keys.splice(to, 0, keys.splice(from, 1)[0]);
    setColumnOrder(keys);
    void persistWorkspace(keys, visibleFields);
  };

  const saveView = () => {
    const view: SavedView = { search, filters: filterRules, sortKey, sortDirection, visibleFields, groupByStatus };
    window.localStorage.setItem(`careflow.response-view.${formId}`, JSON.stringify(view));
    setNotice("View preferences saved"); window.setTimeout(() => setNotice(""), 2200);
  };
  const selectForm = (id: string) => {
    setFormId(id);
    window.history.replaceState(null, "", `/admin/responses?form=${id}`);
  };
  const toggleSelection = (id: string | number) => setSelectedIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const allSelected = displayedResponses.length > 0 && displayedResponses.every((response) => selectedIds.includes(response.id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : displayedResponses.map((response) => response.id));

  if (error && forms.length === 0) return <div className="rounded-2xl border border-error-200 bg-error-50 p-5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">{error}</div>;
  if (!formId || !selectedForm) return <FormPicker forms={forms} onSelect={selectForm} />;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
      {notice && <div className="absolute right-5 top-4 z-50 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg dark:bg-white dark:text-gray-900">{notice}</div>}
      <div className="border-b border-gray-200 bg-[#f7fbfc] px-3 pt-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Response tables">
          <button type="button" role="tab" aria-selected className="shrink-0 rounded-t-lg border-x border-t border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white">{selectedForm.name}<span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">{responses.length}</span></button>
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
            <ToolbarButton icon="filter" label={filterRules.length ? `Filter · ${filterRules.length}` : "Filter"} active={panel === "filter" || filterRules.length > 0} onClick={() => setPanel(panel === "filter" ? null : "filter")} />
            <ToolbarButton icon="group" label="Group" active={groupByStatus} onClick={() => setGroupByStatus((value) => !value)} disabled={activeView === "kanban"} />
            <ToolbarButton icon="sort" label="Sort" active={panel === "sort" || sortKey !== "submittedAt" || sortDirection !== "desc"} onClick={() => setPanel(panel === "sort" ? null : "sort")} />
            <ToolbarButton icon="fields" label={savingWorkspace ? "Saving…" : hiddenFieldCount ? `${hiddenFieldCount} hidden` : "Fields"} active={panel === "fields" || hiddenFieldCount > 0} onClick={() => setPanel(panel === "fields" ? null : "fields")} />
            <div className="relative ml-auto min-w-[170px] grow sm:max-w-xs sm:grow-0"><Icon name="search" className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-800 outline-none focus:border-brand-400 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></div>
            <button type="button" onClick={saveView} className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"><Icon name="save" className="h-3.5 w-3.5" />Save view</button>
            <select value={formId} onChange={(event) => selectForm(event.target.value)} aria-label="Select a form" className="h-8 max-w-48 rounded-md border border-brand-300 bg-white px-2 text-xs font-semibold text-gray-700 outline-none focus:border-brand-500 dark:border-brand-600 dark:bg-gray-900 dark:text-gray-200">{forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}</select>
            <button type="button" onClick={() => void loadResponses(formId, true)} disabled={refreshing} aria-label="Refresh responses" className="grid h-8 w-8 place-items-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"><Icon name="refresh" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></button>
          </div>
          <div className="relative">
            {panel === "filter" && <FilterPanel fields={tableFields} rules={filterRules} onChange={setFilterRules} onClose={() => setPanel(null)} />}
            {panel === "sort" && <SortPanel fields={fields} sortKey={sortKey} direction={sortDirection} onSortKey={setSortKey} onDirection={setSortDirection} onClose={() => setPanel(null)} />}
            {panel === "fields" && <FieldsPanel fields={tableFields} visible={visibleFields} onChange={updateVisibleFields} onClose={() => setPanel(null)} />}
            {error && <div className="border-b border-error-200 bg-error-50 px-4 py-3 text-xs text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-300">{error}<button type="button" onClick={() => setError("")} className="ml-3 font-semibold underline">Dismiss</button></div>}
            {loading ? <div className="grid min-h-[520px] place-items-center"><div className="flex items-center gap-2 text-sm text-gray-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />Loading responses for {selectedForm.name}…</div></div> : activeView === "kanban" ? <Kanban responses={displayedResponses} fields={orderedFields} savingId={savingId} onOpen={setOpenResponse} onStatus={updateStatus} /> : <GridView responses={displayedResponses} columns={visibleTableFields} primaryFields={orderedFields} selectedIds={selectedIds} allSelected={allSelected} groupByStatus={groupByStatus} savingId={savingId} savingCell={savingCell} onToggle={toggleSelection} onToggleAll={toggleAll} onOpen={setOpenResponse} onStatus={updateStatus} onAnswer={updateAnswer} onMoveColumn={moveColumn} />}
          </div>
        </main>
      </div>
      {openResponse && <RecordDrawer response={openResponse} fields={orderedFields} saving={savingId === openResponse.id} onClose={() => setOpenResponse(null)} onStatus={(status) => void updateStatus(openResponse, status)} />}
    </div>
  );
}

function FormPicker({ forms, onSelect }: { forms: AdminQuestionnaire[]; onSelect: (id: string) => void }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-8"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-wider text-brand-600">Response workspace</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Select a form to open its responses</h2><p className="mt-2 text-sm leading-6 text-gray-500">Each form has its own questions, filters, hidden columns, and column order. Responses are never combined across forms.</p></div><div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{forms.map((form) => <button key={form.id} type="button" onClick={() => onSelect(String(form.id))} className="group rounded-xl border border-gray-200 bg-gray-50/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-brand-600 dark:hover:bg-gray-900"><div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><Icon name="grid" className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{form.name}</span><span className="mt-1 block text-xs leading-5 text-gray-500">{form.submissionsCount ?? 0} submissions · {form.questions?.filter(isResponseColumn).length ?? 0} response fields</span></span><Icon name="chevron" className="mt-1 h-4 w-4 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-500" /></div></button>)}</div>{forms.length === 0 && <div className="mt-8 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">Create or import a form before opening the response workspace.</div>}</div>;
}

function ToolbarButton({ icon, label, active, disabled, onClick }: { icon: "filter" | "sort" | "fields" | "group"; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"}`}><Icon name={icon} className="h-3.5 w-3.5" />{label}</button>;
}

function FilterPanel({ fields, rules, onChange, onClose }: { fields: FieldColumn[]; rules: FilterRule[]; onChange: (items: FilterRule[]) => void; onClose: () => void }) {
  const updateRule = (id: string, patch: Partial<FilterRule>) => onChange(rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  const addRule = () => onChange([...rules, { id: crypto.randomUUID(), field: fields[0]?.key ?? "__status", operator: "contains", value: "" }]);
  return <Popover title="Filter every record" onClose={onClose} wide>
    <p className="mb-3 text-[11px] leading-4 text-gray-500">Choose one column and a condition. Every row in this table is checked against it.</p>
    <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
      {rules.map((rule, index) => <div key={rule.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-950">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-gray-400"><span>{index === 0 ? "Where" : "And"}</span><button type="button" onClick={() => onChange(rules.filter((item) => item.id !== rule.id))} className="rounded p-1 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"><Icon name="close" className="h-3 w-3" /></button></div>
        <div className="grid grid-cols-2 gap-2">
          <select value={rule.field} onChange={(event) => updateRule(rule.id, { field: event.target.value })} aria-label="Filter column" className="h-8 min-w-0 rounded-md border border-gray-200 bg-white px-2 text-[11px] font-medium text-gray-800 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white">{fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select>
          <select value={rule.operator} onChange={(event) => updateRule(rule.id, { operator: event.target.value as FilterOperator })} aria-label="Filter condition" className="h-8 min-w-0 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-700 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"><option value="contains">contains</option><option value="equals">is exactly</option><option value="not_equals">is not</option><option value="empty">is empty</option><option value="not_empty">is not empty</option></select>
        </div>
        {!['empty', 'not_empty'].includes(rule.operator) && <input value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} placeholder="Enter a value" aria-label="Filter value" className="mt-2 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-800 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />}
      </div>)}
    </div>
    <div className="mt-3 flex items-center justify-between"><button type="button" onClick={addRule} className="text-xs font-semibold text-brand-600 hover:text-brand-700">+ Add condition</button>{rules.length > 0 && <button type="button" onClick={() => onChange([])} className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-white">Clear all</button>}</div>
  </Popover>;
}

function SortPanel({ fields, sortKey, direction, onSortKey, onDirection, onClose }: { fields: FieldColumn[]; sortKey: string; direction: SortDirection; onSortKey: (key: string) => void; onDirection: (direction: SortDirection) => void; onClose: () => void }) {
  return <Popover title="Sort records" onClose={onClose}><div className="flex gap-2"><select value={sortKey} onChange={(event) => onSortKey(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="submittedAt">Submitted date</option><option value="id">Record ID</option>{fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select><select value={direction} onChange={(event) => onDirection(event.target.value as SortDirection)} className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="asc">Ascending</option><option value="desc">Descending</option></select></div></Popover>;
}

function FieldsPanel({ fields, visible, onChange, onClose }: { fields: FieldColumn[]; visible: string[]; onChange: (items: string[]) => void; onClose: () => void }) {
  return <Popover title="Hide a specific column" onClose={onClose} wide><div className="mb-2 flex items-center justify-between text-[11px]"><span className="text-gray-500">Toggle any column for this table view.</span><button type="button" onClick={() => onChange(fields.map((field) => field.key))} className="font-medium text-brand-600">Show all</button></div><div className="max-h-72 overflow-y-auto">{fields.map((field) => <label key={field.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"><input type="checkbox" checked={visible.includes(field.key)} onChange={() => onChange(visible.includes(field.key) ? visible.filter((item) => item !== field.key) : [...visible, field.key])} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" /><span className="truncate">{field.label}</span><span className="ml-auto text-[10px] text-gray-400">{field.type ?? "field"}</span></label>)}</div></Popover>;
}

function Popover({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className={`absolute left-3 top-2 z-40 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900 ${wide ? "w-80" : "w-72"}`}><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-gray-900 dark:text-white">{title}</p><button type="button" onClick={onClose} className="grid h-6 w-6 place-items-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><Icon name="close" className="h-3.5 w-3.5" /></button></div>{children}</div>;
}

function StatusSelect({ value, disabled, onChange }: { value?: string; disabled?: boolean; onChange: (status: string) => void }) {
  const config = statusConfig(value);
  return <div className="relative inline-flex" onClick={(event) => event.stopPropagation()}><span className={`pointer-events-none absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${config.dot}`} /><select value={normalizedStatus(value)} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-label="Response status" className={`h-7 max-w-32 appearance-none rounded-full border-0 py-1 pl-6 pr-6 text-[11px] font-semibold outline-none ring-1 ring-inset ring-black/5 ${config.badge}`}>{statuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></div>;
}

function GridView({ responses, columns, primaryFields, selectedIds, allSelected, groupByStatus, savingId, savingCell, onToggle, onToggleAll, onOpen, onStatus, onAnswer, onMoveColumn }: { responses: AdminResponse[]; columns: FieldColumn[]; primaryFields: FieldColumn[]; selectedIds: Array<string | number>; allSelected: boolean; groupByStatus: boolean; savingId: string | number | null; savingCell: string; onToggle: (id: string | number) => void; onToggleAll: () => void; onOpen: (response: AdminResponse) => void; onStatus: (response: AdminResponse, status: string) => void; onAnswer: (response: AdminResponse, field: FieldColumn, value: string) => void; onMoveColumn: (draggedKey: string, targetKey: string) => void }) {
  if (responses.length === 0) return <EmptyState />;
  const grouped = groupByStatus ? statuses.map((status) => ({ status, items: responses.filter((response) => normalizedStatus(response.status) === status.id) })).filter((group) => group.items.length > 0) : [{ status: null, items: responses }];
  return <div className="max-h-[560px] overflow-auto">
    <table className="min-w-max border-separate border-spacing-0 text-left text-xs">
      <thead className="sticky top-0 z-20 bg-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
        <tr>
          <th className="sticky left-0 z-30 h-9 w-12 border-b border-r border-gray-200 bg-gray-50 px-3 dark:border-gray-800 dark:bg-gray-900"><input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Select all records" className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" /></th>
          <th className="sticky left-12 z-30 min-w-56 border-b border-r border-gray-200 bg-gray-50 px-3 dark:border-gray-800 dark:bg-gray-900">Primary field</th>
          {columns.map((field) => <th key={field.key} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", field.key)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const draggedKey = event.dataTransfer.getData("text/plain"); if (draggedKey) onMoveColumn(draggedKey, field.key); }} title="Drag to reorder this column" className="min-w-52 max-w-72 cursor-grab border-b border-r border-gray-200 px-3 normal-case tracking-normal hover:bg-gray-100 active:cursor-grabbing dark:border-gray-800 dark:hover:bg-gray-800"><span className="flex items-center gap-1.5"><span className="text-gray-400">{field.type === "date" ? "◷" : field.type === "system" ? "◉" : "A"}</span>{field.label}<span className="ml-auto text-gray-300">⋮⋮</span></span></th>)}
        </tr>
      </thead>
      <tbody>{grouped.map((group) => <GridGroup key={group.status?.id ?? "all"} group={group} columns={columns} primaryFields={primaryFields} selectedIds={selectedIds} savingId={savingId} savingCell={savingCell} onToggle={onToggle} onOpen={onOpen} onStatus={onStatus} onAnswer={onAnswer} />)}</tbody>
    </table>
    <div className="sticky bottom-0 left-0 flex h-9 items-center border-t border-gray-200 bg-white/95 px-4 text-[11px] font-medium text-gray-500 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">{responses.length} records</div>
  </div>;
}

function GridGroup({ group, columns, primaryFields, selectedIds, savingId, savingCell, onToggle, onOpen, onStatus, onAnswer }: { group: { status: typeof statuses[number] | null; items: AdminResponse[] }; columns: FieldColumn[]; primaryFields: FieldColumn[]; selectedIds: Array<string | number>; savingId: string | number | null; savingCell: string; onToggle: (id: string | number) => void; onOpen: (response: AdminResponse) => void; onStatus: (response: AdminResponse, status: string) => void; onAnswer: (response: AdminResponse, field: FieldColumn, value: string) => void }) {
  return <>
    {group.status && <tr><td colSpan={columns.length + 2} className="border-b border-gray-200 bg-gray-50/90 px-4 py-2 font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-900/90 dark:text-gray-300"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${group.status.dot}`} />{group.status.label}<span className="ml-2 font-normal text-gray-400">{group.items.length}</span></td></tr>}
    {group.items.map((response) => <tr key={response.id} onClick={() => onOpen(response)} className="group cursor-pointer bg-white text-gray-700 hover:bg-brand-50/40 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-brand-500/[0.04]">
      <td className="sticky left-0 z-10 h-10 border-b border-r border-gray-200 bg-inherit px-3 dark:border-gray-800"><input type="checkbox" checked={selectedIds.includes(response.id)} onClick={(event) => event.stopPropagation()} onChange={() => onToggle(response.id)} aria-label={`Select response ${response.id}`} className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" /></td>
      <td className="sticky left-12 z-10 max-w-72 border-b border-r border-gray-200 bg-inherit px-3 font-medium text-gray-900 dark:border-gray-800 dark:text-white"><span className="flex items-center gap-2"><span className="text-[10px] tabular-nums text-gray-400">{response.id}</span><span className="truncate">{responseTitle(response, primaryFields)}</span><Icon name="chevron" className="ml-auto h-3 w-3 opacity-0 transition group-hover:opacity-100" /></span></td>
      {columns.map((field) => field.key === "__status" ? <td key={field.key} className="border-b border-r border-gray-200 px-3 dark:border-gray-800"><StatusSelect value={response.status} disabled={savingId === response.id} onChange={(status) => onStatus(response, status)} /></td> : field.key === "__submittedAt" ? <td key={field.key} className="whitespace-nowrap border-b border-r border-gray-200 px-3 text-gray-500 dark:border-gray-800 dark:text-gray-400">{dateLabel(response.submittedAt)}</td> : <EditableCell key={field.key} response={response} field={field} saving={savingCell === `${response.id}:${field.key}`} onSave={(value) => onAnswer(response, field, value)} />)}
    </tr>)}
  </>;
}

function EditableCell({ response, field, saving, onSave }: { response: AdminResponse; field: FieldColumn; saving: boolean; onSave: (value: string) => void }) {
  const original = formatValue(response.answers?.[field.key]);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(original === "—" ? "" : original);
  const canEdit = editableField(field) && typeof response.answers?.[field.key] !== "object";
  const commit = () => {
    setEditing(false);
    if (value !== (original === "—" ? "" : original)) onSave(value);
  };

  return <td onClick={(event) => event.stopPropagation()} onDoubleClick={() => { if (canEdit && !saving) { setValue(original === "—" ? "" : original); setEditing(true); } }} title={canEdit ? "Double-click to edit" : original} className={`group/cell relative max-w-72 border-b border-r border-gray-200 p-0 text-gray-600 dark:border-gray-800 dark:text-gray-300 ${editing ? "ring-2 ring-inset ring-brand-500" : ""}`}>
    {editing ? <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") commit(); if (event.key === "Escape") { setValue(original === "—" ? "" : original); setEditing(false); } }} className="h-10 w-full min-w-52 bg-white px-3 text-xs text-gray-900 outline-none dark:bg-gray-950 dark:text-white" /> : <div className="flex h-10 min-w-52 items-center gap-2 px-3"><span className="min-w-0 flex-1 truncate">{saving ? "Saving…" : shortValue(response.answers?.[field.key])}</span>{canEdit && <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-3.5 w-3.5 shrink-0 text-gray-400 opacity-0 transition group-hover/cell:opacity-100" aria-hidden="true"><path d="m13.8 3.2 3 3L7 16l-4 1 1-4z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>}
  </td>;
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
