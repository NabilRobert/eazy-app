import type { ProfileForm, TargetingForm, AutomationForm, LinkedinFlow, LinkedinStatus } from '~/types/settings'

/**
 * Settings logic: load/save profile, targeting, automation settings, and the
 * LinkedIn connect (+ 2FA) flow. Page stays presentational.
 */
export function useSettings() {
  const toast = ref('')
  function flash(msg: string) {
    toast.value = msg
    setTimeout(() => (toast.value = ''), 2500)
  }

  const profile = reactive<ProfileForm>({
    fullName: '',
    phone: '',
    location: '',
    yearsExperience: null,
    education: ''
  })
  const targeting = reactive<TargetingForm>({
    desiredPosition: '',
    preferredLocation: '',
    employmentType: '',
    minSalary: null
  })
  const automation = reactive<AutomationForm>({
    triggerType: 'manual',
    scheduledTime: '09:00'
  })

  // --- Resume upload ---
  const resumeUploaded = ref(false)
  const resumeUploading = ref(false)
  async function uploadResume(file: File | null | undefined) {
    if (!file) return
    if (file.type && !file.type.includes('pdf')) {
      flash('Resume must be a PDF')
      return
    }
    resumeUploading.value = true
    try {
      const fd = new FormData()
      fd.append('resume', file)
      await $fetch('/api/profile/resume', { method: 'POST', body: fd })
      resumeUploaded.value = true
      flash('Resume uploaded')
    } catch (err: any) {
      flash(err.data?.statusMessage || 'Failed to upload resume')
    } finally {
      resumeUploading.value = false
    }
  }
  function onResumeChange(e: Event) {
    const input = e.target as HTMLInputElement
    uploadResume(input.files?.[0])
  }

  const linkedinStatus = ref<LinkedinStatus>('expired')
  const linkedinDot = computed(() =>
    linkedinStatus.value === 'authenticated'
      ? 'bg-green-500'
      : linkedinStatus.value === 'pending_2fa'
        ? 'bg-yellow-400'
        : 'bg-red-500'
  )
  const linkedinStatusText = computed(() =>
    linkedinStatus.value === 'authenticated'
      ? 'Connected'
      : linkedinStatus.value === 'pending_2fa'
        ? 'Awaiting verification'
        : 'Not connected'
  )

  async function putProfile(body: Record<string, any>, label: string) {
    try {
      await $fetch('/api/profile', { method: 'PUT', body })
      flash(`${label} saved`)
    } catch (err: any) {
      flash(err.data?.statusMessage || `Failed to save ${label.toLowerCase()}`)
    }
  }
  const saveProfile = () => putProfile({ ...profile }, 'Profile')
  const saveTargeting = () => putProfile({ ...targeting }, 'Targeting')
  const saveAutomation = () =>
    putProfile(
      {
        triggerType: automation.triggerType,
        scheduledTime: automation.triggerType === 'scheduled' ? automation.scheduledTime : null
      },
      'Automation settings'
    )

  // --- LinkedIn connect flow ---
  const li = reactive<LinkedinFlow>({
    open: false,
    step: 'creds',
    email: '',
    password: '',
    code: '',
    loading: false,
    error: ''
  })

  function openLinkedin() {
    Object.assign(li, { open: true, step: 'creds', password: '', code: '', error: '' })
  }

  async function submitCreds() {
    li.loading = true
    li.error = ''
    try {
      const res = await $fetch<{ status: string; message?: string }>('/api/automation/linkedin-auth', {
        method: 'POST',
        body: { email: li.email, password: li.password }
      })
      li.password = ''
      if (res.status === 'pending_2fa') {
        li.step = '2fa'
        linkedinStatus.value = 'pending_2fa'
      } else if (res.status === 'authenticated') {
        linkedinStatus.value = 'authenticated'
        li.open = false
        flash('LinkedIn connected')
      } else {
        li.error = res.message || 'Could not connect'
      }
    } catch (err: any) {
      li.error = err.data?.statusMessage || 'Could not connect'
    } finally {
      li.loading = false
    }
  }

  async function submitCode() {
    li.loading = true
    li.error = ''
    try {
      const res = await $fetch<{ status: string; message?: string }>('/api/automation/linkedin-auth/verify', {
        method: 'POST',
        body: { code: li.code }
      })
      if (res.status === 'authenticated') {
        linkedinStatus.value = 'authenticated'
        li.open = false
        flash('LinkedIn connected')
      } else {
        li.error = res.message || 'Verification failed'
      }
    } catch (err: any) {
      li.error = err.data?.statusMessage || 'Verification failed'
    } finally {
      li.loading = false
    }
  }

  onMounted(async () => {
    try {
      const res = await $fetch<{ success: boolean; data: any }>('/api/profile')
      const p = res.data
      if (p) {
        profile.fullName = p.fullName ?? ''
        profile.phone = p.phone ?? ''
        profile.location = p.location ?? ''
        profile.yearsExperience = p.yearsExperience ?? null
        profile.education = p.education ?? ''
        targeting.desiredPosition = p.desiredPosition ?? ''
        targeting.preferredLocation = p.preferredLocation ?? ''
        targeting.employmentType = p.employmentType ?? ''
        targeting.minSalary = p.minSalary ?? null
        automation.triggerType = p.triggerType ?? 'manual'
        automation.scheduledTime = p.scheduledTime ?? '09:00'
        resumeUploaded.value = !!p.resumeUrl
        if (['authenticated', 'expired', 'pending_2fa'].includes(p.linkedinAuthStatus)) {
          linkedinStatus.value = p.linkedinAuthStatus
        }
      }
    } catch {
      // 404 (no profile yet) is fine — keep defaults.
    }
  })

  return {
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
  }
}
