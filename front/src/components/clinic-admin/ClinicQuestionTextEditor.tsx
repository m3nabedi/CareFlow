"use client";

import { useState } from "react";
import { clinicAdminApi, type AdminQuestion } from "@/lib/clinic-admin";

export default function ClinicQuestionTextEditor({ formId, question }: { formId: string; question: AdminQuestion }) {
  const [label, setLabel] = useState(question.label ?? ""); const [description, setDescription] = useState(question.description ?? ""); const [status, setStatus] = useState("");
  async function save() { setStatus("Saving…"); try { await clinicAdminApi.updateQuestion(formId, question.id, { label, description }); setStatus("Saved"); } catch (error) { setStatus(error instanceof Error ? error.message : "Could not save question."); } }
  return <article className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{question.type ?? "field"}</p><label className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">Question text<input value={label} onChange={(event) => setLabel(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><label className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">Help text<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><div className="mt-3 flex items-center justify-end gap-3"><span className="text-xs text-gray-500">{status}</span><button type="button" onClick={save} className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:border-brand-500/30 dark:text-brand-300">Save question</button></div></article>;
}
