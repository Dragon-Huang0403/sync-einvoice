import {format} from 'date-fns';
import puppeteer, {Page} from 'puppeteer';
import {z} from 'zod';
import capsolver from '../capsolver';
import {getEnv} from '../util/env';
import {invoiceDetailSchema, invoiceSchema, listInvoiceSchema} from './schema';

async function login(page: Page) {
  const loginPopupBtnSelector = '#loginBtn';
  await page.click(loginPopupBtnSelector);
  await page.waitForNetworkIdle();

  const captchaImageSelector = '#randPicIndex';
  const image = await page.$(captchaImageSelector);

  const buffer = await image?.screenshot();
  if (!(buffer instanceof Buffer)) {
    throw new Error('Get captcha image failed');
  }

  const captcha = await capsolver(buffer);

  const phoneInputSelector = '#l0_mobile';
  const passwordInputSelector = '#l0_password';
  const captchaInputSelector = '#checkPicIndex';

  const env = getEnv();

  const inputs = [
    {selector: phoneInputSelector, value: env.E_INVOICE_PHONE},
    {selector: passwordInputSelector, value: env.E_INVOICE_PASSWORD},
    {selector: captchaInputSelector, value: captcha},
  ];

  for (const input of inputs) {
    await page.type(input.selector, input.value);
  }

  const loginBtnSelector = '#button';
  await page.click(loginBtnSelector);
}
async function handleSelectDate(page: Page, selector: string, date: Date) {
  const year = date.getFullYear() - 1911;
  const dateString = year + format(date, '/MM/dd');

  await page.evaluate(
    ({selector, dateString}) => {
      const input = document.querySelector(selector) as HTMLInputElement;
      input.value = dateString;
    },
    {selector, dateString}
  );
}

async function waitForListInvoiceReturn(page: Page) {
  const response = await page.waitForResponse(
    'https://www.einvoice.nat.gov.tw/APCONSUMER/BTC502W/rest/listInvoiceReturn'
  );

  const data = listInvoiceSchema.parse(await response.json()).data;
  return data;
}

async function searchInvoice(page: Page, beginDate: Date, endDate: Date) {
  const beginDateInputSelector = '#beginDate';
  const endDateInputSelector = '#endDate';
  await handleSelectDate(page, beginDateInputSelector, beginDate);
  await handleSelectDate(page, endDateInputSelector, endDate);

  await sleep(2000);
  await page.click(endDateInputSelector);
  await sleep(2000);
  await page.click('.wrap');
  await sleep(2000);
  await page.click(beginDateInputSelector);
  await sleep(2000);
  await page.click('.wrap');
  await sleep(2000);

  const submitBtnSelector = 'form .btn.btn-primary';
  const submitBtn = await page.$(submitBtnSelector);

  await submitBtn?.click();

  let data = await waitForListInvoiceReturn(page);

  const listInvoices = data.content;
  while (!data.last) {
    await sleep(2000);
    const element = await page.$('.panel-footer button:nth-child(3)');
    await element?.click();
    data = await waitForListInvoiceReturn(page);
    listInvoices.push(...data.content);
  }

  return listInvoices;
}

async function fetchInvoiceDetail(
  page: Page,
  csrfToken: string,
  invoice: z.infer<typeof invoiceSchema>
) {
  const response = await page.evaluate(
    async reqBody => {
      const {invoicenumber, invoicedate, selleridentifier} = reqBody.invoice;
      const {transactionId} = await fetch(
        'https://www.einvoice.nat.gov.tw/APCONSUMER/Menber/invoice/getMemberInvoice',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': reqBody.csrfToken,
          },
          body: JSON.stringify({
            invoiceNumber: invoicenumber,
            invoiceDate: new Date(invoicedate).toISOString(),
            selleridentifier,
          }),
        }
      ).then(resp => resp.json());
      const resp = await fetch(
        'https://www.einvoice.nat.gov.tw/APCONSUMER/Menber/invoice/pageMemberInvoiceDetail',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': reqBody.csrfToken,
          },
          body: JSON.stringify({
            transactionId,
            pager: {
              size: 30,
              page: 0,
            },
          }),
        }
      );
      return resp.json();
    },
    {csrfToken, invoice}
  );

  const {content} = invoiceDetailSchema.parse(response);
  return {...invoice, content};
}

export async function crawlInvoices(beginDate: Date, endDate: Date) {
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();

  const timeout = 60000;
  page.setDefaultTimeout(timeout);

  const baseUrl = 'https://www.einvoice.nat.gov.tw/';
  await page.goto(baseUrl);
  await page.waitForNetworkIdle({idleTime: 1000});

  await login(page);

  const [resp] = await Promise.all([
    page.waitForResponse(
      'https://www.einvoice.nat.gov.tw/APCONSUMER/BTC502W/rest/getCarrierList'
    ),
    page.waitForSelector('.panel-body', {visible: true}),
  ]);

  const csrfToken = resp.request().headers()['x-csrf-token'];

  const data = await searchInvoice(page, beginDate, endDate);

  const invoices = await Promise.all(
    data.map(invoice => fetchInvoiceDetail(page, csrfToken, invoice))
  );

  await browser.close();

  return invoices;
}

async function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
