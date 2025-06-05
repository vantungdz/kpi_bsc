<template>
  <div class="notfound-viewport">
    <div class="starfield"></div>
    <main class="container" role="main" aria-labelledby="title404">
      <h1 id="title404" aria-label="Mã lỗi 404">{{ $t("page404.title") }}</h1>
      <div class="company" aria-label="Tên công ty">{{ $t("page404.company") }}</div>
      <div class="bsc-container" aria-hidden="true" aria-label="Biểu đồ cân bằng chỉ số BSC">
        <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
          <circle class="bsc-ring-bg" cx="60" cy="60" r="45"/>
          <circle class="bsc-ring bsc-finance" cx="60" cy="60" r="45" />
          <circle class="bsc-ring bsc-customer" cx="60" cy="60" r="45" />
          <circle class="bsc-ring bsc-internal" cx="60" cy="60" r="45" />
          <circle class="bsc-ring bsc-learning" cx="60" cy="60" r="45" />
        </svg>
        <div class="labels">
          <div class="label finance" aria-label="Tài chính">{{ $t("page404.bscFinance") }}</div>
          <div class="label customer" aria-label="Khách hàng">{{ $t("page404.bscCustomer") }}</div>
          <div class="label internal" aria-label="Quy trình nội bộ">{{ $t("page404.bscInternal") }}</div>
          <div class="label learning" aria-label="Học hỏi & Phát triển">{{ $t("page404.bscLearning") }}</div>
        </div>
      </div>
      <p class="subtitle">{{ $t("page404.subtitle") }}</p>
      <router-link to="/" class="btn-home" aria-label="Quay về trang chủ">{{ $t("page404.backHome") }}</router-link>
    </main>
  </div>
</template>

<script setup>
// No logic needed for static 404 page
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Open+Sans&display=swap');

.notfound-viewport {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  min-width: 100vw;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, #041c32 0%, #010a17 100%);
  overflow: hidden;
}

.starfield {
  position: fixed;
  top:0; left:0; right:0; bottom:0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(circle 2px at 20% 30%, #4992f5, transparent),
    radial-gradient(circle 2px at 40% 70%, #82c0ff, transparent),
    radial-gradient(circle 1.5px at 70% 20%, #b3d1ff, transparent),
    radial-gradient(circle 1.2px at 85% 80%, #75aaff, transparent);
  background-repeat: repeat;
  background-size: 100px 100px;
  animation: starmove 120s linear infinite;
}
@keyframes starmove {
  from { background-position: 0 0; }
  to { background-position: 10000px 10000px; }
}
.container {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 600px;
  background: rgba(12, 34, 70, 0.8);
  border-radius: 30px;
  box-shadow: 0 0 30px #3e84ffcc;
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 40px 70px;
}
h1 {
  font-family: 'Montserrat', sans-serif;
  font-weight: 900;
  font-size: 7.5rem;
  margin: 0 0 10px;
  color: #3399ff;
  text-shadow:
    0 0 8px #4ab3ff,
    0 0 20px #3399ff,
    0 0 30px #1776ff;
  animation: glowPulse 3s ease-in-out infinite alternate;
  letter-spacing: 16px;
}
@keyframes glowPulse {
  0% {
    text-shadow:
      0 0 8px #4ab3ff,
      0 0 20px #3399ff,
      0 0 30px #1776ff;
    color: #3399ff;
  }
  100% {
    text-shadow:
      0 0 18px #4db3ff,
      0 0 40px #4dbbff,
      0 0 60px #4dbbff;
    color: #55b0ff;
  }
}
.company {
  font-weight: 700;
  font-size: 1.4rem;
  margin-bottom: 20px;
  color: #aad4ffcc;
  letter-spacing: 3px;
}
p.subtitle {
  font-size: 1.3rem;
  margin: 0 0 40px;
  color: #a3c6ffcf;
}
.bsc-container {
  width: 200px;
  height: 200px;
  margin: 0 auto 40px;
  position: relative;
  user-select: none;
}
svg {
  width: 100%;
  height: 100%;
  display: block;
}
circle.bsc-ring-bg {
  fill: none;
  stroke: #214a8a;
  stroke-width: 15;
  opacity: 0.2;
}
circle.bsc-ring {
  fill: none;
  stroke-width: 15;
  stroke-linecap: round;
  transform-origin: 50% 50%;
  animation: ringRotate 15s linear infinite;
}
circle.bsc-finance {
  stroke: #3399ff;
  stroke-dasharray: 94;
  stroke-dashoffset: 94;
  animation: ringDrawFinance 2.5s forwards;
  animation-delay: 0.2s;
}
circle.bsc-customer {
  stroke: #4dbbff;
  stroke-dasharray: 94;
  stroke-dashoffset: 94;
  animation: ringDrawCustomer 2.5s forwards;
  animation-delay: 0.7s;
}
circle.bsc-internal {
  stroke: #69c6ff;
  stroke-dasharray: 94;
  stroke-dashoffset: 94;
  animation: ringDrawInternal 2.5s forwards;
  animation-delay: 1.2s;
}
circle.bsc-learning {
  stroke: #8dd3ff;
  stroke-dasharray: 94;
  stroke-dashoffset: 94;
  animation: ringDrawLearning 2.5s forwards;
  animation-delay: 1.7s;
}
.labels {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0; left: 0;
  pointer-events: none;
}
.label {
  position: absolute;
  font-size: 1rem;
  font-weight: 600;
  text-shadow: 0 0 4px #004a8aaa;
  color: #aad4ffcc;
  user-select: none;
  white-space: nowrap;
  padding: 0 8px;
  background: rgba(1, 25, 43, 0.7);
  border-radius: 12px;
}
.label.finance {
  top: 5%;
  left: 50%;
  transform: translateX(-50%);
}
.label.customer {
  top: 40%;
  right: -18px;
  transform: translateY(-50%);
}
.label.internal {
  bottom: 5%;
  left: 50%;
  transform: translateX(-50%);
}
.label.learning {
  top: 60%;
  left: -18px;
  transform: translateY(-50%);
}
@keyframes ringRotate {
  0% { transform: rotate(0deg);}
  100% {transform: rotate(360deg);}
}
@keyframes ringDrawFinance {
  to { stroke-dashoffset: 47; }
}
@keyframes ringDrawCustomer {
  to { stroke-dashoffset: 37; }
}
@keyframes ringDrawInternal {
  to { stroke-dashoffset: 68; }
}
@keyframes ringDrawLearning {
  to { stroke-dashoffset: 55; }
}
a.btn-home {
  display: inline-block;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 1.2rem;
  padding: 16px 50px;
  color: #003366;
  background: #66b0ff;
  border-radius: 50px;
  box-shadow:
    0 0 15px #66b0ffaa,
    inset 0 0 15px #99ccff;
  text-decoration: none;
  transition: all 0.3s ease;
  user-select: none;
}
a.btn-home:hover, a.btn-home:focus {
  background: #99d1ff;
  box-shadow:
    0 0 25px #99d1ff,
    inset 0 0 20px #bbdeff;
  color: #002247;
  outline: none;
  transform: scale(1.05);
}
@media (max-width: 480px) {
  h1 {
    font-size: 5.5rem;
    letter-spacing: 10px;
  }
  .container {
    max-width: 90vw;
    padding: 30px 25px 50px;
  }
  a.btn-home {
    padding: 14px 40px;
    font-size: 1rem;
  }
  .bsc-container {
    width: 160px;
    height: 160px;
    margin-bottom: 30px;
  }
  .label {
    font-size: 0.85rem;
  }
}
</style>
