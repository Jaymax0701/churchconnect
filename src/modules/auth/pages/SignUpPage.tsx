import { useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../AuthContext";
import { supabase } from "../../../lib/supabase";

const PRIVACY_NOTICE_VERSION = "2026-11-v1";

function getAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayHasPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayHasPassed) age -= 1;
  return age;
}

export const SignUpPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [noticeLanguage, setNoticeLanguage] = useState<"en" | "ms">("en");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const age = useMemo(() => getAge(dateOfBirth), [dateOfBirth]);
  const under12Registration = age !== null && age < 12;
  const minorRegistration = age !== null && age < 18;

  if (!authLoading && user) return <Navigate to="/portal" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!dateOfBirth) {
      setError("Enter your date of birth.");
      return;
    }
    if (under12Registration) {
      setError("Children under 12 must be registered as a managed family member by their Family Leader. They cannot create an individual login account.");
      return;
    }
    if (new Date(dateOfBirth + "T00:00:00") > new Date()) {
      setError("Date of birth cannot be in the future.");
      return;
    }
    if (!privacyConsent) {
      setError("You must acknowledge the Privacy Notice and provide the required consent to register.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            date_of_birth: dateOfBirth,
            privacy_notice_version: PRIVACY_NOTICE_VERSION,
            privacy_notice_language: noticeLanguage,
            privacy_consent: true,
            marketing_consent: marketingConsent,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        navigate("/pending", { replace: true });
        return;
      }
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "calc(100vh - 70px - 200px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-10) var(--space-4)" }}>
      <div style={{ width: "100%", maxWidth: "520px" }}>
        <Card><CardBody style={{ padding: "var(--space-8)" }}>
          <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "var(--radius-lg)", background: "var(--color-forest-green)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "var(--space-3)" }}>
              <Icon name="person_add" size={26} color="var(--color-white)" />
            </div>
            <h1 style={{ fontSize: "var(--text-2xl)", margin: "0 0 var(--space-1)" }}>Create your account</h1>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>Join your church community on ChurchConnect.</p>
          </div>
          {submitted ? <Alert variant="success" title="Check your email to verify your account">
            We have sent a verification link if this email is eligible for registration. After verifying, your account will wait for administrator approval. Registrations from people under 18 also require administrator review before member access.
          </Alert> : <>
            {error && <Alert variant="danger" title="Registration unsuccessful">{error}</Alert>}
            <form onSubmit={(event) => void handleSubmit(event)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
              <Input id="signup-name" label="Full name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Enter your full name" required />
              <Input id="signup-dob" label="Date of birth" type="date" autoComplete="bday" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} max={new Date().toISOString().slice(0, 10)} hint="Used to determine age eligibility and whether additional registration review is required." required />
              {under12Registration && <Alert variant="warning" title="Family Leader registration required">
                Children under 12 do not create individual login accounts. Ask your Family Leader to register you as a managed family member. If your family has not been set up yet, contact your church administrator for assistance.
              </Alert>}
              {minorRegistration && !under12Registration && <Alert variant="info" title="Administrator review required">
                Because you are under 18, your registration will be flagged for review. You will not receive member access until the church completes its review and any applicable parent/guardian or safeguarding checks. This notice is not a substitute for parent/guardian consent.
              </Alert>}
              <Input id="signup-email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
              <Input id="signup-password" label="Password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} hint="At least 8 characters." required minLength={8} />
              <Input id="signup-confirm-password" label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} />

              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div>
                  <h2 style={{ fontSize: "var(--text-base)", margin: "0 0 var(--space-1)" }}>Privacy and consent</h2>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", margin: 0 }}>
                    Read the <Link to="/privacy" target="_blank" rel="noreferrer" style={{ color: "var(--color-forest-green)", fontWeight: 700 }}>ChurchConnect Privacy Notice</Link> before continuing. It is available in English and Bahasa Malaysia.
                  </p>
                </div>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
                  <input type="checkbox" checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} required style={{ marginTop: 4 }} />
                  <span>I acknowledge that I have read and understood the Privacy Notice and expressly consent to the processing of my personal data, including sensitive personal data where applicable, for the purposes explained in that notice. / Saya mengakui bahawa saya telah membaca dan memahami Notis Privasi serta memberikan persetujuan nyata terhadap pemprosesan data peribadi saya, termasuk data peribadi sensitif jika berkenaan, bagi tujuan yang diterangkan dalam notis tersebut.</span>
                </label>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
                  <input type="checkbox" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)} style={{ marginTop: 4 }} />
                  <span>I agree to receive optional promotional, fundraising and non-essential church communications. This is optional and can be withdrawn. / Saya bersetuju menerima komunikasi promosi, pengumpulan dana dan komunikasi gereja yang tidak penting. Persetujuan ini adalah pilihan dan boleh ditarik balik.</span>
                </label>
                <label htmlFor="privacy-language" style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Privacy Notice language acknowledged</label>
                <select id="privacy-language" value={noticeLanguage} onChange={(event) => setNoticeLanguage(event.target.value as "en" | "ms")} style={{ minHeight: 40, padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", background: "var(--color-white)" }}>
                  <option value="en">English</option>
                  <option value="ms">Bahasa Malaysia</option>
                </select>
              </div>

              <Button type="submit" size="lg" isLoading={submitting} disabled={submitting || authLoading || under12Registration} style={{ width: "100%" }}>Create account</Button>
            </form>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", lineHeight: 1.6, marginTop: "var(--space-4)" }}>
              Registration does not automatically grant member access. Verify your email first; a ChurchConnect Superadmin must then approve your account. Under-18 registrations require an additional administrator review. Roles and congregation membership are assigned separately.
            </p>
          </>}
          <p style={{ textAlign: "center", fontSize: "var(--text-sm)", margin: "var(--space-5) 0 0" }}>
            Already have an account? <Link to="/login" style={{ color: "var(--color-forest-green)", fontWeight: 700 }}>Sign in</Link>
          </p>
        </CardBody></Card>
        <p style={{ textAlign: "center", marginTop: "var(--space-4)" }}><Link to="/" style={{ color: "var(--color-forest-green)", fontSize: "var(--text-sm)", textDecoration: "none" }}>Return to Public Website</Link></p>
      </div>
    </main>
  );
};
