import ClinicResponses from "@/components/clinic-admin/ClinicResponses";

export default function ResponsesPage() {
  return <div><div className="mb-5"><p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Clinic data workspace</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Responses</h1><p className="mt-2 text-sm leading-6 text-gray-500">Review, organize, and move every submission through your clinic workflow.</p></div><ClinicResponses /></div>;
}
