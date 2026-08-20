import { FoundryForm } from "./foundry-form";

export const dynamic = "force-dynamic";

export default function FoundryPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <span className="label">MSTRMND Foundry</span>
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Create an agent identity
        </h1>
        <p className="text-muted max-w-2xl leading-relaxed">
          An agent&rsquo;s identity is not its prompt or model. Foundry issues
          an Ed25519 key, a signed Genesis Manifest, and derived IDs for the
          alliance specialists. Instructions and skills can evolve; the key
          does not.
        </p>
      </section>
      <FoundryForm />
    </div>
  );
}
