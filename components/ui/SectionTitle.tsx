type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  action?: string;
};

export default function SectionTitle({
  eyebrow,
  title,
  action,
}: SectionTitleProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#fcb415]">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-2xl font-black uppercase text-white">
          {title}
        </h2>
      </div>

      {action && (
        <p className="text-xs font-black uppercase text-[#fcb415]">
          {action}
        </p>
      )}
    </div>
  );
}