import { clsx } from "clsx";
import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={clsx("ui-field", className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx("ui-input", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx("ui-input", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx("ui-input", "ui-textarea", className)} {...props} />;
}
