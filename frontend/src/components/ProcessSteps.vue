<script setup lang="ts">
import type { ProcessStepData } from '@/types'

const steps: ProcessStepData[] = [
  {
    n: 1,
    title: 'Ghi nhận vị trí',
    desc: 'Người dân gửi vị trí cần cứu trợ hoặc cảnh báo nguy hiểm kèm toạ độ GPS trực tiếp từ thiết bị.'
  },
  {
    n: 2,
    title: 'Đối chiếu ranh giới',
    desc: 'Hệ thống tự động xác định vị trí thuộc xã/phường nào, gắn với điểm cứu trợ gần nhất bằng truy vấn không gian.'
  },
  {
    n: 3,
    title: 'Điều phối hỗ trợ',
    desc: 'Đội cứu hộ và tình nguyện viên xem bản đồ tổng hợp, ưu tiên theo mức độ khẩn cấp và khoảng cách.'
  }
]
</script>

<template>
  <div class="steps">
    <div v-for="step in steps" :key="step.n" class="step reveal" v-reveal>
      <div class="n">{{ step.n }}</div>
      <h3>{{ step.title }}</h3>
      <p>{{ step.desc }}</p>
    </div>
  </div>
</template>
