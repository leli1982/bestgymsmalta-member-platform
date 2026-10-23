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
    public async Task Direct_capture_maps_cs9711_frame_to_portable_fingerprint_sample()
    {
        var frame = new byte[Cs9711Protocol.FrameBytes];
        frame[0] = 17;
        frame[^1] = 29;
        var source = new Cs9711DirectFingerprintCaptureSource("terminal-a", () => frame);

        var sample = await source.CaptureAsync(CancellationToken.None);

        Assert.Equal("terminal-a", source.TerminalId);
        Assert.Equal(500, sample.Dpi);
        Assert.Equal(Cs9711Protocol.ImageWidth, sample.Width);
        Assert.Equal(Cs9711Protocol.ImageHeight, sample.Height);
        Assert.Equal(frame, sample.Pixels);
    }
}
