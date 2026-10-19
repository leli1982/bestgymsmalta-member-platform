using System.ComponentModel;
using System.Runtime.InteropServices;

namespace Bgm.StaffBiometricService.Biometric;

public sealed class WinBioFingerprintCaptureSource : IFingerprintCaptureSource
{
    private const uint WinBioTypeFingerprint = 0x00000008;
    private const uint WinBioPoolSystem = 1;
    private const uint WinBioFlagRaw = 0x00000001;
    private const byte WinBioPurposeIdentify = 0x02;
    private const byte WinBioDataFlagRaw = 0x20;
    private static readonly IntPtr WinBioDbDefault = new(1);

    public string TerminalId { get; }

    public WinBioFingerprintCaptureSource(string terminalId)
    {
        TerminalId = string.IsNullOrWhiteSpace(terminalId) ? Environment.MachineName : terminalId.Trim();
    }

    public Task<FingerprintSample> CaptureAsync(CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        return Task.FromResult(Capture());
    }

    private static FingerprintSample Capture()
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

            uint unitId;
            UIntPtr sampleSize;
            uint rejectDetail;
            ThrowIfFailed(WinBioCaptureSample(
                session,
                WinBioPurposeIdentify,
                WinBioDataFlagRaw,
                out unitId,
                out sample,
                out sampleSize,
                out rejectDetail), "WinBioCaptureSample", rejectDetail);

            if (sample == IntPtr.Zero || sampleSize == UIntPtr.Zero)
                throw new BiometricDeviceException("Windows returned an empty fingerprint sample.");

            return ParseAnsi381(sample, checked((int)sampleSize.ToUInt64()));
        }
        catch (BiometricDeviceException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new BiometricDeviceException("Fingerprint capture failed.", ex);
        }
        finally
        {
            if (sample != IntPtr.Zero) WinBioFree(sample);
            if (session != 0) WinBioCloseSession(session);
        }
    }

    private static FingerprintSample ParseAnsi381(IntPtr birPointer, int totalSize)
    {
        var bir = Marshal.PtrToStructure<WinBioBir>(birPointer);
        if (bir.StandardDataBlock.Size == 0)
            throw new BiometricDeviceException("The reader did not return an ANSI 381 standard data block.");
        if ((ulong)bir.StandardDataBlock.Offset + bir.StandardDataBlock.Size > (ulong)totalSize)
            throw new BiometricDeviceException("The fingerprint sample block is outside the returned buffer.");

        var headerSize = Marshal.SizeOf<Ansi381Header>();
        var recordHeaderSize = Marshal.SizeOf<Ansi381Record>();
        if (bir.StandardDataBlock.Size < headerSize + recordHeaderSize)
            throw new BiometricDeviceException("The ANSI 381 standard data block is too small.");

        var standard = IntPtr.Add(birPointer, checked((int)bir.StandardDataBlock.Offset));
        var header = Marshal.PtrToStructure<Ansi381Header>(standard);
        if (header.ElementCount < 1)
            throw new BiometricDeviceException("The fingerprint sample contains no image record.");
        if (header.PixelDepth != 8)
            throw new BiometricDeviceException($"Unsupported fingerprint pixel depth {header.PixelDepth}; expected 8-bit grayscale.");
        if (header.ImageCompressionAlg != 0)
            throw new BiometricDeviceException($"Unsupported ANSI 381 image compression code {header.ImageCompressionAlg}; the capability probe requires uncompressed raw capture.");

        var recordPtr = IntPtr.Add(standard, headerSize);
        var record = Marshal.PtrToStructure<Ansi381Record>(recordPtr);
        if (record.BlockLength < recordHeaderSize || record.BlockLength > bir.StandardDataBlock.Size - headerSize)
            throw new BiometricDeviceException("ANSI 381 fingerprint record length is invalid.");

        var imageBytes = checked((int)record.BlockLength - recordHeaderSize);
        var expected = checked((int)record.HorizontalLineLength * record.VerticalLineLength);
        if (imageBytes < expected || expected <= 0)
            throw new BiometricDeviceException("ANSI 381 fingerprint image dimensions are invalid.");

        var pixels = new byte[expected];
        Marshal.Copy(IntPtr.Add(recordPtr, recordHeaderSize), pixels, 0, pixels.Length);
        var dpi = header.ScaleUnits switch
        {
            1 when header.HorizontalImageResolution > 0 => header.HorizontalImageResolution,
            2 when header.HorizontalImageResolution > 0 => (int)Math.Round(header.HorizontalImageResolution * 2.54),
            _ => 500,
        };

        return new FingerprintSample(pixels, dpi, record.HorizontalLineLength, record.VerticalLineLength);
    }

    private static void ThrowIfFailed(int hresult, string operation, uint rejectDetail = 0)
    {
        if (hresult >= 0) return;
        var detail = rejectDetail == 0 ? "" : $" Reject detail: 0x{rejectDetail:X}.";
        throw new BiometricDeviceException($"{operation} failed with HRESULT 0x{hresult:X8}.{detail}", new Win32Exception(hresult));
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WinBioBirData { public uint Size; public uint Offset; }

    [StructLayout(LayoutKind.Sequential)]
    private struct WinBioBir
    {
        public WinBioBirData HeaderBlock;
        public WinBioBirData StandardDataBlock;
        public WinBioBirData VendorDataBlock;
        public WinBioBirData SignatureBlock;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    private struct RegisteredFormat { public ushort Owner; public ushort Type; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    private struct Ansi381Header
    {
        public ulong RecordLength;
        public uint FormatIdentifier;
        public uint VersionNumber;
        public RegisteredFormat ProductId;
        public ushort CaptureDeviceId;
        public ushort ImageAcquisitionLevel;
        public ushort HorizontalScanResolution;
        public ushort VerticalScanResolution;
        public ushort HorizontalImageResolution;
        public ushort VerticalImageResolution;
        public byte ElementCount;
        public byte ScaleUnits;
        public byte PixelDepth;
        public byte ImageCompressionAlg;
        public ushort Reserved;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    private struct Ansi381Record
    {
        public uint BlockLength;
        public ushort HorizontalLineLength;
        public ushort VerticalLineLength;
        public byte Position;
        public byte CountOfViews;
        public byte ViewNumber;
        public byte ImageQuality;
        public byte ImpressionType;
        public byte Reserved;
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
