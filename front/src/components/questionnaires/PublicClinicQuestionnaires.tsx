"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clinicApi, questionnaireApi, type ClinicSummary, type Questionnaire } from "@/lib/questionnaires";

type PublicClinicQuestionnairesProps = {
  clinicSlug: string;
};

export default function PublicClinicQuestionnaires({ clinicSlug }: PublicClinicQuestionnairesProps) {
  const [clinic, setClinic] = useState<ClinicSummary | null>(null);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([clinicApi.getPublic(clinicSlug), questionnaireApi.listForClinic(clinicSlug)])
      .then(([resolvedClinic, items]) => {
        if (active) {
          setClinic(resolvedClinic);
          setQuestionnaires(items);
        }
      })
      .catch(() => {
        if (active) {
          setError("This clinic or its questionnaires are unavailable.");
        }
      });

    return () => {
      active = false;
    };
  }, [clinicSlug]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 sm:py-16">
      <section className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-semibold text-brand-600 transition hover:text-brand-700">← All clinics</Link>
        {!clinic && !error && <p className="mt-10 text-center text-sm text-gray-500">Loading questionnaires…</p>}
        {error && <p className="mt-8 rounded-2xl border border-error-200 bg-error-50 p-5 text-center text-sm text-error-800" role="alert">{error}</p>}
        {clinic && (
          <>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">{clinic.name ?? clinic.slug}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">Choose a questionnaire to continue.</p>
            {questionnaires.length > 0 ? (
              <nav aria-label="Questionnaires" className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
                {questionnaires.map((questionnaire) => (
                  <Link key={questionnaire.id} href={`/c/${encodeURIComponent(clinic.slug)}/${encodeURIComponent(questionnaire.slug ?? String(questionnaire.id))}`} className="block border-b border-gray-100 px-5 py-4 transition last:border-b-0 hover:bg-brand-50 sm:px-6">
                    <p className="font-semibold text-gray-800">{questionnaire.title ?? questionnaire.name}</p>
                    {questionnaire.description && <p className="mt-1 text-sm leading-6 text-gray-600">{questionnaire.description}</p>}
                  </Link>
                ))}
              </nav>
            ) : <p className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">This clinic has no published questionnaires yet.</p>}
          </>
        )}
      </section>
    </main>
  );
}
