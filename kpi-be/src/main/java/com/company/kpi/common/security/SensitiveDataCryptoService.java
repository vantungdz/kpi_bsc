package com.company.kpi.common.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Base64;
import java.util.Set;

/**
 * Common service để mã hóa/giải mã dữ liệu nhạy cảm.
 * Dùng AES/GCM/NoPadding + prefix để hỗ trợ backward compatibility.
 */
@Service
@RequiredArgsConstructor
public class SensitiveDataCryptoService {

    private static final String CIPHER_ALGO = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int IV_LENGTH_BYTES = 12;
    private static final String PREFIX = "enc:v1:";
    private static final Set<String> EVIDENCE_SENSITIVE_KEYS = Set.of(
            "note",
            "text",
            "memberFeedback",
            "leaderFeedback",
            "gmComment",
            "certificateOutcomeNote");

    private final ObjectMapper objectMapper;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.security.encryption-key:${APP_DATA_ENCRYPTION_KEY:}}")
    private String configuredKey;
    @Value("${app.security.score.factor:111}")
    private BigDecimal scoreFactor;
    @Value("${app.security.score.offset:222}")
    private BigDecimal scoreOffset;
    @Value("${app.security.score.threshold:5}")
    private BigDecimal scoreEncryptedThreshold;

    public String encrypt(String plainText) {
        if (plainText == null) {
            return null;
        }
        String value = plainText.trim();
        if (value.isEmpty()) {
            return plainText;
        }
        if (isEncrypted(value)) {
            return value;
        }
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
            cipher.init(
                    Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(normalizeKey(configuredKey), "AES"),
                    new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));

            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            byte[] packed = ByteBuffer.allocate(iv.length + encrypted.length)
                    .put(iv)
                    .put(encrypted)
                    .array();
            return PREFIX + Base64.getEncoder().encodeToString(packed);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not encrypt sensitive payload", ex);
        }
    }

    public String decrypt(String cipherText) {
        if (cipherText == null) {
            return null;
        }
        if (!isEncrypted(cipherText)) {
            return cipherText;
        }
        try {
            String payload = cipherText.substring(PREFIX.length());
            byte[] packed = Base64.getDecoder().decode(payload);
            byte[] iv = new byte[IV_LENGTH_BYTES];
            byte[] encrypted = new byte[packed.length - IV_LENGTH_BYTES];
            System.arraycopy(packed, 0, iv, 0, IV_LENGTH_BYTES);
            System.arraycopy(packed, IV_LENGTH_BYTES, encrypted, 0, encrypted.length);

            Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    new SecretKeySpec(normalizeKey(configuredKey), "AES"),
                    new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));

            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not decrypt sensitive payload", ex);
        }
    }

    public String decryptIfEncrypted(String value) {
        if (value == null) {
            return null;
        }
        return isEncrypted(value) ? decrypt(value) : value;
    }

    public String encryptEvidenceSensitiveFields(String evidencesJson) {
        return transformEvidenceSensitiveFields(evidencesJson, true);
    }

    public String decryptEvidenceSensitiveFields(String evidencesJson) {
        return transformEvidenceSensitiveFields(evidencesJson, false);
    }

    /**
     * Numeric score encryption in-place for existing numeric columns:
     * encrypted = value * factor + offset
     */
    public BigDecimal encryptScore(BigDecimal plainScore) {
        if (plainScore == null) {
            return null;
        }
        // already encrypted / out-of-band value
        if (plainScore.compareTo(scoreEncryptedThreshold) > 0) {
            return plainScore;
        }
        return plainScore.multiply(scoreFactor).add(scoreOffset).setScale(6, RoundingMode.HALF_UP);
    }

    /**
     * Reverse numeric score encryption.
     * Legacy plaintext values (<= threshold) are returned as-is for compatibility.
     */
    public BigDecimal decryptScore(BigDecimal encryptedScore) {
        if (encryptedScore == null) {
            return null;
        }
        if (encryptedScore.compareTo(scoreEncryptedThreshold) <= 0) {
            return encryptedScore;
        }
        return encryptedScore.subtract(scoreOffset).divide(scoreFactor, 6, RoundingMode.HALF_UP);
    }

    private String transformEvidenceSensitiveFields(String evidencesJson, boolean encrypt) {
        if (StringUtils.isBlank(evidencesJson)) {
            return evidencesJson;
        }
        String raw = evidencesJson.trim();
        if (!raw.startsWith("{")) {
            return evidencesJson;
        }
        try {
            JsonNode root = objectMapper.readTree(raw);
            if (!(root instanceof ObjectNode objectNode)) {
                return evidencesJson;
            }
            for (String key : EVIDENCE_SENSITIVE_KEYS) {
                JsonNode n = objectNode.get(key);
                if (n == null || n.isNull() || !n.isTextual()) {
                    continue;
                }
                String value = n.asText();
                if (StringUtils.isBlank(value)) {
                    continue;
                }
                objectNode.put(key, encrypt ? encrypt(value) : decryptIfEncrypted(value));
            }
            return objectMapper.writeValueAsString(objectNode);
        } catch (Exception ignore) {
            return evidencesJson;
        }
    }

    private static boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX);
    }

    private static byte[] normalizeKey(String rawKey) throws Exception {
        if (StringUtils.isBlank(rawKey)) {
            throw new IllegalStateException(
                    "Missing APP_DATA_ENCRYPTION_KEY. Please define it in environment before starting backend.");
        }
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return digest.digest(rawKey.getBytes(StandardCharsets.UTF_8));
    }
}
