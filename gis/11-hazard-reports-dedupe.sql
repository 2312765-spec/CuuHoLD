-- gis/11-hazard-reports-dedupe.sql
-- Gộp báo cáo cộng đồng trùng nhau (nhiều người báo cùng 1 điểm, cùng loại) thành 1 mục kiểm duyệt.
-- Chạy SAU 10-hazard-reports-and-severity.sql. Chỉ THÊM (IF NOT EXISTS) — không đổi/xoá dữ liệu cũ,
-- và code cũ vẫn chạy bình thường khi cột này đã tồn tại (cột nullable, mặc định NULL).

-- duplicate_of: NULL = báo cáo "chính" (hiện trong hàng đợi kiểm duyệt); khác NULL = báo cáo đã
-- được GỘP vào báo cáo chính đó (cùng loại, trong bán kính 100 m lúc gửi, báo cáo chính còn chờ duyệt).
-- Duyệt/từ chối báo cáo chính thì các báo cáo gộp theo cùng trạng thái + cùng cảnh báo (hazard_id).
ALTER TABLE public.hazard_reports
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES public.hazard_reports(id) ON DELETE SET NULL;

-- Chỉ lập chỉ mục các dòng đã gộp (phần lớn báo cáo là báo cáo chính, duplicate_of NULL).
CREATE INDEX IF NOT EXISTS hazard_reports_duplicate_of_idx
  ON public.hazard_reports (duplicate_of)
  WHERE duplicate_of IS NOT NULL;
