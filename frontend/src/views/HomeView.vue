<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import FeatureCards from '@/components/FeatureCards.vue'
import ProcessSteps from '@/components/ProcessSteps.vue'
import HighlightFeatures from '@/components/HighlightFeatures.vue'
</script>

<template>
  <AppHeader />

  <section class="hero" id="gioi-thieu">
    <svg class="contours" viewBox="0 0 1120 500" preserveAspectRatio="none">
      <path d="M-20,420 C160,380 260,440 420,400 C560,368 640,420 820,380 C940,356 1020,390 1140,360" stroke="#1f3d2e" stroke-width="1" fill="none" opacity="0.5"/>
      <path d="M-20,450 C180,410 280,470 440,430 C580,398 660,450 840,410 C960,386 1040,420 1140,392" stroke="#1f3d2e" stroke-width="1" fill="none" opacity="0.4"/>
      <path d="M-20,380 C150,330 280,400 430,350 C580,300 680,370 860,320 C980,288 1040,330 1140,300" stroke="#a8462b" stroke-width="1" fill="none" opacity="0.4"/>
      <path d="M-20,340 C160,280 300,360 450,300 C600,242 700,320 880,270 C1000,236 1050,280 1140,250" stroke="#a8462b" stroke-width="1" fill="none" opacity="0.3"/>
      <path d="M-20,300 C170,230 320,320 470,250 C630,178 720,270 900,220 C1010,190 1060,230 1140,205" stroke="#6f8f74" stroke-width="1" fill="none" opacity="0.35"/>
    </svg>
    <div class="wrap hero-inner">
      <h1>Định vị cứu trợ <em>nhanh hơn</em> trên bản đồ tỉnh Lâm Đồng</h1>
      <p>Nền tảng tổng hợp ranh giới hành chính, điểm cứu trợ và cảnh báo khu vực nguy hiểm cho 124 xã, phường thuộc Lâm Đồng — từ cao nguyên Đà Lạt đến duyên hải Bình Thuận cũ.</p>
      <div class="hero-actions">
        <!-- <RouterLink to="/map" class="btn btn-primary">Xem bản đồ cứu trợ</RouterLink> -->
         <a href="#ban-do" class="btn btn-primary">Xem bản đồ cứu trợ</a>
        <a href="#quy-trinh" class="btn btn-ghost">Cách hoạt động</a>
      </div>
    </div>
  </section>

  <div class="status">
    <div class="wrap">
      <div class="hero-stats">
        <div class="hero-stat"><b class="mono">124</b><span>Đơn vị hành chính cấp xã</span></div>
        <div class="hero-stat"><b class="mono">24.233</b><span>Km² diện tích tự nhiên</span></div>
        <div class="hero-stat"><b class="mono">3.8tr</b><span>Dân số toàn tỉnh</span></div>
        
      </div>
    </div>
  </div>

  <section id="ban-do">
    <div class="wrap">
      <div class="head reveal" v-reveal>
        <div class="eyebrow">Hệ thống bản đồ</div>
        <h2>Ba lớp thông tin, một điểm nhìn duy nhất</h2>
        <p>Mỗi lớp dữ liệu phục vụ một nhóm người dùng khác nhau — người cần hỗ trợ, đội cứu hộ và người điều phối.</p>
      </div>

      <FeatureCards />

      <div class="map-preview reveal" v-reveal>
        <div class="map-preview-inner">
          <svg width="100%" height="100%" viewBox="0 0 1080 420" preserveAspectRatio="xMidYMid slice">
            <rect width="1080" height="420" fill="#eae3d0"/>
            <path d="M40,120 L220,90 L340,150 L300,260 L180,320 L60,280 Z" fill="#dcd3ba" stroke="#c9bd9c" stroke-width="1"/>
            <path d="M340,150 L520,110 L620,190 L560,300 L400,330 L300,260 Z" fill="#e2d9c0" stroke="#c9bd9c" stroke-width="1"/>
            <path d="M620,190 L800,140 L920,220 L860,330 L680,360 L560,300 Z" fill="#dcd3ba" stroke="#c9bd9c" stroke-width="1"/>
            <path d="M800,140 L980,120 L1040,220 L920,220 Z" fill="#e2d9c0" stroke="#c9bd9c" stroke-width="1"/>
          </svg>
          <div class="pin" style="left:32%; top:38%; background:#a8462b;"></div>
          <div class="pin" style="left:47%; top:55%; background:#1f3d2e;"></div>
          <div class="pin" style="left:63%; top:42%; background:#d99a35;"></div>
          <div class="pin" style="left:58%; top:66%; background:#1f3d2e;"></div>
          <div class="pin" style="left:74%; top:35%; background:#a8462b;"></div>
          <div class="map-legend">
            <div><span class="sw" style="background:#a8462b;"></span>Sự cố khẩn cấp</div>
            <div><span class="sw" style="background:#1f3d2e;"></span>Điểm tiếp nhận</div>
            <div><span class="sw" style="background:#d99a35;"></span>Cảnh báo nguy hiểm</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="process" id="quy-trinh">
    <div class="wrap">
      <div class="head reveal" v-reveal>
        <div class="eyebrow">Quy trình</div>
        <h2>Từ báo cáo đến hỗ trợ, ba bước</h2>
        <p>Luồng dữ liệu tối giản để thông tin đến được đội cứu hộ nhanh nhất có thể.</p>
      </div>
      <ProcessSteps />
    </div>
  </section>

  <section id="tinh-nang">
    <div class="wrap">
      <div class="head reveal" v-reveal style="margin-left:auto; margin-right:auto; text-align:center;">
        <div class="eyebrow" style="justify-content:center;">Tính năng nổi bật</div>
        <h2>Giải pháp toàn diện cho tình huống khẩn cấp</h2>
        <p style="margin-left:auto; margin-right:auto;">Bản đồ cứu trợ Lâm Đồng được xây với các tính năng thiết yếu, giúp người dân vùng chịu ảnh hưởng nhận được hỗ trợ kịp thời.</p>
      </div>
      <HighlightFeatures />
    </div>
  </section>

  <section class="coverage">
    <div class="wrap">
      <div class="reveal" v-reveal>
        <div class="eyebrow">Phạm vi</div>
        <h2 style="font-size:clamp(26px,3.6vw,36px); margin-bottom:18px;">Toàn bộ tỉnh Lâm Đồng sau sáp nhập</h2>
        <p style="color:rgba(42,42,36,0.68); max-width:440px;">Hợp nhất từ Lâm Đồng, Đắk Nông và Bình Thuận cũ — trải dài từ cao nguyên Lang Biang đến duyên hải Phan Thiết, quản lý theo mô hình chính quyền hai cấp.</p>
      </div>
      <div class="coverage-figures reveal" v-reveal>
        <div class="cov-card"><b class="mono">124</b><span>Xã, phường, đặc khu</span></div>
        <div class="cov-card"><b class="mono">3.8tr</b><span>Dân số toàn tỉnh</span></div>
        <div class="cov-card"><b class="mono">2</b><span>Cấp chính quyền: tỉnh, xã</span></div>
      </div>
    </div>
  </section>

  <AppFooter />
</template>
