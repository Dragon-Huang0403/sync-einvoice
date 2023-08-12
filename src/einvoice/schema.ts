import {z} from 'zod';

const alertSchema = z.object({
  type: z.string(),
  code: z.string(),
  message: z.string(),
  timestamp: z.string(),
  occurrence: z.string(),
});

export const invoiceSchema = z.object({
  carriertype: z.string(),
  carrierid2: z.string(),
  carrierName: z.string(),
  buyeridentifier: z.any().optional(),
  invoicedate: z.number(),
  invoicenumber: z.string(),
  totalamount: z.number(),
  donatemark: z.string(),
  donateStatus: z.any().optional(),
  currentStatus: z.string(),
  selleridentifier: z.string(),
  invPeriod: z.any().optional(),
  invoiceTime: z.any().optional(),
  currency: z.any().optional(),
  estabLosnMk: z.any().optional(),
  sellerAddress: z.any().optional(),
  sellername: z.string(),
  mainremark: z.string(),
  displayBuyeridentifier: z.any().optional(),
  displayInvoiceNumber: z.string(),
  displayTotalAmount: z.string(),
  displayInvoiceDate: z.string().regex(/^\d{3}\/\d{2}\/\d{2}$/),
});

const dataSchema = z.object({
  content: z.array(invoiceSchema),
  number: z.number(),
  size: z.number(),
  totalPages: z.number(),
  first: z.boolean(),
  last: z.boolean(),
  totalElements: z.number(),
});

export const listInvoiceSchema = z.object({
  data: dataSchema,
  alerts: z.array(alertSchema),
});

export const invoiceDetailSchema = z.object({
  content: z.array(
    z.object({
      description: z.string(),
      unitprice: z.string(),
      quantity: z.string(),
      amount: z.number(),
      carrierId2: z.string(),
      displayUnitprice: z.string(),
      displayQuantity: z.string(),
      displayAmount: z.string(),
    })
  ),
  number: z.number(),
  size: z.number(),
  totalPages: z.number(),
  first: z.boolean(),
  last: z.boolean(),
  totalElements: z.number(),
});
