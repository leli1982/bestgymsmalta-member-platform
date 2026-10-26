using Bgm.StaffBiometricService.Biometric;
using Xunit;

namespace Bgm.StaffBiometricService.Tests.Biometric;

public sealed class VendorPortableBiometricProbeTests
{
    [Fact]
    public async Task Enrollment_saves_one_active_vendor_template_for_the_employee()
    {
        var frame = new byte[Cs9711Protocol.FrameBytes];
        frame[^1] = 1;
        var vendorTemplate = Enumerable.Repeat((byte)0x5A, ChipSailingAlgorithm.TemplateBytes).ToArray();
        var store = new InMemoryPortableCredentialStore();

        var probe = new VendorPortableBiometricProbe(
            terminalId: "terminal-a",
            store: store,
            captureFrame: () => frame.ToArray(),
            createTemplate: _ => new ChipSailingTemplateResult(
                vendorTemplate.ToArray(),
                ReturnCode: 1,
                MetricOffset4: 8000,
                QualityOffset12: 80,
                AlgorithmVersion: "CSAlg-test"),
            matchScore: (_, _) => 0);

        var result = await probe.EnrollAsync("employee-1", CancellationToken.None);
        var saved = Assert.Single(await store.GetAllAsync(CancellationToken.None));

        Assert.True(result.Success);
        Assert.Equal("terminal-a", result.TerminalId);
        Assert.Equal("employee-1", result.EmployeeId);
        Assert.Equal("CSAlg-test", result.AlgorithmVersion);
        Assert.Equal(result.CredentialId, saved.CredentialId);
        Assert.Equal("employee-1", saved.EmployeeId);
        Assert.True(saved.Active);
        Assert.Equal(vendorTemplate, saved.Template);
    }

    [Fact]
    public async Task Score_returns_highest_raw_vendor_score_and_ignores_revoked_credentials()
    {
        var store = new InMemoryPortableCredentialStore();
        await store.SaveAsync(Credential("cred-a", "employee-a", marker: 1, active: true), CancellationToken.None);
        await store.SaveAsync(Credential("cred-b", "employee-b", marker: 2, active: true), CancellationToken.None);
        await store.SaveAsync(Credential("cred-revoked", "employee-revoked", marker: 3, active: false), CancellationToken.None);

        var frame = new byte[Cs9711Protocol.FrameBytes];
        frame[^1] = 1;
        var liveTemplate = Enumerable.Repeat((byte)0x7A, ChipSailingAlgorithm.TemplateBytes).ToArray();
        var probe = new VendorPortableBiometricProbe(
            terminalId: "terminal-b",
            store: store,
            captureFrame: () => frame.ToArray(),
            createTemplate: _ => new ChipSailingTemplateResult(
                liveTemplate.ToArray(),
                ReturnCode: 1,
                MetricOffset4: 7900,
                QualityOffset12: 75,
                AlgorithmVersion: "CSAlg-test"),
            matchScore: (_, candidate) => candidate[0] switch
            {
                1 => 25,
                2 => 106,
                3 => 400,
                _ => 0,
            });

        var result = await probe.ScoreAsync(CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("terminal-b", result.TerminalId);
        Assert.Equal("cred-b", result.CredentialId);
        Assert.Equal("employee-b", result.EmployeeId);
        Assert.Equal((short)106, result.Score);
        Assert.Equal("CSAlg-test", result.AlgorithmVersion);
    }

    [Fact]
    public async Task Score_with_no_active_credentials_returns_no_candidate_without_touching_reader()
    {
        var store = new InMemoryPortableCredentialStore();
        var captureCalls = 0;
        var probe = new VendorPortableBiometricProbe(
            terminalId: "terminal-b",
            store: store,
            captureFrame: () =>
            {
                captureCalls++;
                return new byte[Cs9711Protocol.FrameBytes];
            },
            createTemplate: _ => throw new InvalidOperationException("must not create a template"),
            matchScore: (_, _) => throw new InvalidOperationException("must not match"));

        var result = await probe.ScoreAsync(CancellationToken.None);

        Assert.False(result.Success);
        Assert.Null(result.CredentialId);
        Assert.Null(result.EmployeeId);
        Assert.Null(result.Score);
        Assert.Equal(0, captureCalls);
        Assert.Equal("No active vendor credential found.", result.Message);
    }

    private static PortableBiometricCredential Credential(
        string credentialId,
        string employeeId,
        byte marker,
        bool active)
    {
        var template = new byte[ChipSailingAlgorithm.TemplateBytes];
        template[0] = marker;
        return new PortableBiometricCredential(
            credentialId,
            employeeId,
            template,
            active,
            DateTimeOffset.UtcNow,
            active ? null : DateTimeOffset.UtcNow);
    }
}
