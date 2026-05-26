package com.company.kpi.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Snapshot điểm/actual giữa kỳ đã GM duyệt — lưu trong {@code kpi_assignments.evidences.approvedMidYearSnapshot}.
 */
public final class ApprovedMidYearSnapshotSupport {

    public static final String SNAPSHOT_KEY = "approvedMidYearSnapshot";

    private static final ObjectMapper JSON = new ObjectMapper();

    private ApprovedMidYearSnapshotSupport() {}

    public record Snapshot(BigDecimal selfScore, String actual, String capturedAt) {}

    public static boolean hasSnapshot(String evidencesJson) {
        JsonNode root = parseRoot(evidencesJson);
        if (root == null) {
            return false;
        }
        JsonNode snap = root.get(SNAPSHOT_KEY);
        return snap != null && snap.isObject() && !snap.isEmpty();
    }

    public static Snapshot parseSnapshot(String evidencesJson) {
        JsonNode root = parseRoot(evidencesJson);
        if (root == null) {
            return null;
        }
        JsonNode snap = root.get(SNAPSHOT_KEY);
        if (snap == null || !snap.isObject()) {
            return null;
        }
        BigDecimal selfScore = null;
        if (snap.hasNonNull("selfScore") && !snap.get("selfScore").isNull()) {
            JsonNode scoreNode = snap.get("selfScore");
            if (scoreNode.isNumber()) {
                selfScore = scoreNode.decimalValue();
            } else if (scoreNode.isTextual()) {
                String raw = scoreNode.asText("").trim();
                if (!raw.isEmpty()) {
                    try {
                        selfScore = new BigDecimal(raw.replace(',', '.'));
                    } catch (NumberFormatException ignored) {
                        selfScore = null;
                    }
                }
            }
        }
        String actual = null;
        if (snap.hasNonNull("actual") && !snap.get("actual").isNull()) {
            actual = snap.get("actual").asText("").trim();
            if (actual.isEmpty()) {
                actual = null;
            }
        }
        String capturedAt = null;
        if (snap.hasNonNull("capturedAt")) {
            capturedAt = snap.get("capturedAt").asText("").trim();
            if (capturedAt.isEmpty()) {
                capturedAt = null;
            }
        }
        if (selfScore == null && actual == null) {
            return null;
        }
        return new Snapshot(selfScore, actual, capturedAt);
    }

    /**
     * Gộp snapshot vào evidences nếu chưa có; trả JSON mới hoặc {@code null} nếu đã có snapshot.
     * Giữ nguyên mọi field evidences hiện có; snapshot luôn được thêm kể cả khi actual null.
     */
    public static String mergeSnapshotIfAbsent(
            String evidencesJson, BigDecimal midSelfScore, String capturedAtIso) {
        if (hasSnapshot(evidencesJson)) {
            return null;
        }
        ObjectNode root = parseOrWrapEvidencesRoot(evidencesJson);
        ObjectNode snap = JSON.createObjectNode();
        if (midSelfScore != null) {
            snap.put("selfScore", midSelfScore);
        }
        String actual = extractActualFromEvidences(root);
        if (actual != null) {
            snap.put("actual", actual);
        }
        String capturedAt = capturedAtIso != null && !capturedAtIso.isBlank()
                ? capturedAtIso
                : OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        snap.put("capturedAt", capturedAt);
        root.set(SNAPSHOT_KEY, snap);
        try {
            return JSON.writeValueAsString(root);
        } catch (Exception e) {
            return null;
        }
    }

    /** Parse evidences object — giữ nguyên root object; array/scalar bọc trong {@code _legacyEvidences}. */
    private static ObjectNode parseOrWrapEvidencesRoot(String evidencesJson) {
        if (evidencesJson == null || evidencesJson.isBlank()) {
            return JSON.createObjectNode();
        }
        try {
            JsonNode parsed = JSON.readTree(evidencesJson.trim());
            if (parsed == null || parsed.isNull()) {
                return JSON.createObjectNode();
            }
            if (parsed.isObject()) {
                return (ObjectNode) parsed.deepCopy();
            }
            ObjectNode wrapped = JSON.createObjectNode();
            wrapped.set("_legacyEvidences", parsed);
            return wrapped;
        } catch (Exception e) {
            ObjectNode fallback = JSON.createObjectNode();
            fallback.put("_legacyEvidencesRaw", evidencesJson.trim());
            return fallback;
        }
    }

    /** Actual/result gốc trong evidences (trường {@code actual} hoặc completed đầu tiên trong planActualRecords). */
    public static String extractActualFromEvidences(JsonNode root) {
        if (root == null || root.isNull()) {
            return null;
        }
        if (root.hasNonNull("actual") && !root.get("actual").isNull()) {
            String s = textOrNumber(root.get("actual"));
            return s.isEmpty() ? null : s;
        }
        if (root.has("planActualRecords") && root.get("planActualRecords").isArray()) {
            for (JsonNode row : root.get("planActualRecords")) {
                if (row == null || row.isNull()) {
                    continue;
                }
                if (row.hasNonNull("completed")) {
                    String s = textOrNumber(row.get("completed"));
                    if (!s.isEmpty()) {
                        return s;
                    }
                }
                if (row.hasNonNull("actual")) {
                    String s = textOrNumber(row.get("actual"));
                    if (!s.isEmpty()) {
                        return s;
                    }
                }
            }
        }
        return null;
    }

    public static String extractActualFromEvidences(String evidencesJson) {
        return extractActualFromEvidences(parseRoot(evidencesJson));
    }

    /**
     * Gộp evidences mới từ client với snapshot audit trên DB — FE không cần gửi snapshot.
     * Trả {@code incomingEvidences} nếu không cần merge; null nếu incoming null/blank và không có gì để trả.
     */
    public static String mergePreservingSnapshot(String currentEvidences, String incomingEvidences) {
        if (incomingEvidences == null || incomingEvidences.isBlank()) {
            return incomingEvidences;
        }
        if (!hasSnapshot(currentEvidences) || hasSnapshot(incomingEvidences)) {
            return incomingEvidences;
        }
        JsonNode currentRoot = parseRoot(currentEvidences);
        ObjectNode incomingRoot = parseOrWrapEvidencesRoot(incomingEvidences);
        JsonNode snapNode = currentRoot != null ? currentRoot.get(SNAPSHOT_KEY) : null;
        if (snapNode == null || snapNode.isNull()) {
            return incomingEvidences;
        }
        incomingRoot.set(SNAPSHOT_KEY, snapNode.deepCopy());
        try {
            return JSON.writeValueAsString(incomingRoot);
        } catch (Exception e) {
            return incomingEvidences;
        }
    }

    /** JSON object cho {@code evidences.approvedMidYearSnapshot} (không bọc full evidences). */
    public static String buildSnapshotJson(
            BigDecimal midSelfScore, String actual, String capturedAtIso) {
        ObjectNode snap = JSON.createObjectNode();
        if (midSelfScore != null) {
            snap.put("selfScore", midSelfScore);
        }
        if (actual != null && !actual.isBlank()) {
            snap.put("actual", actual.trim());
        }
        String capturedAt = capturedAtIso != null && !capturedAtIso.isBlank()
                ? capturedAtIso
                : OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        snap.put("capturedAt", capturedAt);
        try {
            return JSON.writeValueAsString(snap);
        } catch (Exception e) {
            return null;
        }
    }

    private static String textOrNumber(JsonNode n) {
        if (n == null || n.isNull()) {
            return "";
        }
        return n.isNumber() ? n.numberValue().toString() : n.asText("").trim();
    }

    private static JsonNode parseRoot(String evidencesJson) {
        if (evidencesJson == null) {
            return null;
        }
        String trimmed = evidencesJson.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        try {
            return JSON.readTree(trimmed);
        } catch (Exception e) {
            return null;
        }
    }
}
