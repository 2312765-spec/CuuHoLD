// Directive v-reveal: thay thế cho đoạn IntersectionObserver viết tay trong script.js cũ.
// Cách dùng trong template: <div class="reveal" v-reveal>...</div>
// Giữ nguyên class "reveal" và "in" để không cần đổi bất kỳ rule CSS nào trong style.css.

import type { Directive } from 'vue'

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in')
        observer.unobserve(entry.target)
      }
    })
  },
  { threshold: 0.15 }
)

export const vReveal: Directive<HTMLElement> = {
  mounted(el) {
    observer.observe(el)
  },
  unmounted(el) {
    observer.unobserve(el)
  }
}
