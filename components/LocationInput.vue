<template>
  <div class="relative">
    <input
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      autocomplete="off"
      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
      @input="onInput"
      @focus="open = true"
      @blur="onBlur"
    />
    <ul
      v-if="open && suggestions.length"
      class="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg"
    >
      <li
        v-for="s in suggestions"
        :key="s"
        class="px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
        @mousedown.prevent="select(s)"
      >
        {{ s }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const { suggestions, search, clear } = usePlaceSearch()
const open = ref(false)

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  emit('update:modelValue', v)
  open.value = true
  search(v)
}

function select(s: string) {
  emit('update:modelValue', s)
  open.value = false
  clear()
}

// Delay close so a click on a suggestion (mousedown) registers first.
function onBlur() {
  setTimeout(() => (open.value = false), 150)
}
</script>
