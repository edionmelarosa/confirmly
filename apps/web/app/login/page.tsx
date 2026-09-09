"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [clinicId, setClinicId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await apiClient.post("/auth/login", { clinicId, email, password });
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Staff login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Clinic ID
              <Input
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Email
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Password
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
