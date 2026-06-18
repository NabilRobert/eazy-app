<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <p class="text-gray-500">Loading…</p>
  </div>
</template>

<script setup lang="ts">
// The global auth middleware sends unauthenticated users to /login;
// authenticated users land on the dashboard.
const { loggedIn } = useUserSession()
await navigateTo(loggedIn.value ? '/dashboard' : '/login')
</script>
