"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "../(admin)/layout";
import { clinicAdminTokenKey } from "@/lib/clinic-admin";

export default function ClinicAdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter(); const [allowed] = useState(() => typeof window !== "undefined" && Boolean(window.localStorage.getItem(clinicAdminTokenKey)));
  useEffect(() => { if (!allowed) router.replace("/signin"); }, [allowed, router]);
  if (!allowed) return <main className="grid min-h-screen place-items-center bg-gray-50 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">Checking your clinic workspace…</main>;
  return <AdminLayout>{children}</AdminLayout>;
}
