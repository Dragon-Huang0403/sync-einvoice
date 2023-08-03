import {getEnv} from '../util/env';
import {twoCaptcha} from './twoCaptcha';

export async function captchaSolver(imageBuffer: Buffer) {
  const base64Buffer = imageBuffer.toString('base64');

  const env = getEnv();

  const request = {
    base64Buffer,
    apiKey: env.TWO_CAPTCHA_KEY,
  };

  const result = await twoCaptcha(request);

  return result;
}
