const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
export const clinicAdminTokenKey = "careflow.admin-token";

export type AuthSession = { token: string; user: { id: string | number; name?: string; email?: string }; clinic?: Clinic };
export type Clinic = { id: string | number; name: string; slug?: string; publicDomain?: string | null; settings?: Record<string, unknown>; branding?: Record<string, unknown>; questionnairesCount?: number };
export type ClinicSettings = { name: string; publicDomain: string; timezone: string; defaultCallingCode: string; supportEmail: string };
export type AdminQuestion = { id: string | number; key?: string; label?: string | null; description?: string | null; type?: string; isRequired?: boolean };
export type AdminQuestionnaire = { id: string | number; name: string; slug: string; description?: string | null; status?: string; submissionsCount?: number; questions?: AdminQuestion[] };
export type AdminResponse = { id: string | number; uuid?: string; status?: string; metadata?: Record<string, unknown>; submittedAt?: string; questionnaire?: { id: string | number; name: string; slug?: string }; answers?: Record<string, unknown> };

async function request<T>(path: string, init?: RequestInit): Promise<T> { const token = typeof window === "undefined" ? null : window.localStorage.getItem(clinicAdminTokenKey); const response = await fetch(`${apiBase}${path}`, { ...init, headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers } }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.message ?? "We could not complete that request. Please try again."); return (body?.data ?? body) as T; }
function saveSession(session: AuthSession): AuthSession { window.localStorage.setItem(clinicAdminTokenKey, session.token); return session; }
function toSettings(clinic: Clinic): ClinicSettings { const settings = clinic.settings ?? {}; return { name: clinic.name, publicDomain: clinic.publicDomain ?? "", timezone: String(settings.timezone ?? "America/Toronto"), defaultCallingCode: String(settings.default_calling_code ?? "+1"), supportEmail: String(settings.support_email ?? "") }; }

export const clinicAdminApi = {
  login: (email: string, password: string) => request<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, device_name: "careflow-clinic-admin" }) }).then(saveSession),
  register: (payload: { firstName: string; lastName: string; clinicName: string; email: string; password: string }) => request<AuthSession>("/auth/register", { method: "POST", body: JSON.stringify({ name: `${payload.firstName} ${payload.lastName}`.trim(), email: payload.email, password: payload.password, device_name: "careflow-clinic-admin", clinic: { name: payload.clinicName } }) }).then(saveSession),
  requestPhoneCode: (phone: string) => request<{ message?: string }>("/auth/phone/request", { method: "POST", body: JSON.stringify({ phone, device_name: "careflow-clinic-admin" }) }),
  verifyPhoneCode: (phone: string, code: string) => request<AuthSession>("/auth/phone/verify", { method: "POST", body: JSON.stringify({ phone, code, device_name: "careflow-clinic-admin" }) }).then(saveSession),
  googleUrl: () => `${apiBase}/auth/google/redirect`,
  clinic: () => request<Clinic>("/admin/clinic").then(toSettings),
  updateClinic: (settings: ClinicSettings) => request<Clinic>("/admin/clinic", { method: "PATCH", body: JSON.stringify({ name: settings.name, public_domain: settings.publicDomain || null, settings: { timezone: settings.timezone, default_calling_code: settings.defaultCallingCode, support_email: settings.supportEmail } }) }).then(toSettings),
  forms: () => request<AdminQuestionnaire[]>("/admin/clinic/questionnaires"),
  form: (id: string | number) => request<AdminQuestionnaire>(`/admin/clinic/questionnaires/${id}`),
  updateForm: (id: string | number, payload: Pick<AdminQuestionnaire, "name" | "description" | "status">) => request<AdminQuestionnaire>(`/admin/clinic/questionnaires/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateQuestion: (formId: string | number, questionId: string | number, payload: Pick<AdminQuestion, "label" | "description">) => request<AdminQuestion>(`/admin/clinic/questionnaires/${formId}/questions/${questionId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  responses: (id: string | number) => request<AdminResponse[]>(`/admin/clinic/questionnaires/${id}/responses?per_page=200`),
  allResponses: () => request<AdminResponse[]>("/admin/clinic/responses?per_page=200"),
  updateResponseStatus: (formId: string | number, responseId: string | number, status: string) => request<AdminResponse>(`/admin/clinic/questionnaires/${formId}/responses/${responseId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  updateResponseAnswer: (formId: string | number, responseId: string | number, questionKey: string, value: unknown) => request<AdminResponse>(`/admin/clinic/questionnaires/${formId}/responses/${responseId}/answers/${encodeURIComponent(questionKey)}`, { method: "PATCH", body: JSON.stringify({ value }) }),
};
