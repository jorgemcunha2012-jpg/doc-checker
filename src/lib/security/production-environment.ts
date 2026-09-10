type Environment = Record<string, string | undefined>;

const SUPABASE_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function isProductionDeployment(environment: Environment = process.env) {
  return environment.VERCEL_ENV === "production" || environment.CONFERIA_ENV === "production";
}

export function productionConfigurationProblems(environment: Environment = process.env) {
  if (!isProductionDeployment(environment)) return [];

  const missing: string[] = SUPABASE_VARIABLES.filter((name) => !environment[name]?.trim());
  if (!environment.CRON_SECRET?.trim()) missing.push("CRON_SECRET");

  const textProvider = environment.TEXT_EXTRACTION_PROVIDER ?? "DEEPSEEK";
  const visionProvider = environment.VISION_EXTRACTION_PROVIDER ?? "KIMI";
  if (textProvider === "HAIKU" && !environment.ANTHROPIC_API_KEY?.trim()) missing.push("ANTHROPIC_API_KEY");
  if (textProvider === "AZURE_OPENAI") {
    if (!environment.AZURE_OPENAI_API_KEY?.trim()) missing.push("AZURE_OPENAI_API_KEY");
    if (!environment.AZURE_OPENAI_ENDPOINT?.trim()) missing.push("AZURE_OPENAI_ENDPOINT");
    if (!environment.AZURE_OPENAI_DEPLOYMENT?.trim()) missing.push("AZURE_OPENAI_DEPLOYMENT");
  }
  if (textProvider === "DEEPSEEK" && !environment.DEEPSEEK_API_KEY?.trim()) missing.push("DEEPSEEK_API_KEY");
  if (visionProvider === "HAIKU" && !environment.ANTHROPIC_API_KEY?.trim()) missing.push("ANTHROPIC_API_KEY");
  if (visionProvider === "AZURE_OPENAI") {
    if (!environment.AZURE_OPENAI_API_KEY?.trim()) missing.push("AZURE_OPENAI_API_KEY");
    if (!environment.AZURE_OPENAI_ENDPOINT?.trim()) missing.push("AZURE_OPENAI_ENDPOINT");
    if (!environment.AZURE_OPENAI_DEPLOYMENT?.trim()) missing.push("AZURE_OPENAI_DEPLOYMENT");
  }
  if (visionProvider === "KIMI" && !environment.KIMI_API_KEY?.trim()) missing.push("KIMI_API_KEY");

  if (environment.CONFERIA_AUTH_DISABLED === "true") missing.push("CONFERIA_AUTH_DISABLED must not be true");
  return [...new Set(missing)];
}

export function assertProductionConfiguration(environment: Environment = process.env) {
  const problems = productionConfigurationProblems(environment);
  if (problems.length) {
    throw new Error(`Configuração de produção inválida: ${problems.join(", ")}`);
  }
}
