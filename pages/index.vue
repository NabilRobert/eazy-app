<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <h1 class="text-4xl font-bold mb-4">Eazy</h1>
      <p class="text-gray-600 mb-8">Automated LinkedIn Job Applications</p>
      <div class="space-y-3">
        <NuxtLink to="/login" class="block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Sign In
        </NuxtLink>
        <NuxtLink to="/dashboard" class="block px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
          Dashboard
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
