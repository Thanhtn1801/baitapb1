# Excel → Flow → Drive (bản khởi đầu)

Extension Chrome Manifest V3, giao diện tiếng Việt. Mỗi dòng một video.

## Chạy

Node.js 24, npm 11. Trong repository:

```sh
npm ci --cache /tmp/flow-npm
npm test
npm run build
```

Mở chrome://extensions, bật Developer mode, chọn Load unpacked và chọn thư mục `extension`. Bấm biểu tượng extension để mở trang làm việc.

## Đã triển khai

- Nhập `.xlsx`, chọn trang tính và cột ảnh; dòng đầu là tiêu đề.
- Xin quyền truy cập các host ảnh khi bấm Đọc ảnh. Đọc URL thuần hoặc hyperlink Excel, kiểm tra phản hồi ảnh và xem trước ảnh.
- Tải ảnh từng dòng để đưa vào Flow. Các URL bài đăng Facebook trả về HTML sẽ được báo lỗi; cần URL ảnh trực tiếp còn hiệu lực.
- Nhập link video Google Drive theo dòng. Xuất file mới chỉ thay các ô ảnh đã có link Drive; giữ nguyên các dòng còn lại, caption, blog và các trang tính khác bằng ExcelJS.

## Chưa triển khai

Đã có cầu nối thử nghiệm gửi ảnh và prompt sang tab Flow đang đăng nhập; chưa kiểm chứng trên giao diện Flow thật. Chưa tự chọn chế độ, bấm tạo, chờ render hoặc lấy video. Chưa đăng nhập OAuth và tải video lên Google Drive. Cần xác minh giao diện Flow trên Chrome đã đăng nhập và thiết lập ứng dụng OAuth Drive trước khi hoàn thiện. Không có giả lập kết quả tạo video. Không tự thay đổi quyền chia sẻ Drive.

Bản hiện tại là quy trình có thao tác thủ công, chưa phải tự động hóa toàn bộ yêu cầu. Không cần nhập mật khẩu vào extension. Dữ liệu và ảnh được xử lý trong trang extension, không gửi lên server riêng. Đóng trang sẽ mất hàng đợi đang mở.

Không hỗ trợ `.xls`, macro hoặc bảo toàn mọi tính năng Excel nâng cao. Nên dùng bản sao file gốc; ExcelJS có thể không giữ một số tính năng không được hỗ trợ. Link ảnh Facebook hết hạn hoặc yêu cầu đăng nhập có thể không tải được.

## Xác minh

`npm test` kiểm tra đọc hyperlink, thay đúng ô, giữ caption/blog/dòng chưa xử lý và trang tính khác sau vòng đọc/ghi XLSX; kiểm tra URL HTTPS và Drive. `npm run build` đóng gói toàn bộ thư viện tại máy, không chạy mã từ CDN. Chưa kiểm thử thực tế trên Chrome/Flow/Drive trong môi trường đám mây này.

## Gửi ảnh sang Flow (thử nghiệm)

1. Reload extension sau khi build. Mở đúng một tab dự án https://flow.google.com/.
2. Chọn chế độ video và cấu hình mong muốn trong Flow; extension không tự thay đổi chế độ, tỉ lệ, model hoặc thời lượng.
3. Bấm + và mở mục tải ảnh để Flow tạo ô chọn file. Nếu hộp chọn file hệ thống xuất hiện, hủy hộp đó.
4. Trong trang extension, nhập Excel, chọn cột ảnh, bấm Đọc ảnh. Sửa prompt chung rồi bấm Gửi ảnh và prompt sang Flow ở một dòng.
5. Kiểm tra Flow đã nhận đúng ảnh và prompt rồi bấm tạo. Nếu adapter báo không tìm thấy ô tải ảnh hoặc prompt, chưa thể dùng cầu nối với giao diện này; không coi thông báo gửi sự kiện là xác nhận Flow đã nhận ảnh.
6. Tạo xong, tải video lên Drive bằng tay và dán link vào đúng dòng trước khi xuất Excel.

Không gửi dòng tiếp theo khi dòng trước chưa tạo xong. Cầu nối không quản lý hàng đợi render. Caption không dùng làm prompt và không bị sửa. Việc gửi ảnh chỉ xảy ra khi bạn bấm nút ở dòng tương ứng.
