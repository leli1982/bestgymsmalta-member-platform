namespace Bgm.StaffBiometricService.Biometric;

public enum ProbeCommandKind
{
    Unknown = 0,
    ProcessedInfo,
    DirectSelfTest,
    SourceAfisEnroll,
    SourceAfisIdentify,
    VendorEnroll,
    VendorScore,
    VendorEnrollMultiView,
    VendorScoreMultiView,
    Revoke,
}

public static class ProbeCommandCatalog
{
    public static IReadOnlyList<string> UsageLines { get; } = new[]
    {
        "Bgm.StaffBiometricService.exe processed-info",
        "Bgm.StaffBiometricService.exe direct-selftest",
        "Bgm.StaffBiometricService.exe enroll <credential-file> <test-employee-id>",
        "Bgm.StaffBiometricService.exe identify <credential-file>",
        "Bgm.StaffBiometricService.exe vendor-enroll <credential-file> <test-employee-id>",
        "Bgm.StaffBiometricService.exe vendor-score  <credential-file>",
        "Bgm.StaffBiometricService.exe vendor-enroll-multiview <credential-file> <test-employee-id>",
        "Bgm.StaffBiometricService.exe vendor-score-multiview  <credential-file>",
        "Bgm.StaffBiometricService.exe revoke <credential-file> <credential-id>",
    };

    public static ProbeCommandKind Parse(string? command) =>
        (command ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "processed-info" => ProbeCommandKind.ProcessedInfo,
            "direct-selftest" => ProbeCommandKind.DirectSelfTest,
            "enroll" => ProbeCommandKind.SourceAfisEnroll,
            "identify" => ProbeCommandKind.SourceAfisIdentify,
            "vendor-enroll" => ProbeCommandKind.VendorEnroll,
            "vendor-score" => ProbeCommandKind.VendorScore,
            "vendor-enroll-multiview" => ProbeCommandKind.VendorEnrollMultiView,
            "vendor-score-multiview" => ProbeCommandKind.VendorScoreMultiView,
            "revoke" => ProbeCommandKind.Revoke,
            _ => ProbeCommandKind.Unknown,
        };

    public static bool UsesVendorAlgorithm(ProbeCommandKind command) =>
        command is ProbeCommandKind.VendorEnroll
            or ProbeCommandKind.VendorScore
            or ProbeCommandKind.VendorEnrollMultiView
            or ProbeCommandKind.VendorScoreMultiView;
}
