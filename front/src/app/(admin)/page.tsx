import QuestionnaireList from "@/components/questionnaires/QuestionnaireList";

export default function Dashboard() {
  return (
    <div><div className="mb-7"><p className="text-sm font-medium text-brand-500">CareFlow</p><h1 className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">پرسشنامه‌ها</h1><p className="mt-2 text-sm text-gray-500">پرسشنامه‌ای را انتخاب کنید تا پاسخ‌ها را ثبت یا بررسی کنید.</p></div><QuestionnaireList /></div>
  );
}
