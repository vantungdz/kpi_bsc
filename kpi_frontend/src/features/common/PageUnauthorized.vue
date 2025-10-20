<template>
  <div class="error-viewport">
    <div class="starfield"></div>
    <main class="container" role="main" aria-labelledby="title401">
      <h1 id="title401" aria-label="Error code 401">
        {{ $t("page401.title") }}
      </h1>
      <div class="company">{{ $t("page401.company") }}</div>
      <div class="error-message">{{ $t("page401.message") }}</div>
      <div class="button-group">
        <router-link to="/" class="btn-home">
          {{ $t("page401.backHome") }}
        </router-link>
        <button @click="handleLogout" class="btn-logout">
          {{ $t("page401.logout") }}
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { useStore } from "vuex";
import { useRouter } from "vue-router";

const store = useStore();
const router = useRouter();

const handleLogout = async () => {
  await store.dispatch("auth/logout");
  router.push("/login");
};
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
    radial-gradient(circle 2px at 20% 30%, #ff6b6b, transparent),
    radial-gradient(circle 2px at 40% 70%, #ff8e8e, transparent),
    radial-gradient(circle 1.5px at 70% 20%, #ffb3b3, transparent),
    radial-gradient(circle 1.2px at 85% 80%, #ff9999, transparent);
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
  background: rgba(70, 34, 34, 0.85);
  border-radius: 30px;
  box-shadow: 0 0 30px #ff3e3ecc;
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
  color: #ff3333;
  text-shadow:
    0 0 8px #ff4a4a,
    0 0 20px #ff3333,
    0 0 30px #ff1717;
  animation: glowPulse 3s ease-in-out infinite alternate;
  letter-spacing: 12px;
}
@keyframes glowPulse {
  0% {
    text-shadow:
      0 0 8px #ff4a4a,
      0 0 20px #ff3333,
      0 0 30px #ff1717;
    color: #ff3333;
  }
  100% {
    text-shadow:
      0 0 18px #ff4a4a,
      0 0 40px #ff4a4a,
      0 0 60px #ff4a4a;
    color: #ff4a4a;
  }
}
.company {
  font-weight: 700;
  font-size: 1.2rem;
  margin-bottom: 18px;
  color: #ffe0e0cc;
  letter-spacing: 2px;
}
.error-message {
  font-size: 1.3rem;
  margin: 0 0 32px;
  color: #ffcccc;
}
.button-group {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
}
a.btn-home {
  display: inline-block;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  padding: 14px 40px;
  color: #330000;
  background: #ff4a4a;
  border-radius: 50px;
  box-shadow:
    0 0 15px #ff4a4aaa,
    inset 0 0 15px #ffe0e0;
  text-decoration: none;
  transition: all 0.3s ease;
  user-select: none;
}
a.btn-home:hover,
a.btn-home:focus {
  background: #ff9999;
  box-shadow:
    0 0 25px #ff9999,
    inset 0 0 20px #fff0f0;
  color: #330000;
  outline: none;
  transform: scale(1.05);
}
.btn-logout {
  display: inline-block;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  padding: 14px 40px;
  color: #330000;
  background: #ff6666;
  border: none;
  border-radius: 50px;
  box-shadow:
    0 0 15px #ff6666aa,
    inset 0 0 15px #ffe0e0;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}
.btn-logout:hover,
.btn-logout:focus {
  background: #ff9999;
  box-shadow:
    0 0 25px #ff9999,
    inset 0 0 20px #fff0f0;
  color: #330000;
  outline: none;
  transform: scale(1.05);
}
</style>
