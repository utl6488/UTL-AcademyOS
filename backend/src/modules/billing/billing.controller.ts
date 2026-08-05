import type { Request, Response } from 'express';

import { ApplyCouponSchema, CreateCheckoutSchema } from './billing.schemas.js';
import * as service from './billing.service.js';

import { AppError } from '@/common/errors/index.js';
import { ok } from '@/common/response.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';
import { audit } from '@/modules/audit/audit.service.js';

function tenantIdOf(req: Request): string {
  const tid = req.auth?.tenantId;
  if (!tid) throw AppError.unauthorized();
  return tid;
}
function actorIdOf(req: Request): string {
  const id = req.auth?.userId;
  if (!id) throw AppError.unauthorized();
  return id;
}

export const listPlans = asyncHandler(async (_req, res: Response) => {
  ok(res, await service.listPlans());
});

export const subscription = asyncHandler(async (req, res: Response) => {
  ok(res, await service.getSubscription(tenantIdOf(req)));
});

export const usage = asyncHandler(async (req, res: Response) => {
  ok(res, await service.getUsage(tenantIdOf(req)));
});

export const invoices = asyncHandler(async (req, res: Response) => {
  ok(res, await service.listInvoices(tenantIdOf(req)));
});

export const downloadInvoice = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const invoiceId = req.params.id;
  if (!invoiceId) throw AppError.badRequest('Invoice id required');
  const { buffer, filename } = await service.renderInvoiceBuffer(tenantId, invoiceId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length.toString());
  res.status(200).end(buffer);
});

export const checkout = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const input = CreateCheckoutSchema.parse(req.body);
  const result = await service.createCheckout(tenantId, input);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'billing.checkout',
    targetType: 'Plan',
    targetId: input.planId,
    meta: { provider: input.provider },
  });
  ok(res, result);
});

export const applyCoupon = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const input = ApplyCouponSchema.parse(req.body);
  const result = await service.applyCoupon(tenantId, input);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'billing.coupon.apply',
    meta: { code: input.code },
  });
  ok(res, result);
});

export const cancel = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const result = await service.cancelSubscription(tenantId);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'billing.cancel',
  });
  ok(res, result);
});

export const resume = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const result = await service.resumeSubscription(tenantId);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'billing.resume',
  });
  ok(res, result);
});
