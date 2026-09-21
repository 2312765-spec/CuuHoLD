TRƯỜNG ĐẠI HỌC ...

**KHOA CÔNG NGHỆ THÔNG TIN**

─────────────────────────

**ĐẶC TẢ YÊU CẦU PHẦN MỀM**

_(Software Requirements Specification)_

**HỆ THỐNG CỨU HỘ KHẨN CẤP GIS TỈNH LÂM ĐỒNG**

| **Tên dự án**            | Rescue GIS Lâm Đồng                            |
| ------------------------ | ---------------------------------------------- |
| **Phiên bản tài liệu**   | 1.0.0                                          |
| **Ngày lập**             | 09/08/2026                                     |
| **Nhóm thực hiện**       | Nhóm Đồ án Chuyên ngành                        |
| **Thành viên**           | A (Frontend) · B (Backend) · C (GIS & Dữ liệu) |
| **Giảng viên hướng dẫn** | \[Tên giảng viên\]                             |
| **Trạng thái**           | Bản nháp v1.0 – Đang phát triển                |

# **LỊCH SỬ THAY ĐỔI TÀI LIỆU**

| **Phiên bản** | **Ngày**   | **Người thực hiện** | **Mô tả thay đổi**       |
| ------------- | ---------- | ------------------- | ------------------------ |
| 1.0.0         | 09/08/2026 | Cả nhóm             | Tạo tài liệu SRS ban đầu |
| 1.0.1         |            |                     |                          |
| 1.0.2         |            |                     |                          |

# **CHƯƠNG 1: GIỚI THIỆU**

## **1.1 Mục đích tài liệu**

Tài liệu Đặc tả Yêu cầu Phần mềm (SRS) này mô tả đầy đủ các yêu cầu chức năng và phi chức năng của hệ thống Cứu hộ Khẩn cấp GIS tỉnh Lâm Đồng. Tài liệu phục vụ làm cơ sở thiết kế, phát triển, kiểm thử và nghiệm thu hệ thống.

Đối tượng đọc tài liệu bao gồm: nhóm phát triển (frontend, backend, GIS), giảng viên hướng dẫn, hội đồng phản biện đồ án và các bên liên quan trong Ban Chỉ huy Phòng chống Thiên tai tỉnh Lâm Đồng.

## **1.2 Phạm vi hệ thống**

Rescue GIS Lâm Đồng là một ứng dụng web (Web App) tích hợp hệ thống thông tin địa lý (GIS), cho phép:

**•** Người dân gửi tín hiệu SOS có tọa độ GPS khi gặp tình huống khẩn cấp.

**•** Trung tâm chỉ huy giám sát toàn bộ sự cố trên bản đồ real-time, điều phối đội cứu hộ.

**•** Đội cứu hộ nhận nhiệm vụ, cập nhật trạng thái, xem lộ trình di chuyển đến nạn nhân.

**•** Hệ thống hoạt động dự phòng qua SMS khi mất kết nối internet (SMS fallback).

**•** Ứng dụng Progressive Web App (PWA) hỗ trợ sử dụng offline cơ bản.

Phạm vi địa lý: toàn tỉnh Lâm Đồng (12 huyện/thành phố). Phạm vi đồ án: hệ thống MVP phục vụ demo và thuyết trình học thuật.

## **1.3 Định nghĩa, viết tắt và ký hiệu**

| **Thuật ngữ / Viết tắt** | **Giải thích**                                                                |
| ------------------------ | ----------------------------------------------------------------------------- |
| SOS                      | Save Our Souls – Tín hiệu cứu hộ khẩn cấp                                     |
| GIS                      | Geographic Information System – Hệ thống thông tin địa lý                     |
| GPS                      | Global Positioning System – Hệ thống định vị toàn cầu                         |
| PostGIS                  | Extension của PostgreSQL hỗ trợ lưu trữ và truy vấn dữ liệu không gian địa lý |
| PWA                      | Progressive Web App – Ứng dụng web tiến bộ hỗ trợ offline                     |
| JWT                      | JSON Web Token – Cơ chế xác thực và phân quyền                                |
| WebSocket                | Giao thức truyền thông hai chiều real-time giữa client và server              |
| REST API                 | Representational State Transfer – Kiến trúc API tiêu chuẩn                    |
| SMS                      | Short Message Service – Dịch vụ tin nhắn ngắn                                 |
| ETA                      | Estimated Time of Arrival – Thời gian đến ước tính                            |
| NestJS                   | Framework Node.js backend sử dụng TypeScript                                  |
| Vue 3                    | Framework JavaScript frontend phiên bản 3                                     |
| BCHPCTT                  | Ban Chỉ huy Phòng chống Thiên tai và Tìm kiếm Cứu nạn                         |
| Victim                   | Người cần cứu hộ – vai trò trong hệ thống                                     |
| Rescuer                  | Thành viên đội cứu hộ – vai trò trong hệ thống                                |
| Commander                | Nhân viên trung tâm chỉ huy – vai trò trong hệ thống                          |

## **1.4 Tài liệu tham khảo**

**•** IEEE Std 830-1998: Recommended Practice for Software Requirements Specifications.

**•** Tài liệu API eSMS.vn – Hướng dẫn tích hợp SMS API.

**•** PostGIS Documentation – postgis.net.

**•** NestJS Official Documentation – docs.nestjs.com.

**•** Vue 3 Official Documentation – vuejs.org.

**•** Leaflet.js Documentation – leafletjs.com.

**•** GADM Database of Global Administrative Areas – gadm.org.

**•** Dữ liệu hành chính Việt Nam – github.com/thanglequoc/vietnamese-provinces-database.

# **CHƯƠNG 2: MÔ TẢ TỔNG QUAN HỆ THỐNG**

## **2.1 Bối cảnh hệ thống**

Tỉnh Lâm Đồng với địa hình đồi núi phức tạp, hệ thống đèo dốc hiểm trở (Đèo Prenn, Đèo Bảo Lộc, Đèo Đại Ninh) và diện tích rừng lớn thường xuyên xảy ra các tình huống khẩn cấp như: lũ lụt, sạt lở đất, tai nạn giao thông trên đèo, người mất tích trong rừng, đuối nước tại các thác-hồ, cháy rừng mùa khô.

Hệ thống hiện tại chủ yếu dựa vào báo cáo qua điện thoại, thiếu khả năng định vị chính xác và điều phối tập trung. Rescue GIS Lâm Đồng được xây dựng nhằm số hóa quy trình cứu hộ, giảm thời gian phản hồi và tăng độ chính xác điều phối.

## **2.2 Các tác nhân (Actor) trong hệ thống**

| **Tác nhân**        | **Mô tả**                                                                                | **Thiết bị sử dụng**                 |
| ------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------ |
| Victim (Nạn nhân)   | Người dân gặp tình huống khẩn cấp cần hỗ trợ cứu hộ. Không yêu cầu kỹ năng kỹ thuật cao. | Điện thoại thông minh (mobile-first) |
| Rescuer (Cứu hộ)    | Thành viên đội cứu hộ chuyên nghiệp. Nhận và xử lý nhiệm vụ được giao.                   | Điện thoại thông minh (thực địa)     |
| Commander (Chỉ huy) | Nhân viên trung tâm BCHPCTT. Giám sát toàn bộ và điều phối lực lượng.                    | Máy tính/laptop tại trung tâm        |
| Hệ thống SMS        | Tác nhân ngoại vi – nhận thông báo SOS qua SMS khi mất internet.                         | Hệ thống eSMS.vn                     |

## **2.3 Các loại sự cố được hỗ trợ**

| **Mã loại**  | **Tên sự cố**      | **Mô tả đặc thù tại Lâm Đồng**                                      |
| ------------ | ------------------ | ------------------------------------------------------------------- |
| flood        | Lũ lụt             | Nước lũ dâng nhanh mùa mưa, đặc biệt khu vực hạ lưu các hồ thủy lợi |
| landslide    | Sạt lở đất         | Phổ biến trên các tuyến đèo và khu vực đồi dốc sau mưa lớn          |
| accident     | Tai nạn giao thông | Xe lao xuống vực trên đèo Prenn, Bảo Lộc, Đại Ninh; QL20            |
| medical      | Y tế khẩn cấp      | Đột quỵ, sinh khó, ngộ độc thuốc trừ sâu ở vùng sâu xa trung tâm    |
| fire         | Cháy rừng          | Mùa khô tháng 12–4, cháy lan từ rẫy canh tác vào rừng thông         |
| lost         | Mất tích           | Du khách lạc đường trekking Tà Năng–Phan Dũng, rừng Lang Biang      |
| drowning     | Đuối nước          | Tại thác Datanla, Prenn, hồ Tuyền Lâm, hồ thủy lợi nông thôn        |
| agricultural | Sự cố nông nghiệp  | Tai nạn máy nông nghiệp, vùi lấp khi đào giếng, điện giật nhà kính  |
| adventure    | Du lịch mạo hiểm   | Dù lượn, zipline, xe đạp địa hình; say độ cao trên đỉnh Lang Biang  |
| other        | Khác               | Các tình huống khẩn cấp không thuộc các loại trên                   |

## **2.4 Môi trường vận hành**

**•** Frontend: Trình duyệt web hiện đại (Chrome, Firefox, Safari) trên thiết bị di động và máy tính.

**•** Backend: Máy chủ Node.js 20 LTS trên Render.com (Singapore region).

**•** Database: PostgreSQL 15 + PostGIS trên Supabase (Singapore region).

**•** Mạng: Internet 3G/4G (mobile), WiFi (trung tâm). SMS dự phòng khi mất internet.

**•** Bản đồ: OpenStreetMap tile qua CDN, hỗ trợ cache offline cho khu vực Lâm Đồng.

# **CHƯƠNG 3: YÊU CẦU CHỨC NĂNG**

## **3.1 Quản lý tài khoản và xác thực**

### **3.1.1 Đăng ký tài khoản**

| **Thuộc tính**       | **Mô tả**                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mã chức năng         | F-AUTH-01                                                                                                                                                                                               |
| Tên chức năng        | Đăng ký tài khoản người dùng                                                                                                                                                                            |
| Tác nhân             | Victim, Rescuer, Commander                                                                                                                                                                              |
| Mô tả                | Người dùng đăng ký tài khoản bằng số điện thoại, họ tên, mật khẩu và chọn vai trò. Hệ thống kiểm tra số điện thoại chưa tồn tại, mã hóa mật khẩu bằng bcrypt (cost factor 12) và lưu vào cơ sở dữ liệu. |
| Đầu vào              | Số điện thoại (10 số), Họ tên (2–100 ký tự), Mật khẩu (≥8 ký tự), Vai trò, Mã huyện                                                                                                                     |
| Đầu ra               | Thông tin tài khoản vừa tạo + JWT access token và refresh token                                                                                                                                         |
| Điều kiện tiên quyết | Số điện thoại chưa được đăng ký trong hệ thống                                                                                                                                                          |
| Luồng chính          | 1\. Người dùng nhập thông tin đăng ký 2. Hệ thống validate dữ liệu 3. Kiểm tra số điện thoại trùng 4. Hash mật khẩu 5. Lưu vào DB 6. Trả về token                                                       |
| Luồng ngoại lệ       | Số điện thoại đã tồn tại → lỗi 400. Dữ liệu không hợp lệ → lỗi 400 kèm chi tiết.                                                                                                                        |
| Ràng buộc            | Rate limit: 3 lần đăng ký/giờ/IP                                                                                                                                                                        |

### **3.1.2 Đăng nhập**

| **Thuộc tính** | **Mô tả**                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Mã chức năng   | F-AUTH-02                                                                                                                          |
| Tên chức năng  | Đăng nhập hệ thống                                                                                                                 |
| Tác nhân       | Victim, Rescuer, Commander                                                                                                         |
| Mô tả          | Người dùng đăng nhập bằng số điện thoại và mật khẩu. Hệ thống xác thực và trả về JWT access token (24h) và refresh token (7 ngày). |
| Đầu vào        | Số điện thoại, Mật khẩu                                                                                                            |
| Đầu ra         | accessToken, refreshToken, expiresIn, thông tin user                                                                               |
| Luồng ngoại lệ | Sai thông tin → lỗi 401. Tài khoản bị khóa → lỗi 403.                                                                              |
| Ràng buộc      | Rate limit: 5 lần/15 phút/IP để chống brute force                                                                                  |

## **3.2 Gửi và quản lý SOS**

### **3.2.1 Gửi tín hiệu SOS**

| **Thuộc tính**       | **Mô tả**                                                                                                                                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mã chức năng         | F-SOS-01                                                                                                                                                                                                                                                        |
| Tên chức năng        | Gửi tín hiệu SOS                                                                                                                                                                                                                                                |
| Tác nhân             | Victim                                                                                                                                                                                                                                                          |
| Mô tả                | Victim nhấn nút SOS, chọn loại sự cố, xác nhận qua countdown 5 giây. Hệ thống lấy tọa độ GPS, lưu vào DB với geometry PostGIS, tự động tìm đội cứu hộ gần nhất và phát tín hiệu real-time qua WebSocket. Đồng thời gửi SMS đến trung tâm qua eSMS làm fallback. |
| Đầu vào              | lat (vĩ độ), lng (kinh độ), type (loại sự cố), description (tùy chọn), imageUrl (tùy chọn)                                                                                                                                                                      |
| Đầu ra               | SOS ID, trạng thái "pending", thời gian hủy miễn phạt (cancel_deadline = +3 phút)                                                                                                                                                                               |
| Điều kiện tiên quyết | Đã đăng nhập với vai trò victim. Trình duyệt cho phép GPS.                                                                                                                                                                                                      |
| Luồng chính          | 1\. Victim chọn loại sự cố 2. Hệ thống lấy tọa độ GPS 3. Hiện countdown xác nhận 5 giây 4. Victim xác nhận 5. POST /api/sos 6. Backend lưu DB 7. Emit socket "sos:new" 8. Gửi SMS fallback 9. Trả về SOS ID                                                     |
| Luồng ngoại lệ       | GPS không khả dụng → yêu cầu bật GPS. Mất mạng → lưu vào IndexedDB, gửi khi có mạng.                                                                                                                                                                            |
| Ràng buộc            | Rate limit: 5 SOS/giờ/user. Chỉ 1 SOS active cùng lúc/user.                                                                                                                                                                                                     |

### **3.2.2 Hủy SOS**

| **Thuộc tính** | **Mô tả**                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mã chức năng   | F-SOS-02                                                                                                                                                                                  |
| Tên chức năng  | Hủy tín hiệu SOS                                                                                                                                                                          |
| Tác nhân       | Victim                                                                                                                                                                                    |
| Mô tả          | Victim có thể hủy SOS vừa gửi. Nếu hủy trong vòng 3 phút kể từ khi gửi (trước cancel_deadline) → không bị ghi nhận là báo động giả. Nếu hủy sau 3 phút → tăng false_alarm_count của user. |
| Đầu vào        | SOS ID, lý do hủy (mistake / resolved_myself / other)                                                                                                                                     |
| Đầu ra         | Trạng thái "cancelled", penaltyApplied (true/false)                                                                                                                                       |
| Ràng buộc      | Chỉ victim của SOS đó mới được hủy. SOS đã resolved/false_alarm không được hủy.                                                                                                           |

### **3.2.3 Phân công đội cứu hộ**

| **Thuộc tính**       | **Mô tả**                                                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mã chức năng         | F-SOS-03                                                                                                                                                                                            |
| Tên chức năng        | Phân công đội cứu hộ                                                                                                                                                                                |
| Tác nhân             | Commander                                                                                                                                                                                           |
| Mô tả                | Commander xem danh sách đội cứu hộ gần nhất (do GIS tính toán) và phân công đội phù hợp. Hệ thống cập nhật trạng thái SOS thành "assigned", đội thành "busy", emit WebSocket đến victim và rescuer. |
| Đầu vào              | SOS ID, Team ID                                                                                                                                                                                     |
| Đầu ra               | SOS status = "assigned", assigned_team thông tin đầy đủ                                                                                                                                             |
| Điều kiện tiên quyết | SOS đang ở trạng thái "pending". Đội cứu hộ đang "available".                                                                                                                                       |

### **3.2.4 Cập nhật trạng thái xử lý SOS**

| **Thuộc tính**        | **Mô tả**                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mã chức năng          | F-SOS-04                                                                                                                                                         |
| Tên chức năng         | Cập nhật trạng thái xử lý                                                                                                                                        |
| Tác nhân              | Rescuer                                                                                                                                                          |
| Mô tả                 | Rescuer cập nhật tiến độ xử lý SOS theo các mốc: đang di chuyển → đã đến nơi → hoàn tất. Mỗi cập nhật được ghi vào sos_timeline và phát real-time qua WebSocket. |
| Chuyển đổi trạng thái | assigned → in_progress → arrived → resolved                                                                                                                      |
| Đầu vào               | SOS ID, status mới, note (tùy chọn)                                                                                                                              |
| Ràng buộc             | Chỉ rescuer được phân công mới cập nhật được. Không được nhảy bước (assigned không được chuyển thẳng sang resolved).                                             |

## **3.3 Bản đồ GIS real-time**

### **3.3.1 Hiển thị bản đồ**

| **Thuộc tính** | **Mô tả**                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mã chức năng   | F-MAP-01                                                                                                                                                                                          |
| Tên chức năng  | Hiển thị bản đồ GIS Lâm Đồng                                                                                                                                                                      |
| Tác nhân       | Victim, Rescuer, Commander                                                                                                                                                                        |
| Mô tả          | Hệ thống hiển thị bản đồ Leaflet.js với tile OpenStreetMap, ranh giới 12 huyện/TP Lâm Đồng từ GeoJSON, vị trí hiện tại của người dùng (blue dot). Commander thấy tất cả marker SOS và đội cứu hộ. |
| Tính năng      | Zoom in/out, click marker xem chi tiết, layer ranh giới huyện, custom icon theo loại SOS                                                                                                          |
| Offline        | Tile bản đồ khu vực Lâm Đồng được cache sẵn bởi Service Worker khi có mạng                                                                                                                        |

### **3.3.2 Tìm đội cứu hộ gần nhất**

| **Thuộc tính** | **Mô tả**                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mã chức năng   | F-GIS-01                                                                                                                                                                      |
| Tên chức năng  | Tìm đội cứu hộ gần nhất bằng PostGIS                                                                                                                                          |
| Tác nhân       | Hệ thống (tự động khi có SOS mới)                                                                                                                                             |
| Mô tả          | Sau khi SOS được tạo, GisService tự động tìm đội cứu hộ "available" trong bán kính 10km sử dụng hàm ST_DWithin và ST_Distance của PostGIS, sắp xếp theo khoảng cách tăng dần. |
| Thuật toán     | ST_DWithin(team.location, sos.location, 10000) → ORDER BY ST_Distance ASC                                                                                                     |
| Đầu ra         | Danh sách đội + khoảng cách (mét) + ETA (phút, giả sử 40km/h)                                                                                                                 |
| Giới hạn       | Tối đa 5 đội gần nhất. Nếu không có đội trong 10km → mở rộng lên 20km.                                                                                                        |

## **3.4 Theo dõi và thông báo**

### **3.4.1 Real-time tracking**

| **Thuộc tính** | **Mô tả**                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mã chức năng   | F-RT-01                                                                                                                                                                                          |
| Tên chức năng  | Theo dõi vị trí đội cứu hộ real-time                                                                                                                                                             |
| Tác nhân       | Rescuer (gửi), Victim và Commander (nhận)                                                                                                                                                        |
| Mô tả          | Khi rescuer có nhiệm vụ active, app tự động gửi tọa độ GPS qua WebSocket event "team:update-location" mỗi 30 giây. Hệ thống tính lại ETA và cập nhật marker trên bản đồ của victim và commander. |
| Đầu vào        | lat, lng, sosId                                                                                                                                                                                  |
| Đầu ra         | Cập nhật marker rescuer trên bản đồ + ETA mới                                                                                                                                                    |

### **3.4.2 SMS Fallback**

| **Thuộc tính** | **Mô tả**                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mã chức năng   | F-SMS-01                                                                                                                                                                                                            |
| Tên chức năng  | Gửi SMS cứu hộ dự phòng                                                                                                                                                                                             |
| Tác nhân       | Hệ thống (tự động)                                                                                                                                                                                                  |
| Mô tả          | Ngay sau khi SOS được tạo, hệ thống gửi SMS đến số điện thoại trung tâm BCHPCTT qua eSMS.vn. SMS chứa: tọa độ GPS, loại sự cố, họ tên và số điện thoại nạn nhân, link Google Maps. Hoạt động độc lập với WebSocket. |
| Nội dung SMS   | \[CUU HO LAM DONG\] SOS tai \[lat\],\[lng\] - Loai: \[type\] - \[name\] - \[phone\] - maps.google.com/?q=\[lat\],\[lng\]                                                                                            |
| Ràng buộc      | Lỗi SMS không được làm gián đoạn luồng SOS chính. Ghi log lỗi nhưng không throw exception.                                                                                                                          |

## **3.5 Offline và PWA**

| **Mã**   | **Chức năng**        | **Mô tả**                                                                                                             |
| -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| F-PWA-01 | Cài đặt như app      | Người dùng có thể cài PWA lên màn hình điện thoại qua "Add to Home Screen". App hiển thị icon riêng, chạy fullscreen. |
| F-PWA-02 | Hàng đợi SOS offline | Khi mất mạng, SOS được lưu vào IndexedDB. Service Worker tự gửi lên server khi kết nối trở lại (Background Sync).     |
| F-PWA-03 | Bản đồ offline       | Tile bản đồ khu vực Lâm Đồng (zoom 8–14) được pre-cache khi app khởi động có mạng. Hiện bản đồ từ cache khi offline.  |
| F-PWA-04 | GPS breadcrumb       | Lưu tọa độ GPS vào IndexedDB mỗi 2 phút, kể cả khi offline. Hữu ích cho tình huống trekking mất tích.                 |

# **CHƯƠNG 4: YÊU CẦU PHI CHỨC NĂNG**

## **4.1 Hiệu năng (Performance)**

| **Mã**     | **Yêu cầu**        | **Chỉ tiêu**                                                    | **Phương pháp đo**             |
| ---------- | ------------------ | --------------------------------------------------------------- | ------------------------------ |
| NF-PERF-01 | Độ trễ WebSocket   | < 2 giây từ khi gửi SOS đến khi marker xuất hiện trên dashboard | Test thủ công với 2 thiết bị   |
| NF-PERF-02 | Tải trang đầu tiên | < 3 giây trên kết nối 4G                                        | Chrome DevTools Lighthouse     |
| NF-PERF-03 | API response time  | < 500ms cho 95% requests                                        | Postman runner với 50 requests |
| NF-PERF-04 | PostGIS query      | < 200ms cho tìm đội gần nhất                                    | EXPLAIN ANALYZE trong Supabase |
| NF-PERF-05 | Đồng thời          | Hỗ trợ ít nhất 50 connections WebSocket đồng thời               | Test bằng Artillery.io         |

## **4.2 Bảo mật (Security)**

| **Mã**    | **Yêu cầu**             | **Cách thực hiện**                                                      |
| --------- | ----------------------- | ----------------------------------------------------------------------- |
| NF-SEC-01 | Xác thực JWT            | Mọi API (trừ /auth/\*) phải có JWT hợp lệ trong Authorization header    |
| NF-SEC-02 | Mã hóa mật khẩu         | Bcrypt với cost factor 12. Không lưu mật khẩu dạng plaintext.           |
| NF-SEC-03 | Phân quyền theo vai trò | RolesGuard kiểm tra role trước mỗi controller action                    |
| NF-SEC-04 | Chống SQL Injection     | Dùng parameterized queries cho tất cả raw SQL PostGIS                   |
| NF-SEC-05 | Chống XSS               | Helmet.js set Content-Security-Policy headers. Vue 3 tự escape output.  |
| NF-SEC-06 | HTTPS bắt buộc          | SSL/TLS tự động qua Render.com + Vercel. Geolocation API yêu cầu HTTPS. |
| NF-SEC-07 | Rate Limiting           | 5 SOS/giờ/user. 5 đăng nhập/15 phút/IP. Chống spam và brute force.      |
| NF-SEC-08 | WebSocket auth          | JWT verify khi handshake. Disconnect ngay nếu token không hợp lệ.       |
| NF-SEC-09 | Bảo vệ .env             | Biến môi trường không được commit lên GitHub. Dùng .env.example.        |
| NF-SEC-10 | CORS                    | Chỉ cho phép request từ domain frontend chính thức.                     |

## **4.3 Độ tin cậy (Reliability)**

| **Mã**    | **Yêu cầu**                         | **Chỉ tiêu**                                                                |
| --------- | ----------------------------------- | --------------------------------------------------------------------------- |
| NF-REL-01 | Uptime                              | ≥ 95% trong thời gian demo và thuyết trình                                  |
| NF-REL-02 | SMS Fallback                        | SMS phải được gửi trong vòng 30 giây sau khi có SOS mới                     |
| NF-REL-03 | Lỗi SMS không ảnh hưởng luồng chính | Nếu eSMS lỗi → chỉ log, không làm hỏng SOS flow                             |
| NF-REL-04 | WebSocket reconnect                 | Client tự động kết nối lại trong vòng 5 giây khi mất kết nối                |
| NF-REL-05 | Database backup                     | Supabase tự backup daily (free tier). Không mất dữ liệu khi restart server. |

## **4.4 Khả năng sử dụng (Usability)**

| **Mã**    | **Yêu cầu**           | **Chi tiết**                                                      |
| --------- | --------------------- | ----------------------------------------------------------------- |
| NF-USE-01 | Mobile-first          | Giao diện ưu tiên màn hình 375px–428px (iPhone/Android phổ biến)  |
| NF-USE-02 | Nút SOS dễ nhấn       | Nút SOS tối thiểu 48×48dp, màu đỏ nổi bật, không bị che khuất     |
| NF-USE-03 | Thời gian học         | Victim có thể gửi SOS thành công chỉ sau 1 lần hướng dẫn          |
| NF-USE-04 | Phản hồi trực quan    | Mọi hành động có loading state và kết quả rõ ràng trong < 3 giây  |
| NF-USE-05 | Thông báo lỗi rõ ràng | Lỗi hiển thị bằng tiếng Việt, mô tả nguyên nhân và cách khắc phục |

## **4.5 Khả năng bảo trì (Maintainability)**

**•** Tuân thủ coding conventions TypeScript: không dùng any, dùng interface/type rõ ràng.

**•** Mọi API endpoint có Swagger documentation đầy đủ (mô tả, request, response, error codes).

**•** Mỗi module NestJS độc lập: thêm tính năng mới không ảnh hưởng module khác.

**•** Shared types trong file shared/socket-events.types.ts – không định nghĩa trùng lặp.

**•** Environment variables cho tất cả config thay đổi theo môi trường (dev/prod).

# **CHƯƠNG 5: MÔ HÌNH DỮ LIỆU**

## **5.1 Sơ đồ các bảng chính**

Hệ thống sử dụng 4 bảng chính trong PostgreSQL + PostGIS trên Supabase:

### **5.1.1 Bảng users**

| **Cột**       | **Kiểu dữ liệu** | **Ràng buộc**                             | **Mô tả**                    |
| ------------- | ---------------- | ----------------------------------------- | ---------------------------- |
| id            | UUID             | PRIMARY KEY, DEFAULT gen_random_uuid()    | Khóa chính tự sinh           |
| phone         | VARCHAR(15)      | UNIQUE, NOT NULL                          | Số điện thoại đăng nhập      |
| name          | VARCHAR(100)     | NOT NULL                                  | Họ tên người dùng            |
| password_hash | VARCHAR(255)     | NOT NULL                                  | Mật khẩu đã hash bcrypt      |
| role          | VARCHAR(20)      | CHECK IN ('victim','rescuer','commander') | Vai trò trong hệ thống       |
| district_code | VARCHAR(10)      | NULL                                      | Mã huyện phụ trách/sinh sống |
| ward_code     | VARCHAR(10)      | NULL                                      | Mã xã/phường                 |
| is_active     | BOOLEAN          | DEFAULT true                              | Trạng thái tài khoản         |
| created_at    | TIMESTAMPTZ      | DEFAULT NOW()                             | Thời điểm tạo                |
| updated_at    | TIMESTAMPTZ      | DEFAULT NOW()                             | Thời điểm cập nhật           |

### **5.1.2 Bảng sos_requests**

| **Cột**           | **Kiểu dữ liệu**     | **Ràng buộc**                            | **Mô tả**                   |
| ----------------- | -------------------- | ---------------------------------------- | --------------------------- |
| id                | UUID                 | PRIMARY KEY                              | Khóa chính                  |
| victim_id         | UUID                 | FK → users.id, NOT NULL                  | Người gửi SOS               |
| location          | GEOMETRY(Point,4326) | NOT NULL, GiST INDEX                     | Tọa độ GPS (PostGIS)        |
| type              | VARCHAR(20)          | CHECK IN (10 loại), NOT NULL             | Loại sự cố                  |
| status            | VARCHAR(20)          | CHECK IN 7 trạng thái, DEFAULT 'pending' | Trạng thái xử lý            |
| description       | TEXT                 | NULL                                     | Mô tả thêm từ victim        |
| image_url         | VARCHAR(500)         | NULL                                     | Ảnh thực địa                |
| assigned_team_id  | UUID                 | FK → rescue_teams.id, NULL               | Đội cứu hộ được phân công   |
| district_code     | VARCHAR(10)          | NULL                                     | Mã huyện nơi xảy ra         |
| false_alarm_count | INTEGER              | DEFAULT 0                                | Số lần báo giả của victim   |
| cancel_deadline   | TIMESTAMPTZ          | NULL                                     | Hạn hủy miễn phạt (+3 phút) |
| created_at        | TIMESTAMPTZ          | DEFAULT NOW()                            | Thời điểm gửi SOS           |
| resolved_at       | TIMESTAMPTZ          | NULL                                     | Thời điểm giải quyết xong   |

### **5.1.3 Bảng rescue_teams**

| **Cột**          | **Kiểu dữ liệu**     | **Ràng buộc**                           | **Mô tả**                       |
| ---------------- | -------------------- | --------------------------------------- | ------------------------------- |
| id               | UUID                 | PRIMARY KEY                             | Khóa chính                      |
| name             | VARCHAR(100)         | NOT NULL                                | Tên đội cứu hộ                  |
| leader_id        | UUID                 | FK → users.id                           | Đội trưởng                      |
| district_code    | VARCHAR(10)          | NOT NULL                                | Huyện phụ trách                 |
| specialties      | TEXT\[\]             | DEFAULT '{}'                            | Chuyên môn (flood, medical,...) |
| current_location | GEOMETRY(Point,4326) | NULL, GiST INDEX                        | Vị trí GPS hiện tại             |
| status           | VARCHAR(20)          | CHECK IN ('available','busy','offline') | Trạng thái sẵn sàng             |
| created_at       | TIMESTAMPTZ          | DEFAULT NOW()                           | Thời điểm tạo                   |

### **5.1.4 Bảng sos_timeline**

| **Cột**    | **Kiểu dữ liệu** | **Ràng buộc**                 | **Mô tả**                                           |
| ---------- | ---------------- | ----------------------------- | --------------------------------------------------- |
| id         | UUID             | PRIMARY KEY                   | Khóa chính                                          |
| sos_id     | UUID             | FK → sos_requests.id, CASCADE | SOS liên quan                                       |
| actor_id   | UUID             | FK → users.id, NULL           | Người thực hiện hành động                           |
| action     | VARCHAR(50)      | NOT NULL                      | Hành động (created, assigned, arrived, resolved...) |
| note       | TEXT             | NULL                          | Ghi chú                                             |
| created_at | TIMESTAMPTZ      | DEFAULT NOW()                 | Thời điểm ghi nhận                                  |

# **CHƯƠNG 6: GIAO DIỆN VÀ USE CASE**

## **6.1 Các màn hình chính**

| **Màn hình**        | **Tác nhân** | **Chức năng chính**                                                                            |
| ------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| Đăng ký / Đăng nhập | Tất cả       | Form nhập thông tin, xác thực, lưu JWT vào localStorage                                        |
| HomeView (SOS)      | Victim       | Bản đồ vị trí hiện tại, nút SOS đỏ lớn, chọn loại sự cố, countdown, trạng thái SOS đang active |
| MapView (Theo dõi)  | Victim       | Bản đồ real-time theo dõi vị trí đội cứu hộ, ETA, thông tin đội được phân công, nút hủy SOS    |
| DashboardView       | Commander    | Bản đồ tổng tỉnh Lâm Đồng với tất cả SOS markers, panel danh sách SOS, phân công đội, thống kê |
| RescuerView         | Rescuer      | Danh sách nhiệm vụ, route di chuyển trên bản đồ, cập nhật trạng thái, thông tin nạn nhân       |

## **6.2 Luồng Use Case chính**

### **6.2.1 UC-01: Gửi và xử lý SOS**

| **Bước** | **Tác nhân** | **Hành động**   | **Hệ thống phản hồi**                               |
| -------- | ------------ | --------------- | --------------------------------------------------- |
| 1        | Victim       | Nhấn nút SOS đỏ | Hiện menu chọn loại sự cố                           |
| 2        | Victim       | Chọn loại sự cố | Hiện dialog xác nhận + countdown 5 giây             |
| 3        | Victim       | Xác nhận gửi    | Lấy GPS, POST /api/sos, emit socket, gửi SMS        |
| 4        | Hệ thống     | Tự động         | Tìm đội gần nhất bằng PostGIS, gán team             |
| 5        | Commander    | Thấy SOS mới    | Marker xuất hiện real-time trên bản đồ dashboard    |
| 6        | Commander    | Phân công đội   | Chọn đội từ danh sách gợi ý, click Phân công        |
| 7        | Rescuer      | Nhận nhiệm vụ   | Notification + SOS xuất hiện trong RescuerView      |
| 8        | Rescuer      | Xuất phát       | Cập nhật status "in_progress", GPS tracking bắt đầu |
| 9        | Victim       | Theo dõi        | Thấy marker đội di chuyển + ETA cập nhật mỗi 30s    |
| 10       | Rescuer      | Đến nơi         | Cập nhật "arrived" → "resolved" sau khi xử lý xong  |
| 11       | Hệ thống     | Tự động         | Đóng SOS, ghi timeline, đội trở lại "available"     |

# **CHƯƠNG 7: KIỂM THỬ**

## **7.1 Danh sách test case**

| **Mã TC** | **Chức năng**        | **Đầu vào**                                     | **Kết quả mong đợi**                               | **Mức ưu tiên** |
| --------- | -------------------- | ----------------------------------------------- | -------------------------------------------------- | --------------- |
| TC-01     | Đăng ký              | Phone: 0901234567, Pass: demo1234, Role: victim | HTTP 201, trả về user info + JWT                   | Cao             |
| TC-02     | Đăng ký trùng SĐT    | Phone đã tồn tại                                | HTTP 400, message: "Số điện thoại đã được đăng ký" | Cao             |
| TC-03     | Đăng nhập đúng       | Phone + Pass hợp lệ                             | HTTP 200, trả về accessToken                       | Cao             |
| TC-04     | Đăng nhập sai pass   | Pass không đúng                                 | HTTP 401, không trả token                          | Cao             |
| TC-05     | Gửi SOS              | lat=11.9465, lng=108.4419, type=flood           | HTTP 201, SOS ID, socket emit "sos:new"            | Cao             |
| TC-06     | SOS rate limit       | 6 SOS trong 1 giờ                               | HTTP 429 ở lần thứ 6                               | Cao             |
| TC-07     | Hủy SOS trong 3 phút | cancelDeadline chưa qua                         | penaltyApplied = false                             | Cao             |
| TC-08     | Hủy SOS sau 3 phút   | cancelDeadline đã qua                           | penaltyApplied = true                              | Trung bình      |
| TC-09     | Tìm đội gần nhất     | lat/lng Đà Lạt, radius=10000                    | Trả về ≥1 đội, distance chính xác                  | Cao             |
| TC-10     | Phân quyền           | Victim gọi GET /api/sos (role commander)        | HTTP 403 Forbidden                                 | Cao             |
| TC-11     | WebSocket SOS        | Victim gửi SOS, Commander đang kết nối          | Marker xuất hiện < 2 giây                          | Cao             |
| TC-12     | SMS Fallback         | Gửi SOS với eSMS config                         | SMS đến số trung tâm trong 30 giây                 | Trung bình      |
| TC-13     | SQL Injection        | Description: '; DROP TABLE users; --            | SOS lưu bình thường, bảng không bị xóa             | Cao             |
| TC-14     | Offline SOS          | Tắt mạng, gửi SOS                               | Lưu IndexedDB, tự gửi khi có mạng                  | Trung bình      |
| TC-15     | Token hết hạn        | Dùng token hết hạn                              | HTTP 401, app tự refresh token                     | Trung bình      |

# **CHƯƠNG 8: RỦI RO VÀ GIỚI HẠN**

## **8.1 Rủi ro kỹ thuật**

| **Rủi ro**                                    | **Mức độ** | **Tác động**                                        | **Biện pháp giảm thiểu**                                                                 |
| --------------------------------------------- | ---------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GPS không chính xác trong nhà hoặc thung lũng | Cao        | Tọa độ SOS sai, đội cứu hộ đến sai địa điểm         | Hướng dẫn victim ra nơi thoáng trước khi gửi SOS. Cho phép victim đính kèm ảnh thực địa. |
| Render.com free tier sleep sau 15 phút        | Trung bình | Server mất 30–60 giây wake-up, miss WebSocket event | Cài UptimeRobot ping mỗi 5 phút. Mua gói paid nếu cần demo chính thức.                   |
| eSMS hết credit trong buổi demo               | Trung bình | SMS fallback không gửi được                         | Kiểm tra balance trước demo. Nạp thêm credit dự phòng.                                   |
| Tile OSM chậm trong mạng yếu                  | Thấp       | Bản đồ load chậm, UX kém                            | Pre-cache tile khu vực Lâm Đồng khi mở app. CARTO CDN thay OSM.                          |
| Merge conflict trong nhóm 3 người             | Trung bình | Mất thời gian giải quyết conflict                   | Git branch strategy rõ ràng. Review PR trước khi merge vào develop.                      |

## **8.2 Giới hạn của hệ thống (MVP)**

**•** Không có tính năng xác thực OTP qua SMS khi đăng ký – tài khoản được tạo tức thì.

**•** Không tích hợp cảnh báo thời tiết tự động – commander phải nhập thủ công.

**•** Không có mobile app native (iOS/Android) – chỉ PWA qua trình duyệt.

**•** Không tích hợp LoRa Mesh – chỉ có SMS fallback một chiều (server → trung tâm).

**•** Khả năng chịu tải giới hạn ở ~50 concurrent WebSocket connections (free tier).

**•** Bản đồ offline chỉ cache khu vực Lâm Đồng zoom 8–14, không toàn quốc.

# **PHỤ LỤC**

## **A. Danh sách WebSocket Events**

| **Tên Event**         | **Chiều**       | **Payload chính**                                    | **Mô tả**                  |
| --------------------- | --------------- | ---------------------------------------------------- | -------------------------- |
| sos:new               | Server → Client | id, type, status, location, victim, districtCode     | SOS mới được tạo           |
| sos:updated           | Server → Client | id, status, assignedTeam, updatedAt                  | Trạng thái SOS thay đổi    |
| team:location-updated | Server → Client | teamId, location, distanceToVictim, estimatedArrival | Vị trí đội cứu hộ cập nhật |
| notification:system   | Server → Client | type, title, message, severity, affectedDistricts    | Thông báo hệ thống         |
| team:update-location  | Client → Server | lat, lng, sosId                                      | Rescuer gửi GPS            |
| sos:victim-cancel     | Client → Server | sosId, reason                                        | Victim hủy SOS             |
| commander:assign-team | Client → Server | sosId, teamId                                        | Commander phân công        |
| rescuer:update-status | Client → Server | sosId, status, note                                  | Rescuer cập nhật tiến độ   |

## **B. Môi trường phát triển**

| **Công cụ / Nền tảng** | **Phiên bản / Gói** | **Mục đích**                     |
| ---------------------- | ------------------- | -------------------------------- |
| Node.js                | 20 LTS              | Runtime cho NestJS backend       |
| NestJS                 | v10+                | Backend framework TypeScript     |
| Vue 3                  | v3.x + Vite         | Frontend framework               |
| TypeScript             | v5.x                | Ngôn ngữ lập trình (cả FE và BE) |
| PostgreSQL             | 15 (Supabase)       | Cơ sở dữ liệu quan hệ            |
| PostGIS                | v3.x                | Extension GIS cho PostgreSQL     |
| Socket.io              | v4.x                | WebSocket real-time              |
| Leaflet.js             | v1.9+               | Thư viện bản đồ interactive      |
| eSMS.vn                | REST API v4         | Dịch vụ SMS Việt Nam             |
| Vercel                 | Free tier           | Deploy frontend Vue 3            |
| Render.com             | Free tier           | Deploy backend NestJS            |
| Supabase               | Free tier           | PostgreSQL + PostGIS cloud       |
| GitHub                 | \-                  | Version control + CI/CD          |
| Postman                | v10+                | Test và document API             |