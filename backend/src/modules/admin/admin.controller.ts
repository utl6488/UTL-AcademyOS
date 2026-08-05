import type { Request, Response } from 'express';

import {
  CreateFeatureFlagSchema,
  OverridePlanSchema,
  TenantListQuerySchema,
  UpdateFeatureFlagSchema,
} from './admin.schemas.js';
import * as service from './admin.service.js';

import { AppError } from '@/common/errors/index.js';
import { ok } from '@/common/response.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';
import { audit } from '@/modules/audit/audit.service.js';

function actorIdOf(req: Request): string {
  const id = req.auth?.userId;
  if (!id) throw AppError.unauthorized();
  return id;
}
function paramId(req: Request, key: string): string {
  const v = req.params[key];
  if (!v) throw AppError.badRequest(`${key} is required`);
  return v;
}

// ─── Tenants ────────────────────────────────────────────────────────────────

export const listTenants = asyncHandler(async (req, res: Response) => {
  const query = TenantListQuerySchema.parse(req.query);
  const result = await service.listTenants(query);
  // Nested envelope so `body.data.data` on the client resolves to the row array.
  ok(res, result);
});

export const getTenant = asyncHandler(async (req, res: Response) => {
  const detail = await service.getTenantDetail(paramId(req, 'id'));
  ok(res, detail);
});

export const suspendTenant = asyncHandler(async (req, res: Response) => {
  const tenantId = paramId(req, 'id');
  await service.setTenantStatus(tenantId, 'SUSPENDED');
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'admin.tenant.suspend',
    targetType: 'Tenant',
    targetId: tenantId,
  });
  ok(res, { ok: true });
});

export const reactivateTenant = asyncHandler(async (req, res: Response) => {
  const tenantId = paramId(req, 'id');
  await service.setTenantStatus(tenantId, 'ACTIVE');
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'admin.tenant.reactivate',
    targetType: 'Tenant',
    targetId: tenantId,
  });
  ok(res, { ok: true });
});

export const overrideTenantPlan = asyncHandler(async (req, res: Response) => {
  const tenantId = paramId(req, 'id');
  const input = OverridePlanSchema.parse(req.body);
  await service.overridePlan(tenantId, input);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'admin.tenant.override-plan',
    targetType: 'Tenant',
    targetId: tenantId,
    meta: { planId: input.planId, trialDays: input.trialDays },
  });
  ok(res, { ok: true });
});

// ─── Revenue ────────────────────────────────────────────────────────────────

export const revenue = asyncHandler(async (_req, res: Response) => {
  ok(res, await service.getRevenueMetrics());
});

// ─── Feature flags ──────────────────────────────────────────────────────────

export const listFlags = asyncHandler(async (_req, res: Response) => {
  ok(res, await service.listFeatureFlags());
});

export const createFlag = asyncHandler(async (req, res: Response) => {
  const input = CreateFeatureFlagSchema.parse(req.body);
  const flag = await service.createFeatureFlag(input);
  await audit({
    actorId: actorIdOf(req),
    action: 'admin.feature-flag.create',
    targetType: 'FeatureFlag',
    targetId: flag.id,
    meta: { key: flag.key },
  });
  ok(res, flag, undefined, 201);
});

export const updateFlag = asyncHandler(async (req, res: Response) => {
  const id = paramId(req, 'id');
  const input = UpdateFeatureFlagSchema.parse(req.body);
  const flag = await service.updateFeatureFlag(id, input);
  await audit({
    actorId: actorIdOf(req),
    action: 'admin.feature-flag.update',
    targetType: 'FeatureFlag',
    targetId: id,
    meta: input as Record<string, unknown>,
  });
  ok(res, flag);
});

export const deleteFlag = asyncHandler(async (req, res: Response) => {
  const id = paramId(req, 'id');
  await service.deleteFeatureFlag(id);
  await audit({
    actorId: actorIdOf(req),
    action: 'admin.feature-flag.delete',
    targetType: 'FeatureFlag',
    targetId: id,
  });
  ok(res, { ok: true });
});

// ─── Health ─────────────────────────────────────────────────────────────────

export const health = asyncHandler(async (_req, res: Response) => {
  ok(res, await service.getSystemHealth());
});
