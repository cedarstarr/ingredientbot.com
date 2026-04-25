import { prisma } from "@/lib/prisma";

export function logAICall(opts: {
  feature: string;
  provider: "anthropic" | "openai";
  model: string;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  userId?: string | null;
}) {
  prisma.aICallLog.create({
    data: {
      site: "ingredientbot.com",
      feature: opts.feature,
      provider: opts.provider,
      model: opts.model,
      inputTokens: opts.inputTokens ?? 0,
      outputTokens: opts.outputTokens ?? 0,
      userId: opts.userId,
    },
  }).catch(() => {});
}
