import { signIn } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const denied = params?.error === "AccessDenied";

  return (
    <div className="login-shell">
      <div className="card login-card">
        <div className="sidebar-brand login-brand">
          <span className="sidebar-brand-mark">O</span>
          Omni SEO
        </div>
        <p className="page-subtitle login-subtitle">
          Internal tool for omnicenters.com — sign in with an authorized Google account.
        </p>
        {denied && (
          <p className="login-error">
            That Google account isn&apos;t authorized for this tool.
          </p>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button type="submit" className="login-google-btn">
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
