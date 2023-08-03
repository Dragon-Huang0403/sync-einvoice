import {z} from 'zod';

import {got} from 'got';

// https://2captcha.com/2captcha-api#solving_normal_captcha

interface TwoCaptchaRequest {
  base64Buffer: string;
  apiKey: string;
}

export async function twoCaptcha(request: TwoCaptchaRequest) {
  const {request: requestId} = await sendSolveCaptchaRequest(request);
  const result = await getCaptchaResult({requestId, apiKey: request.apiKey});
  return result;
}

async function sendSolveCaptchaRequest({
  base64Buffer,
  apiKey,
}: TwoCaptchaRequest) {
  const response = await got
    .post('http://2captcha.com/in.php', {
      form: {
        key: apiKey,
        method: 'base64',
        body: base64Buffer,
        // tells the server to send the response as JSON
        json: 1,
        numeric: 1,
      },
    })
    .json();
  console.log({response});
  const result = twoCaptchaResponseSchema.safeParse(response);
  if (!result.success || result.data.status === 0) {
    throw new Error('Solve captcha failed');
  }
  return result.data;
}

const second = 1000;

async function getCaptchaResult({
  requestId,
  apiKey,
  retry = 15,
}: {
  requestId: string;
  apiKey: string;
  retry?: number;
  delay?: number;
}): Promise<string> {
  const response = await got
    .get(
      `http://2captcha.com/res.php?key=${apiKey}&action=get&id=${requestId}&json=1`
    )
    .json();
  const result = twoCaptchaResponseSchema.safeParse(response);

  if (!result.success) {
    throw new Error('Solve captcha failed');
  }

  const {data} = result;
  if (data.status === 1) {
    return data.request;
  }

  if (retry === 0) {
    throw new Error('Solve captcha failed');
  }

  await sleep(second);
  const newRetry = retry - 1;

  return getCaptchaResult({
    requestId,
    apiKey,
    retry: newRetry,
  });
}

const twoCaptchaResponseSchema = z
  .object({
    status: z.literal(1),
    request: z.string(),
  })
  .or(z.object({status: z.literal(0)}));

async function sleep(ms: number) {
  return new Promise(res => {
    setTimeout(res, ms);
  });
}
