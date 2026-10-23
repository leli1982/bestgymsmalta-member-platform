using Bgm.StaffBiometricService.Biometric;
using Xunit;

namespace Bgm.StaffBiometricService.Tests.Biometric;

public sealed class WinBioProcessedCaptureProbeTests
{
    [Fact]
    public void Processed_capture_metadata_never_contains_sample_bytes()
    {
        var metadata = new WinBioProcessedCaptureMetadata(
            UnitId: 3,
            TotalBirBytes: 2048,
            HeaderBlockBytes: 48,
            StandardBlockBytes: 1536,
            VendorBlockBytes: 256,
            SignatureBlockBytes: 0,
            Purpose: 0x02,
            DataFlags: WinBioProcessedCaptureProbe.ProcessedDataFlag,
            RejectDetail: 0);

        Assert.Equal((byte)0x80, metadata.DataFlags);
        Assert.Equal(1536u, metadata.StandardBlockBytes);
        Assert.Equal(256u, metadata.VendorBlockBytes);
        Assert.DoesNotContain("Sample", metadata.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Processed_capture_flag_is_the_WBF_processed_flag()
    {
        Assert.Equal((byte)0x80, WinBioProcessedCaptureProbe.ProcessedDataFlag);
    }
}
