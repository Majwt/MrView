import { useNewFeatureData } from "../hooks/use-new-feature-data";

export function NewFeatureShell() {
  const { loading, title } = useNewFeatureData();

  return (
    <section className="p-4 md:p-6">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {loading ? "Loading..." : "Replace this shell with your feature UI."}
      </p>
    </section>
  );
}
