using Bgm.StaffBiometricService.Biometric;
using Xunit;

namespace Bgm.StaffBiometricService.Tests.Biometric;

public sealed class VendorMultiViewBiometricProbeTests
{
    [Fact]
    public void Multi_view_commands_are_explicit_vendor_commands()
    {
        Assert.Equal(
            ProbeCommandKind.VendorEnrollMultiView,
            ProbeCommandCatalog.Parse("vendor-enroll-multiview"));
        Assert.Equal(
            ProbeCommandKind.VendorScoreMultiView,
            ProbeCommandCatalog.Parse("VENDOR-SCORE-MULTIVIEW"));

        Assert.True(ProbeCommandCatalog.UsesVendorAlgorithm(ProbeCommandKind.VendorEnrollMultiView));
        Assert.True(ProbeCommandCatalog.UsesVendorAlgorithm(ProbeCommandKind.VendorScoreMultiView));

        var usage = string.Join("\n", ProbeCommandCatalog.UsageLines);
        Assert.Contains("vendor-enroll-multiview <credential-file> <test-employee-id>", usage);
        Assert.Contains("vendor-score-multiview  <credential-file>", usage);
    }

    [Fact]
    public async Task Multi_view_enrollment_captures_five_guided_views_in_order_and_saves_one_bundle()
    {
        var captureCalls = 0;
        var prompts = new List<string>();
        var store = new TestStore();
        var probe = new VendorPortableBiometricProbe(
            terminalId: "terminal-a",
            store: store,
            captureFrame: () =>
            {
                captureCalls++;
                var frame = new byte[Cs9711Protocol.FrameBytes];
                frame[0] = (byte)captureCalls;
                return frame;
            },
            createTemplate: frame =>
            {
                var marker = frame[0];
                var template = new byte[ChipSailingAlgorithm.TemplateBytes];
                template[0] = marker;
                return new ChipSailingTemplateResult(
                    template,
                    ReturnCode: 1,
                    MetricOffset4: 7000 + marker,
                    QualityOffset12: 60 + marker,
                    AlgorithmVersion: "CSAlg-test");
            },
            matchScore: (first, second) => (short)(first[0] * 10 + second[0]));

        var result = await probe.EnrollMultiViewAsync(
            "employee-1",
            prompts.Add,
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(5, captureCalls);
        Assert.Equal(5, result.CaptureCount);
        Assert.Equal(
            new[] { "center", "left", "right", "tip", "base" },
            result.Views.Select(view => view.Label));
        Assert.Equal(new[] { 61, 62, 63, 64, 65 }, result.Views.Select(view => view.Quality));
        Assert.Equal(10, result.ConsistencyScores.Count);
        Assert.Contains(
            result.ConsistencyScores,
            score => score.FirstView == "center" && score.SecondView == "left" && score.Score == 12);

        Assert.Equal(5, prompts.Count);
        Assert.Contains("center", prompts[0], StringComparison.OrdinalIgnoreCase);
        Assert.Contains("left", prompts[1], StringComparison.OrdinalIgnoreCase);
        Assert.Contains("right", prompts[2], StringComparison.OrdinalIgnoreCase);
        Assert.Contains("tip", prompts[3], StringComparison.OrdinalIgnoreCase);
        Assert.Contains("base", prompts[4], StringComparison.OrdinalIgnoreCase);

        var saved = Assert.Single(await store.GetAllAsync(CancellationToken.None));
        Assert.Equal(result.CredentialId, saved.CredentialId);
        Assert.Equal("employee-1", saved.EmployeeId);
        Assert.True(saved.Active);
        Assert.Equal(1, saved.VendorBundleVersion);
        Assert.Equal((byte)1, saved.Template[0]);
        Assert.NotNull(saved.VendorTemplateViews);
        Assert.Equal(
            new[] { "center", "left", "right", "tip", "base" },
            saved.VendorTemplateViews!.Select(view => view.Label));
        Assert.Equal(new byte[] { 1, 2, 3, 4, 5 }, saved.VendorTemplateViews.Select(view => view.Template[0]));
    }

    [Fact]
    public async Task Multi_view_score_captures_once_and_returns_best_view_across_active_bundle()
    {
        var store = new TestStore();
        await store.SaveAsync(BundleCredential("active", "employee-1", active: true, 1, 2, 3, 4, 5), CancellationToken.None);
        await store.SaveAsync(BundleCredential("revoked", "employee-2", active: false, 9, 9, 9, 9, 9), CancellationToken.None);

        var captureCalls = 0;
        var probe = new VendorPortableBiometricProbe(
            terminalId: "terminal-b",
            store: store,
            captureFrame: () =>
            {
                captureCalls++;
                var frame = new byte[Cs9711Protocol.FrameBytes];
                frame[0] = 8;
                return frame;
            },
            createTemplate: _ =>
            {
                var template = new byte[ChipSailingAlgorithm.TemplateBytes];
                template[0] = 8;
                return new ChipSailingTemplateResult(
                    template,
                    ReturnCode: 1,
                    MetricOffset4: 7900,
                    QualityOffset12: 75,
                    AlgorithmVersion: "CSAlg-test");
            },
            matchScore: (_, candidate) => candidate[0] switch
            {
                1 => 2,
                2 => 11,
                3 => 47,
                4 => 18,
                5 => 6,
                9 => 400,
                _ => 0,
            });

        var result = await probe.ScoreMultiViewAsync(CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(1, captureCalls);
        Assert.Equal("active", result.CredentialId);
        Assert.Equal("employee-1", result.EmployeeId);
        Assert.Equal((short)47, result.BestScore);
        Assert.Equal("right", result.BestView);
        Assert.Equal(
            new short[] { 2, 11, 47, 18, 6 },
            result.ViewScores.Select(score => score.Score));
        Assert.Equal(
            new[] { "center", "left", "right", "tip", "base" },
            result.ViewScores.Select(score => score.Label));
        Assert.Equal("CSAlg-test", result.AlgorithmVersion);
    }

    [Fact]
    public async Task Multi_view_score_accepts_legacy_single_template_credentials_for_diagnostics()
    {
        var store = new TestStore();
        var legacyTemplate = new byte[ChipSailingAlgorithm.TemplateBytes];
        legacyTemplate[0] = 7;
        await store.SaveAsync(
            new PortableBiometricCredential(
                "legacy-cred",
                "employee-legacy",
                legacyTemplate,
                true,
                DateTimeOffset.UtcNow),
            CancellationToken.None);

        var probe = new VendorPortableBiometricProbe(
            "terminal-b",
            store,
            captureFrame: () =>
            {
                var frame = new byte[Cs9711Protocol.FrameBytes];
                frame[0] = 1;
                return frame;
            },
            createTemplate: _ => new ChipSailingTemplateResult(
                new byte[ChipSailingAlgorithm.TemplateBytes],
                ReturnCode: 1,
                MetricOffset4: 7800,
                QualityOffset12: 70,
                AlgorithmVersion: "CSAlg-test"),
            matchScore: (_, candidate) => candidate[0] == 7 ? (short)22 : (short)0);

        var result = await probe.ScoreMultiViewAsync(CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("legacy-cred", result.CredentialId);
        Assert.Equal((short)22, result.BestScore);
        Assert.Equal("legacy", result.BestView);
        var score = Assert.Single(result.ViewScores);
        Assert.Equal("legacy", score.Label);
        Assert.Equal((short)22, score.Score);
    }

    [Fact]
    public async Task Multi_view_score_with_no_active_credentials_does_not_touch_reader()
    {
        var store = new TestStore();
        await store.SaveAsync(BundleCredential("revoked", "employee-2", active: false, 9, 9, 9, 9, 9), CancellationToken.None);
        var captureCalls = 0;
        var probe = new VendorPortableBiometricProbe(
            "terminal-b",
            store,
            captureFrame: () =>
            {
                captureCalls++;
                return new byte[Cs9711Protocol.FrameBytes];
            },
            createTemplate: _ => throw new InvalidOperationException("must not create template"),
            matchScore: (_, _) => throw new InvalidOperationException("must not match"));

        var result = await probe.ScoreMultiViewAsync(CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(0, captureCalls);
        Assert.Null(result.CredentialId);
        Assert.Null(result.BestScore);
        Assert.Empty(result.ViewScores);
    }

    private static PortableBiometricCredential BundleCredential(
        string credentialId,
        string employeeId,
        bool active,
        params byte[] markers)
    {
        var views = new[] { "center", "left", "right", "tip", "base" }
            .Zip(markers, (label, marker) =>
            {
                var template = new byte[ChipSailingAlgorithm.TemplateBytes];
                template[0] = marker;
                return new PortableVendorTemplateView(label, template);
            })
            .ToArray();

        return new PortableBiometricCredential(
            credentialId,
            employeeId,
            views[0].Template.ToArray(),
            active,
            DateTimeOffset.UtcNow,
            active ? null : DateTimeOffset.UtcNow,
            VendorBundleVersion: 1,
            VendorTemplateViews: views);
    }

    private sealed class TestStore : IPortableCredentialStore
    {
        private readonly List<PortableBiometricCredential> _credentials = new();

        public Task<IReadOnlyList<PortableBiometricCredential>> GetAllAsync(CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<PortableBiometricCredential>>(_credentials.ToArray());

        public Task SaveAsync(PortableBiometricCredential credential, CancellationToken ct)
        {
            var index = _credentials.FindIndex(existing => existing.CredentialId == credential.CredentialId);
            if (index >= 0) _credentials[index] = credential;
            else _credentials.Add(credential);
            return Task.CompletedTask;
        }

        public Task RevokeAsync(string credentialId, CancellationToken ct)
        {
            var index = _credentials.FindIndex(existing => existing.CredentialId == credentialId);
            if (index >= 0)
            {
                _credentials[index] = _credentials[index] with
                {
                    Active = false,
                    RevokedAtUtc = DateTimeOffset.UtcNow,
                };
            }
            return Task.CompletedTask;
        }
    }
}
