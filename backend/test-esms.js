// Test độc lập gửi SMS qua eSMS.vn — KHÔNG đụng tới NestJS/DB/Auth,
// chỉ để cô lập xem cấu hình ESMS_API_KEY/ESMS_SECRET_KEY có đúng không.
// Chạy: node test-esms.js  (từ chính thư mục backend/, để dotenv đọc đúng backend/.env)
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const axios = require('axios');

const URL = 'http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/';

async function main() {
  const payload = {
    ApiKey: process.env.ESMS_API_KEY,
    SecretKey: process.env.ESMS_SECRET_KEY,
    Phone: process.env.RESCUE_CENTER_PHONE,
    Content: '[TEST] Rescue GIS Lam Dong - kiem tra gui SMS',
    SmsType: process.env.ESMS_SMS_TYPE || '4',
    IsUnicode: '0',
  };

  console.log('--- Config check (không in giá trị key) ---');
  console.log('ApiKey set:', !!payload.ApiKey);
  console.log('SecretKey set:', !!payload.SecretKey);
  console.log('Phone:', payload.Phone);
  console.log('SmsType:', payload.SmsType);

  if (!payload.ApiKey || !payload.SecretKey || !payload.Phone) {
    console.error('\n❌ Thiếu ESMS_API_KEY / ESMS_SECRET_KEY / RESCUE_CENTER_PHONE trong .env — điền rồi chạy lại.');
    process.exit(1);
  }

  try {
    const res = await axios.post(URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    console.log('\n--- Response từ eSMS ---');
    console.log(JSON.stringify(res.data, null, 2));
    if (res.data?.CodeResult === '100') {
      console.log('\n✅ Gửi thành công. SMSID:', res.data.SMSID);
    } else {
      console.log('\n❌ Gửi thất bại. CodeResult:', res.data?.CodeResult, '— Xem bảng mã lỗi tại trang tài liệu API của esms.vn.');
    }
  } catch (e) {
    console.error('\n❌ Request lỗi (network/timeout):', e.message);
  }
}

main();
