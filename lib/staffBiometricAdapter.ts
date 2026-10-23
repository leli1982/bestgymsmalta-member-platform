export type BiometricMatch = {
  employeeId: string;
  adapterEventId: string;
  matchedAt: string;
};

export type StaffBiometricFailureCode =
  | "hardware_not_configured"
  | "no_match"
  | "invalid_payload";

export class StaffBiometricAdapterError extends Error {
  readonly code: StaffBiometricFailureCode;

  constructor(code: StaffBiometricFailureCode, message: string) {
    super(message);
    this.name = "StaffBiometricAdapterError";
    this.code = code;
  }
}

export interface StaffBiometricAdapter {
  resolveMatch(input: unknown): Promise<BiometricMatch>;
}

class DisabledStaffBiometricAdapter implements StaffBiometricAdapter {
  async resolveMatch(input: unknown): Promise<BiometricMatch> {
    void input;
    throw new StaffBiometricAdapterError(
      "hardware_not_configured",
      "Fingerprint reader is not configured.",
    );
  }
}

export function getStaffBiometricAdapter(): StaffBiometricAdapter {
  return new DisabledStaffBiometricAdapter();
}
