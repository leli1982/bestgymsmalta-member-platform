namespace Bgm.StaffBiometricService.Biometric;

public sealed record EmployeeBiometricSubject(string EmployeeId);
public sealed record FingerprintSample(byte[] Pixels, int Dpi, int Width = 0, int Height = 0);
public sealed record EnrolledBiometricCredential(string CredentialId, string EmployeeId);
public sealed record BiometricIdentificationResult(string CredentialId, string EmployeeId, string TerminalId, double Score);
public sealed record PortableVendorTemplateView(string Label, byte[] Template);
public sealed record PortableBiometricCredential(
    string CredentialId,
    string EmployeeId,
    byte[] Template,
    bool Active,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? RevokedAtUtc = null,
    int VendorBundleVersion = 0,
    PortableVendorTemplateView[]? VendorTemplateViews = null);

public interface IPortableBiometricEngine
{
    Task<EnrolledBiometricCredential> EnrollAsync(EmployeeBiometricSubject subject, CancellationToken ct);
    Task<BiometricIdentificationResult> IdentifyAsync(CancellationToken ct);
    Task RevokeAsync(string credentialId, CancellationToken ct);
}

public interface IFingerprintCaptureSource
{
    string TerminalId { get; }
    Task<FingerprintSample> CaptureAsync(CancellationToken ct);
}

public interface IPortableFingerprintMatcher
{
    byte[] CreateTemplate(FingerprintSample sample);
    double Match(byte[] probeTemplate, byte[] candidateTemplate);
    bool IsMatch(double score);
}

public interface IPortableCredentialStore
{
    Task<IReadOnlyList<PortableBiometricCredential>> GetAllAsync(CancellationToken ct);
    Task SaveAsync(PortableBiometricCredential credential, CancellationToken ct);
    Task RevokeAsync(string credentialId, CancellationToken ct);
}

public sealed class BiometricNoMatchException(string message) : Exception(message);
public sealed class BiometricDeviceException(string message, Exception? inner = null) : Exception(message, inner);
