using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Bgm.StaffBiometricService.Biometric;

public sealed class EncryptedCredentialFileStore(string path, string passphrase) : IPortableCredentialStore
{
    private const int Iterations = 200_000;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = false };

    public async Task<IReadOnlyList<PortableBiometricCredential>> GetAllAsync(CancellationToken ct)
    {
        if (!File.Exists(path)) return Array.Empty<PortableBiometricCredential>();
        var envelope = JsonSerializer.Deserialize<Envelope>(await File.ReadAllTextAsync(path, ct), JsonOptions)
            ?? throw new InvalidDataException("Credential file is invalid.");
        var plaintext = Decrypt(envelope);
        try
        {
            return JsonSerializer.Deserialize<List<PortableBiometricCredential>>(plaintext, JsonOptions)
                ?? new List<PortableBiometricCredential>();
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public async Task SaveAsync(PortableBiometricCredential credential, CancellationToken ct)
    {
        var all = (await GetAllAsync(ct)).ToList();
        var index = all.FindIndex(c => c.CredentialId == credential.CredentialId);
        if (index >= 0) all[index] = credential; else all.Add(credential);
        await WriteAsync(all, ct);
    }

    public async Task RevokeAsync(string credentialId, CancellationToken ct)
    {
        var all = (await GetAllAsync(ct)).ToList();
        var index = all.FindIndex(c => c.CredentialId == credentialId);
        if (index < 0) return;
        all[index] = all[index] with { Active = false, RevokedAtUtc = DateTimeOffset.UtcNow };
        await WriteAsync(all, ct);
    }

    private async Task WriteAsync(List<PortableBiometricCredential> credentials, CancellationToken ct)
    {
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(credentials, JsonOptions);
        try
        {
            var salt = RandomNumberGenerator.GetBytes(16);
            var nonce = RandomNumberGenerator.GetBytes(12);
            var key = Rfc2898DeriveBytes.Pbkdf2(passphrase, salt, Iterations, HashAlgorithmName.SHA256, 32);
            var ciphertext = new byte[plaintext.Length];
            var tag = new byte[16];
            try
            {
                using var aes = new AesGcm(key, tag.Length);
                aes.Encrypt(nonce, plaintext, ciphertext, tag);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(key);
            }
            var envelope = new Envelope(
                Version: 1,
                Kdf: "PBKDF2-SHA256",
                Iterations: Iterations,
                Salt: Convert.ToBase64String(salt),
                Nonce: Convert.ToBase64String(nonce),
                Ciphertext: Convert.ToBase64String(ciphertext),
                Tag: Convert.ToBase64String(tag));
            await File.WriteAllTextAsync(path, JsonSerializer.Serialize(envelope, JsonOptions), Encoding.UTF8, ct);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    private byte[] Decrypt(Envelope envelope)
    {
        if (envelope.Version != 1 || envelope.Kdf != "PBKDF2-SHA256")
            throw new InvalidDataException("Unsupported credential file format.");
        var salt = Convert.FromBase64String(envelope.Salt);
        var nonce = Convert.FromBase64String(envelope.Nonce);
        var ciphertext = Convert.FromBase64String(envelope.Ciphertext);
        var tag = Convert.FromBase64String(envelope.Tag);
        var key = Rfc2898DeriveBytes.Pbkdf2(passphrase, salt, envelope.Iterations, HashAlgorithmName.SHA256, 32);
        var plaintext = new byte[ciphertext.Length];
        try
        {
            using var aes = new AesGcm(key, tag.Length);
            aes.Decrypt(nonce, ciphertext, tag, plaintext);
            return plaintext;
        }
        catch (CryptographicException ex)
        {
            CryptographicOperations.ZeroMemory(plaintext);
            throw new InvalidDataException("Credential file could not be decrypted. Check the passphrase.", ex);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
        }
    }

    private sealed record Envelope(int Version, string Kdf, int Iterations, string Salt, string Nonce, string Ciphertext, string Tag);
}
