import {parse} from 'csv';
import {format, subDays} from 'date-fns';
import * as fs from 'fs';
import {crawlInvoices} from './einvoice/einvoice';

const filename = 'AndroMoney.csv';
const columns = [
  'Id',
  'Currency',
  'Amount',
  'Category',
  'Sub-Category',
  'Date',
  'Expense(Transfer Out)',
  'Income(Transfer In)',
  'Note',
  'Periodic',
  'Project',
  'Payee/Payer',
  'uid',
  'Time',
] as const;

async function readCSV() {
  const rawData: string[] = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filename)
      .pipe(parse({delimiter: ',', from_line: 3}))
      .on('data', row => {
        // console.log(row);
        rawData.push(row);
      })
      .on('end', resolve)
      .on('error', reject);
  });

  const data = rawData.map(row => {
    const col = {} as Record<(typeof columns)[number], string>;
    columns.forEach((c, i) => {
      col[c] = row[i];
    });
    return col;
  });

  return data;
}

async function main() {
  const now = new Date();
  const beginDate = new Date(now);
  beginDate.setDate(1);

  const lastMonth = subDays(beginDate, 1);
  const lastMonthBeginDate = new Date(lastMonth);
  lastMonthBeginDate.setDate(1);

  const invoices = await Promise.all([
    crawlInvoices(lastMonthBeginDate, lastMonth),
    crawlInvoices(beginDate, now),
  ]);

  const storedData = await readCSV();

  let id = Number(storedData[storedData.length - 1].Id) + 1;

  invoices
    .flat()
    .sort((a, b) => a.invoicedate - b.invoicedate)
    .forEach(invoice => {
      if (storedData.some(d => d.uid === invoice.invoicenumber)) {
        return;
      }
      const date = new Date(invoice.invoicedate);
      const notes = [`發票號碼:${invoice.displayInvoiceNumber}`];
      invoice.content.forEach(c => {
        const note = `${c.description} [NT$${c.displayAmount}] x ${c.displayQuantity}`;
        notes.push(note);
      });

      const newRow: Record<string, string> = {
        Id: String(id++),
        Currency: 'TWD',
        Amount: invoice.displayTotalAmount + '.0',
        Category: '電子發票',
        'Sub-Category': '手機條碼',
        Date: format(date, 'yyyyMMdd'),
        'Expense(Transfer Out)': '信用卡',
        'Income(Transfer In)': '',
        Note: notes.join(' \n '),
        Periodic: '',
        Project: '',
        'Payee/Payer': '',
        uid: invoice.invoicenumber,
        Time: '',
      };

      const rowString = [] as string[];
      columns.forEach(c => {
        rowString.push(`"${newRow[c]}"`);
      });

      fs.appendFileSync(filename, rowString.join(',') + '\r\n');
    });
}

main();
