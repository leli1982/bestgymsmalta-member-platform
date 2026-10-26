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

var command = ProbeCommandCatalog.Parse(args[0]);
if (command == ProbeCommandKind.Unknown)
{
    PrintUsage();
    return 2;
}

if (command == ProbeCommandKind.ProcessedInfo)
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

if (command == ProbeCommandKind.DirectSelfTest)
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

try
{
    if (ProbeCommandCatalog.UsesVendorAlgorithm(command))
    {
        using var algorithm = new ChipSailingAlgorithm();
        var vendorProbe = new VendorPortableBiometricProbe(
            terminalId,
            store,
            captureFrame: () =>
            {
                using var directCapture = new Cs9711LibUsbCapture();
                return directCapture.CaptureFrame();
            },
            createTemplate: algorithm.CreateTemplate,
            matchScore: algorithm.MatchScore);

        if (command is ProbeCommandKind.VendorEnroll or ProbeCommandKind.VendorEnrollMultiView)
        {
            if (args.Length < 3 || string.IsNullOrWhiteSpace(args[2]))
            {
                Console.Error.WriteLine("Vendor enroll requires a test employee ID.");
                return 2;
            }

            if (command == ProbeCommandKind.VendorEnrollMultiView)
            {
                Console.WriteLine("Five-view FP100 vendor enrollment. Use ONE finger for all five captures.");
                Console.WriteLine("No raw fingerprint image will be written to disk.");
                var multiViewEnrollment = await vendorProbe.EnrollMultiViewAsync(
                    args[2].Trim(),
                    WaitForMultiViewCapture,
                    CancellationToken.None);
                Console.WriteLine(JsonSerializer.Serialize(
                    multiViewEnrollment,
                    new JsonSerializerOptions { WriteIndented = true }));
                return 0;
            }

            Console.WriteLine("Place the test finger on the FP100 reader.");
            var enrollmentResult = await vendorProbe.EnrollAsync(args[2].Trim(), CancellationToken.None);
            Console.WriteLine(JsonSerializer.Serialize(enrollmentResult, new JsonSerializerOptions { WriteIndented = true }));
            return 0;
        }

        if (command == ProbeCommandKind.VendorScoreMultiView)
        {
            Console.WriteLine("Place the enrolled finger on the FP100 reader once.");
            var multiViewScore = await vendorProbe.ScoreMultiViewAsync(CancellationToken.None);
            Console.WriteLine(JsonSerializer.Serialize(
                multiViewScore,
                new JsonSerializerOptions { WriteIndented = true }));
            return multiViewScore.Success ? 0 : 11;
        }

        Console.WriteLine("Place a finger on the FP100 reader.");
        var scoreResult = await vendorProbe.ScoreAsync(CancellationToken.None);
        Console.WriteLine(JsonSerializer.Serialize(scoreResult, new JsonSerializerOptions { WriteIndented = true }));
        return scoreResult.Success ? 0 : 11;
    }

    var capture = new Cs9711DirectFingerprintCaptureSource(terminalId);
    var matcher = new SourceAfisFingerprintMatcher(40);
    var engine = new PortableBiometricEngine(capture, store, matcher);
    var probe = new Fp100CapabilityProbe(engine, terminalId);

    Fp100CapabilityProbeResult result;
    switch (command)
    {
        case ProbeCommandKind.SourceAfisEnroll:
            if (args.Length < 3 || string.IsNullOrWhiteSpace(args[2]))
            {
                Console.Error.WriteLine("Enroll requires a test employee ID.");
                return 2;
            }
            Console.WriteLine("Place the test finger on the FP100 reader.");
            result = await probe.EnrollAsync(args[2].Trim(), CancellationToken.None);
            break;

        case ProbeCommandKind.SourceAfisIdentify:
            Console.WriteLine("Place a finger on the FP100 reader.");
            result = await probe.IdentifyAsync(CancellationToken.None);
            break;

        case ProbeCommandKind.Revoke:
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

static void WaitForMultiViewCapture(string prompt)
{
    Console.WriteLine();
    Console.WriteLine(prompt);
    Console.WriteLine("Keep the finger OFF the reader while you reposition it.");
    Console.Write("Press ENTER when ready, then place the finger on the FP100 reader: ");
    Console.ReadLine();
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
    foreach (var line in ProbeCommandCatalog.UsageLines)
        Console.WriteLine($"  {line}");
    Console.WriteLine();
    Console.WriteLine("processed-info reports only WBF metadata and never persists fingerprint sample bytes.");
    Console.WriteLine("direct-selftest bypasses WBF and uses direct USB + CSAlgDll.dll with all biometric bytes kept in memory only.");
    Console.WriteLine("enroll/identify are the earlier SourceAFIS diagnostic path.");
    Console.WriteLine("vendor-enroll/vendor-score keep the earlier single-view ChipSailing diagnostic path.");
    Console.WriteLine("vendor-enroll-multiview captures five guided views of ONE finger into one encrypted credential bundle.");
    Console.WriteLine("vendor-score-multiview captures ONE live touch and reports the raw score against every enrolled view plus the best view.");
    Console.WriteLine("Vendor scoring reports raw scores only; this capability gate deliberately applies no acceptance threshold.");
    Console.WriteLine("Raw fingerprint frames are never persisted. The encrypted credential contains derived vendor templates only.");
}
