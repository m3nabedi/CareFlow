"use client";

import { useEffect, useState } from "react";
import { clinicAdminApi, type AdminQuestionnaire } from "@/lib/clinic-admin";

type Response = { id: string | number; status?: string; submittedAt?: string; answers?: Record<string, unknown> };

export default function ClinicResponses() {
  const [forms, setForms] = useState<AdminQuestionnaire[]>([]); const [formId, setFormId] = useState(""); const [responses, setResponses] = useState<Response[]>([]); const [error, setError] = useState("");
  useEffect(() => { clinicAdminApi.forms().then((items) => { setForms(items); if (items[0]) setFormId(String(items[0].id)); }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "We could not load clinic forms.")); }, []);
  useEffect(() => { if (!formId) return; clinicAdminApi.responses(formId).then((items) => setResponses(items as Response[])).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "We could not load responses.")); }, [formId]);
  if (error) return <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700">{error}</div>;
  return <div className="space-y-5"><label className="block max-w-md text-sm font-medium text-gray-700 dark:text-gray-300">Form<select value={formId} onChange={(event) => setFormId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="">Select a form</option>{forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}</select></label>{formId && (responses.length ? <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-gray-500 dark:bg-white/[0.03]"><tr><th className="p-4">Response</th><th className="p-4">Status</th><th className="p-4">Submitted</th></tr></thead><tbody>{responses.map((response) => <tr key={response.id} className="border-t border-gray-100 dark:border-gray-800"><td className="p-4 font-medium text-gray-900 dark:text-white">#{response.id}</td><td className="p-4 capitalize text-gray-600 dark:text-gray-300">{response.status ?? "new"}</td><td className="p-4 text-gray-500">{response.submittedAt ? new Date(response.submittedAt).toLocaleString() : "—"}</td></tr>)}</tbody></table></div> : <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">No responses have been submitted to this form yet.</div>)}</div>;
}
