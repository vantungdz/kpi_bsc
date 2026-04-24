package com.company.kpi.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import java.util.List;

/**
 * Service gửi email qua JavaMailSender (SMTP).
 *
 * Cấu hình SMTP trong application-local.properties:
 *   spring.mail.host / port / username / password
 *
 * Nếu SMTP chưa cấu hình (mailSender = null hoặc kết nối thất bại),
 * service sẽ chỉ log và không ném exception để không ảnh hưởng luồng chính.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    private static final String DEFAULT_FROM = "noreply@kpi-system.vn";

    @Value("${spring.mail.username:}")
    private String fromAddress;

    @Value("${app.mail.enabled:true}")
    private boolean mailEnabled;

    /**
     * Gửi email HTML đến một địa chỉ đơn lẻ.
     *
     * @param to      Email nhận
     * @param subject Tiêu đề
     * @param htmlBody Nội dung HTML
     */
    public void sendHtml(String to, String subject, String htmlBody) {
        if (!mailEnabled) {
            log.info("[Email][SKIP] mailEnabled=false → to={}, subject={}", to, subject);
            return;
        }
        if (to == null || to.isBlank()) {
            log.warn("[Email] to address is blank — skip");
            return;
        }
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, true, "UTF-8");
            helper.setFrom(fromAddress.isBlank() ? DEFAULT_FROM : fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(msg);
            log.info("[Email][SENT] to={}, subject={}", to, subject);
        } catch (Exception e) {
            log.error("[Email][ERROR] Gửi email thất bại đến {}: {}", to, e.getMessage());
        }
    }

    /**
     * Gửi email HTML hàng loạt (mass mail).
     *
     * @param recipients Danh sách email nhận
     * @param subject    Tiêu đề chung
     * @param htmlBody   Nội dung HTML chung
     */
    public void sendBulkHtml(List<String> recipients, String subject, String htmlBody) {
        if (!mailEnabled) {
            log.info("[Email][SKIP] mailEnabled=false → bulk {} recipients", recipients.size());
            return;
        }
        if (recipients == null || recipients.isEmpty()) {
            log.warn("[Email] recipients list is empty — skip");
            return;
        }
        int success = 0;
        int fail    = 0;
        for (String to : recipients) {
            try {
                MimeMessage msg = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(msg, true, "UTF-8");
                helper.setFrom(fromAddress.isBlank() ? DEFAULT_FROM : fromAddress);
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(htmlBody, true);
                mailSender.send(msg);
                success++;
            } catch (Exception e) {
                log.error("[Email][ERROR] Gửi bulk mail thất bại đến {}: {}", to, e.getMessage());
                fail++;
            }
        }
        log.info("[Email][BULK DONE] success={}, fail={}", success, fail);
    }

    /**
     * Gửi email dạng text đơn giản (fallback không cần HTML).
     */
    public void sendPlain(String to, String subject, String text) {
        if (!mailEnabled) {
            log.info("[Email][SKIP] mailEnabled=false → to={}", to);
            return;
        }
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromAddress.isBlank() ? DEFAULT_FROM : fromAddress);
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(text);
            mailSender.send(msg);
            log.info("[Email][SENT plain] to={}", to);
        } catch (Exception e) {
            log.error("[Email][ERROR] to={}: {}", to, e.getMessage());
        }
    }
}
