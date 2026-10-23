namespace Bgm.StaffBiometricService.Biometric;

public sealed class Cs9711DirectFingerprintCaptureSource : IFingerprintCaptureSource
{
    public const int Dpi = 500;

    private readonly Func<byte[]> _captureFrame;

    public string TerminalId { get; }

    public Cs9711DirectFingerprintCaptureSource(string terminalId, Func<byte[]>? captureFrame = null)
    {
        TerminalId = string.IsNullOrWhiteSpace(terminalId) ? Environment.MachineName : terminalId.Trim();
        _captureFrame = captureFrame ?? CaptureFrame;
    }

    public Task<FingerprintSample> CaptureAsync(CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var frame = _captureFrame();
        Cs9711Protocol.ValidateFrame(frame);
        return Task.FromResult(new FingerprintSample(
            frame,
            Dpi,
            Cs9711Protocol.ImageWidth,
            Cs9711Protocol.ImageHeight));
    }

    private static byte[] CaptureFrame()
    {
        using var capture = new Cs9711LibUsbCapture();
        return capture.CaptureFrame();
    }
}
