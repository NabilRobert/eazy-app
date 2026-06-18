<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow">
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold tracking-tight text-gray-900">Thought Process</h1>
            <p class="text-sm text-gray-500 mt-1">Why Eazy applied, skipped, or flagged each job — and how it decided.</p>
          </div>
          <NuxtLink to="/dashboard" class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200">
            Back to Dashboard
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <!-- Filter chips -->
      <div class="flex gap-2 mb-4">
        <button
          v-for="f in filters"
          :key="f.value"
          @click="setFilter(f.value)"
          :class="[
            'px-3 py-1.5 rounded-full text-sm font-medium',
            activeFilter === f.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          ]"
        >
          {{ f.label }}
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: decision list -->
        <div class="lg:col-span-1">
          <div class="rounded-lg bg-white shadow p-4 space-y-2">
            <div v-if="loading" class="text-center py-8 text-gray-500">Loading…</div>
            <div v-else-if="!decisions.length" class="text-center py-8 text-gray-500">
              No decisions yet. They appear here once Eazy evaluates jobs.
            </div>
            <div
              v-for="d in decisions"
              :key="d.id"
              @click="selected = d"
              :class="[
                'p-3 border-l-4 cursor-pointer rounded hover:bg-gray-50',
                selected && selected.id === d.id ? 'bg-gray-50' : '',
                borderClass(d.decision)
              ]"
            >
              <div class="flex justify-between items-start gap-2">
                <h3 class="font-medium text-sm leading-snug">{{ d.jobTitle || 'Untitled role' }}</h3>
                <span :class="['text-xs px-2 py-0.5 rounded-full whitespace-nowrap', badgeClass(d.decision)]">
                  {{ d.decision }}
                </span>
              </div>
              <p class="text-xs text-gray-600">{{ d.company }}</p>
              <div class="flex items-center gap-2 mt-1.5">
                <div class="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden">
                  <div class="h-full bg-gray-700" :style="{ width: scorePct(d.score) }"></div>
                </div>
                <span class="text-xs text-gray-500 w-8 text-right">{{ scorePct(d.score) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: full reasoning -->
        <div class="lg:col-span-2">
          <div v-if="selected" class="rounded-lg bg-white shadow p-6">
            <div class="flex justify-between items-start gap-4 mb-1">
              <h2 class="text-2xl font-bold">{{ selected.jobTitle || 'Untitled role' }}</h2>
              <span :class="['text-sm px-3 py-1 rounded-full whitespace-nowrap', badgeClass(selected.decision)]">
                {{ selected.decision }} · {{ scorePct(selected.score) }}
              </span>
            </div>
            <p class="text-gray-600 mb-1">{{ selected.company }}</p>
            <a v-if="selected.jobUrl" :href="selected.jobUrl" target="_blank"
               class="text-sm text-blue-600 hover:underline">View posting ↗</a>

            <!-- Rationale -->
            <div class="mt-6">
              <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Rationale</h3>
              <p class="text-gray-800 leading-relaxed">{{ selected.rationale || '—' }}</p>
            </div>

            <!-- Criteria breakdown -->
            <div class="mt-6">
              <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">How it judged the fit</h3>
              <div v-if="criteriaOf(selected).length" class="space-y-2">
                <div
                  v-for="(c, i) in criteriaOf(selected)"
                  :key="i"
                  class="flex items-start gap-3 p-3 rounded border border-gray-100"
                >
                  <span :class="['mt-0.5 text-xs px-2 py-0.5 rounded-full whitespace-nowrap', verdictClass(c.verdict)]">
                    {{ c.verdict }}
                  </span>
                  <div class="flex-1">
                    <div class="flex justify-between">
                      <span class="font-medium text-sm">{{ c.name }}</span>
                      <span class="text-xs text-gray-400">weight {{ Math.round((c.weight || 0) * 100) }}%</span>
                    </div>
                    <p class="text-sm text-gray-600">{{ c.note }}</p>
                  </div>
                </div>
              </div>
              <p v-else class="text-sm text-gray-500">No per-criterion breakdown recorded.</p>
            </div>

            <!-- Meta -->
            <div class="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 flex gap-4 flex-wrap">
              <span>Model: {{ selected.model || '—' }}</span>
              <span>Version: {{ selected.promptVersion || '—' }}</span>
              <span>{{ formatDate(selected.createdAt) }}</span>
            </div>
          </div>

          <div v-else class="rounded-lg bg-white shadow p-6 text-center text-gray-500">
            Select a decision to see the full reasoning.
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const {
  filters,
  decisions,
  selected,
  activeFilter,
  loading,
  setFilter,
  criteriaOf,
  scorePct,
  borderClass,
  badgeClass,
  verdictClass,
  formatDate
} = useDecisions()
</script>
