using System.Text.Json;
using Bgm.StaffBiometricService.Biometric;

if (!OperatingSystem.IsWindows())
{
    Console.Error.WriteLine("This capability probe only runs on Windows.");
    return 2;
}

if (args.Length < 1)
{
    PrintUsage();
    return 2;
}

var command = args[0].Trim().ToLowerInvariant();

if (command == "processed-info")
{
    try
    {
        Console.WriteLine("Place a test finger on the FP100 reader. No fingerprint bytes will be saved.");
        var metadata = WinBioProcessedCaptureProbe.Capture();
        Console.WriteLine(JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true }));
        return 0;
    }
    catch (BiometricDeviceException ex)
    {
        Console.Error.WriteLine($"DEVICE_ERROR: {ex.Message}");
        return 20;
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"PROBE_ERROR: {ex.GetType().Name}: {ex.Message}");
        return 40;
    }
}

if (command == "direct-selftest")
{
    try
    {
        Console.WriteLine("BGM CS9711 direct USB + ChipSailing vendor algorithm self-test.");
        Console.WriteLine("No fingerprint image or template bytes are written to disk.");
        var result = Cs9711DirectSelfTest.Run();
        Console.WriteLine(JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
        return 0;
    }
    catch (DllNotFoundException ex)
    {
        Console.Error.WriteLine($"DIRECT_USB_SETUP_ERROR: {ex.Message}");
        return 21;
    }
    catch (BiometricDeviceException ex)
    {
        Console.Error.WriteLine($"DEVICE_ERROR: {ex.Message}");
        return 20;
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"PROBE_ERROR: {ex.GetType().Name}: {ex.Message}");
        return 40;
    }
}

if (args.Length < 2)
{
    PrintUsage();
    return 2;
}

var credentialFile = Path.GetFullPath(args[1]);
var terminalId = Environment.MachineName;
var passphrase = ReadSecret("Portable credential passphrase: ");
if (string.IsNullOrWhiteSpace(passphrase))
{
    Console.Error.WriteLine("A passphrase is required.");
    return 2;
}

var store = new EncryptedCredentialFileStore(credentialFile, passphrase);
var capture = new Cs9711DirectFingerprintCaptureSource(terminalId);
var matcher = new SourceAfisFingerprintMatcher(40);
var engine = new PortableBiometricEngine(capture, store, matcher);
var probe = new Fp100CapabilityProbe(engine, terminalId);

try
{
    Fp100CapabilityProbeResult result;
    switch (command)
    {
        case "enroll":
            if (args.Length < 3 || string.IsNullOrWhiteSpace(args[2]))
            {
                Console.Error.WriteLine("Enroll requires a test employee ID.");
                return 2;
            }
            Console.WriteLine("Place the test finger on the FP100 reader.");
            result = await probe.EnrollAsync(args[2].Trim(), CancellationToken.None);
            break;

        case "identify":
            Console.WriteLine("Place a finger on the FP100 reader.");
            result = await probe.IdentifyAsync(CancellationToken.None);
            break;

        case "revoke":
            if (args.Length < 3 || string.IsNullOrWhiteSpace(args[2]))
            {
                Console.Error.WriteLine("Revoke requires the opaque credential ID printed during enrollment.");
                return 2;
            }
            result = await probe.RevokeAsync(args[2].Trim(), CancellationToken.None);
            break;

        default:
            PrintUsage();
            return 2;
    }

    Console.WriteLine(JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
    return 0;
}
catch (BiometricNoMatchException ex)
{
    Console.Error.WriteLine($"NO_MATCH: {ex.Message}");
    return 10;
}
catch (DllNotFoundException ex)
{
    Console.Error.WriteLine($"DIRECT_USB_SETUP_ERROR: {ex.Message}");
    return 21;
}
catch (BiometricDeviceException ex)
{
    Console.Error.WriteLine($"DEVICE_ERROR: {ex.Message}");
    return 20;
}
catch (InvalidDataException ex)
{
    Console.Error.WriteLine($"CREDENTIAL_FILE_ERROR: {ex.Message}");
    return 30;
}
catch (Exception ex)
{
    Console.Error.WriteLine($"PROBE_ERROR: {ex.GetType().Name}: {ex.Message}");
    return 40;
}

static string ReadSecret(string prompt)
{
    Console.Write(prompt);
    var chars = new List<char>();
    while (true)
    {
        var key = Console.ReadKey(intercept: true);
        if (key.Key == ConsoleKey.Enter)
        {
            Console.WriteLine();
            return new string(chars.ToArray());
        }
        if (key.Key == ConsoleKey.Backspace)
        {
            if (chars.Count > 0) chars.RemoveAt(chars.Count - 1);
            continue;
        }
        if (!char.IsControl(key.KeyChar)) chars.Add(key.KeyChar);
    }
}

static void PrintUsage()
{
    Console.WriteLine("BGM FP100 cross-PC capability probe");
    Console.WriteLine("Run from an elevated Administrator Command Prompt or PowerShell.");
    Console.WriteLine();
    Console.WriteLine("  Bgm.StaffBiometricService.exe processed-info");
    Console.WriteLine("  Bgm.StaffBiometricService.exe direct-selftest");
    Console.WriteLine("  Bgm.StaffBiometricService.exe enroll   <credential-file> <test-employee-id>");
    Console.WriteLine("  Bgm.StaffBiometricService.exe identify <credential-file>");
    Console.WriteLine("  Bgm.StaffBiometricService.exe revoke   <credential-file> <credential-id>");
    Console.WriteLine();
    Console.WriteLine("processed-info reports only WBF metadata and never persists fingerprint sample bytes.");
    Console.WriteLine("direct-selftest bypasses WBF, uses direct USB + CSAlgDll.dll, and keeps all biometric bytes in memory only.");
    Console.WriteLine("enroll/identify use direct WinUSB capture plus SourceAFIS portable matching; raw frames are never written to disk.");
    Console.WriteLine("The credential file is encrypted and contains a portable fingerprint feature template, not a raw fingerprint image.");
}
