import {format} from 'date-fns';
import puppeteer, {Page} from 'puppeteer';
import capsolver from '../capsolver';
import {getEnv} from '../util/env';
import {listInvoiceSchema} from './schema';

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

async function searchInvoice(page: Page) {
  const beginDateInputSelector = '#beginDate';
  const endDateInputSelector = '#endDate';
  await handleSelectDate(page, beginDateInputSelector, new Date('2023/07/01'));
  await handleSelectDate(page, endDateInputSelector, new Date('2023/07/31'));

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

export async function crawlInvoices() {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();

  const timeout = 60000;
  page.setDefaultTimeout(timeout);

  const baseUrl = 'https://www.einvoice.nat.gov.tw/';
  await page.goto(baseUrl);
  await page.waitForNetworkIdle({idleTime: 1000});

  await login(page);

  await Promise.all([
    page.waitForResponse(
      'https://www.einvoice.nat.gov.tw/APCONSUMER/BTC502W/rest/getCarrierList'
    ),
    page.waitForSelector('.panel-body', {visible: true}),
  ]);

  const data = await searchInvoice(page);
  return data;
}

async function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
