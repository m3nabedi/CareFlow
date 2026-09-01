import PublicQuestionnaire from "@/components/questionnaires/PublicQuestionnaire";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; questionnaireSlug: string }>;
}) {
  const { slug, questionnaireSlug } = await params;

  return <PublicQuestionnaire key={`${slug}/${questionnaireSlug}`} clinicSlug={slug} questionnaireSlug={questionnaireSlug} />;
}
