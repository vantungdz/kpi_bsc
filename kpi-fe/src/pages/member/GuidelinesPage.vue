<template>
  <div class="max-w-[1000px] mx-auto space-y-8 animate-fade-in pb-12">

    <!-- Page Header -->
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Guideline & Quy Định KPI</h2>
        <p class="text-slate-500 text-base">Tài liệu tham chiếu chính thức giúp bạn hiểu rõ cách tính điểm, quy định chung và 11 tiêu chí đánh giá KPI.</p>
      </div>
      <a href="#rules" class="hidden md:flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors">
        <i class="fas fa-download w-4 text-center"></i> Tải bản Excel
      </a>
    </div>

    <!-- Quick Navigation -->
    <div class="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-1 sticky top-0 z-10">
      <a href="#rules" class="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">1. Quy định chung</a>
      <a href="#group-a" class="px-4 py-2 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">2. Nhóm A (7 Mục)</a>
      <a href="#group-b" class="px-4 py-2 text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">3. Nhóm B (4 Mục)</a>
    </div>

    <!-- ==========================================
         SECTION 1: QUY ĐỊNH CHUNG
    =========================================== -->
    <section id="rules" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-20">
      <div class="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
        <div class="p-2 bg-slate-800 text-white rounded-lg">
          <i class="fas fa-balance-scale w-5 text-center"></i>
        </div>
        <h3 class="text-lg font-bold text-slate-800">1. Quy định chung & Xử lý vi phạm</h3>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex items-start gap-3 p-4 bg-rose-50/50 rounded-xl border border-rose-100">
            <i class="fas fa-copyright w-5 text-rose-500 shrink-0 mt-0.5"></i>
            <div>
              <p class="text-sm font-bold text-slate-800">Bản quyền / Copy nội dung</p>
              <p class="text-sm text-slate-600 mt-1">Khi copy từ một page khác phải ghi rõ nguồn. <strong>Trường hợp cố tình vi phạm sẽ bị đánh điểm 1.</strong></p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <i class="fas fa-image w-5 text-blue-500 shrink-0 mt-0.5"></i>
            <div>
              <p class="text-sm font-bold text-slate-800">Sử dụng Hình ảnh & Icon</p>
              <p class="text-sm text-slate-600 mt-1">Hình ảnh phải ghi rõ nguồn gốc. Đối với Icon, bắt buộc phải lấy từ những trang cung cấp miễn phí.</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <i class="fas fa-edit w-5 text-emerald-500 shrink-0 mt-0.5"></i>
            <div>
              <p class="text-sm font-bold text-slate-800">Quy đổi bài viết Blog/Post</p>
              <p class="text-sm text-slate-600 mt-1"><strong>02 bài Non-Technical post</strong> sẽ được tính tương đương với hiệu suất của <strong>01 bài Technical Post</strong>.</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <i class="fas fa-award w-5 text-indigo-500 shrink-0 mt-0.5"></i>
            <div>
              <p class="text-sm font-bold text-slate-800">Điểm cộng đóng góp (Contribution)</p>
              <p class="text-sm text-slate-600 mt-1">Có thể xem xét cộng điểm cho các contribution đóng góp giá trị cho team/công ty. Yêu cầu <strong>Score tối thiểu đang có là 2</strong> và phải được PM & GM approve.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ==========================================
         SECTION 2: NHÓM A
    =========================================== -->
    <section id="group-a" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-20">
      <div class="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
            <i class="fas fa-chart-line w-5 text-center"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-800">2. Hướng dẫn đánh giá Nhóm A</h3>
            <p class="text-xs text-blue-600 font-medium">Target for works, improvement, competence (7 Hạng mục)</p>
          </div>
        </div>
      </div>

      <div class="divide-y divide-slate-100">
        <!-- Item A.1a -->
        <div class="p-6 hover:bg-slate-50/50 transition-colors">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">A.1a</span>
              <h4 class="text-base font-bold text-slate-900">Individual Efficiency (IE)</h4>
            </div>
            <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Source: Redmine (Estimated vs Actual)</div>
          </div>
          <div class="bg-white border border-slate-200 p-4 rounded-xl space-y-3 shadow-sm">
            <p class="text-sm text-slate-700"><strong>Nguyên tắc:</strong> Estimated effort nên bao trùm các vấn đề liên quan đến task level thấp hoặc thiếu skill.</p>
            <div class="flex gap-2 text-sm text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-100">
              <i class="fas fa-info-circle w-4 shrink-0 mt-0.5"></i>
              <p>Nếu không thực hiện estimate (ước lượng) cho các task được giao trong một project, điểm IE dự án đó sẽ bị tính mặc định là <strong>80% (Tương đương Điểm 2)</strong>.</p>
            </div>
            <div class="pt-2">
              <p class="text-sm font-bold text-slate-800 mb-1">Quy định cộng điểm (Added Score):</p>
              <p class="text-sm text-slate-600">Nếu member hoàn thành mọi trách nhiệm và có thể tận dụng thời gian để làm thêm công việc ở các dự án un-planned (vd: OT hoặc tối ưu để tiết kiệm thời gian), sẽ nhận được project[X] bổ sung với <strong>IEi = 5</strong>.</p>
            </div>
          </div>
        </div>

        <!-- Item A.2a -->
        <div class="p-6 hover:bg-slate-50/50 transition-colors">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">A.2a</span>
              <h4 class="text-base font-bold text-slate-900">Work Amount (WA)</h4>
            </div>
            <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Source: Timesheet / Working Hours</div>
          </div>
          <p class="text-sm text-slate-700 mb-3">Đo lường khối lượng công việc. Công thức: <code class="bg-slate-100 px-1.5 py-0.5 rounded text-rose-600 font-bold text-xs">WA = Spent Time / Standard Working Time</code></p>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-sm">
            <div class="border border-emerald-200 bg-emerald-50 rounded-lg p-2"><div class="font-bold text-emerald-700 text-lg">5</div><div class="text-xs text-slate-600">> 120%</div></div>
            <div class="border border-blue-200 bg-blue-50 rounded-lg p-2"><div class="font-bold text-blue-700 text-lg">4</div><div class="text-xs text-slate-600">101% - 120%</div></div>
            <div class="border border-slate-200 bg-slate-50 rounded-lg p-2"><div class="font-bold text-slate-700 text-lg">3</div><div class="text-xs text-slate-600">90% - 100%</div></div>
            <div class="border border-orange-200 bg-orange-50 rounded-lg p-2"><div class="font-bold text-orange-700 text-lg">2</div><div class="text-xs text-slate-600">< 90%</div></div>
          </div>
        </div>

        <!-- Item A.3a -->
        <div class="p-6 hover:bg-slate-50/50 transition-colors">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">A.3a</span>
              <h4 class="text-base font-bold text-slate-900">Individual Quality (IQ)</h4>
            </div>
            <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Source: Redmine (Bug Tracking)</div>
          </div>
          <p class="text-sm text-slate-700 mb-2">Đánh giá chất lượng dựa trên tỉ lệ Rework và Bug phát sinh sau release.</p>
          <ul class="list-disc list-inside text-sm text-slate-600 space-y-1 ml-1">
            <li><strong>Effort on Rework (%):</strong> Thời gian phải fix bug / Tổng thời gian task.</li>
            <li><strong>UT bug after release:</strong> Số lượng bug lọt qua quá trình Unit Test.</li>
            <li><strong>Degraded bug (%):</strong> Lỗi hồi quy gây ảnh hưởng chức năng cũ.</li>
          </ul>
        </div>

        <!-- Item A.4 -->
        <div class="p-6 hover:bg-slate-50/50 transition-colors">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">A.4</span>
              <h4 class="text-base font-bold text-slate-900">Customer Satisfaction (CS)</h4>
            </div>
            <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Source: CES / Client Feedback</div>
          </div>
          <p class="text-sm text-slate-700">Điểm đánh giá sự hài lòng từ khách hàng (Customer Evaluation Score). <br>
          <span class="text-rose-600 font-medium">Lưu ý:</span> Nếu PM/PL có thể thu thập đánh giá, sẽ sử dụng data thực tế. Trong trường hợp không có dữ liệu đánh giá, <strong>điểm CS mặc định là 3</strong>.</p>
        </div>

        <!-- Item A.5a -->
        <div class="p-6 hover:bg-slate-50/50 transition-colors">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">A.5a</span>
              <h4 class="text-base font-bold text-slate-900">Task Delivery (TD)</h4>
            </div>
            <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Source: PM Report</div>
          </div>
          <p class="text-sm text-slate-700">Khả năng hoàn thành task đúng hạn (On-time Delivery). Điểm số phụ thuộc vào số lượng task bị trễ deadline (Overdue) trong kỳ đánh giá mà không có lý do chính đáng.</p>
        </div>

        <!-- Item A.6 -->
        <div class="p-6 hover:bg-slate-50/50 transition-colors">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">A.6</span>
              <h4 class="text-base font-bold text-slate-900">Process Compliance (PC)</h4>
            </div>
            <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Source: QA Report</div>
          </div>
          <p class="text-sm text-slate-700">Tuân thủ quy trình phát triển dự án và quy trình chất lượng chung (Report từ bộ phận QA / Non-Production). Các lỗi vi phạm quy trình (Non-conformity) sẽ bị trừ điểm trực tiếp.</p>
        </div>

        <!-- Item A.7 -->
        <div class="p-6 hover:bg-slate-50/50 transition-colors">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">A.7</span>
              <h4 class="text-base font-bold text-slate-900">Security Compliance (SC)</h4>
            </div>
            <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Source: ISMS Dept</div>
          </div>
          <p class="text-sm text-slate-700">Tuân thủ quy định An toàn thông tin (ISMS). Mọi vi phạm rò rỉ dữ liệu, vi phạm quy định bảo mật thiết bị hoặc không hoàn thành khóa học Security nội bộ sẽ làm giảm mạnh điểm SC.</p>
        </div>
      </div>
    </section>

    <!-- ==========================================
         SECTION 3: NHÓM B
    =========================================== -->
    <section id="group-b" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-20">
      <div class="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
            <i class="fas fa-graduation-cap w-5 text-center"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-800">3. Hướng dẫn đánh giá Nhóm B</h3>
            <p class="text-xs text-emerald-600 font-medium">Mục tiêu Đào tạo, Chia sẻ & Phát triển (4 Hạng mục)</p>
          </div>
        </div>
      </div>

      <div class="divide-y divide-slate-100">
        <!-- Item B.1 -->
        <div class="p-6 hover:bg-slate-50/50 transition-colors">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">B.1</span>
              <h4 class="text-base font-bold text-slate-900">Improvement</h4>
            </div>
            <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Source: Self Evaluation & PM</div>
          </div>
          <p class="text-sm text-slate-700">Đánh giá khả năng tự cải thiện kỹ năng Mềm và Kỹ năng Quản lý (VD: Improve khả năng quản lý sub-team, khả năng report cho khách hàng). Bằng chứng nộp dưới dạng báo cáo thực tế được PM công nhận.</p>
        </div>

        <!-- Item B.2 -->
        <div class="p-6 hover:bg-slate-50/50 transition-colors">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">B.2</span>
              <h4 class="text-base font-bold text-slate-900">Contribution</h4>
            </div>
            <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Source: Tech Blog / Internal Portal</div>
          </div>
          <p class="text-sm text-slate-700 mb-2">Sự đóng góp chia sẻ kiến thức cho cộng đồng nội bộ. Cần cung cấp Link bằng chứng của các bài viết.</p>
          <div class="bg-orange-50 text-orange-800 text-sm p-3 rounded-lg border border-orange-100 inline-block font-medium">
            Nhắc lại: 02 Bài Non-Technical Post = 01 Bài Technical Post.
          </div>
        </div>

        <!-- Item B.3 -->
        <div class="p-6 hover:bg-slate-50/50 transition-colors">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">B.3</span>
              <h4 class="text-base font-bold text-slate-900">Language Capability</h4>
            </div>
            <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Source: Report from HR</div>
          </div>

          <p class="text-sm text-slate-700 mb-4">Đánh giá qua kết quả chứng chỉ Ngoại ngữ (Nhật/Anh) hoặc tham gia sự kiện nội bộ. Đối với rank R1-R3: tự đánh giá qua thành tích cá nhân đạt được.</p>

          <div class="space-y-3">
            <div class="flex items-stretch border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div class="bg-violet-100 w-12 md:w-16 flex items-center justify-center font-extrabold text-violet-700 text-lg border-r border-slate-200">5</div>
              <div class="p-3 md:p-4 bg-white flex-1">
                <p class="text-sm font-bold text-slate-800 mb-1">Achieve level up and joint e-club event > 75%</p>
                <p class="text-xs font-medium text-slate-500">HOẶC DEV/QC level up đạt <strong class="text-slate-700">N2</strong> / IELTS 6.5 / TOEIC 800</p>
              </div>
            </div>
            <div class="flex items-stretch border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div class="bg-blue-100 w-12 md:w-16 flex items-center justify-center font-extrabold text-blue-700 text-lg border-r border-slate-200">4</div>
              <div class="p-3 md:p-4 bg-white flex-1">
                <p class="text-sm font-bold text-slate-800 mb-1">Finish studying and take exam as plan and joint e-club event > 50%</p>
                <p class="text-xs font-medium text-slate-500">HOẶC DEV/QC level up đạt <strong class="text-slate-700">N3, N4</strong> / IELTS 5.5 / TOEIC 700</p>
              </div>
            </div>
            <div class="flex items-stretch border border-slate-200 rounded-xl overflow-hidden">
              <div class="bg-emerald-100 w-12 md:w-16 flex items-center justify-center font-extrabold text-emerald-700 text-lg border-r border-slate-200">3</div>
              <div class="p-3 md:p-4 bg-white flex-1 flex items-center">
                <p class="text-sm font-bold text-slate-800">On learning in company's program (Đang theo học chuẩn tiến độ)</p>
              </div>
            </div>
            <div class="flex items-stretch border border-slate-200 rounded-xl overflow-hidden">
              <div class="bg-orange-100 w-12 md:w-16 flex items-center justify-center font-extrabold text-orange-700 text-lg border-r border-slate-200">2</div>
              <div class="p-3 md:p-4 bg-white flex-1 flex items-center">
                <p class="text-sm font-bold text-slate-800">Join but drop class <span class="text-rose-600 underline decoration-rose-300">WITH</span> acceptable reason (Bỏ dở có lý do chính đáng)</p>
              </div>
            </div>
            <div class="flex items-stretch border border-slate-200 rounded-xl overflow-hidden">
              <div class="bg-rose-100 w-12 md:w-16 flex items-center justify-center font-extrabold text-rose-700 text-lg border-r border-slate-200">1</div>
              <div class="p-3 md:p-4 bg-white flex-1 flex items-center">
                <p class="text-sm font-bold text-slate-800">Join but drop class <span class="text-rose-600 underline decoration-rose-300">WITHOUT</span> acceptable reason (Bỏ dở không có lý do)</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Item B.4 -->
        <div class="p-6 hover:bg-slate-50/50 transition-colors">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">B.4</span>
              <h4 class="text-base font-bold text-slate-900">Certificate</h4>
            </div>
            <div class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Source: HR / Certificate Upload</div>
          </div>
          <p class="text-sm text-slate-700">Đạt các chứng chỉ chuyên môn liên quan đến công việc hoặc định hướng phát triển trong năm (VD: AWS, ISTQB, PSM, PMP...). Cần upload bản scan chứng chỉ hợp lệ lên hệ thống làm bằng chứng (Evidence).</p>
        </div>
      </div>
    </section>

    <!-- Back to Top -->
    <div class="flex justify-center pt-6">
      <a href="#main-content" class="text-sm font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors">
        <i class="fas fa-arrow-up w-4 text-center"></i> Về đầu trang
      </a>
    </div>

  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn 0.5s ease-out forwards;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

html {
  scroll-behavior: smooth;
}
</style>