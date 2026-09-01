import DomainQuestionnaire from "@/components/questionnaires/DomainQuestionnaire";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <DomainQuestionnaire questionnaireSlug={slug} />;
}
