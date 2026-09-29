"use client";

import { UNDER16_SUPERVISION_CLAUSE } from "@/lib/guardianConsentPolicy";

export type PublishedDeclaration = {
  id: string;
  versionNo: number;
  body: string;
  contentSha256: string;
};

export type RegistrationDeclarationAcceptance = {
  gymRules: boolean;
  privacy: boolean;
  health: boolean;
};

type Props = {
  participantLabel: string;
  gymRules: PublishedDeclaration;
  privacy: PublishedDeclaration;
  health: PublishedDeclaration;
  guardian?: PublishedDeclaration;
  showGuardian?: boolean;
  showUnder16Supervision?: boolean;
  value: RegistrationDeclarationAcceptance;
  onChange: (value: RegistrationDeclarationAcceptance) => void;
};

function DeclarationCard({
  title,
  declaration,
  checked,
  onChange,
}: {
  title: string;
  declaration: PublishedDeclaration;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
        <p className="mb-2 font-black text-zinc-950">{title}</p>
        {declaration.body}
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm font-semibold text-zinc-800">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-5 w-5 accent-zinc-950"
        />
        <span>I have read and agree to the {title}.</span>
      </label>
    </div>
  );
}

export default function RegistrationDeclarations({
  participantLabel,
  gymRules,
  privacy,
  health,
  guardian,
  showGuardian = false,
  showUnder16Supervision = false,
  value,
  onChange,
}: Props) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Declarations</p>
      <h3 className="mt-1 text-lg font-black text-zinc-950">{participantLabel}</h3>
      <p className="mt-1 text-sm leading-6 text-zinc-600">
        Each applicant must read the exact published wording and confirm acceptance before submission.
      </p>

      <div className="mt-4 space-y-3">
        <DeclarationCard
          title="BGM Gym Rules"
          declaration={gymRules}
          checked={value.gymRules}
          onChange={(checked) => onChange({ ...value, gymRules: checked })}
        />
        <DeclarationCard
          title="Privacy and data processing notice"
          declaration={privacy}
          checked={value.privacy}
          onChange={(checked) => onChange({ ...value, privacy: checked })}
        />
        <DeclarationCard
          title="Health declaration"
          declaration={health}
          checked={value.health}
          onChange={(checked) => onChange({ ...value, health: checked })}
        />

        {showGuardian && guardian && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="font-black text-violet-950">Parent / guardian requirement</p>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-violet-900">
              {guardian.body}
              {showUnder16Supervision && (
                <p className="mt-3 font-bold">{UNDER16_SUPERVISION_CLAUSE}</p>
              )}
            </div>
            <p className="mt-3 text-sm font-semibold text-violet-950">
              A parent or legal guardian must be present at reception and co-sign the printed application before activation.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
