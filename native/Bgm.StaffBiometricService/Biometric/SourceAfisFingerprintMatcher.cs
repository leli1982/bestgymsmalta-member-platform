using SourceAFIS;

namespace Bgm.StaffBiometricService.Biometric;

public sealed class SourceAfisFingerprintMatcher(double threshold = 40) : IPortableFingerprintMatcher
{
    public byte[] CreateTemplate(FingerprintSample sample)
    {
        if (sample.Width <= 0 || sample.Height <= 0)
            throw new ArgumentException("Fingerprint sample dimensions are required.", nameof(sample));
        if (sample.Pixels.Length != sample.Width * sample.Height)
            throw new ArgumentException("Fingerprint pixel buffer size does not match dimensions.", nameof(sample));

        var options = new FingerprintImageOptions { Dpi = sample.Dpi };
        var image = new FingerprintImage(sample.Width, sample.Height, sample.Pixels, options);
        return new FingerprintTemplate(image).ToByteArray();
    }

    public double Match(byte[] probeTemplate, byte[] candidateTemplate)
    {
        var probe = new FingerprintTemplate(probeTemplate);
        var candidate = new FingerprintTemplate(candidateTemplate);
        return new FingerprintMatcher(probe).Match(candidate);
    }

    public bool IsMatch(double score) => score >= threshold;
}
