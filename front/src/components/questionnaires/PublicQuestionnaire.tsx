"use client";

import { useEffect, useState } from "react";
import QuestionnaireForm from "@/components/questionnaires/QuestionnaireForm";
import { questionnaireApi, QuestionnaireApiError, type Questionnaire } from "@/lib/questionnaires";

type PublicQuestionnaireProps = {
  clinicSlug: string;
  questionnaireSlug: string;
  embedded?: boolean;
};

function clinicBrandColor(questionnaire: Questionnaire): string | undefined {
  const branding = questionnaire.clinic?.branding;
  const color = branding?.primary_color ?? branding?.primaryColor;

  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : undefined;
}

export default function PublicQuestionnaire({
  clinicSlug,
  questionnaireSlug,
  embedded = false,
}: PublicQuestionnaireProps) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    questionnaireApi.getForClinic(clinicSlug, questionnaireSlug)
      .then((item) => {
        if (active) {
          setQuestionnaire(item);
        }
      })
      .catch((requestError: Error) => {
        if (!active) {
          return;
        }

        setError(requestError instanceof QuestionnaireApiError && requestError.status === 404
          ? "This questionnaire is unavailable."
          : requestError.message);
      });

    return () => {
      active = false;
    };
  }, [clinicSlug, questionnaireSlug]);

  const pageClassName = embedded
    ? "bg-transparent p-0"
    : "min-h-screen bg-gray-50 px-4 py-8 sm:px-6 sm:py-12";

  if (error) {
    return <main className={pageClassName}><div className="mx-auto max-w-xl rounded-2xl border border-error-200 bg-error-50 p-6 text-center text-error-800" role="alert">{error}</div></main>;
  }

  if (!questionnaire) {
    return <main className={pageClassName}><p className="mx-auto max-w-5xl py-12 text-center text-sm text-gray-500">Loading questionnaire…</p></main>;
  }

  const clinicName = questionnaire.clinic?.name ?? "CareFlow clinic";
  const brandColor = clinicBrandColor(questionnaire);

  return (
    <main className={pageClassName}>
      <div className={embedded ? "mx-auto max-w-5xl" : "mx-auto max-w-5xl"}>
        {!embedded && (
          <header className="mb-7 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs" style={brandColor ? { borderTopColor: brandColor, borderTopWidth: 4 } : undefined}>
            <div className="px-5 py-6 sm:px-8 sm:py-7">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600">{clinicName}</p>
              <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">{questionnaire.title ?? questionnaire.name}</h1>
              {questionnaire.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">{questionnaire.description}</p>}
            </div>
          </header>
        )}
        {embedded && (
          <div className="mb-4 px-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{clinicName}</p>
            <h1 className="mt-1 text-lg font-bold text-gray-900">{questionnaire.title ?? questionnaire.name}</h1>
          </div>
        )}
        <QuestionnaireForm questionnaire={questionnaire} clinicSlug={clinicSlug} />
      </div>
    </main>
  );
}
