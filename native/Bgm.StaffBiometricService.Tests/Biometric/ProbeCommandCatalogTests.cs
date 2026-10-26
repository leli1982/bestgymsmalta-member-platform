using Bgm.StaffBiometricService.Biometric;
using Xunit;

namespace Bgm.StaffBiometricService.Tests.Biometric;

public sealed class ProbeCommandCatalogTests
{
    [Theory]
    [InlineData("vendor-enroll", ProbeCommandKind.VendorEnroll)]
    [InlineData("VENDOR-SCORE", ProbeCommandKind.VendorScore)]
    [InlineData("enroll", ProbeCommandKind.SourceAfisEnroll)]
    [InlineData("identify", ProbeCommandKind.SourceAfisIdentify)]
    [InlineData("revoke", ProbeCommandKind.Revoke)]
    public void Parses_portability_commands_without_confusing_vendor_and_sourceafis_paths(
        string command,
        ProbeCommandKind expected)
    {
        Assert.Equal(expected, ProbeCommandCatalog.Parse(command));
    }

    [Fact]
    public void Vendor_commands_are_explicitly_marked_as_vendor_algorithm_commands()
    {
        Assert.True(ProbeCommandCatalog.UsesVendorAlgorithm(ProbeCommandKind.VendorEnroll));
        Assert.True(ProbeCommandCatalog.UsesVendorAlgorithm(ProbeCommandKind.VendorScore));
        Assert.False(ProbeCommandCatalog.UsesVendorAlgorithm(ProbeCommandKind.SourceAfisEnroll));
        Assert.False(ProbeCommandCatalog.UsesVendorAlgorithm(ProbeCommandKind.SourceAfisIdentify));
        Assert.False(ProbeCommandCatalog.UsesVendorAlgorithm(ProbeCommandKind.Revoke));
    }

    [Fact]
    public void Usage_text_exposes_vendor_enroll_and_vendor_score()
    {
        var usage = string.Join("\n", ProbeCommandCatalog.UsageLines);

        Assert.Contains("vendor-enroll <credential-file> <test-employee-id>", usage);
        Assert.Contains("vendor-score  <credential-file>", usage);
    }
}
