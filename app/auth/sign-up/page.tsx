import { SignUpForm } from "@/components/sign-up-form";
import { BrandLogo } from "@/components/brand-logo";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 md:p-10">
      <BrandLogo size="lg" />
      <div className="w-full max-w-sm">
        <SignUpForm />
      </div>
    </div>
  );
}
