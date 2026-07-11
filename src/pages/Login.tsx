import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { GraduationCap, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const { login, verifyMFA, isLoading, showMFA } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      if (!useAuthStore.getState().showMFA) {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      toast.error(errorMessage);
    }
  };

  const handleMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyMFA(mfaCode);
      navigate('/dashboard');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'MFA verification failed';
      toast.error(errorMessage);
    }
  };

  const quickLogin = (u: string, p: string) => {
    setEmail(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <GraduationCap className="w-9 h-9 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Workforce Europe</h1>
          <p className="text-sm text-muted-foreground mt-1">Recruitment Intelligence Platform</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border p-8">
          {!showMFA ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v === true)}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">Remember me</Label>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Sign In
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground">Quick Login</span></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Admin', u: 'deeban@workforce-europe.com', p: 'admin123' },
                  { label: 'Recruiter', u: 'lisa@workforce-europe.com', p: 'recruiter123' },
                  { label: 'Trainer', u: 'klaus@workforce-europe.com', p: 'trainer123' },
                  { label: 'Agency', u: 'rajesh@gts.com', p: 'agency123' },
                ].map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => quickLogin(q.u, q.p)}
                    className="text-xs px-2 py-1.5 rounded border hover:bg-accent transition-colors"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </form>
          ) : (
            <form onSubmit={handleMFA} className="space-y-5">
              <div className="text-center mb-4">
                <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
                <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mfa">Authentication Code</Label>
                <Input
                  id="mfa"
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  required
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Verify
              </Button>

              <button
                type="button"
                onClick={() => useAuthStore.getState().logout()}
                className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
              >
                Back to login
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          &copy; 2024 Workforce Europe. All rights reserved.
        </p>
      </div>
    </div>
  );
}
