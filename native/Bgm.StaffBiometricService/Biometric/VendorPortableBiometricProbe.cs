using System.Security.Cryptography;

namespace Bgm.StaffBiometricService.Biometric;

public sealed record VendorEnrollmentResult(
    string CredentialId,
    string EmployeeId,
    string TerminalId,
    string AlgorithmVersion,
    bool Success,
    string Message);

public sealed record VendorScoreResult(
    string? CredentialId,
    string? EmployeeId,
    string TerminalId,
    short? Score,
    string? AlgorithmVersion,
    bool Success,
    string Message);

public sealed record VendorEnrollmentViewDiagnostic(
    string Label,
    int Metric,
    int Quality);

public sealed record VendorConsistencyScore(
    string FirstView,
    string SecondView,
    short Score);

public sealed record VendorMultiViewEnrollmentResult(
    string CredentialId,
    string EmployeeId,
    string TerminalId,
    string AlgorithmVersion,
    int CaptureCount,
    IReadOnlyList<VendorEnrollmentViewDiagnostic> Views,
    IReadOnlyList<VendorConsistencyScore> ConsistencyScores,
    bool Success,
    string Message);

public sealed record VendorViewScore(string Label, short Score);

public sealed record VendorMultiViewScoreResult(
    string? CredentialId,
    string? EmployeeId,
    string TerminalId,
    short? BestScore,
    string? BestView,
    IReadOnlyList<VendorViewScore> ViewScores,
    string? AlgorithmVersion,
    bool Success,
    string Message);

public sealed class VendorPortableBiometricProbe
{
    private const int MultiViewBundleVersion = 1;

    private static readonly (string Label, string Instruction)[] MultiViewCapturePlan =
    {
        ("center", "Place the finger normally and centred on the sensor."),
        ("left", "Lift the finger, then place it slightly left of centre."),
        ("right", "Lift the finger, then place it slightly right of centre."),
        ("tip", "Lift the finger, then place it slightly toward the fingertip."),
        ("base", "Lift the finger, then place it slightly toward the base of the finger."),
    };

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

            ValidateVendorTemplate(transientTemplate);

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

    public async Task<VendorMultiViewEnrollmentResult> EnrollMultiViewAsync(
        string employeeId,
        Action<string>? prompt,
        CancellationToken ct)
    {
        var normalizedEmployeeId = (employeeId ?? string.Empty).Trim();
        if (normalizedEmployeeId.Length == 0)
            throw new ArgumentException("Employee ID is required.", nameof(employeeId));

        prompt ??= _ => { };
        var captured = new List<CapturedVendorView>(MultiViewCapturePlan.Length);
        string? algorithmVersion = null;

        try
        {
            for (var index = 0; index < MultiViewCapturePlan.Length; index++)
            {
                ct.ThrowIfCancellationRequested();
                var step = MultiViewCapturePlan[index];
                prompt($"CAPTURE {index + 1}/{MultiViewCapturePlan.Length} - {step.Label}: {step.Instruction}");

                byte[]? frame = null;
                byte[]? transientTemplate = null;
                try
                {
                    frame = _captureFrame();
                    Cs9711Protocol.ValidateFrame(frame);
                    var created = _createTemplate(frame);
                    transientTemplate = created.Template;
                    ValidateVendorTemplate(transientTemplate);

                    algorithmVersion ??= created.AlgorithmVersion;
                    captured.Add(new CapturedVendorView(
                        step.Label,
                        transientTemplate.ToArray(),
                        created.MetricOffset4,
                        created.QualityOffset12));
                }
                finally
                {
                    if (frame is not null) CryptographicOperations.ZeroMemory(frame);
                    if (transientTemplate is not null) CryptographicOperations.ZeroMemory(transientTemplate);
                }
            }

            var diagnostics = captured
                .Select(view => new VendorEnrollmentViewDiagnostic(view.Label, view.Metric, view.Quality))
                .ToArray();

            var consistencyScores = new List<VendorConsistencyScore>();
            for (var firstIndex = 0; firstIndex < captured.Count; firstIndex++)
            {
                for (var secondIndex = firstIndex + 1; secondIndex < captured.Count; secondIndex++)
                {
                    var first = captured[firstIndex];
                    var second = captured[secondIndex];
                    consistencyScores.Add(new VendorConsistencyScore(
                        first.Label,
                        second.Label,
                        _matchScore(first.Template, second.Template)));
                }
            }

            var persistedViews = captured
                .Select(view => new PortableVendorTemplateView(view.Label, view.Template.ToArray()))
                .ToArray();

            var credential = new PortableBiometricCredential(
                CredentialId: $"bgm-bio-{Guid.NewGuid():N}",
                EmployeeId: normalizedEmployeeId,
                Template: persistedViews[0].Template.ToArray(),
                Active: true,
                CreatedAtUtc: DateTimeOffset.UtcNow,
                VendorBundleVersion: MultiViewBundleVersion,
                VendorTemplateViews: persistedViews);

            await _store.SaveAsync(credential, ct);

            return new VendorMultiViewEnrollmentResult(
                credential.CredentialId,
                credential.EmployeeId,
                _terminalId,
                algorithmVersion ?? "unknown",
                captured.Count,
                diagnostics,
                consistencyScores,
                Success: true,
                Message: "Five-view vendor enrollment captured and portable credential bundle created.");
        }
        finally
        {
            foreach (var view in captured)
                CryptographicOperations.ZeroMemory(view.Template);
        }
    }

    public async Task<VendorScoreResult> ScoreAsync(CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var activeCredentials = (await _store.GetAllAsync(ct)).Where(c => c.Active).ToList();
        if (activeCredentials.Count == 0)
        {
            return new VendorScoreResult(
                CredentialId: null,
                EmployeeId: null,
                TerminalId: _terminalId,
                Score: null,
                AlgorithmVersion: null,
                Success: false,
                Message: "No active vendor credential found.");
        }

        byte[]? frame = null;
        byte[]? liveTemplate = null;
        try
        {
            frame = _captureFrame();
            Cs9711Protocol.ValidateFrame(frame);
            var created = _createTemplate(frame);
            liveTemplate = created.Template;

            ValidateVendorTemplate(liveTemplate);

            PortableBiometricCredential? best = null;
            short? bestScore = null;
            foreach (var credential in activeCredentials)
            {
                var score = _matchScore(liveTemplate, credential.Template);
                if (bestScore is null || score > bestScore.Value)
                {
                    best = credential;
                    bestScore = score;
                }
            }

            return new VendorScoreResult(
                CredentialId: best!.CredentialId,
                EmployeeId: best.EmployeeId,
                TerminalId: _terminalId,
                Score: bestScore,
                AlgorithmVersion: created.AlgorithmVersion,
                Success: true,
                Message: "Vendor score captured.");
        }
        finally
        {
            if (frame is not null) CryptographicOperations.ZeroMemory(frame);
            if (liveTemplate is not null) CryptographicOperations.ZeroMemory(liveTemplate);
        }
    }

    public async Task<VendorMultiViewScoreResult> ScoreMultiViewAsync(CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var activeCredentials = (await _store.GetAllAsync(ct)).Where(c => c.Active).ToList();
        if (activeCredentials.Count == 0)
            return EmptyMultiViewScore("No active vendor credential found.");

        byte[]? frame = null;
        byte[]? liveTemplate = null;
        try
        {
            frame = _captureFrame();
            Cs9711Protocol.ValidateFrame(frame);
            var created = _createTemplate(frame);
            liveTemplate = created.Template;
            ValidateVendorTemplate(liveTemplate);

            PortableBiometricCredential? bestCredential = null;
            short? bestScore = null;
            string? bestView = null;
            IReadOnlyList<VendorViewScore> bestViewScores = Array.Empty<VendorViewScore>();

            foreach (var credential in activeCredentials)
            {
                var candidateViews = CandidateViews(credential);
                var scores = new List<VendorViewScore>(candidateViews.Count);
                short? credentialBestScore = null;
                string? credentialBestView = null;

                foreach (var view in candidateViews)
                {
                    if (view.Template.Length != ChipSailingAlgorithm.TemplateBytes)
                        continue;

                    var score = _matchScore(liveTemplate, view.Template);
                    scores.Add(new VendorViewScore(view.Label, score));
                    if (credentialBestScore is null || score > credentialBestScore.Value)
                    {
                        credentialBestScore = score;
                        credentialBestView = view.Label;
                    }
                }

                if (credentialBestScore is null)
                    continue;

                if (bestScore is null || credentialBestScore.Value > bestScore.Value)
                {
                    bestCredential = credential;
                    bestScore = credentialBestScore;
                    bestView = credentialBestView;
                    bestViewScores = scores.ToArray();
                }
            }

            if (bestCredential is null || bestScore is null)
                return EmptyMultiViewScore("No active vendor template found.");

            return new VendorMultiViewScoreResult(
                CredentialId: bestCredential.CredentialId,
                EmployeeId: bestCredential.EmployeeId,
                TerminalId: _terminalId,
                BestScore: bestScore,
                BestView: bestView,
                ViewScores: bestViewScores,
                AlgorithmVersion: created.AlgorithmVersion,
                Success: true,
                Message: "Five-view vendor score captured from one live fingerprint.");
        }
        finally
        {
            if (frame is not null) CryptographicOperations.ZeroMemory(frame);
            if (liveTemplate is not null) CryptographicOperations.ZeroMemory(liveTemplate);
        }
    }

    private VendorMultiViewScoreResult EmptyMultiViewScore(string message) =>
        new(
            CredentialId: null,
            EmployeeId: null,
            TerminalId: _terminalId,
            BestScore: null,
            BestView: null,
            ViewScores: Array.Empty<VendorViewScore>(),
            AlgorithmVersion: null,
            Success: false,
            Message: message);

    private static IReadOnlyList<PortableVendorTemplateView> CandidateViews(PortableBiometricCredential credential)
    {
        if (credential.VendorBundleVersion > 0 && credential.VendorTemplateViews is { Length: > 0 })
            return credential.VendorTemplateViews;

        return new[] { new PortableVendorTemplateView("legacy", credential.Template) };
    }

    private static void ValidateVendorTemplate(byte[] template)
    {
        if (template.Length != ChipSailingAlgorithm.TemplateBytes)
            throw new BiometricDeviceException(
                $"ChipSailing template must be exactly {ChipSailingAlgorithm.TemplateBytes} bytes.");
    }

    private sealed record CapturedVendorView(string Label, byte[] Template, int Metric, int Quality);
}
