"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import styles from "./page.module.css";

export function LoginForm({ initialMessage }: { initialMessage?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState(
    initialMessage ?? "Use a magic link so your web app can stay signed in securely."
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setOtpSent(true);
      setMessage("Sign-in email sent. Enter the code from the email below, or use the magic link if you prefer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start sign-in.");
    }
  }

  async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email"
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to verify code.");
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button className={styles.button} type="submit">
          Send sign-in email
        </button>
      </form>
      {otpSent ? (
        <form className={styles.form} onSubmit={handleVerifyCode}>
          <input
            className={styles.input}
            inputMode="numeric"
            placeholder="6-digit code"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
          />
          <button className={styles.secondaryButton} type="submit">
            Verify code
          </button>
        </form>
      ) : null}
      <p className={styles.message}>{message}</p>
    </>
  );
}
