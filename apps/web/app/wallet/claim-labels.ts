export type AcademicClaimKey =
  | "degree"
  | "graduationYear"
  | "cgpa"
  | "marks"
  | "recipientName"
  | "institution"
  | "credentialName"
  | "course"
  | "issuedOn"
  | "graduationDate";

export const claimLabels: Record<AcademicClaimKey, string> = {
  degree: "Degree",
  graduationYear: "Graduation year",
  cgpa: "CGPA",
  marks: "Marks",
  recipientName: "Recipient",
  institution: "Institution",
  credentialName: "Credential",
  course: "Course",
  issuedOn: "Issued on",
  graduationDate: "Graduation date"
};

export const defaultClaimSelection = (claims: Partial<Record<AcademicClaimKey, string | number>>) => {
  const preferred: AcademicClaimKey[] = ["recipientName", "institution", "course", "graduationDate"];
  const fallback: AcademicClaimKey[] = ["degree", "graduationYear"];
  const selected = preferred.filter((claim) => claims[claim] !== undefined);
  return selected.length > 0 ? selected : fallback.filter((claim) => claims[claim] !== undefined);
};

export const formatClaimValue = (key: string, value: string | number) => {
  if (typeof value === "number") return String(value);
  if ((key === "issuedOn" || key === "graduationDate") && !Number.isNaN(Date.parse(value))) {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
  }
  return value;
};

export const labelForClaim = (key: string) => claimLabels[key as AcademicClaimKey] ?? key;
