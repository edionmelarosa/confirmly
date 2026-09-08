import { PatientSessionView } from "@/components/patient/PatientSessionView";

export default async function PatientSessionPage(props: PageProps<"/c/[token]">) {
  const { token } = await props.params;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-8">
      <PatientSessionView token={token} />
    </main>
  );
}
