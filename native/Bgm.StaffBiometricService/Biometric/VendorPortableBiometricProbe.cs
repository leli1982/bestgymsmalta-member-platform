using System.Security.Cryptography;

namespace Bgm.StaffBiometricService.Biometric;

public sealed record VendorEnrollmentResult(
    string CredentialId,
    string EmployeeId,
    string TerminalId,
    string AlgorithmVersion,
    bool Success,
    string Message);

public sealed class VendorPortableBiometricProbe
{
    private readonly string _terminalId;
    private readonly IPortableCredentialStore _store;
    private readonly Func<byte[]> _captureFrame;
    private readonly Func<byte[], ChipSailingTemplateResult> _createTemplate;
    private readonly Func<byte[], byte[], short> _matchScore;

    public VendorPortableBiometricProbe(
        string terminalId,
        IPortableCredentialStore store,
        Func<byte[]> captureFrame,
        Func<byte[], ChipSailingTemplateResult> createTemplate,
        Func<byte[], byte[], short> matchScore)
    {
        _terminalId = string.IsNullOrWhiteSpace(terminalId) ? Environment.MachineName : terminalId.Trim();
        _store = store;
        _captureFrame = captureFrame;
        _createTemplate = createTemplate;
        _matchScore = matchScore;
    }

    public async Task<VendorEnrollmentResult> EnrollAsync(string employeeId, CancellationToken ct)
    {
        var normalizedEmployeeId = (employeeId ?? string.Empty).Trim();
        if (normalizedEmployeeId.Length == 0)
            throw new ArgumentException("Employee ID is required.", nameof(employeeId));

        ct.ThrowIfCancellationRequested();
        byte[]? frame = null;
        byte[]? transientTemplate = null;

        try
        {
            frame = _captureFrame();
            Cs9711Protocol.ValidateFrame(frame);
            var created = _createTemplate(frame);
            transientTemplate = created.Template;

            if (transientTemplate.Length != ChipSailingAlgorithm.TemplateBytes)
                throw new BiometricDeviceException(
                    $"ChipSailing template must be exactly {ChipSailingAlgorithm.TemplateBytes} bytes.");

            var credential = new PortableBiometricCredential(
                CredentialId: $"bgm-bio-{Guid.NewGuid():N}",
                EmployeeId: normalizedEmployeeId,
                Template: transientTemplate.ToArray(),
                Active: true,
                CreatedAtUtc: DateTimeOffset.UtcNow);

            await _store.SaveAsync(credential, ct);

            return new VendorEnrollmentResult(
                credential.CredentialId,
                credential.EmployeeId,
                _terminalId,
                created.AlgorithmVersion,
                Success: true,
                Message: "Vendor enrollment captured and portable credential created.");
        }
        finally
        {
            if (frame is not null) CryptographicOperations.ZeroMemory(frame);
            if (transientTemplate is not null) CryptographicOperations.ZeroMemory(transientTemplate);
        }
    }
}
