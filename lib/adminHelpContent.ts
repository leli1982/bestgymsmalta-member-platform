import type { AdminHelpTopic } from "@/lib/adminHelpTypes";
import { ADMIN_HELP_OPERATIONS } from "@/lib/adminHelpOperations";
import { ADMIN_HELP_MANAGEMENT } from "@/lib/adminHelpManagement";
import { ADMIN_HELP_MEMBERSHIP } from "@/lib/adminHelpMembership";

export type { AdminHelpSafety, AdminHelpTopic } from "@/lib/adminHelpTypes";

export const ADMIN_HELP_TOPICS: AdminHelpTopic[] = [
  ...ADMIN_HELP_OPERATIONS,
  ...ADMIN_HELP_MANAGEMENT,
  ...ADMIN_HELP_MEMBERSHIP,
];

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9€]+/g, " ").replace(/\s+/g, " ").trim();
}

export function searchAdminHelpTopics(query: string): AdminHelpTopic[] {
  const normalised = normalise(query);
  if (!normalised) return ADMIN_HELP_TOPICS;
  const terms = normalised.split(" ").filter(Boolean);
  return ADMIN_HELP_TOPICS
    .map((topic) => {
      const title = normalise(topic.title);
      const keywords = normalise(topic.keywords.join(" "));
      const body = normalise([topic.summary, ...topic.steps, topic.safetyText, topic.important || ""].join(" "));
      if (!terms.every((term) => `${title} ${keywords} ${body}`.includes(term))) return null;
      let score = 0;
      if (title.includes(normalised)) score += 100;
      if (keywords.includes(normalised)) score += 60;
      for (const term of terms) {
        if (title.includes(term)) score += 20;
        if (keywords.includes(term)) score += 12;
        if (body.includes(term)) score += 4;
      }
      return { topic, score };
    })
    .filter((entry): entry is { topic: AdminHelpTopic; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.topic);
}

export function getContextAdminHelpTopic(pathname: string): AdminHelpTopic | null {
  const pathWithQuery = pathname || "/staff/admin";
  const candidates = ADMIN_HELP_TOPICS.flatMap((topic) => topic.routePrefixes.map((prefix) => ({ topic, prefix })))
    .filter(({ prefix }) => prefix && pathWithQuery.startsWith(prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  return candidates[0]?.topic || null;
}
