import {config} from 'dotenv';
import {z} from 'zod';

config();
const envSchema = z.object({
  TWO_CAPTCHA_KEY: z.string(),
});

export function getEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      '❌ Invalid environment variables:',
      JSON.stringify(result.error.format(), null, 4)
    );
    throw new Error('❌ Invalid environment variables:');
  }

  return result.data;
}
