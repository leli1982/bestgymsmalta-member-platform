using Bgm.StaffBiometricService.Biometric;
using Xunit;

namespace Bgm.StaffBiometricService.Tests.Biometric;

public sealed class Cs9711DirectProbeTests
{
    [Theory]
    [InlineData(0x01)]
    [InlineData(0x02)]
    [InlineData(0x04)]
    public void Builds_expected_eight_byte_command(byte command)
    {
        Assert.Equal(new byte[] { 0xEA, command, 0, 0, 0, 0, command, 0xEA }, Cs9711Protocol.BuildCommand(command));
    }

    [Fact]
    public void Accepts_only_complete_non_empty_cs9711_frame()
    {
        var frame = new byte[Cs9711Protocol.FrameBytes];
        frame[^1] = 1;

        Cs9711Protocol.ValidateFrame(frame);

        Assert.Throws<InvalidDataException>(() => Cs9711Protocol.ValidateFrame(new byte[Cs9711Protocol.FrameBytes - 1]));
        Assert.Throws<InvalidDataException>(() => Cs9711Protocol.ValidateFrame(new byte[Cs9711Protocol.FrameBytes]));
    }

    [Fact]
    public void Vendor_template_contract_matches_engine_adapter_observation()
    {
        Assert.Equal(68, Cs9711Protocol.ImageWidth);
        Assert.Equal(118, Cs9711Protocol.ImageHeight);
        Assert.Equal(8024, Cs9711Protocol.FrameBytes);
        Assert.Equal(15600, ChipSailingAlgorithm.TemplateBytes);
        Assert.Equal(40, ChipSailingAlgorithm.TemplateInfoBytes);
        Assert.Equal(3, ChipSailingAlgorithm.AlgorithmMode);
    }

    [Fact]
    public async Task Direct_capture_deinterleaves_cs9711_sensor_rows_for_portable_matcher()
    {
        var frame = new byte[Cs9711Protocol.FrameBytes];
        frame[0] = 17;       // raw (x=0,y=0) -> image (0,0)
        frame[34] = 23;      // raw (x=0,y=1) -> image (1,0)
        frame[69] = 31;      // raw (x=1,y=2) -> image (2,1)
        frame[^1] = 41;      // keep final sensor byte non-zero too
        var source = new Cs9711DirectFingerprintCaptureSource("terminal-a", () => frame);

        var sample = await source.CaptureAsync(CancellationToken.None);

        Assert.Equal("terminal-a", source.TerminalId);
        Assert.Equal(500, sample.Dpi);
        Assert.Equal(Cs9711Protocol.ImageWidth, sample.Width);
        Assert.Equal(Cs9711Protocol.ImageHeight, sample.Height);
        Assert.Equal(17, sample.Pixels[0]);
        Assert.Equal(23, sample.Pixels[1]);
        Assert.Equal(31, sample.Pixels[Cs9711Protocol.ImageWidth + 2]);
        Assert.NotEqual(frame, sample.Pixels);
    }

    [Fact]
    public void SourceAfis_diagnostic_inverts_grayscale_without_mutating_source()
    {
        var source = new byte[] { 0, 64, 128, 255 };

        var inverted = SourceAfisDiagnosticSelfTest.InvertPixels(source);

        Assert.Equal(new byte[] { 255, 191, 127, 0 }, inverted);
        Assert.Equal(new byte[] { 0, 64, 128, 255 }, source);
    }
}
