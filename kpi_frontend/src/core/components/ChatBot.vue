<template>
    <div>
        <button class="chatbot-fab" @click="toggleChat">
            <span v-if="!isOpen">💬</span>
            <span v-else>✖</span>
        </button>
        <transition name="chatbot-fade">
            <div v-if="isOpen" class="chatbot-window">
                <div class="chatbot-header">{{ $t('chatbot.header') }}</div>
                <div class="chatbot-messages" ref="messagesRef">
                    <div v-for="(msg, idx) in messages" :key="idx" :class="['chatbot-msg', msg.from]">
                        <span v-if="msg.from === 'bot'">🤖</span>
                        <span v-else>🧑</span>
                        <span>{{ msg.text }}</span>
                    </div>
                </div>
                <form class="chatbot-input-row" @submit.prevent="sendMessage">
                    <input v-model="input" type="text" :placeholder="$t('chatbot.inputPlaceholder')" autocomplete="off"
                        :disabled="isThinking" />
                    <button type="submit" :disabled="isThinking">{{ $t('chatbot.send') }} </button>
                </form>
            </div>
        </transition>
    </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';

const { t: $t, locale } = useI18n();

const isOpen = ref(false);
const input = ref('');
const messages = ref([
    { from: 'bot', text: $t('chatbot.greeting') }
]);
const messagesRef = ref(null);
const isThinking = ref(false);

watch(locale, () => {
    // Đổi lại toàn bộ tin nhắn bot sang ngôn ngữ mới
    messages.value = messages.value.map(msg =>
        msg.from === 'bot' ? { ...msg, text: getBotReply(msg.text, true) } : msg
    );
    // Đổi lại lời chào đầu tiên nếu chưa chat gì
    if (messages.value.length === 1 && messages.value[0].from === 'bot') {
        messages.value[0].text = $t('chatbot.greeting');
    }
});

function toggleChat() {
    isOpen.value = !isOpen.value;
    if (isOpen.value) nextTick(scrollToBottom);
}

async function sendMessage() {
    const text = input.value.trim();
    if (!text || isThinking.value) return;
    messages.value.push({ from: 'user', text });
    input.value = '';
    nextTick(scrollToBottom);

    // Hiển thị trạng thái đang trả lời
    isThinking.value = true;
    messages.value.push({ from: 'bot', text: $t('chatbot.thinking'), key: 'chatbot.thinking' });
    nextTick(scrollToBottom);

    // Gọi Gemini API
    const reply = await getGeminiReply(text);

    // Xóa trạng thái đang trả lời và thêm câu trả lời thực tế
    messages.value.pop();
    messages.value.push({ from: 'bot', text: reply });
    isThinking.value = false;
    nextTick(scrollToBottom);
}

async function getGeminiReply(text) {
    try {
        const response = await axios.post('/api/gemini/chat', { message: text });
        return response.data.text || $t('chatbot.unknown');
    } catch (e) {
        return $t('chatbot.unknown');
    }
}

function scrollToBottom() {
    if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
    }
}

function getBotReply(text, forceGreeting = false) {
    // forceGreeting: dùng khi đổi ngôn ngữ, chỉ trả về greeting nếu là tin nhắn đầu tiên
    if (forceGreeting && (text === $t('chatbot.greeting') || text === undefined)) {
        return $t('chatbot.greeting');
    }
    const lower = text.toLowerCase ? text.toLowerCase() : '';
    if (lower.includes('kpi là gì') || lower.includes('what is kpi'))
        return $t('chatbot.kpiDefinition');
    if (lower.includes('hướng dẫn') || lower.includes('sử dụng') || lower.includes('guide'))
        return $t('chatbot.guide');
    if (lower.includes('deadline') || lower.includes('hạn'))
        return $t('chatbot.deadline');
    if (lower.includes('ai là người đánh giá') || lower.includes('who evaluates'))
        return $t('chatbot.evaluator');
    if (lower.includes('xin chào') || lower.includes('hello'))
        return $t('chatbot.hello');
    if (lower.includes('báo cáo') || lower.includes('report'))
        return $t('chatbot.report');
    return $t('chatbot.unknown');
}
</script>

<style scoped>
.chatbot-fab {
    position: fixed;
    bottom: 32px;
    right: 32px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #1976d2;
    color: #fff;
    font-size: 1.5em;
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    cursor: pointer;
    z-index: 1001;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
}

.chatbot-fab:hover {
    background: #1565c0;
}

.chatbot-window {
    position: fixed;
    bottom: 100px;
    right: 32px;
    width: 340px;
    max-width: 95vw;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
    z-index: 1002;
    display: flex;
    flex-direction: column;
    animation: chatbot-pop 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes chatbot-pop {
    0% {
        transform: scale(0.85);
        opacity: 0;
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}

.chatbot-header {
    background: #1976d2;
    color: #fff;
    padding: 12px 18px;
    border-radius: 12px 12px 0 0;
    font-weight: 600;
    font-size: 1.1em;
}

.chatbot-messages {
    padding: 12px 12px 0 12px;
    max-height: 260px;
    overflow-y: auto;
    background: #f7fafd;
    flex: 1;
}

.chatbot-msg {
    margin-bottom: 8px;
    display: flex;
    align-items: flex-end;
    gap: 6px;
    font-size: 0.98em;
}

.chatbot-msg.bot {
    color: #1976d2;
}

.chatbot-msg.user {
    color: #333;
    justify-content: flex-end;
}

.chatbot-input-row {
    display: flex;
    border-top: 1px solid #e3e8ee;
    padding: 8px 10px;
    background: #f7fafd;
    border-radius: 0 0 12px 12px;
}

.chatbot-input-row input {
    flex: 1;
    border: 1px solid #b3c6e0;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 1em;
    outline: none;
    margin-right: 8px;
    background: #fff;
    transition: border 0.2s;
}

.chatbot-input-row input:focus {
    border: 1.5px solid #1976d2;
}

.chatbot-input-row button {
    background: #1976d2;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 16px;
    font-size: 1em;
    cursor: pointer;
    transition: background 0.2s;
}

.chatbot-input-row button:hover {
    background: #1565c0;
}

.chatbot-fade-enter-active,
.chatbot-fade-leave-active {
    transition: opacity 0.25s;
}

.chatbot-fade-enter-from,
.chatbot-fade-leave-to {
    opacity: 0;
}
</style>
  
