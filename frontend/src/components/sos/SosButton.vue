<script setup lang="ts">
// Nút SOS chính (role victim). Bấm → mở dialog xác nhận có đếm ngược, KHÔNG gửi ngay
// để tránh bấm nhầm trong hoảng loạn. Việc gửi thật do component cha xử lý qua sự kiện.
defineEmits<{ open: [] }>()
</script>

<template>
  <button class="sos-main-btn" @click="$emit('open')" aria-label="Gửi tín hiệu cứu trợ khẩn cấp">
    <span class="sos-ring"></span>
    <span class="sos-core">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L22 20H2L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M12 10V14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="12" cy="17" r="1" fill="currentColor"/>
      </svg>
      <b>SOS</b>
    </span>
  </button>
</template>

<style scoped>
.sos-main-btn{
  position:relative; width:120px; height:120px; border:none; background:transparent;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
}
.sos-core{
  position:relative; z-index:2; width:96px; height:96px; border-radius:50%;
  background:#a8462b; color:#fff; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:2px;
  box-shadow:0 8px 24px rgba(168,70,43,0.45); transition:transform .15s ease;
}
.sos-core b{ font-family:'Fraunces',serif; font-size:20px; letter-spacing:1px; }
.sos-main-btn:active .sos-core{ transform:scale(0.94); }
/* vòng sóng lan toả liên tục để thu hút chú ý trong tình huống khẩn cấp */
.sos-ring{
  position:absolute; inset:0; border-radius:50%; background:rgba(168,70,43,0.35);
  animation:sos-pulse 1.8s ease-out infinite;
}
@keyframes sos-pulse{
  0%{ transform:scale(0.8); opacity:0.7; }
  100%{ transform:scale(1.35); opacity:0; }
}
@media (prefers-reduced-motion: reduce){
  .sos-ring{ animation:none; }
}
</style>