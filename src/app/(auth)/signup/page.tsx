import { Suspense } from 'react'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata = { title: 'Sign Up — Robot Food' }

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
