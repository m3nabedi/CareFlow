import QuestionnaireList from "@/components/questionnaires/QuestionnaireList";

export default function Dashboard() {
  return (
    <div><div className="mb-7"><p className="text-sm font-medium text-brand-500">CareFlow</p><h1 className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">Questionnaires</h1><p className="mt-2 text-sm text-gray-500">Choose a questionnaire to submit or review responses.</p></div><QuestionnaireList /></div>
  );
}
