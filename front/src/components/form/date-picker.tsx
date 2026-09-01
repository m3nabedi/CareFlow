import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";
import DateOption = flatpickr.Options.DateOption;
import Hook = flatpickr.Options.Hook;

type PropsType = {
  id: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  value?: DateOption;
  defaultDate?: DateOption;
  maxDate?: DateOption;
  minDate?: DateOption;
  dateFormat?: string;
  displayFormat?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

export default function DatePicker({
  id,
  mode = "single",
  onChange,
  value,
  defaultDate,
  maxDate,
  minDate,
  dateFormat = "Y-m-d",
  displayFormat = "d/m/Y",
  label,
  placeholder,
  required,
  invalid,
  describedBy,
}: PropsType) {
  const inputRef = useRef<HTMLInputElement>(null);
  const instanceRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);
  const initialDateRef = useRef(value ?? defaultDate);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!inputRef.current) return;
    const instance = flatpickr(inputRef.current, {
      mode,
      static: true,
      allowInput: true,
      disableMobile: true,
      monthSelectorType: "dropdown",
      dateFormat,
      altInput: true,
      altFormat: displayFormat,
      defaultDate: initialDateRef.current,
      maxDate,
      minDate,
      onChange: (dates, currentDateString, currentInstance, data) => {
        const callback = onChangeRef.current;
        if (Array.isArray(callback)) callback.forEach((hook) => hook(dates, currentDateString, currentInstance, data));
        else callback?.(dates, currentDateString, currentInstance, data);
      },
      onReady: (_, __, currentInstance) => {
        const altInput = currentInstance.altInput;
        if (!altInput) return;
        altInput.setAttribute("aria-invalid", String(Boolean(invalid)));
        if (describedBy) altInput.setAttribute("aria-describedby", describedBy);
        if (required) altInput.setAttribute("aria-required", "true");
      },
    });
    instanceRef.current = instance;
    return () => {
      instance.destroy();
      instanceRef.current = null;
    };
  }, [dateFormat, defaultDate, describedBy, displayFormat, id, invalid, maxDate, minDate, mode, required]);

  useEffect(() => {
    if (!instanceRef.current) return;
    if (value) instanceRef.current.setDate(value, false, dateFormat);
    else instanceRef.current.clear(false);
  }, [dateFormat, value]);

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          hidden
          aria-hidden="true"
          inputMode="numeric"
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          required={required}
          className={`h-12 w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs outline-none transition placeholder:text-gray-400 focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 ${invalid ? "border-error-400 focus:border-error-500 focus:ring-error-500/10 dark:border-error-500" : "border-gray-300 focus:border-brand-500 focus:ring-brand-500/10 dark:border-gray-700 dark:focus:border-brand-500"}`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
          <CalenderIcon className="size-5" />
        </span>
      </div>
    </div>
  );
}
