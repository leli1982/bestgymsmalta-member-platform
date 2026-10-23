using System.ComponentModel;
using System.Runtime.InteropServices;

namespace Bgm.StaffBiometricService.Biometric;

public sealed record WinBioProcessedCaptureMetadata(
    uint UnitId,
    uint TotalBirBytes,
    uint HeaderBlockBytes,
    uint StandardBlockBytes,
    uint VendorBlockBytes,
    uint SignatureBlockBytes,
    byte Purpose,
    byte DataFlags,
    uint RejectDetail);

public static class WinBioProcessedCaptureProbe
{
    private const uint WinBioTypeFingerprint = 0x00000008;
    private const uint WinBioPoolSystem = 1;
    private const uint WinBioFlagRaw = 0x00000001;
    private const byte WinBioPurposeIdentify = 0x02;
    public const byte ProcessedDataFlag = 0x80;
    private static readonly IntPtr WinBioDbDefault = new(1);

    public static WinBioProcessedCaptureMetadata Capture()
    {
        uint session = 0;
        IntPtr sample = IntPtr.Zero;

        try
        {
            ThrowIfFailed(WinBioOpenSession(
                WinBioTypeFingerprint,
                WinBioPoolSystem,
                WinBioFlagRaw,
                IntPtr.Zero,
                UIntPtr.Zero,
                WinBioDbDefault,
                out session), "WinBioOpenSession");

            var rejectDetail = 0u;
            ThrowIfFailed(WinBioCaptureSample(
                session,
                WinBioPurposeIdentify,
                ProcessedDataFlag,
                out var unitId,
                out sample,
                out var sampleSize,
                out rejectDetail), "WinBioCaptureSample(PROCESSED)", rejectDetail);

            if (sample == IntPtr.Zero || sampleSize == UIntPtr.Zero)
                throw new BiometricDeviceException("Windows returned an empty processed fingerprint BIR.");

            var totalBytes = checked((uint)sampleSize.ToUInt64());
            if (totalBytes < Marshal.SizeOf<WinBioBir>())
                throw new BiometricDeviceException("Windows returned a processed fingerprint BIR that is too small.");

            var bir = Marshal.PtrToStructure<WinBioBir>(sample);
            ValidateBlock("header", bir.HeaderBlock, totalBytes);
            ValidateBlock("standard", bir.StandardDataBlock, totalBytes);
            ValidateBlock("vendor", bir.VendorDataBlock, totalBytes);
            ValidateBlock("signature", bir.SignatureBlock, totalBytes);

            return new WinBioProcessedCaptureMetadata(
                unitId,
                totalBytes,
                bir.HeaderBlock.Size,
                bir.StandardDataBlock.Size,
                bir.VendorDataBlock.Size,
                bir.SignatureBlock.Size,
                WinBioPurposeIdentify,
                ProcessedDataFlag,
                rejectDetail);
        }
        catch (BiometricDeviceException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new BiometricDeviceException("Processed fingerprint capability probe failed.", ex);
        }
        finally
        {
            if (sample != IntPtr.Zero) WinBioFree(sample);
            if (session != 0) WinBioCloseSession(session);
        }
    }

    private static void ValidateBlock(string name, WinBioBirData block, uint totalBytes)
    {
        if (block.Size == 0) return;
        var end = (ulong)block.Offset + block.Size;
        if (end > totalBytes)
            throw new BiometricDeviceException($"The processed BIR {name} block is outside the returned buffer.");
    }

    private static void ThrowIfFailed(int hresult, string operation, uint rejectDetail = 0)
    {
        if (hresult >= 0) return;
        var detail = rejectDetail == 0 ? "" : $" Reject detail: 0x{rejectDetail:X}.";
        throw new BiometricDeviceException($"{operation} failed with HRESULT 0x{hresult:X8}.{detail}", new Win32Exception(hresult));
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WinBioBirData
    {
        public uint Size;
        public uint Offset;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WinBioBir
    {
        public WinBioBirData HeaderBlock;
        public WinBioBirData StandardDataBlock;
        public WinBioBirData VendorDataBlock;
        public WinBioBirData SignatureBlock;
    }

    [DllImport("winbio.dll", ExactSpelling = true)]
    private static extern int WinBioOpenSession(
        uint Factor,
        uint PoolType,
        uint Flags,
        IntPtr UnitArray,
        UIntPtr UnitCount,
        IntPtr DatabaseId,
        out uint SessionHandle);

    [DllImport("winbio.dll", ExactSpelling = true)]
    private static extern int WinBioCaptureSample(
        uint SessionHandle,
        byte Purpose,
        byte Flags,
        out uint UnitId,
        out IntPtr Sample,
        out UIntPtr SampleSize,
        out uint RejectDetail);

    [DllImport("winbio.dll", ExactSpelling = true)]
    private static extern int WinBioCloseSession(uint SessionHandle);

    [DllImport("winbio.dll", ExactSpelling = true)]
    private static extern void WinBioFree(IntPtr Address);
}
