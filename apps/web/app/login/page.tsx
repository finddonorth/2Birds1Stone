import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { createSupabaseServerAuthClient } from "../../lib/supabase/server";
import styles from "./page.module.css";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  try {
    const supabase = await createSupabaseServerAuthClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/");
    }
  } catch {
    // Allow local mock mode to show the login page if auth env is missing.
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>2Birds1Stone</p>
        <h1>Sign in and keep your ideas synced.</h1>
        <p>Your workspace, priorities, and captured thoughts stay attached to your account.</p>
        <LoginForm initialMessage={params.error ? `Sign-in error: ${params.error}` : undefined} />
      </section>
    </main>
  );
}
