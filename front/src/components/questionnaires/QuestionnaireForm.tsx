"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "@/components/form/date-picker";
import {
  questionnaireApi,
  QuestionnaireApiError,
  type FrontendRule,
  type Question,
  type Questionnaire,
  type QuestionnaireConfirmation,
  type QuestionnaireEvaluation,
  type QuestionOption,
  type WpFormsCondition,
} from "@/lib/questionnaires";

type Answers = Record<string, unknown>;
type Errors = Record<string, string>;

const inputClass =
  "h-12 w-full rounded-xl border border-gray-300 bg-white px-3.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500";

const optionValue = (option: QuestionOption): string =>
  typeof option === "string" ? option : String(option.id ?? option.value ?? option.label);
const optionLabel = (option: QuestionOption): string =>
  typeof option === "string" ? option : option.label;
const questionKey = (question: Question): string => String(question.key ?? question.id);
const sourceId = (question: Question): string =>
  String(question.execution?.sourceId ?? question.settings?.wpforms?.id ?? question.settings?.wpforms_field_id ?? question.id);
const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === "object" && !Array.isArray(value) && Object.values(value).every(isEmpty));

function answerForSource(questions: Question[], answers: Answers, field: string): unknown {
  const question = questions.find((candidate) => sourceId(candidate) === String(field) || questionKey(candidate) === String(field));
  return question ? answers[questionKey(question)] : undefined;
}

function conditionTarget(questions: Question[], condition: WpFormsCondition): string {
  const question = questions.find((candidate) => sourceId(candidate) === String(condition.field));
  const rawTarget = String(condition.value ?? condition.exclusiveChoice ?? "");
  const exact = question?.options?.find((option) =>
    typeof option !== "string" && String(option.id ?? option.value ?? "") === rawTarget,
  );
  if (exact) return optionValue(exact);
  const index = Number(rawTarget);
  if (question && Number.isInteger(index) && index > 0 && question.options?.[index - 1]) {
    return optionValue(question.options[index - 1]);
  }
  return rawTarget;
}

function conditionMatches(questions: Question[], answers: Answers, condition: WpFormsCondition): boolean {
  const answer = answerForSource(questions, answers, condition.field);
  const target = conditionTarget(questions, condition);
  const values = Array.isArray(answer) ? answer.map(String) : [String(answer ?? "")];
  const number = Number(Array.isArray(answer) ? answer[0] : answer);
  const targetNumber = Number(target);

  switch (condition.operator) {
    case "e": return isEmpty(answer);
    case "!e": return !isEmpty(answer);
    case "!=": return !values.includes(target);
    case ">": return Number.isFinite(number) && number > targetNumber;
    case "<": return Number.isFinite(number) && number < targetNumber;
    case ">=": return Number.isFinite(number) && number >= targetNumber;
    case "<=": return Number.isFinite(number) && number <= targetNumber;
    case "contains": return values.some((value) => value.includes(target));
    case "not_contains": return values.every((value) => !value.includes(target));
    case "checkbox_choice_only": return values.length === 1 && values[0] === target;
    case "==":
    default: return values.includes(target);
  }
}

function conditionsMatch(questions: Question[], answers: Answers, groups: WpFormsCondition[][] = []): boolean {
  return groups.some((group) => group.every((condition) => conditionMatches(questions, answers, condition)));
}

function normalizeConditionGroups(input: unknown): WpFormsCondition[][] {
  if (!input || typeof input !== "object") return [];
  const nodes = Array.isArray(input) ? input : Object.values(input);
  const isCondition = (value: unknown): value is WpFormsCondition =>
    Boolean(value && typeof value === "object" && "field" in value && "operator" in value);
  if (nodes.every(isCondition)) return [nodes];
  return nodes.flatMap((node) => normalizeConditionGroups(node));
}

function isVisible(question: Question, questions: Question[], answers: Answers): boolean {
  const runtimeVisibility = question.execution?.visibility;
  if (runtimeVisibility?.groups?.length) {
    const matches = conditionsMatch(questions, answers, runtimeVisibility.groups);
    return runtimeVisibility.effect === "hide" ? !matches : matches;
  }
  const settings = question.settings?.wpforms;
  const groups = normalizeConditionGroups(settings?.conditionals);
  if (settings?.conditional_logic !== "1" || groups.length === 0) return true;
  const matches = conditionsMatch(questions, answers, groups);
  return settings.conditional_type === "hide" ? !matches : matches;
}

function buildSteps(questions: Question[]): Question[][] {
  const sorted = [...questions].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const steps: Question[][] = [[]];
  sorted.forEach((question) => {
    if (question.type !== "pagebreak") {
      steps[steps.length - 1].push(question);
      return;
    }
    const position = question.settings?.wpforms?.position;
    if (position !== "top" && position !== "bottom" && steps.at(-1)!.length > 0) steps.push([]);
  });
  return steps.filter((step) => step.length > 0);
}

function safeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const allowed = new Set(["A", "BR", "DIV", "EM", "H2", "H3", "H4", "LI", "OL", "P", "SPAN", "STRONG", "UL"]);
  [...parsed.body.querySelectorAll("*")].forEach((element) => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }
    const href = element.tagName === "A" ? element.getAttribute("href") : null;
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
    if (element.tagName === "A" && href && /^https?:\/\//i.test(href)) {
      element.setAttribute("href", href);
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  });
  return parsed.body.innerHTML;
}

type ContentTone = "info" | "warning" | "success";

function contentIsUrgent(html: string): boolean {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").toLowerCase();
  return /urgent|emergency|higher-support|higher support|acute care|cannot (provide|proceed)|unable to provide|not eligible|triple zero|\b000\b/.test(text);
}

function RichContent({ html, tone = "info", title }: { html: string; tone?: ContentTone; title?: string }) {
  const [sanitized, setSanitized] = useState("");

  useEffect(() => {
    setSanitized(safeHtml(html));
  }, [html]);

  const palette = tone === "warning"
    ? "border-error-300 bg-error-50 text-error-950 dark:border-error-500/50 dark:bg-error-500/10 dark:text-error-100"
    : tone === "success"
      ? "border-success-200 bg-success-50 text-success-950 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-100"
      : "border-blue-light-200 bg-blue-light-50 text-gray-700 dark:border-blue-light-500/30 dark:bg-blue-light-500/10 dark:text-gray-200";
  const iconPalette = tone === "warning"
    ? "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-300"
    : tone === "success"
      ? "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-300"
      : "bg-blue-light-100 text-blue-light-700 dark:bg-blue-light-500/20 dark:text-blue-light-300";

  return (
    <aside className={`flex items-start gap-3.5 rounded-xl border p-4 shadow-theme-xs sm:p-5 ${palette}`} role={tone === "warning" ? "alert" : "note"}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconPalette}`} aria-hidden="true">
        {tone === "warning" ? (
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4m0 4h.01M10.3 3.6 2.4 17.3A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.7L13.7 3.6a2 2 0 0 0-3.4 0Z" /></svg>
        ) : tone === "success" ? (
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m5 12 4 4L19 6" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        {title && <h3 className="mb-1.5 text-sm font-bold sm:text-base">{title}</h3>}
        <div
          className="text-sm leading-6 [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-bold [&_h4]:mb-1.5 [&_h4]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ol]:grid [&_ol]:gap-1 [&_p+p]:mt-2 [&_ul]:grid [&_ul]:gap-1 dark:[&_a]:text-brand-300"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      </div>
    </aside>
  );
}

export default function QuestionnaireForm({ questionnaire }: { questionnaire: Questionnaire }) {
  const questions = useMemo(() => questionnaire.questions ?? [], [questionnaire.questions]);
  const steps = useMemo(() => {
    const executionSteps = questionnaire.execution?.steps;
    if (!executionSteps?.length) return buildSteps(questions);
    return executionSteps.map((step) => step.elements.map((element) => questions.find((question) => questionKey(question) === element.key)).filter((question): question is Question => Boolean(question))).filter((step) => step.length > 0);
  }, [questionnaire.execution?.steps, questions]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [phonePrefixes, setPhonePrefixes] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionConfirmation, setSubmissionConfirmation] = useState<QuestionnaireConfirmation | null>(null);
  const [evaluation, setEvaluation] = useState<QuestionnaireEvaluation | null>(null);
  const [evaluationStatus, setEvaluationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const formTop = useRef<HTMLDivElement>(null);
  const wpSettings = questionnaire.settings?.wpforms_settings;
  const rules = useMemo(() => wpSettings?.mcp_frontend_rules ?? questionnaire.execution?.gates?.map((gate) => ({
    key: gate.key,
    type: gate.type,
    page: gate.step,
    mode: gate.passWhen?.mode,
    conditions: gate.passWhen?.conditions,
    message: gate.blocked?.message,
    messageTitle: gate.blocked?.title,
    hideNextUntilClear: gate.blocked?.hideNext,
  })) ?? [], [questionnaire.execution?.gates, wpSettings?.mcp_frontend_rules]);
  const phoneConfiguration = useMemo(() => {
    const clinic = questionnaire.clinic;
    const rawAllowed = clinic?.allowed_calling_codes ?? clinic?.regional?.allowedCallingCodes ?? clinic?.regional?.allowed_calling_codes ?? [];
    const allowed = rawAllowed.map((entry) => {
      if (typeof entry === "string") return { code: entry, label: entry };
      const code = entry.callingCode ?? entry.calling_code ?? "";
      const region = entry.label ?? entry.iso ?? "";
      return { code, label: region ? `${region} ${code}` : code };
    }).filter((entry) => entry.code);
    const importedDefault = questions.find((question) => question.type === "phone")?.settings?.wpforms?.default_calling_code;
    const preferred = String(clinic?.default_calling_code ?? clinic?.regional?.defaultCallingCode ?? clinic?.regional?.default_calling_code ?? importedDefault ?? "");
    const options = allowed.length > 0 ? allowed : [{ code: preferred || "+1", label: preferred || "+1" }];
    const defaultCode = options.some((option) => option.code === preferred) ? preferred : options[0].code;
    return { options, defaultCode };
  }, [questionnaire.clinic, questions]);
  const recommendationSources = useMemo(() => {
    const calculation = questionnaire.execution?.calculations?.find((item) => item.target === "wpforms_87" && item.operation === "joinVisibleValues");
    const sources = calculation?.sources;
    return Array.isArray(sources) ? sources.map(String) : ["wpforms_75", "wpforms_78", "wpforms_76"];
  }, [questionnaire.execution?.calculations]);
  const formAnswers = useMemo(() => {
    const next: Answers = { ...answers };
    questions.forEach((question) => {
      if (question.type === "hidden" || question.execution?.hidden) return;
      const defaultValue = question.execution?.defaultValue ?? question.settings?.wpforms?.default_value;
      if (isEmpty(next[questionKey(question)]) && !isEmpty(defaultValue)) {
        next[questionKey(question)] = defaultValue;
        return;
      }
      const selectedChoices = (question.options ?? [])
        .filter((option) => typeof option !== "string" && option.selected)
        .map(optionValue);
      if (isEmpty(next[questionKey(question)]) && selectedChoices.length > 0) {
        next[questionKey(question)] = ["checkbox", "multiple_checkboxes"].includes(question.type)
          ? selectedChoices
          : selectedChoices[0];
      }
    });
    const recommended = questions
      .filter((question) => recommendationSources.includes(questionKey(question)))
      .filter((question) => isVisible(question, questions, next))
      .map((question) => String(next[questionKey(question)] ?? question.label))
      .filter(Boolean);
    const recommendation = questions.find((question) => sourceId(question) === "87");
    if (recommendation) next[questionKey(recommendation)] = recommended.join(" OR ");
    return next;
  }, [answers, questions, recommendationSources]);
  const eligibleDoctors = questions.filter((question) => recommendationSources.includes(questionKey(question)) && isVisible(question, questions, formAnswers));
  const recommendationsReady = (steps[2] ?? []).filter((question) => question.required && !["content", "hidden", "layout", "pagebreak"].includes(question.type) && isVisible(question, questions, formAnswers)).every((question) => !isEmpty(formAnswers[questionKey(question)]) || Boolean(files[questionKey(question)]));
  const displayedRecommendations: QuestionnaireEvaluation["recommendations"] = evaluation?.recommendations ?? eligibleDoctors.map((question) => ({ key: questionKey(question), name: question.label, status: "preview", reason: undefined }));

  useEffect(() => {
    let active = true;
    setEvaluationStatus("loading");
    const timeout = window.setTimeout(() => {
      questionnaireApi.evaluate(String(questionnaire.id), formAnswers)
        .then((result) => {
          if (!active) return;
          setEvaluation(result);
          setEvaluationStatus("success");
        })
        .catch(() => {
          if (!active) return;
          setEvaluationStatus("error");
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [formAnswers, questionnaire.id, questionnaire.slug]);

  const update = (question: Question, value: unknown): void => {
    const key = questionKey(question);
    setAnswers((current) => {
      const next = { ...current, [key]: value };
      if (sourceId(question) === "96" && typeof value === "string" && value) {
        const birthDate = new Date(`${value}T00:00:00`);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        if (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())) age -= 1;
        const ageQuestion = questions.find((candidate) => sourceId(candidate) === "95");
        if (ageQuestion && Number.isFinite(age)) next[questionKey(ageQuestion)] = age;
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const exclusiveChoice = (question: Question): string | undefined => {
    const configured = rules.flatMap((rule) => rule.conditions ?? [])
      .find((condition) => String(condition.field) === sourceId(question) && condition.exclusiveChoice);
    if (configured) return conditionTarget(questions, configured);
    const fallback = question.options?.find((option) => /^(none|none of the above)$/i.test(optionLabel(option).trim()));
    return fallback ? optionValue(fallback) : undefined;
  };

  const toggleCheckbox = (question: Question, choice: string, checked: boolean): void => {
    const current = Array.isArray(formAnswers[questionKey(question)])
      ? (formAnswers[questionKey(question)] as unknown[]).map(String) : [];
    const exclusive = exclusiveChoice(question);
    const next = !checked
      ? current.filter((value) => value !== choice)
      : choice === exclusive
        ? [choice]
        : [...current.filter((value) => value !== exclusive && value !== choice), choice];
    update(question, next);
  };

  const renderField = (question: Question): ReactNode => {
    const key = questionKey(question);
    const value = formAnswers[key];
    const options = question.options ?? [];
    const error = errors[key];
    const describedBy = error ? `${key}-error` : undefined;

    if (question.type === "content") {
      const html = String(question.execution?.content ?? question.settings?.wpforms?.content ?? question.description ?? "");
      const urgent = ["56", "58"].includes(sourceId(question)) || contentIsUrgent(html);
      return <RichContent html={html} tone={urgent ? "warning" : "info"} title={urgent ? "Important care information" : undefined} />;
    }
    if (question.type === "hidden") return null;
    if (question.type === "textarea" || question.type === "paragraph") return (
      <textarea value={String(value ?? "")} onChange={(event) => update(question, event.target.value)} placeholder={question.placeholder ?? ""} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={`${inputClass} min-h-32 py-3`} />
    );
    if (question.type === "select" || question.type === "dropdown") return (
      <select value={String(value ?? "")} onChange={(event) => update(question, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={inputClass}>
        <option value="">Select an option</option>
        {options.map((option, index) => <option key={`${index}-${optionValue(option)}`} value={optionValue(option)}>{optionLabel(option)}</option>)}
      </select>
    );
    if (question.type === "radio" || question.type === "multiple_choice") return (
      <div className="grid gap-2.5 sm:grid-cols-2">
        {options.map((option, index) => {
          const choice = optionValue(option); const selected = String(value ?? "") === choice; const inputId = `${key}-choice-${index}-${choice.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
          return <label htmlFor={inputId} key={`${index}-${choice}`} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm leading-5 transition ${selected ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/10 dark:bg-brand-500/10 dark:text-brand-300" : "border-gray-200 bg-white text-gray-700 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"}`}>
            <input id={inputId} type="radio" name={key} value={choice} checked={selected} onChange={(event) => update(question, event.currentTarget.value)} className="mt-0.5 size-4 border-gray-300 text-brand-500 focus:ring-brand-500" />{optionLabel(option)}
          </label>;
        })}
      </div>
    );
    if (question.type === "checkbox" || question.type === "multiple_checkboxes") {
      const selected = Array.isArray(value) ? value.map(String) : [];
      return <div className="grid gap-2.5">{options.map((option, index) => {
        const choice = optionValue(option); const checked = selected.includes(choice); const inputId = `${key}-choice-${index}-${choice.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        return <label htmlFor={inputId} key={`${index}-${choice}`} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm leading-5 transition ${checked ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "border-gray-200 bg-white text-gray-700 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"}`}>
          <input id={inputId} type="checkbox" value={choice} checked={checked} onChange={(event) => toggleCheckbox(question, event.currentTarget.value, event.currentTarget.checked)} className="mt-0.5 size-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500" />{optionLabel(option)}
        </label>;
      })}</div>;
    }
    if (question.type === "email") {
      const confirmation = question.execution?.compound?.mustMatch || String(question.validation?.confirmation ?? question.settings?.wpforms?.confirmation ?? "") === "1";
      return <div className={confirmation ? "grid gap-4 sm:grid-cols-2" : ""}>
        <label className="grid gap-1.5"><span className="sr-only">{question.label}</span><input type="email" value={String(value ?? "")} onChange={(event) => update(question, event.target.value)} placeholder={question.placeholder ?? ""} autoComplete="email" aria-invalid={Boolean(error)} aria-describedby={describedBy} className={inputClass} />{confirmation && <span className="text-xs text-gray-500 dark:text-gray-400">Email</span>}</label>
        {confirmation && <label className="grid gap-1.5"><span className="sr-only">Confirm email</span><input type="email" value={confirmations[key] ?? ""} onChange={(event) => { setConfirmations((current) => ({ ...current, [key]: event.target.value })); setErrors((current) => ({ ...current, [key]: "" })); }} placeholder={String(question.settings?.wpforms?.confirmation_placeholder ?? "")} autoComplete="email" aria-invalid={Boolean(error)} aria-describedby={describedBy} className={inputClass} /><span className="text-xs text-gray-500 dark:text-gray-400">Confirm Email</span></label>}
      </div>;
    }
    if (question.type === "phone") {
      const prefix = phonePrefixes[key] ?? phoneConfiguration.defaultCode;
      return <div className="flex"><select aria-label="Country calling code" value={prefix} onChange={(event) => setPhonePrefixes((current) => ({ ...current, [key]: event.target.value }))} className="h-12 w-32 rounded-l-xl border border-r-0 border-gray-300 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">{phoneConfiguration.options.map((option, index) => <option key={`${option.code}-${index}`} value={option.code}>{option.label}</option>)}</select><input type="tel" value={String(value ?? "").replace(/^\+\d+\s*/, "")} onChange={(event) => update(question, `${prefix} ${event.target.value}`.trim())} placeholder={question.placeholder ?? "Phone number"} autoComplete="tel" aria-invalid={Boolean(error)} aria-describedby={describedBy} className={`${inputClass} rounded-l-none`} /></div>;
    }
    if (question.type === "file" || question.settings?.wpforms?.type === "file-upload") {
      const file = files[key];
      return <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-6 text-center transition hover:border-brand-400 hover:bg-brand-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-brand-500/5"><span className="text-sm font-medium text-gray-700 dark:text-gray-200">{file ? file.name : "Choose a file or drop it here"}</span><span className="text-xs text-gray-500">PDF, image or document</span><input type="file" className="sr-only" onChange={(event) => { const selected = event.target.files?.[0]; if (!selected) return; setFiles((current) => ({ ...current, [key]: selected })); update(question, { name: selected.name, size: selected.size, type: selected.type }); }} /></label>;
    }
    if (question.type === "name") {
      const name = typeof value === "object" && value ? (value as Record<string, string>) : {};
      return <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5"><input className={inputClass} value={name.first ?? ""} onChange={(event) => update(question, { ...name, first: event.target.value })} /><span className="text-xs text-gray-500">First name</span></label><label className="grid gap-1.5"><input className={inputClass} value={name.last ?? ""} onChange={(event) => update(question, { ...name, last: event.target.value })} /><span className="text-xs text-gray-500">Last name</span></label></div>;
    }
    if (question.execution?.readOnly || question.settings?.wpforms?.read_only === "1") {
      return <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm font-semibold text-success-800 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300">{String(value ?? question.label)}</div>;
    }
    if (question.type === "date") {
      const isBirthDate = sourceId(question) === "96" || sourceId(question) === "91" || /date of birth|birth date|dob/i.test(question.label);
      return <DatePicker id={`date-${key}`} value={typeof value === "string" ? value : undefined} onChange={(_, canonicalValue) => update(question, canonicalValue)} dateFormat="Y-m-d" displayFormat={String(question.settings?.wpforms?.date_format ?? "d/m/Y")} maxDate={isBirthDate ? "today" : undefined} placeholder={question.placeholder ?? "Select a date"} required={question.required} invalid={Boolean(error)} describedBy={describedBy} />;
    }
    const type = question.type === "number" ? "number" : "text";
    return <input type={type} value={String(value ?? "")} onChange={(event) => update(question, type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)} placeholder={question.placeholder ?? ""} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={inputClass} />;
  };

  const renderQuestion = (question: Question): ReactNode => {
    if (!isVisible(question, questions, formAnswers) || question.type === "hidden" || question.execution?.hidden) return null;
    if (question.type === "content") return <div key={question.id}>{renderField(question)}</div>;
    if (recommendationSources.includes(questionKey(question))) return null;
    const key = questionKey(question);
    const description = question.settings?.wpforms?.description ?? question.description;
    return <div key={question.id} data-field={sourceId(question)} className="grid gap-2.5">
      <label className="text-sm font-semibold text-gray-800 dark:text-white/90">{question.label}{question.required && <span className="ml-1 text-error-500">*</span>}</label>
      {renderField(question)}
      {description && <RichContent html={String(description)} tone={contentIsUrgent(String(description)) ? "warning" : "info"} title={/^\s*(?:<[^>]+>\s*)*important\b/i.test(String(description)) ? "Important" : undefined} />}
      {errors[key] && <p id={`${key}-error`} role="alert" className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm font-semibold text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"><span aria-hidden="true">!</span><span>{errors[key]}</span></p>}
    </div>;
  };

  const renderStep = (step: Question[]): ReactNode[] => {
    const layoutColumns = (question: Question): Array<{ fields?: Array<string | number> }> => question.execution?.columns ?? question.settings?.wpforms?.columns ?? [];
    const layoutMembers = new Set(step.filter((question) => question.type === "layout").flatMap((question) => layoutColumns(question).flatMap((column) => column.fields ?? []).map(String)));
    const content: ReactNode[] = [];
    step.forEach((question) => {
      if (layoutMembers.has(sourceId(question)) || layoutMembers.has(questionKey(question))) return;
      if (question.type !== "layout") {
        content.push(renderQuestion(question));
        return;
      }
      const columns = layoutColumns(question);
      content.push(<section key={question.id} className="grid gap-4">
        {question.label && question.settings?.wpforms?.label_hide !== "1" && <div><h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{question.label}</h3>{question.description && <p className="mt-1 text-sm text-gray-500">{question.description}</p>}</div>}
        <div className={`grid gap-6 ${columns.length > 1 ? "lg:grid-cols-2" : ""}`}>{columns.map((column, index) => <div key={index} className="grid content-start gap-6">{(column.fields ?? []).map((id) => { const child = step.find((candidate) => sourceId(candidate) === String(id) || questionKey(candidate) === String(id)); return child ? renderQuestion(child) : null; })}</div>)}</div>
        {columns.some((column) => (column.fields ?? []).some((id) => recommendationSources.includes(String(id).startsWith("wpforms_") ? String(id) : `wpforms_${id}`))) && <div className="grid gap-3">
          {evaluationStatus === "loading" && <p className="text-sm text-gray-500 dark:text-gray-400">Checking eligibility with the clinic…</p>}
          {displayedRecommendations.map((recommendation) => <article key={recommendation.key} className="flex items-start gap-3 rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-500/30 dark:bg-success-500/10"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-100 font-semibold text-success-700 dark:bg-success-500/20 dark:text-success-300">✓</span><div><p className="text-xs font-semibold uppercase tracking-wide text-success-700 dark:text-success-400">{evaluation ? "Eligible psychiatrist" : "Eligibility preview"}</p><h4 className="mt-0.5 font-semibold text-gray-900 dark:text-white">{recommendation.name}</h4>{recommendation.reason && <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">{recommendation.reason}</p>}</div></article>)}
          {displayedRecommendations.length === 0 && recommendationsReady && evaluationStatus !== "loading" && <div className="rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm leading-6 text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"><strong className="block">No eligible psychiatrist was identified.</strong>Please contact the clinic so the care team can review the referral and advise on the most appropriate pathway.</div>}
          {evaluationStatus === "error" && <p className="text-xs text-warning-700 dark:text-warning-400">The clinic eligibility service is temporarily unavailable. Any results shown above are a local preview and will be verified when you submit.</p>}
        </div>}
      </section>);
    });
    return content;
  };

  const validateQuestions = (candidates: Question[]): Errors => {
    const nextErrors: Errors = {};
    candidates.filter((question) => isVisible(question, questions, formAnswers)).forEach((question) => {
      if (["content", "hidden", "layout", "pagebreak"].includes(question.type)) return;
      const key = questionKey(question); const value = formAnswers[key];
      if (question.required && isEmpty(value)) { nextErrors[key] = "This field is required."; return; }
      if (question.type === "email" && !isEmpty(value)) {
        if (!/^\S+@\S+\.\S+$/.test(String(value))) { nextErrors[key] = "Enter a valid email address."; return; }
        const confirmation = question.execution?.compound?.mustMatch || String(question.validation?.confirmation ?? question.settings?.wpforms?.confirmation ?? "") === "1";
        if (confirmation && confirmations[key] !== String(value)) nextErrors[key] = "The email addresses do not match.";
      }
    });
    return nextErrors;
  };

  const currentRules = rules.filter((rule) => rule.type === "page_next_gate" && rule.page === currentStep + 1);
  const ruleIsClear = (rule: FrontendRule): boolean => {
    const results = (rule.conditions ?? []).map((condition) => conditionMatches(questions, formAnswers, condition));
    return rule.mode === "any" ? results.some(Boolean) : results.length > 0 && results.every(Boolean);
  };
  const localBlockedRules = currentRules.filter((rule) => !ruleIsClear(rule));
  const serverGateViolations = evaluation?.gateViolations.filter((violation) =>
    violation.step === currentStep + 1 || currentRules.some((rule) => rule.key && rule.key === violation.key),
  ) ?? [];
  const blockedRules = evaluationStatus === "success"
    ? currentRules.filter((rule) => serverGateViolations.some((violation) => violation.key === rule.key))
    : localBlockedRules;
  const hidesNext = evaluationStatus === "success"
    ? serverGateViolations.some((violation) => violation.blocked?.hideNext !== false)
    : blockedRules.some((rule) => rule.hideNextUntilClear);
  const visibleWarningText = (steps[currentStep] ?? [])
    .filter((question) => question.type === "content" && isVisible(question, questions, formAnswers))
    .map((question) => String(question.execution?.content ?? question.description ?? "").replace(/<[^>]*>/g, " ").toLowerCase())
    .join(" ");
  const actionableBlockedRules = blockedRules.filter((rule) => {
    const hasAnsweredCondition = (rule.conditions ?? []).some((condition) => !isEmpty(answerForSource(questions, formAnswers, condition.field)));
    const title = String(rule.messageTitle ?? rule.message ?? "").toLowerCase();

    return hasAnsweredCondition && (title === "" || !visibleWarningText.includes(title));
  });

  const goToStep = (nextStep: number): void => {
    setCurrentStep(nextStep); setErrors({});
    requestAnimationFrame(() => formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const next = (): void => {
    const nextErrors = validateQuestions(steps[currentStep] ?? []); setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || blockedRules.length > 0) return;
    goToStep(Math.min(currentStep + 1, steps.length - 1));
  };
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const allErrors = validateQuestions(questions);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const invalidStep = steps.findIndex((step) => step.some((question) => allErrors[questionKey(question)]));
      if (invalidStep >= 0) goToStep(invalidStep);
      return;
    }
    setSaving(true); setMessage("");
    try {
      const submissionAnswers = { ...formAnswers, ...(evaluation?.derivedAnswers ?? {}) };
      questions.forEach((question) => {
        const key = questionKey(question);
        if (question.type === "email" && (question.execution?.compound?.mustMatch || String(question.validation?.confirmation ?? question.settings?.wpforms?.confirmation ?? "") === "1")) {
          submissionAnswers[key] = { value: String(formAnswers[key] ?? ""), confirmation: confirmations[key] ?? "" };
        }
      });
      const result = await questionnaireApi.submit(String(questionnaire.id), submissionAnswers, files);
      setSubmissionConfirmation(result.confirmation ?? questionnaire.execution?.completion?.confirmation ?? null);
      setSubmitted(true); setMessage("Your response has been submitted successfully.");
      requestAnimationFrame(() => formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (error) {
      if (error instanceof QuestionnaireApiError) {
        const apiErrors: Errors = {};
        Object.entries(error.errors).forEach(([path, detail]) => {
          const segments = path.split(".");
          const answerIndex = segments.indexOf("answers");
          const key = answerIndex >= 0 ? segments[answerIndex + 1] : undefined;
          if (key) apiErrors[key] = Array.isArray(detail) ? detail[0] : detail;
        });
        setErrors(apiErrors);
        const invalidStep = steps.findIndex((step) => step.some((question) => apiErrors[questionKey(question)]));
        if (invalidStep >= 0) goToStep(invalidStep);
        setMessage(Object.keys(apiErrors).length > 0 ? "Please review the highlighted fields and submit again." : error.message);
      } else {
        setMessage(error instanceof Error ? error.message : "Your response could not be submitted.");
      }
    }
    finally { setSaving(false); }
  };

  if (submitted) {
    const redirect = submissionConfirmation?.redirect;
    const safeRedirect = redirect && /^https?:\/\//i.test(redirect) ? redirect : null;
    const confirmationMessage = submissionConfirmation?.message;

    return <section ref={formTop} className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-success-200 bg-white shadow-theme-md dark:border-success-500/30 dark:bg-gray-900" aria-live="polite">
      <div className="border-b border-success-100 bg-success-50 px-6 py-7 text-center sm:px-10 sm:py-9 dark:border-success-500/20 dark:bg-success-500/10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-100 text-success-700 ring-8 ring-success-100/50 dark:bg-success-500/20 dark:text-success-300 dark:ring-success-500/10"><svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m5 12 4 4L19 6" /></svg></div>
        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-success-700 dark:text-success-400">Submission received</p>
        <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{submissionConfirmation?.title ?? submissionConfirmation?.name ?? "Thank you"}</h2>
      </div>
      <div className="grid gap-6 px-6 py-7 sm:px-10 sm:py-9">
        {confirmationMessage ? <RichContent html={confirmationMessage} tone="success" /> : <p className="text-center text-sm leading-6 text-gray-600 dark:text-gray-300">{message}</p>}
        {safeRedirect && <div className="flex justify-center"><a href={safeRedirect} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-500/20">Continue to booking <span aria-hidden="true">→</span></a></div>}
      </div>
    </section>;
  }

  return <form onSubmit={submit} noValidate className="mx-auto max-w-5xl" dir="ltr">
    <div ref={formTop} className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-gray-900">
      {steps.length > 1 && <div className="border-b border-gray-100 px-5 py-5 sm:px-8 dark:border-gray-800"><div className="flex items-center gap-3" aria-label={`Step ${currentStep + 1} of ${steps.length}`}>{steps.map((_, index) => <div key={index} className="flex flex-1 items-center gap-3 last:flex-none"><span aria-current={index === currentStep ? "step" : undefined} className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${index < currentStep ? "bg-success-500 text-white" : index === currentStep ? "bg-brand-500 text-white shadow-focus-ring" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{index < currentStep ? "✓" : index + 1}</span>{index < steps.length - 1 && <span className={`h-1 flex-1 rounded-full ${index < currentStep ? "bg-success-400" : "bg-gray-100 dark:bg-gray-800"}`} />}</div>)}</div><p className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Step {currentStep + 1} of {steps.length}</p></div>}
      <div className="grid gap-7 px-5 py-7 sm:px-8 sm:py-9">
        {message && <div role="alert" className="flex items-start gap-3 rounded-xl border border-error-300 bg-error-50 p-4 text-error-900 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-200"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-error-100 text-sm font-bold dark:bg-error-500/20" aria-hidden="true">!</span><div><p className="font-bold">We could not submit your response</p><p className="mt-1 text-sm leading-6">{message}</p></div></div>}
        {renderStep(steps[currentStep] ?? [])}
        {actionableBlockedRules.slice(0, 1).map((rule, index) => <RichContent key={rule.key ?? index} html={rule.message ?? "Your answers indicate that this clinic may not be the appropriate care pathway. Please review the guidance above."} tone="warning" title={rule.messageTitle ?? "You cannot continue with this response"} />)}
      </div>
      <div className="flex min-h-21 flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-5 sm:px-8 dark:border-gray-800"><div>{currentStep > 0 && <button type="button" onClick={() => goToStep(currentStep - 1)} className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">Previous</button>}</div><div className="flex items-center gap-3">{currentStep < steps.length - 1 ? <button type="button" onClick={next} disabled={hidesNext} aria-describedby={hidesNext ? "next-step-requirement" : undefined} className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus:ring-4 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50">Next</button> : <button type="submit" disabled={saving} className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus:ring-4 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50">{saving ? wpSettings?.submit_text_processing ?? questionnaire.execution?.completion?.processingText ?? "Sending…" : wpSettings?.submit_text ?? questionnaire.execution?.completion?.submitText ?? "Submit"}</button>}</div></div>
      {currentStep < steps.length - 1 && hidesNext && <p id="next-step-requirement" role="alert" className="flex items-center gap-2 border-t border-error-200 bg-error-50 px-5 py-3 text-sm font-semibold text-error-800 sm:px-8 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-error-100 text-xs dark:bg-error-500/20" aria-hidden="true">!</span>Review the highlighted care guidance above before continuing.</p>}
    </div>
  </form>;
}
