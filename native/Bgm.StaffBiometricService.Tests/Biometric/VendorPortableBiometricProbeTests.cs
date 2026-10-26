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
}
