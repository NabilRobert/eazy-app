<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="w-full max-w-md space-y-8">
      <div>
        <h1 class="text-center text-4xl font-bold text-gray-900">Eazy</h1>
        <h2 class="mt-4 text-center text-xl font-medium text-gray-700">
          {{ mode === 'login' ? 'Sign in to your account' : 'Create your account' }}
        </h2>
      </div>

      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              required
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="••••••••"
            />
            <p v-if="mode === 'register'" class="mt-1 text-xs text-gray-500">At least 8 characters.</p>
          </div>
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {{ loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account' }}
        </button>

        <p v-if="error" class="text-center text-sm text-red-600">{{ error }}</p>
      </form>

      <p class="text-center text-sm text-gray-600">
        {{ mode === 'login' ? "Don't have an account?" : 'Already have an account?' }}
        <button type="button" class="font-medium text-blue-600 hover:text-blue-500" @click="toggleMode">
          {{ mode === 'login' ? 'Create one' : 'Sign in' }}
        </button>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { mode, form, loading, error, toggleMode, handleSubmit } = useLogin()
</script>
