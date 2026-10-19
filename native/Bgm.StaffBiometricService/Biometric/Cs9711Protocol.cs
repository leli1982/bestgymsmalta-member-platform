namespace Bgm.StaffBiometricService.Biometric;

public static class Cs9711Protocol
{
    public const ushort VendorId = 0x2541;
    public const ushort ProductId = 0x0236;
    public const int InterfaceNumber = 0;
    public const byte EndpointOut = 0x01;
    public const byte EndpointIn = 0x81;

    public const byte InitCommand = 0x01;
    public const byte ResetCommand = 0x02;
    public const byte ScanCommand = 0x04;

    public const int FirstChunkBytes = 8000;
    public const int TailChunkBytes = 24;
    public const int FrameBytes = FirstChunkBytes + TailChunkBytes;
    public const int ImageWidth = 68;
    public const int ImageHeight = 118;

    public static byte[] BuildCommand(byte command) =>
        new byte[] { 0xEA, command, 0, 0, 0, 0, command, 0xEA };

    public static void ValidateFrame(ReadOnlySpan<byte> frame)
    {
        if (frame.Length != FrameBytes)
            throw new InvalidDataException($"CS9711 frame must be exactly {FrameBytes} bytes; received {frame.Length}.");

        var allZero = true;
        for (var i = 0; i < frame.Length; i++)
        {
            if (frame[i] != 0)
            {
                allZero = false;
                break;
            }
        }

        if (allZero)
            throw new InvalidDataException("CS9711 returned an all-zero frame.");
    }
}
