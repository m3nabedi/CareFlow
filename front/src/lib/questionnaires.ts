export type QuestionOption = { label: string; value?: string } | string;

export type Question = {
  id: string | number;
  key?: string;
  label: string;
  description?: string | null;
  type: string;
  required?: boolean;
  options?: QuestionOption[];
  placeholder?: string | null;
};

export type Questionnaire = {
  id: string | number;
  slug?: string;
  title?: string;
  name?: string;
  description?: string | null;
  status?: string;
  questions: Question[];
  responses_count?: number;
  submissions_count?: number;
  created_at?: string;
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
};

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    ...init,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message ?? "ارتباط با سرور برقرار نشد.");
  return (body?.data ?? body) as T;
}

export const questionnaireApi = {
  list: () => request<Questionnaire[]>("/questionnaires"),
  get: (id: string) => request<Questionnaire>(`/questionnaires/${id}`),
  responses: (id: string) => request<Response[]>(`/questionnaires/${id}/responses`),
  submit: (id: string, answers: Record<string, unknown>) =>
    request<Response>(`/questionnaires/${id}/responses`, { method: "POST", body: JSON.stringify({ answers }) }),
};
