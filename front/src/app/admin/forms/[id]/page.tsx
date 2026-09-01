import ClinicFormEditor from "@/components/clinic-admin/ClinicFormEditor";

export default async function AdminFormPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ClinicFormEditor id={id} />; }
