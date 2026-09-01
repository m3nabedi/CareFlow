"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clinicAdminTokenKey } from "@/lib/clinic-admin";

export default function GoogleCallbackPage() {
  const router = useRouter();
  useEffect(() => { const token = new URLSearchParams(window.location.search).get("token"); if (!token) return; window.localStorage.setItem(clinicAdminTokenKey, token); router.replace("/admin"); }, [router]);
  return <main className="grid min-h-screen place-items-center bg-gray-50 p-6 text-center dark:bg-gray-900"><div><h1 className="text-xl font-bold text-gray-900 dark:text-white">Completing Google sign-in</h1><p className="mt-2 text-sm text-gray-500">Please wait while we open your clinic workspace. If this page does not continue, please sign in again.</p></div></main>;
}
