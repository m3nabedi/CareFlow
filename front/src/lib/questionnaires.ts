export type QuestionOption = { id?: string | number; label: string; value?: string; selected?: boolean } | string;

export type WpFormsCondition = {
  field: string;
  operator: string;
  value?: string;
  exclusiveLast?: boolean;
  exclusiveChoice?: string;
};

export type WpFormsField = {
  id?: string;
  type?: string;
  content?: string;
  description?: string;
  confirmation?: string;
  confirmation_placeholder?: string;
  conditional_logic?: string;
  conditional_type?: "show" | "hide";
  conditionals?: unknown;
  columns?: Array<{ width_preset?: string; width_custom?: string; fields?: Array<string | number> }>;
  [key: string]: unknown;
};

export type ExecutionVisibility = {
  effect?: "show" | "hide";
  groups?: WpFormsCondition[][];
};

export type ExecutionElement = {
  kind: "field" | "content" | "layout";
  key: string;
  sourceId?: string;
  type?: string;
  label?: string;
  required?: boolean;
  hidden?: boolean;
  readOnly?: boolean;
  defaultValue?: unknown;
  content?: string;
  choices?: Array<{ id: string; label: string; value: string; displayValue?: string; selected?: boolean }>;
  compound?: { shape?: string; inputs?: Array<{ key: string; label: string }>; mustMatch?: boolean } | null;
  validation?: Record<string, unknown>;
  visibility?: ExecutionVisibility;
  columns?: Array<{ width?: string; fields?: string[] }>;
};

export type Question = {
  id: string | number;
  key?: string;
  label: string;
  description?: string | null;
  type: string;
  required?: boolean;
  options?: QuestionOption[];
  placeholder?: string | null;
  validation?: Record<string, unknown> | null;
  settings?: {
    source?: string;
    wpforms_field_id?: string;
    wpforms_type?: string;
    wpforms?: WpFormsField;
  } | null;
  sortOrder?: number;
  execution?: ExecutionElement;
};

export type FrontendRule = {
  key?: string;
  type?: string;
  page?: number;
  mode?: "all" | "any";
  message?: string;
  messageTitle?: string;
  showMessage?: boolean;
  hideNextUntilClear?: boolean;
  conditions?: WpFormsCondition[];
};

export type Questionnaire = {
  id: string | number;
  slug?: string;
  title?: string;
  name?: string;
  description?: string | null;
  status?: string;
  questions: Question[];
  settings?: {
    source?: string;
    wpforms_form_id?: string;
    wpforms_settings?: {
      submit_text?: string;
      submit_text_processing?: string;
      confirmations?: Array<Record<string, unknown>>;
      mcp_frontend_rules?: FrontendRule[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  } | null;
  layout?: {
    source?: string;
    field_order?: string[];
    pages?: WpFormsField[];
    layouts?: WpFormsField[];
  } | null;
  responses_count?: number;
  submissions_count?: number;
  questionsCount?: number;
  submissionsCount?: number;
  created_at?: string;
  clinic?: {
    id?: string | number;
    name?: string;
    slug?: string;
    logo_url?: string | null;
    primary_color?: string | null;
    branding?: Record<string, unknown> | null;
    default_calling_code?: string | null;
    allowed_calling_codes?: Array<string | { iso?: string; label?: string; callingCode?: string; calling_code?: string }> | null;
    regional?: {
      defaultCallingCode?: string | null;
      allowedCallingCodes?: Array<string | { iso?: string; label?: string; callingCode?: string; calling_code?: string }> | null;
      default_calling_code?: string | null;
      allowed_calling_codes?: Array<string | { iso?: string; label?: string; callingCode?: string; calling_code?: string }> | null;
    } | null;
  } | null;
  clinic_id?: string | number | null;
  clinic_name?: string | null;
  execution?: {
    version?: number;
    steps?: Array<{ id: string; index: number; title?: string | null; elements: ExecutionElement[] }>;
    gates?: Array<{
      key?: string;
      type?: string;
      step?: number;
      passWhen?: { mode?: "all" | "any"; conditions?: WpFormsCondition[] };
      blocked?: { title?: string; message?: string; hideNext?: boolean };
    }>;
    calculations?: Array<Record<string, unknown>>;
    completion?: {
      submitText?: string;
      processingText?: string;
      confirmation?: QuestionnaireConfirmation | null;
      confirmations?: QuestionnaireConfirmation[];
    };
  } | null;
};

export type ResolvedClinic = {
  id?: string | number;
  name?: string;
  slug: string;
};

export type ClinicSummary = ResolvedClinic & {
  questionnairesCount?: number;
  publicDomain?: string | null;
};

export type QuestionnaireConfirmation = {
  id?: string;
  title?: string | null;
  name?: string | null;
  type?: "message" | "redirect" | string | null;
  message?: string | null;
  page?: string | null;
  redirect?: string | null;
  when?: {
    effect?: string;
    groups?: WpFormsCondition[][];
  } | null;
};

export type Response = {
  id: string | number;
  answers: Record<string, unknown>;
  status?: string | null;
  submitted_at?: string | null;
  submittedAt?: string | null;
  created_at?: string;
  createdAt?: string;
  respondent?: { name?: string; email?: string } | null;
  confirmation?: QuestionnaireConfirmation | null;
  recommendations?: QuestionnaireEvaluation["recommendations"];
};

export type QuestionnaireEvaluation = {
  visibleFields: string[];
  gateViolations: Array<{
    key?: string;
    step?: number;
    blocked?: { title?: string; message?: string; hideNext?: boolean };
  }>;
  recommendations: Array<{
    key: string;
    sourceId?: string;
    name: string;
    status?: string;
    reason?: string;
  }>;
  derivedAnswers: Record<string, unknown>;
};

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

function clinicQuestionnairePath(clinicSlug: string, questionnaireSlug: string): string {
  return `/clinics/${encodeURIComponent(clinicSlug)}/questionnaires/${encodeURIComponent(questionnaireSlug)}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isMultipart = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/json", ...(init?.body && !isMultipart ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    ...init,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new QuestionnaireApiError(
      body?.message ?? "Could not connect to the CareFlow API.",
      body?.errors ?? {},
      response.status,
    );
  }
  return (body?.data ?? body) as T;
}

export class QuestionnaireApiError extends Error {
  constructor(
    message: string,
    public readonly errors: Record<string, string[] | string>,
    public readonly status: number,
  ) {
    super(message);
    this.name = "QuestionnaireApiError";
  }
}

function withExecutionSchema(questionnaire: Questionnaire): Questionnaire {
  const elements = questionnaire.execution?.steps?.flatMap((step) => step.elements) ?? [];
  const elementsByKey = new Map(elements.map((element) => [element.key, element]));
  if (elementsByKey.size === 0) return questionnaire;

  return {
    ...questionnaire,
    questions: questionnaire.questions.map((question) => {
      const execution = elementsByKey.get(questionKeyForApi(question));
      if (!execution) return question;
      return {
        ...question,
        execution,
        options: execution.choices?.map((choice) => ({ id: choice.id, label: choice.label, value: choice.value, selected: choice.selected })) ?? question.options,
        validation: { ...question.validation, ...execution.validation },
      };
    }),
  };
}

function questionKeyForApi(question: Question): string {
  return String(question.key ?? question.id);
}

function resolvedClinicFrom(value: unknown): ResolvedClinic {
  if (!value || typeof value !== "object" || !("slug" in value) || typeof value.slug !== "string" || value.slug.trim() === "") {
    throw new QuestionnaireApiError("The clinic domain response is invalid.", {}, 502);
  }

  return {
    id: "id" in value && (typeof value.id === "string" || typeof value.id === "number") ? value.id : undefined,
    name: "name" in value && typeof value.name === "string" ? value.name : undefined,
    slug: value.slug,
  };
}

function clinicSummaryFrom(value: unknown): ClinicSummary {
  const clinic = resolvedClinicFrom(value);

  return {
    ...clinic,
    questionnairesCount: "questionnairesCount" in (value as object) && typeof (value as { questionnairesCount?: unknown }).questionnairesCount === "number"
      ? (value as { questionnairesCount: number }).questionnairesCount
      : undefined,
    publicDomain: "publicDomain" in (value as object) && (typeof (value as { publicDomain?: unknown }).publicDomain === "string" || (value as { publicDomain?: unknown }).publicDomain === null)
      ? (value as { publicDomain: string | null }).publicDomain
      : undefined,
  };
}

export const questionnaireApi = {
  resolveClinicForDomain: (domain: string) =>
    request<unknown>(`/public/clinics/resolve?domain=${encodeURIComponent(domain)}`).then(resolvedClinicFrom),
  list: (clinic?: string) => request<Questionnaire[]>(`/questionnaires${clinic ? `?filter[clinic]=${encodeURIComponent(clinic)}` : ""}`),
  get: (id: string) => request<Questionnaire>(`/questionnaires/${id}`).then(withExecutionSchema),
  listForClinic: (clinicSlug: string) =>
    request<Questionnaire[]>(`/clinics/${encodeURIComponent(clinicSlug)}/questionnaires`),
  getForClinic: (clinicSlug: string, questionnaireSlug: string) =>
    request<Questionnaire>(clinicQuestionnairePath(clinicSlug, questionnaireSlug)).then(withExecutionSchema),
  responses: (id: string) => request<Response[]>(`/questionnaires/${id}/responses`),
  evaluate: (id: string, answers: Record<string, unknown>) =>
    request<QuestionnaireEvaluation>(`/questionnaires/${id}/evaluate`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
  evaluateForClinic: (clinicSlug: string, questionnaireSlug: string, answers: Record<string, unknown>) =>
    request<QuestionnaireEvaluation>(`${clinicQuestionnairePath(clinicSlug, questionnaireSlug)}/evaluate`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
  submit: (id: string, answers: Record<string, unknown>, files: Record<string, File> = {}) => {
    if (Object.keys(files).length === 0) {
      return request<Response>(`/questionnaires/${id}/responses`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
    }

    const payload = new FormData();
    payload.append("answers", JSON.stringify(answers));
    Object.entries(files).forEach(([field, file]) => payload.append(`files[${field}]`, file));

    return request<Response>(`/questionnaires/${id}/responses`, { method: "POST", body: payload });
  },
  submitForClinic: (clinicSlug: string, questionnaireSlug: string, answers: Record<string, unknown>, files: Record<string, File> = {}) => {
    const path = `${clinicQuestionnairePath(clinicSlug, questionnaireSlug)}/responses`;
    if (Object.keys(files).length === 0) {
      return request<Response>(path, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
    }

    const payload = new FormData();
    payload.append("answers", JSON.stringify(answers));
    Object.entries(files).forEach(([field, file]) => payload.append(`files[${field}]`, file));

    return request<Response>(path, { method: "POST", body: payload });
  },
};

export const clinicApi = {
  listPublic: () => request<unknown[]>("/clinics").then((clinics) => clinics.map(clinicSummaryFrom)),
  getPublic: (clinicSlug: string) => request<unknown>(`/clinics/${encodeURIComponent(clinicSlug)}`).then(clinicSummaryFrom),
};
