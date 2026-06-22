<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow">
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center">
          <h1 class="text-3xl font-bold tracking-tight text-gray-900">Settings</h1>
          <NuxtLink to="/dashboard" class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200">
            Back to Dashboard
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <!-- Profile Section -->
      <div class="rounded-lg bg-white shadow p-6">
        <h2 class="text-xl font-bold mb-4">Profile</h2>
        <form class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Full Name</label>
              <input v-model="profile.fullName" type="text" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Phone</label>
              <input v-model="profile.phone" type="tel" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Location</label>
              <LocationInput v-model="profile.location" placeholder="Start typing your city…" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Years of Experience</label>
              <input v-model.number="profile.yearsExperience" type="number" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Education</label>
            <input v-model="profile.education" type="text" placeholder="e.g., Bachelor of Science in Computer Science" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>

          <button @click="saveProfile" type="button" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Profile</button>
        </form>
      </div>

      <!-- Resume -->
      <div class="rounded-lg bg-white shadow p-6">
        <h2 class="text-xl font-bold mb-4">Resume</h2>
        <div class="flex items-center gap-3">
          <span :class="['h-2.5 w-2.5 rounded-full', resumeUploaded ? 'bg-green-500' : 'bg-gray-300']"></span>
          <span class="text-sm text-gray-700">{{ resumeUploaded ? 'Resume uploaded' : 'No resume yet' }}</span>
        </div>
        <label class="mt-4 inline-block">
          <span class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer inline-block">
            {{ resumeUploading ? 'Uploading…' : resumeUploaded ? 'Replace PDF' : 'Upload PDF' }}
          </span>
          <input type="file" accept="application/pdf" class="hidden" :disabled="resumeUploading" @change="onResumeChange" />
        </label>
        <p class="text-xs text-gray-500 mt-2">PDF only, up to 5MB.</p>
      </div>

      <!-- Job Targeting -->
      <div class="rounded-lg bg-white shadow p-6">
        <h2 class="text-xl font-bold mb-4">Job Targeting</h2>
        <form class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Desired Position</label>
              <input v-model="targeting.desiredPosition" type="text" placeholder="e.g., Frontend Developer" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Preferred Location</label>
              <LocationInput v-model="targeting.preferredLocation" placeholder="Where do you want to work?" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Employment Type</label>
              <select v-model="targeting.employmentType" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">Select...</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="remote">Remote</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Minimum Salary (Optional)</label>
              <input v-model.number="targeting.minSalary" type="number" placeholder="Annual salary" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          <button @click="saveTargeting" type="button" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Targeting</button>
        </form>
      </div>

      <!-- LinkedIn Auth -->
      <div class="rounded-lg bg-white shadow p-6">
        <h2 class="text-xl font-bold mb-4">LinkedIn Account</h2>
        <div class="flex items-center gap-2 mb-4">
          <span :class="['h-2.5 w-2.5 rounded-full', linkedinDot]"></span>
          <span class="text-sm text-gray-700">{{ linkedinStatusText }}</span>
        </div>
        <button @click="openLinkedin" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {{ linkedinStatus === 'authenticated' ? 'Reconnect LinkedIn' : 'Connect LinkedIn' }}
        </button>
      </div>

      <!-- Automation Settings -->
      <div class="rounded-lg bg-white shadow p-6">
        <h2 class="text-xl font-bold mb-4">Automation</h2>
        <form class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Trigger Type</label>
            <div class="mt-2 space-y-2">
              <label class="flex items-center">
                <input v-model="automation.triggerType" type="radio" value="manual" class="mr-2" />
                <span>Manual (Start/Stop buttons)</span>
              </label>
              <label class="flex items-center">
                <input v-model="automation.triggerType" type="radio" value="scheduled" class="mr-2" />
                <span>Scheduled</span>
              </label>
            </div>
          </div>

          <div v-if="automation.triggerType === 'scheduled'">
            <label class="block text-sm font-medium text-gray-700">Start Time</label>
            <input v-model="automation.scheduledTime" type="time" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>

          <button @click="saveAutomation" type="button" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Automation Settings</button>
        </form>
      </div>

      <p v-if="toast" class="text-center text-sm text-green-700">{{ toast }}</p>
    </main>

    <!-- LinkedIn connect modal -->
    <div v-if="li.open" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-bold">Connect LinkedIn</h3>
          <button @click="li.open = false" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <p class="text-xs text-gray-500">
          Your password is used only to sign in and is never stored.
        </p>

        <template v-if="li.step === 'creds'">
          <input v-model="li.email" type="email" autofocus placeholder="LinkedIn email" class="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <input v-model="li.password" type="password" placeholder="LinkedIn password" class="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <button @click="submitCreds" :disabled="li.loading" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ li.loading ? 'Connecting…' : 'Connect' }}
          </button>
        </template>

        <template v-else-if="li.step === '2fa'">
          <p class="text-sm text-gray-700">LinkedIn sent a verification code. Enter it below.</p>
          <input v-model="li.code" type="text" inputmode="numeric" placeholder="Verification code" class="block w-full px-3 py-2 border border-gray-300 rounded-md" />
          <button @click="submitCode" :disabled="li.loading" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ li.loading ? 'Verifying…' : 'Verify' }}
          </button>
        </template>

        <p v-if="li.error" class="text-sm text-red-600">{{ li.error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  toast,
  profile,
  targeting,
  automation,
  linkedinStatus,
  linkedinDot,
  linkedinStatusText,
  saveProfile,
  saveTargeting,
  saveAutomation,
  resumeUploaded,
  resumeUploading,
  onResumeChange,
  li,
  openLinkedin,
  submitCreds,
  submitCode
} = useSettings()
</script>
