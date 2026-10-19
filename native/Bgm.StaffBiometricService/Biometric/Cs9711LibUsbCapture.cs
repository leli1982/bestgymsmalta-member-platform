using System.Runtime.InteropServices;
using System.Security.Cryptography;

namespace Bgm.StaffBiometricService.Biometric;

public sealed class Cs9711LibUsbCapture : IDisposable
{
    private const int Success = 0;
    private const int TimeoutMs = 1000;

    private IntPtr _context;
    private IntPtr _device;
    private bool _claimed;
    private bool _disposed;

    public Cs9711LibUsbCapture()
    {
        var rc = LibUsbInit(out _context);
        if (rc != Success)
            throw new BiometricDeviceException($"libusb_init failed with code {rc}.");

        _device = LibUsbOpenDeviceWithVidPid(_context, Cs9711Protocol.VendorId, Cs9711Protocol.ProductId);
        if (_device == IntPtr.Zero)
            throw new BiometricDeviceException("CS9711/FP100 USB device 2541:0236 was not found through libusb. The reader may still be using the ChipSailing WBF driver instead of WinUSB.");

        rc = LibUsbClaimInterface(_device, Cs9711Protocol.InterfaceNumber);
        if (rc != Success)
            throw new BiometricDeviceException($"libusb_claim_interface failed with code {rc}. The reader likely needs the WinUSB driver for this direct test.");

        _claimed = true;
    }

    public byte[] CaptureFrame()
    {
        ThrowIfDisposed();

        try
        {
            SendCommand(Cs9711Protocol.InitCommand);
            TryReadInitResponse();
            SendCommand(Cs9711Protocol.ScanCommand);

            var frame = new byte[Cs9711Protocol.FrameBytes];
            ReadExact(frame, 0, Cs9711Protocol.FirstChunkBytes);
            ReadExact(frame, Cs9711Protocol.FirstChunkBytes, Cs9711Protocol.TailChunkBytes);
            Cs9711Protocol.ValidateFrame(frame);
            return frame;
        }
        catch
        {
            BestEffortReset();
            throw;
        }
    }

    public void Reset() => BestEffortReset();

    private void SendCommand(byte command)
    {
        var data = Cs9711Protocol.BuildCommand(command);
        var rc = LibUsbBulkTransfer(_device, Cs9711Protocol.EndpointOut, data, data.Length, out var transferred, TimeoutMs);
        if (rc != Success || transferred != data.Length)
            throw new BiometricDeviceException($"CS9711 USB command 0x{command:X2} failed. libusb={rc}, transferred={transferred}/{data.Length}.");
    }

    private void TryReadInitResponse()
    {
        var buffer = new byte[8];
        _ = LibUsbBulkTransfer(_device, Cs9711Protocol.EndpointIn, buffer, buffer.Length, out _, 300);
        CryptographicOperations.ZeroMemory(buffer);
    }

    private void ReadExact(byte[] destination, int offset, int count)
    {
        var remaining = count;
        var cursor = offset;
        var deadline = DateTime.UtcNow.AddSeconds(10);

        while (remaining > 0)
        {
            if (DateTime.UtcNow >= deadline)
                throw new BiometricDeviceException($"Timed out reading CS9711 frame ({count - remaining}/{count} bytes received for this segment).");

            var buffer = new byte[remaining];
            var rc = LibUsbBulkTransfer(_device, Cs9711Protocol.EndpointIn, buffer, buffer.Length, out var transferred, 300);
            if (rc == -7) // LIBUSB_ERROR_TIMEOUT: retry until overall deadline
                continue;
            if (rc != Success)
                throw new BiometricDeviceException($"CS9711 USB read failed with libusb code {rc}.");
            if (transferred <= 0)
                continue;

            Buffer.BlockCopy(buffer, 0, destination, cursor, transferred);
            CryptographicOperations.ZeroMemory(buffer);
            cursor += transferred;
            remaining -= transferred;
        }
    }

    private void BestEffortReset()
    {
        if (_device == IntPtr.Zero) return;
        try { SendCommand(Cs9711Protocol.ResetCommand); } catch { }
    }

    private void ThrowIfDisposed() => ObjectDisposedException.ThrowIf(_disposed, this);

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        BestEffortReset();
        if (_claimed && _device != IntPtr.Zero)
            _ = LibUsbReleaseInterface(_device, Cs9711Protocol.InterfaceNumber);
        if (_device != IntPtr.Zero)
            LibUsbClose(_device);
        if (_context != IntPtr.Zero)
            LibUsbExit(_context);
        _device = IntPtr.Zero;
        _context = IntPtr.Zero;
    }

    [DllImport("libusb-1.0.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "libusb_init")]
    private static extern int LibUsbInit(out IntPtr context);

    [DllImport("libusb-1.0.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "libusb_exit")]
    private static extern void LibUsbExit(IntPtr context);

    [DllImport("libusb-1.0.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "libusb_open_device_with_vid_pid")]
    private static extern IntPtr LibUsbOpenDeviceWithVidPid(IntPtr context, ushort vendorId, ushort productId);

    [DllImport("libusb-1.0.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "libusb_claim_interface")]
    private static extern int LibUsbClaimInterface(IntPtr deviceHandle, int interfaceNumber);

    [DllImport("libusb-1.0.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "libusb_release_interface")]
    private static extern int LibUsbReleaseInterface(IntPtr deviceHandle, int interfaceNumber);

    [DllImport("libusb-1.0.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "libusb_close")]
    private static extern void LibUsbClose(IntPtr deviceHandle);

    [DllImport("libusb-1.0.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "libusb_bulk_transfer")]
    private static extern int LibUsbBulkTransfer(
        IntPtr deviceHandle,
        byte endpoint,
        byte[] data,
        int length,
        out int transferred,
        uint timeout);
}
