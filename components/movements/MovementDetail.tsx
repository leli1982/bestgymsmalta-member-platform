import type { MovementDefinition } from "@/lib/movements/types";

type MovementDetailProps = {
  movement: MovementDefinition;
};

export default function MovementDetail({ movement }: MovementDetailProps) {
  return (
    <div className="space-y-4 border-t border-zinc-200 pt-4 text-sm text-zinc-700">
      <section>
        <h4 className="font-semibold text-zinc-950">Start position</h4>
        <p className="mt-1 leading-6">{movement.startPosition}</p>
      </section>

      <section>
        <h4 className="font-semibold text-zinc-950">How to move</h4>
        <ol className="mt-1 list-decimal space-y-1 pl-5 leading-6">
          {movement.movementInstructions.map((instruction, index) => (
            <li key={`${movement.id}-instruction-${index}`}>{instruction}</li>
          ))}
        </ol>
      </section>

      <section>
        <h4 className="font-semibold text-zinc-950">Coaching cues</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 leading-6">
          {movement.coachingCues.map((cue, index) => (
            <li key={`${movement.id}-cue-${index}`}>{cue}</li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="font-semibold text-zinc-950">Common mistakes</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 leading-6">
          {movement.commonMistakes.map((mistake, index) => (
            <li key={`${movement.id}-mistake-${index}`}>{mistake}</li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="font-semibold text-zinc-950">Safety</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 leading-6">
          {movement.safetyNotes.map((note, index) => (
            <li key={`${movement.id}-safety-${index}`}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
