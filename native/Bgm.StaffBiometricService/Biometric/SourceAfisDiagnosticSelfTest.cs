using System.Security.Cryptography;

namespace Bgm.StaffBiometricService.Biometric;

public sealed record SourceAfisDiagnosticVariantResult(
    int Dpi,
    bool Inverted,
    double? SameFingerScore,
    double? DifferentFingerScore,
    int? FirstTemplateBytes,
    int? SecondTemplateBytes,
    int? DifferentTemplateBytes,
    string? Error);

public sealed record SourceAfisDiagnosticSelfTestResult(
    int Width,
    int Height,
    IReadOnlyList<SourceAfisDiagnosticVariantResult> Variants);

public static class SourceAfisDiagnosticSelfTest
{
    private static readonly int[] DiagnosticDpis = [250, 333, 400, 500, 600, 750, 1000];

    public static byte[] InvertPixels(ReadOnlySpan<byte> source)
    {
        var inverted = new byte[source.Length];
        for (var i = 0; i < source.Length; i++)
            inverted[i] = (byte)(255 - source[i]);
        return inverted;
    }

    public static SourceAfisDiagnosticSelfTestResult Run(Action<string>? prompt = null)
    {
        prompt ??= Console.WriteLine;

        using var capture = new Cs9711LibUsbCapture();
        byte[]? frame1 = null;
        byte[]? frame2 = null;
        byte[]? frame3 = null;
        FingerprintSample? first = null;
        FingerprintSample? second = null;
        FingerprintSample? different = null;

        try
        {
            prompt("SCAN_1: Place one finger on the FP100 reader.");
            frame1 = capture.CaptureFrame();
            first = ToSample(frame1);
            capture.Reset();

            prompt("SCAN_2: Lift and place the SAME finger again.");
            frame2 = capture.CaptureFrame();
            second = ToSample(frame2);
            capture.Reset();

            prompt("SCAN_3: Lift and place a DIFFERENT finger.");
            frame3 = capture.CaptureFrame();
            different = ToSample(frame3);

            var variants = new List<SourceAfisDiagnosticVariantResult>();
            foreach (var dpi in DiagnosticDpis)
            {
                variants.Add(EvaluateVariant(first, second, different, dpi, inverted: false));
                variants.Add(EvaluateVariant(first, second, different, dpi, inverted: true));
            }

            return new SourceAfisDiagnosticSelfTestResult(
                Cs9711Protocol.ImageWidth,
                Cs9711Protocol.ImageHeight,
                variants);
        }
        finally
        {
            if (frame1 is not null) CryptographicOperations.ZeroMemory(frame1);
            if (frame2 is not null) CryptographicOperations.ZeroMemory(frame2);
            if (frame3 is not null) CryptographicOperations.ZeroMemory(frame3);
            if (first is not null) CryptographicOperations.ZeroMemory(first.Pixels);
            if (second is not null) CryptographicOperations.ZeroMemory(second.Pixels);
            if (different is not null) CryptographicOperations.ZeroMemory(different.Pixels);
        }
    }

    private static FingerprintSample ToSample(byte[] frame)
    {
        var source = new Cs9711DirectFingerprintCaptureSource("sourceafis-diagnostic", () => frame);
        return source.CaptureAsync(CancellationToken.None).GetAwaiter().GetResult();
    }

    private static SourceAfisDiagnosticVariantResult EvaluateVariant(
        FingerprintSample first,
        FingerprintSample second,
        FingerprintSample different,
        int dpi,
        bool inverted)
    {
        byte[]? firstPixels = null;
        byte[]? secondPixels = null;
        byte[]? differentPixels = null;
        byte[]? firstTemplate = null;
        byte[]? secondTemplate = null;
        byte[]? differentTemplate = null;

        try
        {
            firstPixels = inverted ? InvertPixels(first.Pixels) : first.Pixels.ToArray();
            secondPixels = inverted ? InvertPixels(second.Pixels) : second.Pixels.ToArray();
            differentPixels = inverted ? InvertPixels(different.Pixels) : different.Pixels.ToArray();

            var matcher = new SourceAfisFingerprintMatcher(40);
            firstTemplate = matcher.CreateTemplate(new FingerprintSample(firstPixels, dpi, first.Width, first.Height));
            secondTemplate = matcher.CreateTemplate(new FingerprintSample(secondPixels, dpi, second.Width, second.Height));
            differentTemplate = matcher.CreateTemplate(new FingerprintSample(differentPixels, dpi, different.Width, different.Height));

            var sameScore = matcher.Match(firstTemplate, secondTemplate);
            var differentScore = matcher.Match(firstTemplate, differentTemplate);

            return new SourceAfisDiagnosticVariantResult(
                dpi,
                inverted,
                sameScore,
                differentScore,
                firstTemplate.Length,
                secondTemplate.Length,
                differentTemplate.Length,
                null);
        }
        catch (Exception ex)
        {
            return new SourceAfisDiagnosticVariantResult(
                dpi,
                inverted,
                null,
                null,
                firstTemplate?.Length,
                secondTemplate?.Length,
                differentTemplate?.Length,
                $"{ex.GetType().Name}: {ex.Message}");
        }
        finally
        {
            if (firstPixels is not null) CryptographicOperations.ZeroMemory(firstPixels);
            if (secondPixels is not null) CryptographicOperations.ZeroMemory(secondPixels);
            if (differentPixels is not null) CryptographicOperations.ZeroMemory(differentPixels);
            if (firstTemplate is not null) CryptographicOperations.ZeroMemory(firstTemplate);
            if (secondTemplate is not null) CryptographicOperations.ZeroMemory(secondTemplate);
            if (differentTemplate is not null) CryptographicOperations.ZeroMemory(differentTemplate);
        }
    }
}
