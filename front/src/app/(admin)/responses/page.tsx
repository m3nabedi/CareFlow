import ClinicResponses from "@/components/clinic-admin/ClinicResponses";

export default function ResponsesPage() {
  return <div className="mx-auto max-w-5xl"><p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Clinic workspace</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Responses</h1><p className="mt-2 text-sm leading-6 text-gray-500">Review submissions for forms owned by your clinic.</p><div className="mt-7"><ClinicResponses /></div></div>;
}
