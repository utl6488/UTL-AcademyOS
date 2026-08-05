import { http, HttpResponse } from "msw";

const API_BASE = "http://localhost:4000/api";

export const handlers = [
  // Auth
  http.post(`${API_BASE}/auth/login`, () => {
    return HttpResponse.json({
      user: {
        id: "user-1",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        roles: ["teacher"],
        permissions: ["exams:view", "exams:create", "questions:view"],
        tenantId: "tenant-1",
        tenantSlug: "test-institute",
      },
      accessToken: "mock-access-token",
    });
  }),

  http.get(`${API_BASE}/auth/me`, () => {
    return HttpResponse.json({
      id: "user-1",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      roles: ["teacher"],
      permissions: ["exams:view", "exams:create"],
      tenantId: "tenant-1",
      tenantSlug: "test-institute",
    });
  }),

  http.post(`${API_BASE}/auth/refresh`, () => {
    return HttpResponse.json({ accessToken: "refreshed-token" });
  }),

  http.post(`${API_BASE}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Institute
  http.get(`${API_BASE}/institute/profile`, () => {
    return HttpResponse.json({
      id: "inst-1",
      name: "Test Institute",
      slug: "test-institute",
      logo: null,
      timezone: "Asia/Kolkata",
      address: null,
      phone: null,
      email: null,
      website: null,
      brandColor: null,
      gradingScheme: "percentage",
      passingPercentage: 33,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });
  }),

  // Questions
  http.get(`${API_BASE}/questions`, () => {
    return HttpResponse.json({
      data: [],
      meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
    });
  }),

  // Exams
  http.get(`${API_BASE}/exams`, () => {
    return HttpResponse.json({
      data: [],
      meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
    });
  }),

  // Users
  http.get(`${API_BASE}/users`, () => {
    return HttpResponse.json({
      data: [],
      meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
    });
  }),

  // Notifications
  http.get(`${API_BASE}/notifications/unread-count`, () => {
    return HttpResponse.json({ count: 0 });
  }),
];
