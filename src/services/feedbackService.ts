export type FeedbackKind = "report" | "rating";
export interface FeedbackContext {
  product: "App/PWA" | "Web";
  page: string;
  dataVersion?: string;
  word?: string;
  family?: string;
  familyKey?: string;
  registeredForms?: readonly string[];
}
export interface FeedbackConfiguration {
  productVersion: string;
  dataVersion: string;
  report: { url: string; fields: Record<string, string>; requiredContext?: string };
  rating: { url: string; fields: Record<string, string>; requiredContext?: string };
}

export function registeredFeedbackWord(word: string, forms: readonly string[]): string | null {
  const normalized = word.normalize("NFC").trim().toLocaleLowerCase("en");
  return (
    forms.find((form) => form.normalize("NFC").trim().toLocaleLowerCase("en") === normalized) ??
    null
  );
}

export function feedbackValues(context: FeedbackContext, config: FeedbackConfiguration) {
  // Deliberately exclude text, images, queries, emails, user identifiers and session tokens.
  const values = {
    product: context.product,
    page: context.page.slice(0, 80),
    word: (context.word ?? "").slice(0, 160),
    family: (context.family ?? "").slice(0, 160),
    familyKey: (context.familyKey ?? "").slice(0, 160),
    productVersion: config.productVersion.slice(0, 100),
    dataVersion: (context.dataVersion ?? config.dataVersion).slice(0, 100),
  };
  const reference = [
    values.word && `Word: ${values.word}`,
    values.family && `Family: ${values.family}`,
    values.familyKey && `Family key: ${values.familyKey}`,
    `Product: ${values.product}`,
    `Page: ${values.page}`,
    `Product version: ${values.productVersion}`,
    `Data version: ${values.dataVersion}`,
  ]
    .filter(Boolean)
    .join(" | ");
  return { ...values, reference };
}

export function buildFeedbackUrl(
  kind: FeedbackKind,
  context: FeedbackContext,
  config: FeedbackConfiguration,
): string | null {
  if (kind === "rating" && (!context.word || !context.familyKey)) return null;
  const target = config[kind];
  try {
    // Never open a configured contextual form until its real reference field exists.
    if (
      target.requiredContext &&
      (target.requiredContext !== "reference" ||
        !/^entry\.\d+$/.test(target.fields.reference ?? ""))
    )
      return null;
    const url = new URL(target.url);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (
      url.hostname !== "docs.google.com" ||
      !/^\/forms\/d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform$/.test(url.pathname)
    )
      return null;
    url.search = "";
    url.hash = "";
    url.searchParams.set("usp", "pp_url");
    for (const [key, value] of Object.entries(feedbackValues(context, config))) {
      const entry = target.fields[key];
      if (value && entry && /^entry\.\d+$/.test(entry)) url.searchParams.set(entry, value);
    }
    return url.toString();
  } catch {
    return null;
  }
}
