namespace Bgm.StaffBiometricService.Biometric;

public sealed class Cs9711DirectFingerprintCaptureSource : IFingerprintCaptureSource
{
    public const int Dpi = 500;

    private const int SensorWidth = 34;
    private const int SensorHeight = 236;

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

        var pixels = new byte[Cs9711Protocol.ImageWidth * Cs9711Protocol.ImageHeight];
        for (var y = 0; y < SensorHeight; y++)
        {
            for (var x = 0; x < SensorWidth; x++)
            {
                var dy = y / 2;
                var dx = x * 2 + y % 2;
                pixels[dy * Cs9711Protocol.ImageWidth + dx] = frame[y * SensorWidth + x];
            }
        }

        return Task.FromResult(new FingerprintSample(
            pixels,
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
