import QuestionnaireDetail from "@/components/questionnaires/QuestionnaireDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestionnaireDetail id={id} />;
}
