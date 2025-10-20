<template>
  <div class="error-viewport">
    <div class="starfield"></div>
    <main class="container" role="main" aria-labelledby="title500">
      <h1 id="title500" aria-label="Error code 500">
        {{ $t("page500.title") }}
      </h1>
      <div class="company">{{ $t("page500.company") }}</div>
      <div class="error-message">{{ $t("page500.message") }}</div>
      <router-link to="/" class="btn-home">{{
        $t("page500.backHome")
      }}</router-link>
    </main>
  </div>
</template>

<script setup>
// No logic needed for static 500 page
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Open+Sans&display=swap");
.error-viewport {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, #2c3240 0%, #0a1720 100%);
  overflow: hidden;
}
.starfield {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  from {
    background-position: 0 0;
  }
  to {
    background-position: 10000px 10000px;
  }
}
.container {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 500px;
  background: rgba(34, 52, 70, 0.85);
  border-radius: 30px;
  box-shadow: 0 0 30px #3e84ffcc;
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 40px 50px;
}
h1 {
  font-family: "Montserrat", sans-serif;
  font-weight: 900;
  font-size: 6rem;
  margin: 0 0 10px;
  color: #ff5555;
  text-shadow:
    0 0 8px #ff8888,
    0 0 20px #ff5555,
    0 0 30px #ff2222;
  animation: glowPulse 3s ease-in-out infinite alternate;
  letter-spacing: 12px;
}
@keyframes glowPulse {
  0% {
    text-shadow:
      0 0 8px #ff8888,
      0 0 20px #ff5555,
      0 0 30px #ff2222;
    color: #ff5555;
  }
  100% {
    text-shadow:
      0 0 18px #ff8888,
      0 0 40px #ff8888,
      0 0 60px #ff8888;
    color: #ff8888;
  }
}
.company {
  font-weight: 700;
  font-size: 1.2rem;
  margin-bottom: 18px;
  color: #ffd6d6cc;
  letter-spacing: 2px;
}
.error-message {
  font-size: 1.3rem;
  margin: 0 0 32px;
  color: #ffb3b3;
}
a.btn-home {
  display: inline-block;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  padding: 14px 40px;
  color: #330000;
  background: #ff8888;
  border-radius: 50px;
  box-shadow:
    0 0 15px #ff8888aa,
    inset 0 0 15px #ffd6d6;
  text-decoration: none;
  transition: all 0.3s ease;
  user-select: none;
}
a.btn-home:hover,
a.btn-home:focus {
  background: #ffb3b3;
  box-shadow:
    0 0 25px #ffb3b3,
    inset 0 0 20px #ffe0e0;
  color: #330000;
  outline: none;
  transform: scale(1.05);
}
</style>
