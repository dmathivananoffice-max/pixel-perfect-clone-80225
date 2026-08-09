import { useState } from "react";

export type ContactValues = {
  name: string;
  phone: string;
  city: string;
  email: string;
};

type Props = {
  busy?: boolean;
  error?: string | null;
  onSubmit: (values: ContactValues) => void;
  onSkip: () => void;
};

export function ContactScreen({ busy, error, onSubmit, onSkip }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div className="diag__shell diag__fade-in">
      <p className="diag__brand">Workforce Europe</p>
      <h1 className="diag__title">
        Get this plan on WhatsApp + speak to an advisor
      </h1>
      <p className="diag__muted">
        Your results stay on this screen if you skip. We only use your number to
        send the plan and connect you with counselling.
      </p>

      <form
        style={{ marginTop: "1.25rem" }}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, phone, city, email });
        }}
      >
        <div className="diag__field">
          <label htmlFor="diag-name">Name</label>
          <input
            id="diag-name"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="diag__field">
          <label htmlFor="diag-phone">WhatsApp number</label>
          <input
            id="diag-phone"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="+91…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="diag__field">
          <label htmlFor="diag-city">City</label>
          <input
            id="diag-city"
            name="city"
            autoComplete="address-level2"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="diag__field">
          <label htmlFor="diag-email">Email (optional)</label>
          <input
            id="diag-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error ? <p className="diag__error">{error}</p> : null}

        <div className="diag__nav">
          <button
            type="button"
            className="diag__btn diag__btn--ghost"
            onClick={onSkip}
            disabled={busy}
          >
            Skip for now
          </button>
          <button
            type="submit"
            className="diag__btn diag__btn--primary"
            disabled={busy}
          >
            {busy ? "Sending…" : "Send my plan"}
          </button>
        </div>
      </form>
    </div>
  );
}
