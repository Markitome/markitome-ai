export function PageHeader({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-semibold tracking-normal text-ink">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{description}</p>
    </div>
  );
}
