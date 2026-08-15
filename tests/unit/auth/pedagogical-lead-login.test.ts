/**
 * Task 3.5: Create Pedagogical_Lead authentication flow.
 * Requirements: 4.8
 */
import { randomUUID } from "node:crypto";
import { loginPedagogicalLead } from "@/lib/auth/pedagogical-lead/login";
import { AuthError } from "@/lib/api/errors";
import { FakeAuthDataStore } from "./helpers/fakeAuthDataStore";
import { fakePasswordAuthClient } from "./helpers/fakePasswordAuthClient";

describe("loginPedagogicalLead", () => {
  it("succeeds for a user who holds the pedagogical_lead role", async () => {
    const store = new FakeAuthDataStore();
    const leadId = randomUUID();
    const user = await store.upsertUser({ id: leadId, tenantId: null, email: "lead@escolent.com" });
    await store.assignRole(user.id, "pedagogical_lead", null);

    const client = fakePasswordAuthClient({ userId: leadId });

    const result = await loginPedagogicalLead({
      dataStore: store,
      authClient: client,
      email: "lead@escolent.com",
      password: "correct-password",
    });

    expect(result).toEqual({ userId: leadId });
  });

  it("does not resolve or return a tenantId — the role is platform-level, not tenant-scoped", async () => {
    const store = new FakeAuthDataStore();
    const leadId = randomUUID();
    const user = await store.upsertUser({ id: leadId, tenantId: null, email: "lead@escolent.com" });
    await store.assignRole(user.id, "pedagogical_lead", null);

    const result = await loginPedagogicalLead({
      dataStore: store,
      authClient: fakePasswordAuthClient({ userId: leadId }),
      email: "lead@escolent.com",
      password: "correct-password",
    });

    expect(result).not.toHaveProperty("tenantId");
  });

  it("rejects incorrect credentials", async () => {
    const store = new FakeAuthDataStore();
    const client = fakePasswordAuthClient({ signInError: "Invalid login credentials" });

    await expect(
      loginPedagogicalLead({
        dataStore: store,
        authClient: client,
        email: "x@y.com",
        password: "wrong",
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INVALID_CREDENTIALS" });
  });

  it("rejects — and signs back out — a valid login for a user who is not Pedagogical_Lead", async () => {
    const store = new FakeAuthDataStore();
    const teacherId = randomUUID();
    await store.upsertUser({ id: teacherId, tenantId: "t1", email: "teacher@teneo.school" });
    await store.assignRole(teacherId, "teacher", "t1");

    const client = fakePasswordAuthClient({ userId: teacherId });
    const signOutSpy = jest.spyOn(client.auth, "signOut");

    await expect(
      loginPedagogicalLead({
        dataStore: store,
        authClient: client,
        email: "teacher@teneo.school",
        password: "correct-password",
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INSUFFICIENT_PERMISSIONS" });

    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects an Admin (tenant-scoped role) — Pedagogical_Lead login is not a superset of Admin", async () => {
    const store = new FakeAuthDataStore();
    const adminId = randomUUID();
    await store.upsertUser({ id: adminId, tenantId: "t1", email: "admin@teneo.school" });
    await store.assignRole(adminId, "admin", "t1");

    await expect(
      loginPedagogicalLead({
        dataStore: store,
        authClient: fakePasswordAuthClient({ userId: adminId }),
        email: "admin@teneo.school",
        password: "correct-password",
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INSUFFICIENT_PERMISSIONS" });
  });
});
