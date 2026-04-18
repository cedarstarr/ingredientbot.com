'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useRouter } from 'next/navigation'

export function SettingsClient() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameMsg, setNameMsg] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')

  const [notifyMarketing, setNotifyMarketing] = useState(true)
  const [notifyProduct, setNotifyProduct] = useState(true)
  const [notifLoading, setNotifLoading] = useState(false)

  const [deletePassword, setDeletePassword] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [signOutAllLoading, setSignOutAllLoading] = useState(false)

  useEffect(() => {
    fetch('/api/user/notifications')
      .then(r => r.json())
      .then(d => {
        if (d) {
          setNotifyMarketing(d.notifyMarketing ?? true)
          setNotifyProduct(d.notifyProduct ?? true)
        }
      })
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => { if (d?.name) setName(d.name) })
  }, [])

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameLoading(true)
    setNameMsg('')
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setNameMsg(res.ok ? 'Name updated!' : 'Failed to update name.')
    setNameLoading(false)
    if (res.ok) router.refresh()
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMsg('')
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg('Passwords do not match')
      return
    }
    setPasswordLoading(true)
    const res = await fetch('/api/user/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    setPasswordMsg(res.ok ? 'Password updated!' : (data.error || 'Failed to update password.'))
    setPasswordLoading(false)
    if (res.ok) { setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('') }
  }

  const handleNotifSave = async () => {
    setNotifLoading(true)
    await fetch('/api/user/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifyMarketing, notifyProduct }),
    })
    setNotifLoading(false)
  }

  const handleSignOutAll = async () => {
    setSignOutAllLoading(true)
    await fetch('/api/auth/signout-all', { method: 'POST' })
    setSignOutAllLoading(false)
    signOut({ callbackUrl: '/login' })
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    const res = await fetch('/api/user/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: deletePassword }),
    })
    if (res.ok) {
      signOut({ callbackUrl: '/login' })
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to delete account')
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">Profile</h2>
        <form onSubmit={handleNameSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          </div>
          {nameMsg && <p className={`text-sm ${nameMsg.includes('!') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{nameMsg}</p>}
          <Button type="submit" disabled={nameLoading} size="sm">
            {nameLoading ? 'Saving...' : 'Save Name'}
          </Button>
        </form>
      </div>

      {/* Password */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input id="currentPassword" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
            <Input id="confirmNewPassword" type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required />
          </div>
          {passwordMsg && <p className={`text-sm ${passwordMsg.includes('!') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{passwordMsg}</p>}
          <Button type="submit" disabled={passwordLoading} size="sm">
            {passwordLoading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </div>

      {/* Notifications */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">Email Notifications</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="notifyMarketing"
              checked={notifyMarketing}
              onCheckedChange={(checked) => setNotifyMarketing(checked === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="notifyMarketing" className="text-sm font-medium text-foreground cursor-pointer">Marketing emails</Label>
              <p className="text-xs text-muted-foreground">Tips, updates, and new features</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="notifyProduct"
              checked={notifyProduct}
              onCheckedChange={(checked) => setNotifyProduct(checked === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="notifyProduct" className="text-sm font-medium text-foreground cursor-pointer">Product emails</Label>
              <p className="text-xs text-muted-foreground">Recipe suggestions and cooking tips</p>
            </div>
          </div>
        </div>
        <Button size="sm" className="mt-4" onClick={handleNotifSave} disabled={notifLoading}>
          {notifLoading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>

      {/* Sign out all devices */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-2">Sessions</h2>
        <p className="text-sm text-muted-foreground mb-4">Sign out from all devices and browsers.</p>
        <Button variant="outline" size="sm" onClick={handleSignOutAll} disabled={signOutAllLoading}>
          {signOutAllLoading ? 'Signing out...' : 'Sign Out All Devices'}
        </Button>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-destructive/40 bg-card p-5">
        <h2 className="text-base font-semibold text-destructive mb-2">Danger Zone</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete your account and all saved recipes. This cannot be undone.
        </p>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">Delete Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
              <DialogDescription>
                This will permanently delete your account and all saved recipes. Enter your password to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 py-2">
              <Label htmlFor="deletePassword">Password</Label>
              <Input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Your current password"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteLoading || !deletePassword}>
                {deleteLoading ? 'Deleting...' : 'Delete My Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
