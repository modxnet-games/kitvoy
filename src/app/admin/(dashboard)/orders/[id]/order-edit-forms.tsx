"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { isRedirectError } from "@/components/admin/order-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrderDetailsInput } from "@/lib/data/admin-orders";
import { CITIES } from "@/lib/morocco";
import { updateOrderDetailsAction, type SavedOrderDetails } from "./actions";

const TEXTAREA =
  "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm";

/** Saves some of an order's details and says how it went. */
function useOrderSave(orderId: string) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = (details: OrderDetailsInput, onSaved: (stored: SavedOrderDetails) => void) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await updateOrderDetailsAction(orderId, details);
        if (result.error || !result.saved) {
          setError(result.error ?? "Not saved. Please try again.");
          return;
        }
        // What was stored can differ from what was typed (spaces trimmed, the phone as 06…)
        onSaved(result.saved);
        setSaved(true);
      } catch (err) {
        if (!isRedirectError(err)) setError("Not saved. Check your connection and try again.");
      }
    });
  };

  return { isPending, error, saved, save, edited: () => setSaved(false) };
}

function SaveRow({ isPending, saved, error, label }: { isPending: boolean; saved: boolean; error: string | null; label: string }) {
  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} className="h-10 px-4">
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {label}
        </Button>
        {saved && !isPending && (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-700" role="status">
            <Check className="size-4" aria-hidden />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

interface CustomerFormProps {
  orderId: string;
  customerName: string;
  phone: string;
  city: string;
  address: string;
}

/** The customer's name, phone, city and address, to correct after the call. */
export function OrderCustomerForm({ orderId, ...initial }: CustomerFormProps) {
  const [values, setValues] = useState(initial);
  const { isPending, error, saved, save, edited } = useOrderSave(orderId);

  const set = (field: keyof typeof initial) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    edited();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save(values, (stored) => setValues({ customerName: stored.customerName, phone: stored.phone, city: stored.city, address: stored.address }));
      }}
      className="space-y-3"
    >
      <div>
        <label htmlFor="order-name" className="mb-1.5 block text-sm font-medium">
          Name
        </label>
        <Input id="order-name" value={values.customerName} onChange={set("customerName")} maxLength={80} required autoComplete="off" dir="auto" className="h-10" />
      </div>
      <div>
        <label htmlFor="order-phone" className="mb-1.5 block text-sm font-medium">
          Phone
        </label>
        <Input
          id="order-phone"
          type="tel"
          inputMode="tel"
          value={values.phone}
          onChange={set("phone")}
          maxLength={30}
          required
          autoComplete="off"
          placeholder="0612345678"
          className="h-10 font-mono"
        />
      </div>
      <div>
        <label htmlFor="order-city" className="mb-1.5 block text-sm font-medium">
          City
        </label>
        <Input id="order-city" list="order-cities" value={values.city} onChange={set("city")} maxLength={60} required autoComplete="off" dir="auto" className="h-10" />
        <datalist id="order-cities">
          {CITIES.map((city) => (
            <option key={city.fr} value={city.fr} />
          ))}
        </datalist>
      </div>
      <div>
        <label htmlFor="order-address" className="mb-1.5 block text-sm font-medium">
          Address
        </label>
        <textarea id="order-address" value={values.address} onChange={set("address")} maxLength={200} required rows={2} dir="auto" className={TEXTAREA} />
      </div>
      <SaveRow isPending={isPending} saved={saved} error={error} label="Save customer" />
    </form>
  );
}

interface NotesFormProps {
  orderId: string;
  adminNote: string;
  trackingNumber: string;
}

/** The owner's own note on the order, and the courier's tracking number when there is one. */
export function OrderNotesForm({ orderId, ...initial }: NotesFormProps) {
  const [values, setValues] = useState(initial);
  const { isPending, error, saved, save, edited } = useOrderSave(orderId);

  const set = (field: keyof typeof initial) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    edited();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save(values, (stored) => setValues({ adminNote: stored.adminNote, trackingNumber: stored.trackingNumber }));
      }}
      className="space-y-3"
    >
      <div>
        <label htmlFor="order-note" className="mb-1.5 block text-sm font-medium">
          Internal note
        </label>
        <textarea
          id="order-note"
          value={values.adminNote}
          onChange={set("adminNote")}
          maxLength={1000}
          rows={3}
          dir="auto"
          placeholder="What the customer said, when to call back, a remark for the courier…"
          className={TEXTAREA}
        />
        <p className="mt-1 text-xs text-muted-foreground">Only you see this note. It is not printed on the delivery slip.</p>
      </div>
      <div>
        <label htmlFor="order-tracking" className="mb-1.5 block text-sm font-medium">
          Tracking number <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="order-tracking"
          value={values.trackingNumber}
          onChange={set("trackingNumber")}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          placeholder="If the courier gives one"
          className="h-10 font-mono"
        />
      </div>
      <SaveRow isPending={isPending} saved={saved} error={error} label="Save note" />
    </form>
  );
}
