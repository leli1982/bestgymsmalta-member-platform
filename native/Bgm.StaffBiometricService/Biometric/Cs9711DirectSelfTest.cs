using System.Security.Cryptography;

namespace Bgm.StaffBiometricService.Biometric;

public sealed record Cs9711DirectSelfTestResult(
    string AlgorithmVersion,
    short FirstReturnCode,
    short SecondReturnCode,
    short DifferentReturnCode,
    int FirstMetric,
    int SecondMetric,
    int DifferentMetric,
    int FirstQuality,
    int SecondQuality,
    int DifferentQuality,
    short SameFingerScore,
    short DifferentFingerScore,
    int TemplateBytes,
    int FrameBytes);

public static class Cs9711DirectSelfTest
{
    public static Cs9711DirectSelfTestResult Run(Action<string>? prompt = null)
    {
        prompt ??= Console.WriteLine;

        using var capture = new Cs9711LibUsbCapture();
        using var algorithm = new ChipSailingAlgorithm();

        byte[]? frame1 = null;
        byte[]? frame2 = null;
        byte[]? frame3 = null;
        byte[]? template1 = null;
        byte[]? template2 = null;
        byte[]? template3 = null;

        try
        {
            prompt("SCAN_1: Place one finger on the FP100 reader.");
            frame1 = capture.CaptureFrame();
            var first = algorithm.CreateTemplate(frame1);
            template1 = first.Template;
            capture.Reset();

            prompt("SCAN_2: Lift and place the SAME finger again.");
            frame2 = capture.CaptureFrame();
            var second = algorithm.CreateTemplate(frame2);
            template2 = second.Template;
            capture.Reset();

            prompt("SCAN_3: Lift and place a DIFFERENT finger.");
            frame3 = capture.CaptureFrame();
            var different = algorithm.CreateTemplate(frame3);
            template3 = different.Template;

            var sameScore = algorithm.MatchScore(template1, template2);
            var differentScore = algorithm.MatchScore(template1, template3);

            return new Cs9711DirectSelfTestResult(
                first.AlgorithmVersion,
                first.ReturnCode,
                second.ReturnCode,
                different.ReturnCode,
                first.MetricOffset4,
                second.MetricOffset4,
                different.MetricOffset4,
                first.QualityOffset12,
                second.QualityOffset12,
                different.QualityOffset12,
                sameScore,
                differentScore,
                ChipSailingAlgorithm.TemplateBytes,
                Cs9711Protocol.FrameBytes);
        }
        finally
        {
            if (frame1 is not null) CryptographicOperations.ZeroMemory(frame1);
            if (frame2 is not null) CryptographicOperations.ZeroMemory(frame2);
            if (frame3 is not null) CryptographicOperations.ZeroMemory(frame3);
            if (template1 is not null) CryptographicOperations.ZeroMemory(template1);
            if (template2 is not null) CryptographicOperations.ZeroMemory(template2);
            if (template3 is not null) CryptographicOperations.ZeroMemory(template3);
        }
    }
}
