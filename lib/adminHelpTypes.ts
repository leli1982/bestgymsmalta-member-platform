export type AdminHelpSafety = "green" | "amber" | "red";

export type AdminHelpTopic = {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  routePrefixes: string[];
  steps: string[];
  safety: AdminHelpSafety;
  safetyText: string;
  important?: string;
  relatedHref?: string;
};
