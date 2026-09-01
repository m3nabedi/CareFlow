"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clinicApi, type ClinicSummary } from "@/lib/questionnaires";

export default function PublicClinicDirectory() {
  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clinicApi.listPublic()
      .then(setClinics)
      .catch(() => setError("We could not load clinics right now. Please try again shortly."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 sm:py-16">
      <section className="mx-auto max-w-2xl">
        <p className="text-center text-sm font-semibold text-brand-600">CareFlow</p>
        <h1 className="mt-3 text-center text-3xl font-bold tracking-tight text-gray-900">Choose your clinic</h1>
        {loading && <p className="mt-10 text-center text-sm text-gray-500">Loading clinics…</p>}
        {error && <p className="mt-10 rounded-2xl border border-error-200 bg-error-50 p-5 text-center text-sm text-error-800" role="alert">{error}</p>}
        {!loading && !error && (
          clinics.length > 0 ? (
            <nav aria-label="Clinics" className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
              {clinics.map((clinic) => (
                <Link key={clinic.slug} href={`/c/${encodeURIComponent(clinic.slug)}`} className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 text-base font-semibold text-gray-800 transition last:border-b-0 hover:bg-brand-50 hover:text-brand-700 sm:px-6">
                  {clinic.name ?? clinic.slug}
                  <span aria-hidden="true" className="text-brand-500">→</span>
                </Link>
              ))}
            </nav>
          ) : <p className="mt-10 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">No clinics are available yet.</p>
        )}
      </section>
    </main>
  );
}
