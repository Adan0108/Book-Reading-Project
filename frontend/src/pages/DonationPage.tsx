import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCheckout } from "../features/membership/useCheckout";
import { decimalCents } from "../lib/money";
import { useApiResource } from "../lib/useApiResource";
import type { PublicAuthor } from "../features/catalog/types";

export default function DonationPage() {
  const { authorId } = useParams(),
    billing = useCheckout();
  const author = useApiResource<PublicAuthor>(`/authors/${authorId}/profile`);
  const [amount, setAmount] = useState("5.00"),
    [validation, setValidation] = useState("");
  return (
    <main className="min-h-screen bg-base-200 p-6">
      <div className="mx-auto max-w-xl space-y-6">
        <Link to={`/author/${authorId}`}>← Author profile</Link>
        <h1 className="text-3xl font-bold break-words">
          Support {author.data?.penName || "an author"}
        </h1>
        <p>
          A one-time donation does not grant membership access. Amounts are in
          USD.
        </p>
        <p>
          {billing.configuration?.mode === "fixture"
            ? "Payment test simulation. No real transaction."
            : "Sandbox payments only. Use provider test cards."}
        </p>
        {(validation || billing.error || author.error) && (
          <p role="alert" className="alert alert-error">
            {validation || billing.error || author.error}
          </p>
        )}
        <form
          className="card bg-base-100 p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const cents = decimalCents(amount);
              if (cents < 100 || cents > 100000)
                throw new Error("Choose an amount from $1.00 to $1,000.00.");
              setValidation("");
              void billing.checkout({
                kind: "DONATION",
                authorId: Number(authorId),
                amountCents: cents,
              });
            } catch (e) {
              setValidation(e instanceof Error ? e.message : "Invalid amount");
            }
          }}
        >
          <label className="block">
            Donation amount (USD)
            <input
              className="input input-bordered w-full mt-2"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <button
            className="btn btn-primary"
            disabled={
              billing.busy ||
              !billing.configuration?.configured ||
              author.loading ||
              !author.data
            }
          >
            {billing.busy
              ? "Opening checkout…"
              : billing.configuration?.configured
                ? "Continue to donation checkout"
                : "Donations unavailable"}
          </button>
        </form>
      </div>
    </main>
  );
}
