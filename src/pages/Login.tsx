import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const { sendMagicLink, isLoading, isAuthenticated } = useAuthStore();

  // If session hydrates while sitting on /login (e.g. after clicking magic link), go to dashboard.
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendMagicLink(email.trim());
      setSent(true);
      toast.success('Magic link sent — check your email');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send magic link';
      toast.error(msg);
    }
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
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Check your email</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>.
                  Click it to continue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSent(false); setEmail(''); }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@workforce-europe.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  We'll email you a one-time sign-in link — no password needed.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !email}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Send magic link
              </Button>
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
