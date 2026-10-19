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
    public void Accepts_only_complete_cs9711_frame()
    {
        var frame = new byte[Cs9711Protocol.FrameBytes];

        Cs9711Protocol.ValidateFrame(frame);

        Assert.Throws<InvalidDataException>(() => Cs9711Protocol.ValidateFrame(new byte[Cs9711Protocol.FrameBytes - 1]));
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
}
