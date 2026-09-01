import ResponsesBoard from "@/components/questionnaires/ResponsesBoard";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResponsesBoard id={id} />;
}
