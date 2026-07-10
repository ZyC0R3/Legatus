import {config as loadEnv} from "dotenv";
import {z} from "zod";

loadEnv();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_APPLICATION_ID: z.string().min(1, "DISCORD_APPLICATION_ID is required"),
  DISCORD_GUILD_ID: z.string().min(1).optional()
});

export const env = envSchema.parse(process.env);