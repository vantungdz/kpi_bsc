<template>
    <a-layout style="min-height: 100vh">
        <AppSidebar v-if="isAuthenticated" />

        <a-layout>
            <AppHeader v-if="isAuthenticated" />

            <a-layout-content style="margin: 16px;">
                <div v-if="isAuthenticating"
                    style="display: flex; justify-content: center; align-items: center; height: calc(100vh - 100px);">
                    <a-spin size="large" tip="Loading user data..." />
                </div>
                <router-view v-else />
            </a-layout-content>

            <a-layout-footer style="text-align: center; padding: 13px 50px; background: #f0f2f5;"> Created by IVC ©{{
                new Date().getFullYear() }}
            </a-layout-footer>
        </a-layout>
    </a-layout>
</template>

<script setup>

import { ref, computed, onMounted, watch } from 'vue'; 
import { useStore } from 'vuex'; 
import AppHeader from '@/core/components/layout/AppHeader.vue';
import AppSidebar from '@/core/components/layout/AppSidebar.vue';

import { Layout as ALayout, LayoutContent as ALayoutContent, LayoutFooter as ALayoutFooter, Spin as ASpin } from 'ant-design-vue';


const store = useStore();



const isAuthenticating = ref(true);



const isAuthenticated = computed(() => store.getters['auth/isAuthenticated']);


onMounted(async () => {
    isAuthenticating.value = true;
    const token = store.getters['auth/token'];

    
    if (token) {
        
        console.log('App.vue onMounted: Token found, fetching user profile...');
        try {
            await store.dispatch('auth/fetchUserProfile');
            console.log('App.vue onMounted: User profile fetch attempt finished.');
            
            if (isAuthenticated.value) { 
                store.dispatch("notifications/fetchUnreadCount");
            }
        } catch (error) {
            
            console.error('App.vue onMounted: Error during fetchUserProfile dispatch (logout might have been triggered).');
        }
    } else {
        console.log('App.vue onMounted: No token found.');
        
        if (store.getters['auth/user']) {
            console.warn("App.vue: User state exists without token, forcing logout.");
            store.dispatch('auth/logout'); 
        }
    }
    

    isAuthenticating.value = false;
});


watch(isAuthenticated, (newValue, oldValue) => {
    
    if (newValue && !oldValue) {
        store.dispatch("notifications/fetchUnreadCount");
    }
});
</script>

<style scoped>
/* Thêm style nếu cần */
.ant-layout-content {
    padding: 24px;
    /* Thêm padding cho nội dung */
    background: #fff;
    /* Nền trắng cho nội dung */
    min-height: calc(100vh - 64px - 48px - 32px);
    /* Tính toán chiều cao tối thiểu (Header 64, Footer ~48, Margin 16*2) */
}
</style>