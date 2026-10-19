namespace Bgm.StaffBiometricService.Biometric;

public sealed class PortableBiometricEngine(
    IFingerprintCaptureSource capture,
    IPortableCredentialStore store,
    IPortableFingerprintMatcher matcher) : IPortableBiometricEngine
{
    public async Task<EnrolledBiometricCredential> EnrollAsync(EmployeeBiometricSubject subject, CancellationToken ct)
    {
        var employeeId = String(subject.EmployeeId || "").Trim();
        if (employeeId.Length == 0) throw new ArgumentException("Employee ID is required.", nameof(subject));

        var sample = await capture.CaptureAsync(ct);
        var template = matcher.CreateTemplate(sample);
        var credential = new PortableBiometricCredential(
            CredentialId: $"bgm-bio-{Guid.NewGuid():N}",
            EmployeeId: employeeId,
            Template: template,
            Active: true,
            CreatedAtUtc: DateTimeOffset.UtcNow);
        await store.SaveAsync(credential, ct);
        return new EnrolledBiometricCredential(credential.CredentialId, credential.EmployeeId);
    }

    public async Task<BiometricIdentificationResult> IdentifyAsync(CancellationToken ct)
    {
        var sample = await capture.CaptureAsync(ct);
        var probe = matcher.CreateTemplate(sample);
        var credentials = await store.GetAllAsync(ct);
        PortableBiometricCredential? best = null;
        double bestScore = double.NegativeInfinity;

        foreach (var credential in credentials.Where(c => c.Active))
        {
            var score = matcher.Match(probe, credential.Template);
            if (score > bestScore)
            {
                best = credential;
                bestScore = score;
            }
        }

        if (best is null || !matcher.IsMatch(bestScore))
            throw new BiometricNoMatchException("Fingerprint not recognised.");

        return new BiometricIdentificationResult(best.CredentialId, best.EmployeeId, capture.TerminalId, bestScore);
    }

    public Task RevokeAsync(string credentialId, CancellationToken ct) => store.RevokeAsync(credentialId, ct);
}

public sealed class InMemoryPortableCredentialStore : IPortableCredentialStore
{
    private readonly Dictionary<string, PortableBiometricCredential> _credentials = new(StringComparer.Ordinal);

    public Task<IReadOnlyList<PortableBiometricCredential>> GetAllAsync(CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<PortableBiometricCredential>>(_credentials.Values.ToList());

    public Task SaveAsync(PortableBiometricCredential credential, CancellationToken ct)
    {
        _credentials[credential.CredentialId] = credential;
        return Task.CompletedTask;
    }

    public Task RevokeAsync(string credentialId, CancellationToken ct)
    {
        if (_credentials.TryGetValue(credentialId, out var existing))
            _credentials[credentialId] = existing with { Active = false, RevokedAtUtc = DateTimeOffset.UtcNow };
        return Task.CompletedTask;
    }
}
