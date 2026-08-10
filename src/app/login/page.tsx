import { Suspense } from 'react';

import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in | CRE Property Tour' };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">CRE Property Tour</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Broker sign-in. Clients don&apos;t need an account &mdash; they just open the
          tour link you send them.
        </p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
