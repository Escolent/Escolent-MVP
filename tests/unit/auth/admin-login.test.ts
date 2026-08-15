/**
 * Task 3.4: Create Admin direct authentication flow.
 * Requirements: 1A.1, 1A.2, 1A.3, 1A.4, 1A.5
 */
import { randomUUID } from "node:crypto";
import { loginAdmin } from "@/lib/auth/admin/login";
import { AuthError } from "@/lib/api/errors";
import { FakeAuthDataStore } from "./helpers/fakeAuthDataStore";
import { fakePasswordAuthClient } from "./helpers/fakePasswordAuthClient";

describe("loginAdmin", () => {
  it("succeeds for a user who holds the admin role, returning their tenant", async () => {
    const store = new FakeAuthDataStore();
    const tenantId = "33333333-3333-3333-3333-333333333333";
    const adminId = randomUUID();
    const user = await store.upsertUser({ id: adminId, tenantId, email: "admin@teneo.school" });
    await store.assignRole(user.id, "admin", tenantId);

    const client = fakePasswordAuthClient({ userId: adminId });

    const result = await loginAdmin({
      dataStore: store,
      authClient: client,
      email: "admin@teneo.school",
      password: "correct-password",
    });

    expect(result).toEqual({ userId: adminId, tenantId });
  });

  it("rejects incorrect credentials", async () => {
    const store = new FakeAuthDataStore();
    const client = fakePasswordAuthClient({ signInError: "Invalid login credentials" });

    await expect(
      loginAdmin({ dataStore: store, authClient: client, email: "x@y.com", password: "wrong" }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INVALID_CREDENTIALS" });
  });

  it("rejects — and signs back out — a valid login for a user who is not an Admin", async () => {
    const store = new FakeAuthDataStore();
    const studentId = randomUUID();
    await store.upsertUser({ id: studentId, tenantId: "t1", email: "student@teneo.school" });
    await store.assignRole(studentId, "student", "t1");

    const client = fakePasswordAuthClient({ userId: studentId });
    const signOutSpy = jest.spyOn(client.auth, "signOut");

    await expect(
      loginAdmin({
        dataStore: store,
        authClient: client,
        email: "student@teneo.school",
        password: "correct-password",
      }),
    ).rejects.toMatchObject<Partial<AuthError>>({ code: "AUTH_INSUFFICIENT_PERMISSIONS" });

    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });
});
