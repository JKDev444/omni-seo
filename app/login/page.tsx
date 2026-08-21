import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/action-plan",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=CredentialsSignin");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const failed = !!params?.error;

  return (
    <div className="login-shell">
      <div className="card login-card">
        <div className="sidebar-brand login-brand">
          <span className="sidebar-brand-mark">O</span>
          Omni SEO
        </div>
        <p className="page-subtitle login-subtitle">Internal tool for omnicenters.com</p>
        {failed && <p className="login-error">Incorrect email or password.</p>}
        <form action={loginAction} className="login-form">
          <label className="login-label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" required className="login-input" autoFocus />
          <label className="login-label" htmlFor="password">
            Password
          </label>
          <input id="password" name="password" type="password" required className="login-input" />
          <button type="submit" className="login-google-btn login-submit-btn">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
