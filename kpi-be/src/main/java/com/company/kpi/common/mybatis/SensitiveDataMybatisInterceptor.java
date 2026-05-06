package com.company.kpi.common.mybatis;

import com.company.kpi.common.security.SensitiveDataCryptoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.*;

/**
 * One-place sensitive codec:
 * - Before write: encrypt comments/evidences/scores
 * - After read: decrypt comments/evidences/scores
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Intercepts({
        @Signature(type = Executor.class, method = "update", args = {MappedStatement.class, Object.class}),
        @Signature(type = Executor.class, method = "query", args = {
                MappedStatement.class, Object.class, org.apache.ibatis.session.RowBounds.class, org.apache.ibatis.session.ResultHandler.class
        }),
        @Signature(type = Executor.class, method = "query", args = {
                MappedStatement.class, Object.class, org.apache.ibatis.session.RowBounds.class, org.apache.ibatis.session.ResultHandler.class,
                org.apache.ibatis.cache.CacheKey.class, org.apache.ibatis.mapping.BoundSql.class
        })
})
public class SensitiveDataMybatisInterceptor implements Interceptor {

    private static final Set<String> COMMENT_FIELDS = Set.of(
            "comments",
            "supervisorComment",
            "pmComment",
            "evaluationComments",
            "evaluationSupervisorComments");
    private static final Set<String> EVIDENCE_FIELDS = Set.of("evidences", "evidence", "actualResult");
    private static final Set<String> SCORE_FIELDS = Set.of(
            "midSelfScore", "endSelfScore", "endPmScore", "endGmScore",
            "selfScore", "pmScore");

    private final SensitiveDataCryptoService cryptoService;

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        String method = invocation.getMethod().getName();
        Object[] args = invocation.getArgs();
        if (args.length >= 2) {
            processWrite(args[1], Collections.newSetFromMap(new IdentityHashMap<>()));
        }

        Object result = invocation.proceed();
        if ("query".equals(method)) {
            processRead(result, Collections.newSetFromMap(new IdentityHashMap<>()));
        }
        return result;
    }

    @Override
    public Object plugin(Object target) {
        return Plugin.wrap(target, this);
    }

    private void processWrite(Object obj, Set<Object> visited) {
        if (obj == null || isPrimitiveLike(obj) || visited.contains(obj)) {
            return;
        }
        visited.add(obj);
        if (obj instanceof Map<?, ?> map) {
            processWriteMap(map, visited);
            return;
        }
        if (obj instanceof Iterable<?> it) {
            for (Object item : it) processWrite(item, visited);
            return;
        }
        processWriteBean(obj, visited);
    }

    @SuppressWarnings("unchecked")
    private void processWriteMap(Map<?, ?> map, Set<Object> visited) {
        Map<Object, Object> mutable = (Map<Object, Object>) map;
        for (Map.Entry<?, ?> e : map.entrySet()) {
            Object keyObj = e.getKey();
            if (!(keyObj instanceof String key)) {
                processWrite(e.getValue(), visited);
                continue;
            }
            Object value = e.getValue();
            if (value == null) continue;
            if (COMMENT_FIELDS.contains(key) && value instanceof String s) {
                mutable.put(key, cryptoService.encrypt(s));
                continue;
            }
            if (EVIDENCE_FIELDS.contains(key) && value instanceof String s) {
                mutable.put(key, cryptoService.encryptEvidenceSensitiveFields(s));
                continue;
            }
            if (SCORE_FIELDS.contains(key) && value instanceof Number n) {
                mutable.put(key, cryptoService.encryptScore(new BigDecimal(n.toString())));
                continue;
            }
            processWrite(value, visited);
        }
    }

    private void processWriteBean(Object bean, Set<Object> visited) {
        for (Field f : allFields(bean.getClass())) {
            try {
                f.setAccessible(true);
                Object value = f.get(bean);
                if (value == null) continue;
                String name = f.getName();
                if (COMMENT_FIELDS.contains(name) && value instanceof String s) {
                    f.set(bean, cryptoService.encrypt(s));
                    continue;
                }
                if (EVIDENCE_FIELDS.contains(name) && value instanceof String s) {
                    f.set(bean, cryptoService.encryptEvidenceSensitiveFields(s));
                    continue;
                }
                if (SCORE_FIELDS.contains(name) && value instanceof Number n) {
                    assignNumber(bean, f, cryptoService.encryptScore(new BigDecimal(n.toString())));
                    continue;
                }
                processWrite(value, visited);
            } catch (Exception ex) {
                log.debug("SensitiveDataMybatisInterceptor write-skip field {}: {}", f.getName(), ex.getMessage());
            }
        }
    }

    private void processRead(Object obj, Set<Object> visited) {
        if (obj == null || isPrimitiveLike(obj) || visited.contains(obj)) {
            return;
        }
        visited.add(obj);
        if (obj instanceof Map<?, ?> map) {
            processReadMap(map, visited);
            return;
        }
        if (obj instanceof Iterable<?> it) {
            for (Object item : it) processRead(item, visited);
            return;
        }
        processReadBean(obj, visited);
    }

    @SuppressWarnings("unchecked")
    private void processReadMap(Map<?, ?> map, Set<Object> visited) {
        Map<Object, Object> mutable = (Map<Object, Object>) map;
        for (Map.Entry<?, ?> e : map.entrySet()) {
            Object keyObj = e.getKey();
            if (!(keyObj instanceof String key)) {
                processRead(e.getValue(), visited);
                continue;
            }
            Object value = e.getValue();
            if (value == null) continue;
            if (COMMENT_FIELDS.contains(key) && value instanceof String s) {
                mutable.put(key, cryptoService.decryptIfEncrypted(s));
                continue;
            }
            if (EVIDENCE_FIELDS.contains(key) && value instanceof String s) {
                mutable.put(key, cryptoService.decryptEvidenceSensitiveFields(s));
                continue;
            }
            processRead(value, visited);
        }
    }

    private void processReadBean(Object bean, Set<Object> visited) {
        for (Field f : allFields(bean.getClass())) {
            try {
                f.setAccessible(true);
                Object value = f.get(bean);
                String name = f.getName();

                if (value instanceof String s) {
                    if (COMMENT_FIELDS.contains(name)) {
                        f.set(bean, cryptoService.decryptIfEncrypted(s));
                        continue;
                    }
                    if (EVIDENCE_FIELDS.contains(name)) {
                        f.set(bean, cryptoService.decryptEvidenceSensitiveFields(s));
                        continue;
                    }
                }

                if (SCORE_FIELDS.contains(name) && value instanceof Number n) {
                    if (canDecryptScoresForCurrentUser()) {
                        assignNumber(bean, f, cryptoService.decryptScore(new BigDecimal(n.toString())));
                    }
                    continue;
                }
                if (value != null) processRead(value, visited);
            } catch (Exception ex) {
                log.debug("SensitiveDataMybatisInterceptor read-skip field {}: {}", f.getName(), ex.getMessage());
            }
        }
    }

    private static void assignNumber(Object target, Field field, BigDecimal value) throws IllegalAccessException {
        Class<?> t = field.getType();
        if (t == Double.class || t == double.class) {
            field.set(target, value.doubleValue());
            return;
        }
        if (t == BigDecimal.class) {
            field.set(target, value);
            return;
        }
        if (t == Integer.class || t == int.class) {
            field.set(target, value.intValue());
        }
    }

    private static List<Field> allFields(Class<?> type) {
        List<Field> out = new ArrayList<>();
        for (Class<?> c = type; c != null && c != Object.class; c = c.getSuperclass()) {
            out.addAll(Arrays.asList(c.getDeclaredFields()));
        }
        return out;
    }

    private static boolean isPrimitiveLike(Object value) {
        return value instanceof String
                || value instanceof Number
                || value instanceof Boolean
                || value instanceof UUID
                || value.getClass().isEnum();
    }

    /**
     * Score chỉ được giải mã cho GM/PM/LEADER/MEMBER.
     * ADMIN hoặc role khác sẽ thấy giá trị đã mã hóa tại tầng API.
     * Phạm vi "PM/LEADER quản lý trực tiếp" vẫn được enforce bởi query/service hiện có.
     */
    private static boolean canDecryptScoresForCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null) {
            return false;
        }
        for (GrantedAuthority a : auth.getAuthorities()) {
            if (a == null || a.getAuthority() == null) {
                continue;
            }
            String role = a.getAuthority().trim().toUpperCase(Locale.ROOT);
            if ("ROLE_GM".equals(role) || "ROLE_PM".equals(role) || "ROLE_LEADER".equals(role) || "ROLE_MEMBER".equals(role)) {
                return true;
            }
        }
        return false;
    }
}
