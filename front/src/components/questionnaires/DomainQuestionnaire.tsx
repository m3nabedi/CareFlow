"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import PublicQuestionnaire from "@/components/questionnaires/PublicQuestionnaire";
import { questionnaireApi, QuestionnaireApiError } from "@/lib/questionnaires";

type DomainQuestionnaireProps = {
  questionnaireSlug: string;
};

function isLocalDevelopmentHost(host: string): boolean {
  const closingBracket = host.indexOf("]");
  const hostname = host.startsWith("[") && closingBracket > 0
    ? host.slice(1, closingBracket).toLowerCase()
    : host.split(":")[0]?.toLowerCase();

  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function subscribeToDomain(): () => void {
  return () => {};
}

export default function DomainQuestionnaire({ questionnaireSlug }: DomainQuestionnaireProps) {
  const [clinicSlug, setClinicSlug] = useState<string | null>(null);
  const [error, setError] = useState("");
  const domain = useSyncExternalStore(subscribeToDomain, () => window.location.host, () => "");
  const hasLocalDevelopmentHost = domain !== "" && isLocalDevelopmentHost(domain);

  useEffect(() => {
    if (domain === "" || hasLocalDevelopmentHost) {
      return;
    }

    let active = true;

    questionnaireApi.resolveClinicForDomain(domain)
      .then((clinic) => {
        if (active) {
          setClinicSlug(clinic.slug);
        }
      })
      .catch((requestError: Error) => {
        if (!active) {
          return;
        }

        setError(requestError instanceof QuestionnaireApiError && requestError.status === 404
          ? "This domain is not configured for a clinic yet. Ask the clinic administrator to complete domain setup."
          : "We could not load this clinic's domain configuration. Please try again shortly.");
      });

    return () => {
      active = false;
    };
  }, [domain, hasLocalDevelopmentHost]);

  if (hasLocalDevelopmentHost) {
    return <main className="grid min-h-screen place-items-center bg-gray-50 px-4 py-8"><div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm leading-6 text-amber-900" role="alert">A configured clinic domain is required to display this questionnaire. Open it from the clinic domain after completing domain setup.</div></main>;
  }

  if (error) {
    return <main className="grid min-h-screen place-items-center bg-gray-50 px-4 py-8"><div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm leading-6 text-amber-900" role="alert">{error}</div></main>;
  }

  if (!clinicSlug) {
    return <main className="grid min-h-screen place-items-center bg-gray-50 px-4 py-8"><p className="text-sm text-gray-500">Loading clinic questionnaire…</p></main>;
  }

  return <PublicQuestionnaire key={`${clinicSlug}/${questionnaireSlug}`} clinicSlug={clinicSlug} questionnaireSlug={questionnaireSlug} />;
}
