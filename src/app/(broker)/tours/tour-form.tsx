'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import type { ActionState } from '@/lib/form';
import { buttonPrimary, buttonSecondary, errorText, hint, input, label } from '@/lib/ui';
import type { Client, Tour } from '@/lib/supabase/types';

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export function TourForm({
  action,
  tour,
  clients,
  submitLabel,
}: {
  action: Action;
  tour?: Tour;
  clients: Pick<Client, 'id' | 'name' | 'company'>[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [clientId, setClientId] = useState(tour?.client_id ?? '');
  const isNewClient = clientId === '__new__';

  return (
    <form action={formAction} className="space-y-6">
      {tour ? <input type="hidden" name="id" value={tour.id} /> : null}

      <div>
        <label htmlFor="title" className={label}>
          Tour name
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={tour?.title ?? ''}
          placeholder="Acme Logistics — Columbus West"
          className={input}
        />
      </div>

      <div>
        <label htmlFor="client_id" className={label}>
          Client
        </label>
        <select
          id="client_id"
          name={isNewClient ? 'client_picker' : 'client_id'}
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          className={input}
        >
          <option value="">No client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.company ? `${client.name} · ${client.company}` : client.name}
            </option>
          ))}
          {!tour ? <option value="__new__">＋ New client…</option> : null}
        </select>
      </div>

      {isNewClient ? (
        <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="new_client_name" className={label}>
              Contact name
            </label>
            <input id="new_client_name" name="new_client_name" required className={input} />
          </div>
          <div>
            <label htmlFor="new_client_company" className={label}>
              Company
            </label>
            <input id="new_client_company" name="new_client_company" className={input} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="tour_date" className={label}>
            Date
          </label>
          <input
            id="tour_date"
            name="tour_date"
            type="date"
            defaultValue={tour?.tour_date ?? ''}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="start_time" className={label}>
            Start time
          </label>
          <input
            id="start_time"
            name="start_time"
            type="time"
            defaultValue={tour?.start_time?.slice(0, 5) ?? ''}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="status" className={label}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={tour?.status ?? 'draft'}
            className={input}
          >
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="market" className={label}>
          Market
        </label>
        <input
          id="market"
          name="market"
          defaultValue={tour?.market ?? ''}
          placeholder="Columbus, OH"
          className={input}
        />
      </div>

      <div>
        <label htmlFor="requirement_summary" className={label}>
          Requirement
        </label>
        <textarea
          id="requirement_summary"
          name="requirement_summary"
          rows={2}
          defaultValue={tour?.requirement_summary ?? ''}
          placeholder="75,000–100,000 SF distribution, 28 ft clear minimum, Q1 occupancy."
          className={input}
        />
        <p className={hint}>Shown to the client on the tour.</p>
      </div>

      <div>
        <label htmlFor="notes" className={label}>
          Internal notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={tour?.notes ?? ''}
          className={`${input} border-amber-300 dark:border-amber-900/60`}
        />
        <p className={hint}>Never shown to the client.</p>
      </div>

      {state && 'error' in state ? <p className={errorText}>{state.error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        <Link href="/tours" className={buttonSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
