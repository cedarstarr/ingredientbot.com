import { Suspense } from 'react'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata = { title: 'Sign Up — IngredientBot' }

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
