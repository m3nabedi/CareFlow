import Link from "next/link";
import ClinicFormList from "@/components/clinic-admin/ClinicFormList";

export default function FormsPage() {
  return <div><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Clinic workspace</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Forms</h1><p className="mt-2 text-sm text-gray-500">Manage the forms your clinic makes available to patients.</p></div><Link href="/admin/clinic-settings" className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-transparent dark:text-gray-200">Clinic settings</Link></div><ClinicFormList /></div>;
}
