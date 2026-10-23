namespace Bgm.StaffBiometricService.Biometric;

public sealed record Fp100CapabilityProbeResult(
    string Operation,
    string TerminalId,
    string? CredentialId,
    string? EmployeeId,
    double? Score,
    bool Success,
    string Message);

public sealed class Fp100CapabilityProbe(IPortableBiometricEngine engine, string terminalId)
{
    public async Task<Fp100CapabilityProbeResult> EnrollAsync(string employeeId, CancellationToken ct)
    {
        var enrolled = await engine.EnrollAsync(new EmployeeBiometricSubject(employeeId), ct);
        return new Fp100CapabilityProbeResult(
            "enroll", terminalId, enrolled.CredentialId, enrolled.EmployeeId, null, true,
            "Enrollment captured and portable credential created.");
    }

    public async Task<Fp100CapabilityProbeResult> IdentifyAsync(CancellationToken ct)
    {
        var identified = await engine.IdentifyAsync(ct);
        return new Fp100CapabilityProbeResult(
            "identify", identified.TerminalId, identified.CredentialId, identified.EmployeeId,
            identified.Score, true, "Fingerprint matched an active portable credential.");
    }

    public async Task<Fp100CapabilityProbeResult> RevokeAsync(string credentialId, CancellationToken ct)
    {
        await engine.RevokeAsync(credentialId, ct);
        return new Fp100CapabilityProbeResult(
            "revoke", terminalId, credentialId, null, null, true,
            "Credential revoked in the portable test store.");
    }
}
