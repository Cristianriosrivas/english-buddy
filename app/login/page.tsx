import { LoginForm } from "@/components/login-form";
import { BrandLogo } from "@/components/brand-logo";
import { hasEnvVars } from "@/lib/utils";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 md:p-10">
      <BrandLogo size="lg" />
      <div className="w-full max-w-sm">
        {!hasEnvVars && (
          <p role="alert" className="glass mb-4 rounded-xl p-3 text-sm text-amber-600 dark:text-amber-400">
            Falta configurar Supabase: copia <code>.env.example</code> a{" "}
            <code>.env.local</code> y pon tu URL y clave publicable.
          </p>
        )}
        <LoginForm />
      </div>
    </div>
  );
}
