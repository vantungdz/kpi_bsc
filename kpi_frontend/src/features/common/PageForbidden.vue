<template>
  <div class="error-viewport">
    <div class="starfield"></div>
    <main class="container" role="main" aria-labelledby="title403">
      <h1 id="title403" aria-label="Error code 403">
        {{ $t("page403.title") }}
      </h1>
      <div class="company">{{ $t("page403.company") }}</div>
      <div class="error-message">{{ $t("page403.message") }}</div>
      <router-link to="/" class="btn-home">{{
        $t("page403.backHome")
      }}</router-link>
    </main>
  </div>
</template>

<script setup>
// No logic needed for static 403 page
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
  background: radial-gradient(circle at center, #2c2c32 0%, #0a0a17 100%);
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
  background: rgba(34, 34, 70, 0.85);
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
  color: #ff9933;
  text-shadow:
    0 0 8px #ffb84a,
    0 0 20px #ff9933,
    0 0 30px #ff7717;
  animation: glowPulse 3s ease-in-out infinite alternate;
  letter-spacing: 12px;
}
@keyframes glowPulse {
  0% {
    text-shadow:
      0 0 8px #ffb84a,
      0 0 20px #ff9933,
      0 0 30px #ff7717;
    color: #ff9933;
  }
  100% {
    text-shadow:
      0 0 18px #ffb84a,
      0 0 40px #ffb84a,
      0 0 60px #ffb84a;
    color: #ffb84a;
  }
}
.company {
  font-weight: 700;
  font-size: 1.2rem;
  margin-bottom: 18px;
  color: #ffe0b2cc;
  letter-spacing: 2px;
}
.error-message {
  font-size: 1.3rem;
  margin: 0 0 32px;
  color: #ffd699;
}
a.btn-home {
  display: inline-block;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  padding: 14px 40px;
  color: #332200;
  background: #ffb84a;
  border-radius: 50px;
  box-shadow:
    0 0 15px #ffb84aaa,
    inset 0 0 15px #ffe0b2;
  text-decoration: none;
  transition: all 0.3s ease;
  user-select: none;
}
a.btn-home:hover,
a.btn-home:focus {
  background: #ffd699;
  box-shadow:
    0 0 25px #ffd699,
    inset 0 0 20px #fff3e0;
  color: #332200;
  outline: none;
  transform: scale(1.05);
}
</style>
