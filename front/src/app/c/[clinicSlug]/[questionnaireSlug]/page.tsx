import PublicQuestionnaire from "@/components/questionnaires/PublicQuestionnaire";

export default async function Page({
  params,
}: {
  params: Promise<{ clinicSlug: string; questionnaireSlug: string }>;
}) {
  const { clinicSlug, questionnaireSlug } = await params;

  return <PublicQuestionnaire key={`${clinicSlug}/${questionnaireSlug}`} clinicSlug={clinicSlug} questionnaireSlug={questionnaireSlug} />;
}
