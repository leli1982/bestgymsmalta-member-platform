using Bgm.StaffBiometricService.Biometric;

namespace Bgm.StaffBiometricService.Tests.Biometric;

public sealed class Fp100CapabilityProbeTests
{
    [Fact]
    public async Task Same_global_credential_can_be_identified_from_second_terminal_context()
    {
        var store = new InMemoryPortableCredentialStore();
        var terminalA = new FakeFingerprintCaptureSource("terminal-a", new byte[] { 1, 2, 3 });
        var terminalB = new FakeFingerprintCaptureSource("terminal-b", new byte[] { 1, 2, 3 });
        var matcher = new ExactTestMatcher();
        var engineA = new PortableBiometricEngine(terminalA, store, matcher);
        var engineB = new PortableBiometricEngine(terminalB, store, matcher);

        var enrolled = await engineA.EnrollAsync(new EmployeeBiometricSubject("employee-1"), CancellationToken.None);
        var identified = await engineB.IdentifyAsync(CancellationToken.None);

        Assert.Equal(enrolled.CredentialId, identified.CredentialId);
        Assert.Equal("employee-1", identified.EmployeeId);
        Assert.Equal("terminal-b", identified.TerminalId);
    }

    [Fact]
    public async Task No_match_is_distinct_from_device_failure()
    {
        var store = new InMemoryPortableCredentialStore();
        var matcher = new ExactTestMatcher();
        var engineA = new PortableBiometricEngine(new FakeFingerprintCaptureSource("terminal-a", new byte[] { 1 }), store, matcher);
        await engineA.EnrollAsync(new EmployeeBiometricSubject("employee-1"), CancellationToken.None);

        var noMatch = new PortableBiometricEngine(new FakeFingerprintCaptureSource("terminal-b", new byte[] { 9 }), store, matcher);
        await Assert.ThrowsAsync<BiometricNoMatchException>(() => noMatch.IdentifyAsync(CancellationToken.None));

        var failed = new PortableBiometricEngine(new FailingFingerprintCaptureSource("terminal-b"), store, matcher);
        await Assert.ThrowsAsync<BiometricDeviceException>(() => failed.IdentifyAsync(CancellationToken.None));
    }

    [Fact]
    public async Task Revoked_global_credential_is_not_accepted()
    {
        var store = new InMemoryPortableCredentialStore();
        var matcher = new ExactTestMatcher();
        var engineA = new PortableBiometricEngine(new FakeFingerprintCaptureSource("terminal-a", new byte[] { 4, 5, 6 }), store, matcher);
        var engineB = new PortableBiometricEngine(new FakeFingerprintCaptureSource("terminal-b", new byte[] { 4, 5, 6 }), store, matcher);

        var enrolled = await engineA.EnrollAsync(new EmployeeBiometricSubject("employee-1"), CancellationToken.None);
        await engineA.RevokeAsync(enrolled.CredentialId, CancellationToken.None);

        await Assert.ThrowsAsync<BiometricNoMatchException>(() => engineB.IdentifyAsync(CancellationToken.None));
    }

    private sealed class FakeFingerprintCaptureSource(string terminalId, byte[] sample) : IFingerprintCaptureSource
    {
        public string TerminalId => terminalId;
        public Task<FingerprintSample> CaptureAsync(CancellationToken ct) => Task.FromResult(new FingerprintSample(sample, 500));
    }

    private sealed class FailingFingerprintCaptureSource(string terminalId) : IFingerprintCaptureSource
    {
        public string TerminalId => terminalId;
        public Task<FingerprintSample> CaptureAsync(CancellationToken ct) => throw new BiometricDeviceException("capture failed");
    }

    private sealed class ExactTestMatcher : IPortableFingerprintMatcher
    {
        public byte[] CreateTemplate(FingerprintSample sample) => sample.Pixels.ToArray();
        public double Match(byte[] probeTemplate, byte[] candidateTemplate) => probeTemplate.SequenceEqual(candidateTemplate) ? 100 : 0;
        public bool IsMatch(double score) => score >= 40;
    }
}
