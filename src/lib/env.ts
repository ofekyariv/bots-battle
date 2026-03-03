import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().optional(),

  // NextAuth
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),

  // GitHub OAuth
  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Redis
  REDIS_URL: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.warn("⚠️ Some environment variables are missing. Multiplayer features may not work.");
    return process.env as unknown as Env;
  }

  return result.data;
}

export const env = validateEnv();
