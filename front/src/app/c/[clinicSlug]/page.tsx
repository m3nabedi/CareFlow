import PublicClinicQuestionnaires from "@/components/questionnaires/PublicClinicQuestionnaires";

export default async function Page({
  params,
}: {
  params: Promise<{ clinicSlug: string }>;
}) {
  const { clinicSlug } = await params;

  return <PublicClinicQuestionnaires clinicSlug={clinicSlug} />;
}
