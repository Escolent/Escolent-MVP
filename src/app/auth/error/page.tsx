import { SUPPORT_CONTACT_MESSAGE } from "@/lib/api/errors";

// Requirements 1.4 / 1A.5: every authentication failure must display an
// error message with support contact information.
export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { code?: string; message?: string };
}) {
  const message = searchParams.message ?? "Something went wrong while signing you in.";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">Sign-in failed</h1>
      <p className="text-sm text-neutral-600">{message}</p>
      <p className="text-sm text-neutral-600">{SUPPORT_CONTACT_MESSAGE}</p>
      {searchParams.code ? (
        <p className="text-xs text-neutral-400">Reference code: {searchParams.code}</p>
      ) : null}
    </main>
  );
}
