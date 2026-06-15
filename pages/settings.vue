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
              <input
                v-model="profile.fullName"
                type="text"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Phone</label>
              <input
                v-model="profile.phone"
                type="tel"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Location</label>
              <input
                v-model="profile.location"
                type="text"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Years of Experience</label>
              <input
                v-model.number="profile.yearsExperience"
                type="number"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Education</label>
            <input
              v-model="profile.education"
              type="text"
              placeholder="e.g., Bachelor of Science in Computer Science"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            @click="saveProfile"
            type="button"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Profile
          </button>
        </form>
      </div>

      <!-- Job Targeting -->
      <div class="rounded-lg bg-white shadow p-6">
        <h2 class="text-xl font-bold mb-4">Job Targeting</h2>
        <form class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Desired Position</label>
              <input
                v-model="targeting.desiredPosition"
                type="text"
                placeholder="e.g., Frontend Developer"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Preferred Location</label>
              <input
                v-model="targeting.preferredLocation"
                type="text"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Employment Type</label>
              <select
                v-model="targeting.employmentType"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="remote">Remote</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Minimum Salary (Optional)</label>
              <input
                v-model.number="targeting.minSalary"
                type="number"
                placeholder="Annual salary in USD"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <button
            @click="saveTargeting"
            type="button"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Targeting
          </button>
        </form>
      </div>

      <!-- LinkedIn Auth -->
      <div class="rounded-lg bg-white shadow p-6">
        <h2 class="text-xl font-bold mb-4">LinkedIn Account</h2>
        <div class="mb-4">
          <p class="text-sm text-gray-600 mb-4">
            Connect your LinkedIn account to start automating applications.
          </p>
          <button
            @click="connectLinkedin"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Connect LinkedIn
          </button>
        </div>
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
            <input
              v-model="automation.scheduledTime"
              type="time"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            @click="saveAutomation"
            type="button"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Automation Settings
          </button>
        </form>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const profile = reactive({
  fullName: '',
  phone: '',
  location: '',
  yearsExperience: null as number | null,
  education: ''
})

const targeting = reactive({
  desiredPosition: '',
  preferredLocation: '',
  employmentType: '',
  minSalary: null as number | null
})

const automation = reactive({
  triggerType: 'manual',
  scheduledTime: '09:00'
})

async function saveProfile() {
  try {
    // TODO: Call PUT /api/profile with profile data
    console.log('Saving profile:', profile)
  } catch (error) {
    console.error('Failed to save profile:', error)
  }
}

async function saveTargeting() {
  try {
    // TODO: Call PUT /api/profile with targeting data
    console.log('Saving targeting:', targeting)
  } catch (error) {
    console.error('Failed to save targeting:', error)
  }
}

async function saveAutomation() {
  try {
    // TODO: Call PUT /api/profile with automation data
    console.log('Saving automation:', automation)
  } catch (error) {
    console.error('Failed to save automation:', error)
  }
}

async function connectLinkedin() {
  // TODO: Navigate to LinkedIn auth modal/page
  console.log('Connecting LinkedIn...')
}

onMounted(async () => {
  // TODO: Fetch current profile settings from /api/profile
})
</script>
