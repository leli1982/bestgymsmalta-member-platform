using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace Bgm.StaffBiometricService.Biometric;

public sealed record ChipSailingTemplateResult(
    byte[] Template,
    short ReturnCode,
    int MetricOffset4,
    int QualityOffset12,
    string AlgorithmVersion);

public sealed class ChipSailingAlgorithm : IDisposable
{
    public const int TemplateBytes = 0x3CF0; // 15,600 bytes; observed allocation in EngineAdapter.dll
    public const int TemplateInfoBytes = 40;
    public const int AlgorithmMode = 3; // exact mode selected for the 8,024-byte CS9711 frame path
    public const string ExpectedDllSha256 = "D497368D427DE6F3BB9301B1401A152E4B15EABD83913CA3888C8C58BE08E0FE";

    private readonly IntPtr _module;
    private readonly InitDelegate _init;
    private readonly GetAlgVersionDelegate _getVersion;
    private readonly CreateTemplateDelegate _createTemplate;
    private readonly MatchScoreDelegate _matchScore;
    private bool _disposed;

    public ChipSailingAlgorithm()
    {
        var dllPath = Path.Combine(Environment.SystemDirectory, "CSAlgDll.dll");
        if (!File.Exists(dllPath))
            throw new BiometricDeviceException($"ChipSailing algorithm DLL not found at {dllPath}.");

        var actualHash = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(dllPath)));
        if (!actualHash.Equals(ExpectedDllSha256, StringComparison.OrdinalIgnoreCase))
            throw new BiometricDeviceException(
                $"Unexpected CSAlgDll.dll build. Expected SHA256 {ExpectedDllSha256}, found {actualHash}. Refusing to guess a vendor ABI.");

        _module = NativeLibrary.Load(dllPath);
        _init = GetExport<InitDelegate>("ChipSailing_Init");
        _getVersion = GetExport<GetAlgVersionDelegate>("ChipSailing_GetAlgVersion");
        _createTemplate = GetExport<CreateTemplateDelegate>("ChipSailing_CreateTemplate");
        _matchScore = GetExport<MatchScoreDelegate>("ChipSailing_MatchScore");

        var initResult = _init(IntPtr.Zero, IntPtr.Zero, AlgorithmMode);
        if (initResult != 0)
            throw new BiometricDeviceException($"ChipSailing_Init returned {initResult}; expected 0.");
    }

    public string GetAlgorithmVersion()
    {
        ThrowIfDisposed();
        var bytes = new byte[28];
        var handle = GCHandle.Alloc(bytes, GCHandleType.Pinned);
        try
        {
            _getVersion(handle.AddrOfPinnedObject());
            var length = Array.IndexOf(bytes, (byte)0);
            if (length < 0) length = bytes.Length;
            return Encoding.ASCII.GetString(bytes, 0, length);
        }
        finally
        {
            handle.Free();
            CryptographicOperations.ZeroMemory(bytes);
        }
    }

    public ChipSailingTemplateResult CreateTemplate(byte[] frame)
    {
        ThrowIfDisposed();
        ArgumentNullException.ThrowIfNull(frame);
        Cs9711Protocol.ValidateFrame(frame);

        var template = new byte[TemplateBytes];
        var info = new byte[TemplateInfoBytes];
        var imageHandle = GCHandle.Alloc(frame, GCHandleType.Pinned);
        var templateHandle = GCHandle.Alloc(template, GCHandleType.Pinned);
        var infoHandle = GCHandle.Alloc(info, GCHandleType.Pinned);

        try
        {
            var result = _createTemplate(
                imageHandle.AddrOfPinnedObject(),
                Cs9711Protocol.ImageWidth,
                Cs9711Protocol.ImageHeight,
                templateHandle.AddrOfPinnedObject(),
                infoHandle.AddrOfPinnedObject());

            if (result != 1)
            {
                CryptographicOperations.ZeroMemory(template);
                throw new BiometricDeviceException($"ChipSailing_CreateTemplate returned {result}; expected 1.");
            }

            var metric4 = BitConverter.ToInt32(info, 4);
            var quality12 = BitConverter.ToInt32(info, 12);
            return new ChipSailingTemplateResult(template, result, metric4, quality12, GetAlgorithmVersion());
        }
        finally
        {
            imageHandle.Free();
            templateHandle.Free();
            infoHandle.Free();
            CryptographicOperations.ZeroMemory(info);
        }
    }

    public short MatchScore(byte[] firstTemplate, byte[] secondTemplate)
    {
        ThrowIfDisposed();
        ValidateTemplate(firstTemplate, nameof(firstTemplate));
        ValidateTemplate(secondTemplate, nameof(secondTemplate));

        var firstHandle = GCHandle.Alloc(firstTemplate, GCHandleType.Pinned);
        var secondHandle = GCHandle.Alloc(secondTemplate, GCHandleType.Pinned);
        try
        {
            return _matchScore(firstHandle.AddrOfPinnedObject(), secondHandle.AddrOfPinnedObject());
        }
        finally
        {
            firstHandle.Free();
            secondHandle.Free();
        }
    }

    private static void ValidateTemplate(byte[] template, string paramName)
    {
        ArgumentNullException.ThrowIfNull(template, paramName);
        if (template.Length != TemplateBytes)
            throw new ArgumentException($"ChipSailing template must be exactly {TemplateBytes} bytes.", paramName);
    }

    private T GetExport<T>(string name) where T : Delegate
    {
        var address = NativeLibrary.GetExport(_module, name);
        return Marshal.GetDelegateForFunctionPointer<T>(address);
    }

    private void ThrowIfDisposed()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        if (_module != IntPtr.Zero) NativeLibrary.Free(_module);
    }

    [UnmanagedFunctionPointer(CallingConvention.Winapi)]
    private delegate int InitDelegate(IntPtr unused1, IntPtr unused2, int mode);

    [UnmanagedFunctionPointer(CallingConvention.Winapi)]
    private delegate void GetAlgVersionDelegate(IntPtr destination);

    [UnmanagedFunctionPointer(CallingConvention.Winapi)]
    private delegate short CreateTemplateDelegate(
        IntPtr image,
        ushort width,
        ushort height,
        IntPtr template,
        IntPtr templateInfo);

    [UnmanagedFunctionPointer(CallingConvention.Winapi)]
    private delegate short MatchScoreDelegate(IntPtr firstTemplate, IntPtr secondTemplate);
}
