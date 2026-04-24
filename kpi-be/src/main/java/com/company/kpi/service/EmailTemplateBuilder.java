package com.company.kpi.service;

import org.springframework.stereotype.Component;

/**
 * Xây dựng nội dung HTML cho các loại email thông báo KPI.
 */
@Component
public class EmailTemplateBuilder {

    /**
     * Template thông báo mở kỳ đánh giá — gửi hàng loạt (mass mail).
     *
     * @param campaignLabel Tên kỳ đánh giá (VD: "1st Half 2026")
     * @param recipientName Tên người nhận (nếu cá nhân hoá); null = "Toàn thể CBNV"
     */
    public String buildAnnounceHtml(String campaignLabel, String recipientName) {
        String greeting = (recipientName != null && !recipientName.isBlank())
                ? "Kính gửi <strong>" + recipientName + "</strong>,"
                : "Kính gửi <strong>Toàn thể Cán bộ Nhân viên</strong>,";

        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head><meta charset="UTF-8"/></head>
                <body style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.6;max-width:640px;margin:auto;padding:24px">
                  <div style="background:#4f46e5;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
                    <h2 style="margin:0;font-size:18px">📊 Thông báo Đánh giá KPI</h2>
                    <p style="margin:4px 0 0;font-size:13px;opacity:.85">Hệ thống Quản lý KPI — HR &amp; Admin Team</p>
                  </div>
                  <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
                    <p>%s</p>
                    <p>Hệ thống Đánh giá KPI cho kỳ <strong>%s</strong> đã chính thức <span style="color:#4f46e5;font-weight:bold">được mở</span>.</p>
                    <p>Anh/chị vui lòng đăng nhập vào hệ thống và hoàn thành đánh giá đúng hạn.</p>
                    <div style="margin:20px 0;padding:16px;background:#f1f5f9;border-radius:6px;border-left:4px solid #4f46e5">
                      <p style="margin:0;font-size:13px;color:#64748b">Lưu ý: Việc nộp trễ có thể ảnh hưởng đến kết quả đánh giá cuối kỳ.</p>
                    </div>
                    <p style="margin-top:24px;color:#64748b;font-size:13px">Trân trọng,<br/><strong>HR &amp; Admin Team</strong></p>
                  </div>
                </body>
                </html>
                """.formatted(greeting, campaignLabel != null ? campaignLabel : "hiện tại");
    }

    /**
     * Template nhắc nhở cá nhân (Remind) — gửi đến một nhân viên cụ thể.
     *
     * @param recipientName Tên nhân viên
     * @param status        Trạng thái hiện tại (VD: "Quá hạn", "Chưa đánh giá")
     * @param campaignLabel Tên kỳ đánh giá
     */
    public String buildRemindHtml(String recipientName, String status, String campaignLabel) {
        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head><meta charset="UTF-8"/></head>
                <body style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.6;max-width:640px;margin:auto;padding:24px">
                  <div style="background:#f97316;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
                    <h2 style="margin:0;font-size:18px">🔔 Nhắc nhở Đánh giá KPI</h2>
                    <p style="margin:4px 0 0;font-size:13px;opacity:.85">Hệ thống Quản lý KPI — HR &amp; Admin Team</p>
                  </div>
                  <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Hệ thống ghi nhận bạn đang ở trạng thái
                       <span style="color:#dc2626;font-weight:bold">%s</span>
                       trong kỳ đánh giá KPI <strong>%s</strong>.
                    </p>
                    <p>Vui lòng đăng nhập vào hệ thống và hoàn thành đánh giá <strong>ngay lập tức</strong>.</p>
                    <div style="margin:20px 0;padding:16px;background:#fff7ed;border-radius:6px;border-left:4px solid #f97316">
                      <p style="margin:0;font-size:13px;color:#9a3412">Nếu có thắc mắc, vui lòng liên hệ Quản lý trực tiếp (PM) hoặc HR.</p>
                    </div>
                    <p style="margin-top:24px;color:#64748b;font-size:13px">Trân trọng,<br/><strong>HR &amp; Admin Team</strong></p>
                  </div>
                </body>
                </html>
                """.formatted(
                    recipientName != null ? recipientName : "Anh/Chị",
                    status != null ? status : "chưa hoàn thành",
                    campaignLabel != null ? campaignLabel : "hiện tại"
                );
    }
}
