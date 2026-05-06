package com.company.kpi.service.kpi;

import com.company.kpi.common.exception.AppException;
import com.company.kpi.dto.kpi.KpiScoringRulesPayload;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses GM scoring-rules DSL, validates, and serializes to JSON for {@code kpis_information.target_description}.
 *
 * <p>Mỗi dòng không rỗng: «điểm (1–5): điều_kiện» — toán tử &lt;, &lt;=, &gt;, &gt;=, =; khoảng nửa-mở {@code (a,b]},
 * {@code [a,b)}; hoặc khoảng {@code a-b} hai mút đóng. Dấu phẩy «,» cuối dòng (sau điều kiện) là tùy chọn và bị bỏ
 * qua khi parse.
 */
@Service
@RequiredArgsConstructor
public class KpiScoringRulesService {

    /** Một dòng: «số_điểm» (1–5) + «:» + điều kiện — tránh hiểu nhầm «10:» thành điểm 1. */
    private static final Pattern LINE = Pattern.compile("^\\s*(\\d+)\\s*:\\s*(.+)\\s*$");
    /** Khoảng có mút mở/đóng: (3.6, 4.5] hoặc [2.4, 3.0) — dấu phẩy giữa hai số. */
    private static final Pattern BRACKET_INTERVAL =
            Pattern.compile("^\\s*([\\[(])\\s*(-?\\d+(?:\\.\\d+)?)\\s*,\\s*(-?\\d+(?:\\.\\d+)?)\\s*([\\])])\\s*$");
    private static final Pattern RANGE = Pattern.compile("^(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)$");
    private static final Pattern LT = Pattern.compile("^<\\s*(\\d+(?:\\.\\d+)?)$");
    private static final Pattern LE = Pattern.compile("^<=\\s*(\\d+(?:\\.\\d+)?)$");
    private static final Pattern GT = Pattern.compile("^>\\s*(\\d+(?:\\.\\d+)?)$");
    private static final Pattern GE = Pattern.compile("^>=\\s*(\\d+(?:\\.\\d+)?)$");
    private static final Pattern EQ = Pattern.compile("^=\\s*(\\d+(?:\\.\\d+)?)$");

    private final ObjectMapper objectMapper;

    /**
     * Validates {@code rawInput}, parses rules, returns canonical JSON for JSONB column.
     * Blank input → {@code null} (column cleared).
     */
    public String serializeForPersistence(KpiScoringRulesPayload input) {
        if (input == null) {
            return null;
        }
        String raw = input.getRawInput() == null ? "" : input.getRawInput();
        if (raw.isBlank()) {
            return null;
        }
        List<Map<String, Object>> rules = parseAndValidate(raw);
        try {
            KpiScoringRulesPayload out = KpiScoringRulesPayload.ofRawAndRules(raw, rules);
            return objectMapper.writeValueAsString(out);
        } catch (JsonProcessingException e) {
            throw AppException.badRequest("Could not serialize scoring rules: " + e.getMessage());
        }
    }

    /** Deserialize DB JSON/string into payload for API responses; never throws to callers. */
    public KpiScoringRulesPayload parseForApi(String stored) {
        if (stored == null || stored.isBlank()) {
            return KpiScoringRulesPayload.empty();
        }
        String trimmed = stored.trim();
        try {
            JsonNode n = objectMapper.readTree(trimmed);
            if (n != null && n.isObject()) {
                String raw =
                        n.has("rawInput") && n.get("rawInput").isTextual()
                                ? n.get("rawInput").asText()
                                : "";
                List<Map<String, Object>> rules = new ArrayList<>();
                if (n.has("rules") && n.get("rules").isArray()) {
                    for (JsonNode r : n.get("rules")) {
                        if (r.isObject()) {
                            Map<String, Object> one =
                                    objectMapper.convertValue(
                                            r, new TypeReference<LinkedHashMap<String, Object>>() {});
                            rules.add(one);
                        }
                    }
                }
                return KpiScoringRulesPayload.ofRawAndRules(raw, rules);
            }
        } catch (Exception ignored) {
            /* fall through */
        }
        return KpiScoringRulesPayload.empty();
    }

    public List<Map<String, Object>> parseAndValidate(String rawInput) {
        String raw = rawInput == null ? "" : rawInput.replace("\r\n", "\n").replace('\r', '\n');
        if (raw.isBlank()) {
            return List.of();
        }
        List<Map<String, Object>> rules = new ArrayList<>();
        Set<Integer> seenScores = new LinkedHashSet<>();
        String[] lines = raw.split("\n", -1);

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            if (line == null || line.isBlank()) {
                continue;
            }
            String lineTrim = line.strip();
            String toParse = lineTrim.endsWith(",") ? lineTrim.substring(0, lineTrim.length() - 1).strip() : lineTrim;
            Matcher m = LINE.matcher(toParse);
            if (!m.matches()) {
                throw AppException.badRequest(
                        "Dòng "
                                + (i + 1)
                                + ": mỗi dòng phải có dạng «số_điểm:điều_kiện» (vd. 1: <50). Nội dung: «"
                                + truncateOneLine(line, 80)
                                + "».");
            }
            int score = Integer.parseInt(m.group(1));
            if (score < 1 || score > 5) {
                throw AppException.badRequest(
                        "Dòng "
                                + (i + 1)
                                + ": điểm phải từ 1 đến 5 (đang ghi «"
                                + score
                                + "»). Nội dung: «"
                                + truncateOneLine(line, 80)
                                + "».");
            }
            if (!seenScores.add(score)) {
                throw AppException.badRequest(
                        "Dòng "
                                + (i + 1)
                                + ": trùng điểm "
                                + score
                                + " — mỗi mức (1–5) chỉ được khai báo một lần.");
            }
            String cond = m.group(2).strip();
            if (cond.isEmpty()) {
                throw AppException.badRequest(
                        "Dòng "
                                + (i + 1)
                                + ": thiếu phần điều kiện sau dấu «:» (vd. "
                                + score
                                + ": <50).");
            }
            Map<String, Object> rule = parseCondition(score, cond);
            rules.add(rule);
        }
        /* Không kiểm tra “tách biệt” toán học: thang kiểu 5:>125, 4:>110,… chồng về tập hợp
         * nhưng được hiểu theo thứ tự dòng — khớp đầu tiên khi resolve điểm (xem resolveScore). */
        return rules;
    }

    private static Map<String, Object> parseCondition(int score, String cond) {
        String c = cond.strip();
        Matcher mb = BRACKET_INTERVAL.matcher(c);
        if (mb.matches()) {
            char left = mb.group(1).charAt(0);
            char right = mb.group(4).charAt(0);
            if ((left != '(' && left != '[') || (right != ')' && right != ']')) {
                throw AppException.badRequest(
                        "Điểm "
                                + score
                                + ": khoảng «"
                                + truncateOneLine(cond, 48)
                                + "» — chỉ dùng ( hoặc [ ở đầu và ) hoặc ] ở cuối.");
            }
            BigDecimal a;
            BigDecimal b;
            try {
                a = new BigDecimal(mb.group(2)).setScale(6, RoundingMode.HALF_UP);
                b = new BigDecimal(mb.group(3)).setScale(6, RoundingMode.HALF_UP);
            } catch (NumberFormatException e) {
                throw AppException.badRequest(
                        "Điểm "
                                + score
                                + ": trong khoảng «"
                                + truncateOneLine(cond, 48)
                                + "» có phần không phải số hợp lệ.");
            }
            if (a.compareTo(b) > 0) {
                throw AppException.badRequest(
                        "Điểm "
                                + score
                                + ": khoảng «"
                                + truncateOneLine(cond, 48)
                                + "» — số trái phải ≤ số phải.");
            }
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("score", score);
            map.put("min", a.stripTrailingZeros());
            map.put("max", b.stripTrailingZeros());
            map.put("loOpen", left == '(');
            map.put("hiOpen", right == ')');
            return map;
        }

        Matcher mr = RANGE.matcher(c);
        if (mr.matches()) {
            BigDecimal a;
            BigDecimal b;
            try {
                a = new BigDecimal(mr.group(1)).setScale(6, RoundingMode.HALF_UP);
                b = new BigDecimal(mr.group(2)).setScale(6, RoundingMode.HALF_UP);
            } catch (NumberFormatException e) {
                throw AppException.badRequest(
                        "Điểm "
                                + score
                                + ": trong khoảng «"
                                + truncateOneLine(cond, 48)
                                + "» có phần không phải số hợp lệ.");
            }
            if (a.compareTo(b) > 0) {
                throw AppException.badRequest(
                        "Điểm "
                                + score
                                + ": khoảng «"
                                + truncateOneLine(cond, 48)
                                + "» không hợp lệ — số bên trái phải ≤ số bên phải (vd. 50-70).");
            }
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("score", score);
            map.put("min", a.stripTrailingZeros());
            map.put("max", b.stripTrailingZeros());
            return map;
        }
        mr = LE.matcher(c);
        if (mr.matches()) {
            return pred(score, "<=", parseBig(score, cond, mr.group(1)));
        }
        mr = LT.matcher(c);
        if (mr.matches()) {
            return pred(score, "<", parseBig(score, cond, mr.group(1)));
        }
        mr = GE.matcher(c);
        if (mr.matches()) {
            return pred(score, ">=", parseBig(score, cond, mr.group(1)));
        }
        mr = GT.matcher(c);
        if (mr.matches()) {
            return pred(score, ">", parseBig(score, cond, mr.group(1)));
        }
        mr = EQ.matcher(c);
        if (mr.matches()) {
            return pred(score, "=", parseBig(score, cond, mr.group(1)));
        }
        throw AppException.badRequest(
                "Điểm "
                        + score
                        + ": điều kiện «"
                        + truncateOneLine(cond, 56)
                        + "» không hợp lệ. Dùng: (a,b] / [a,b); khoảng 50-70; hoặc <50, <=50, >90, >=100, =100 (số thập phân).");
    }

    private static BigDecimal parseBig(int score, String cond, String numPart) {
        try {
            return new BigDecimal(numPart.trim());
        } catch (NumberFormatException e) {
            throw AppException.badRequest(
                    "Điểm "
                            + score
                            + ": sau toán tử cần là một số hợp lệ trong «"
                            + truncateOneLine(cond, 48)
                            + "».");
        }
    }

    private static String truncateOneLine(String s, int maxChars) {
        if (s == null) {
            return "";
        }
        String t = s.replace('\t', ' ').strip().replaceAll("\\s+", " ");
        if (t.length() <= maxChars) {
            return t;
        }
        return t.substring(0, maxChars) + "…";
    }

    private static Map<String, Object> pred(int score, String op, BigDecimal v) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("score", score);
        map.put("operator", op);
        map.put("value", v.stripTrailingZeros());
        return map;
    }

    private static int intScore(Map<String, Object> r) {
        return ((Number) r.get("score")).intValue();
    }

    private static final BigDecimal NEG = new BigDecimal("-1000000000000000000");
    private static final BigDecimal POS = new BigDecimal("1000000000000000000");
    private static final BigDecimal EPS = new BigDecimal("0.0000000000001");

    /** Map rule to inclusive numeric interval [lo, hi] using a tiny epsilon for strict inequalities. */
    private static Closed toClosedInterval(Map<String, Object> rule) {
        if (rule.containsKey("min") && rule.containsKey("max")) {
            BigDecimal lo = num(rule.get("min"));
            BigDecimal hi = num(rule.get("max"));
            boolean loOpen = Boolean.TRUE.equals(rule.get("loOpen"));
            boolean hiOpen = Boolean.TRUE.equals(rule.get("hiOpen"));
            if (loOpen) {
                lo = lo.add(EPS);
            }
            if (hiOpen) {
                hi = hi.subtract(EPS);
            }
            return new Closed(lo, hi);
        }
        String op = String.valueOf(rule.get("operator")).trim();
        BigDecimal v = num(rule.get("value"));
        return switch (op) {
            case "<" -> new Closed(NEG, v.subtract(EPS));
            case "<=" -> new Closed(NEG, v);
            case ">" -> new Closed(v.add(EPS), POS);
            case ">=" -> new Closed(v, POS);
            case "=" -> new Closed(v, v);
            default -> throw new IllegalArgumentException("operator: " + op);
        };
    }

    private record Closed(BigDecimal lo, BigDecimal hi) {}

    private static BigDecimal num(Object o) {
        if (o instanceof BigDecimal bd) {
            return bd;
        }
        if (o instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue());
        }
        return new BigDecimal(String.valueOf(o));
    }

    /**
     * Ánh xạ chỉ số số (tỉ lệ %, hoặc số parsed từ Actual 803) sang điểm 1–5 theo DSL GM trong
     * {@code kpis_information.target_description}.
     *
     * @return điểm khớp khoảng/điều kiện đầu tiên (theo thứ tự {@code rules}), hoặc {@code null}.
     */
    public Integer resolveScore(BigDecimal metric, String targetDescriptionStored) {
        if (metric == null) {
            return null;
        }
        KpiScoringRulesPayload p = parseForApi(targetDescriptionStored);
        if (p.getRules() == null || p.getRules().isEmpty()) {
            return null;
        }
        for (Map<String, Object> r : p.getRules()) {
            Closed c = toClosedInterval(r);
            if (metric.compareTo(c.lo()) >= 0 && metric.compareTo(c.hi()) <= 0) {
                return intScore(r);
            }
        }
        return null;
    }
}
