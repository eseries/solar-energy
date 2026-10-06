"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { endpoints, onboardingApi } from "../../../../src/lib/api";
import type { Customer } from "../../../../src/lib/types";
import {
  Button,
  ErrorMessage,
  Field,
  PageTitle,
} from "../../../../src/components/ui";
export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    billingMode: "POSTPAID",
    status: "ACTIVE",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [meterForm, setMeterForm] = useState({
    meterNumber: "",
    meterType: "MANUAL",
    installedAt: "",
  });
  const load = () =>
    onboardingApi
      .get(id)
      .then((x) => {
        setC(x);
        setForm({
          name: x.name,
          email: x.email ?? "",
          phone: x.phone ?? "",
          address: x.address ?? "",
          billingMode: x.billingMode,
          status: x.status,
        });
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [id]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await endpoints.updateCustomer(id, form);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update customer");
    }
  }
  async function linkUser(userId: string) {
    setBusy(true);
    try {
      await onboardingApi.associate(id, userId);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to link customer login",
      );
    } finally {
      setBusy(false);
    }
  }
  async function createMeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await endpoints.createMeter({
        meterNumber: meterForm.meterNumber,
        meterType: meterForm.meterType,
        customerId: id,
        installedAt: meterForm.installedAt,
      });
      setMeterForm({ meterNumber: "", meterType: "MANUAL", installedAt: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create meter");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title={c ? `Customer ${c.customerNumber}` : "Customer detail"}
      />
      <ErrorMessage message={error} />
      {c && (
        <>
          <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Customer</p>
            <h2 className="text-2xl font-bold">{c.name}</h2>
            <p>
              {c.customerNumber} · {c.email || "No email"} ·{" "}
              {c.phone || "No phone"} · {c.status} · {c.billingMode}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Status
                label="Login"
                value={c.user ? "✓ Linked" : "⚠ Not linked"}
                good={!!c.user}
              />
              <Status
                label="Meter"
                value={
                  c.meters?.length
                    ? `✓ ${c.meters.length} assigned`
                    : "⚠ Not assigned"
                }
                good={!!c.meters?.length}
              />
              <Status
                label="Reading"
                value={
                  c.meters?.some((m) => m.readings?.length)
                    ? "✓ Available"
                    : "○ Ready for first reading"
                }
                good={!!c.meters?.some((m) => m.readings?.length)}
              />
              <Status
                label="Billing"
                value={
                  c.bills?.length
                    ? `✓ ${c.bills[0].billNumber}`
                    : "○ No bill generated"
                }
                good={!!c.bills?.length}
              />
            </div>
          </div>
          <form
            onSubmit={save}
            className="grid max-w-2xl gap-4 rounded-xl bg-white p-6 shadow-sm"
          >
            <Field
              label="Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Field
              label="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <label className="text-sm font-medium">
              Billing mode
              <select
                className="mt-1 w-full rounded-lg border p-2"
                value={form.billingMode}
                onChange={(e) =>
                  setForm({ ...form, billingMode: e.target.value })
                }
              >
                <option>POSTPAID</option>
                <option>PREPAID</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Status
              <select
                className="mt-1 w-full rounded-lg border p-2"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option>ACTIVE</option>
                <option>SUSPENDED</option>
                <option>INACTIVE</option>
              </select>
            </label>
            <Button>Save changes</Button>
          </form>
          <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Customer login</h2>
            {c.user ? (
              <p className="mt-2 text-sm">
                ✓ {c.user.name} · {c.user.email} · {c.user.role} ·{" "}
                {c.user.isActive ? "Active" : "Inactive"}
              </p>
            ) : (
              <>
                <p className="mt-2 text-amber-700">
                  Warning: no customer login is linked.
                </p>
                {c.availableUsers?.map((u) => (
                  <div
                    className="mt-2 flex flex-wrap justify-between gap-2 rounded border p-3"
                    key={u.id}
                  >
                    <span>
                      {u.name} · {u.email} · {u.role}
                    </span>
                    <Button disabled={busy} onClick={() => linkUser(u.id)}>
                      Link this account
                    </Button>
                  </div>
                ))}
              </>
            )}
          </section>
          <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Meters</h2>
            {c.meters?.map((m) => (
              <Link
                className="mt-2 block rounded border p-3"
                href={`/dashboard/meters/${m.id}`}
                key={m.id}
              >
                {m.meterNumber} · {m.meterType} · {m.status}
                {m.readings?.[0] && (
                  <span className="block text-sm text-slate-500">
                    Latest: {m.readings[0].reading} on{" "}
                    {new Date(m.readings[0].readingAt).toLocaleDateString()}
                  </span>
                )}
              </Link>
            ))}
            <form
              onSubmit={createMeter}
              className="mt-4 grid gap-3 sm:grid-cols-4"
            >
              <Field
                label="Meter number"
                name="meterNumber"
                required
                value={meterForm.meterNumber}
                onChange={(e) =>
                  setMeterForm({ ...meterForm, meterNumber: e.target.value })
                }
              />
              <label className="text-sm font-medium">
                Type
                <select
                  name="meterType"
                  className="mt-1 w-full rounded-lg border p-2"
                  value={meterForm.meterType}
                  onChange={(e) =>
                    setMeterForm({ ...meterForm, meterType: e.target.value })
                  }
                >
                  <option>MANUAL</option>
                  <option>SMART</option>
                </select>
              </label>
              <Field
                label="Installed at"
                name="installedAt"
                type="date"
                required
                value={meterForm.installedAt}
                onChange={(e) =>
                  setMeterForm({ ...meterForm, installedAt: e.target.value })
                }
              />
              <Button disabled={busy}>Create and assign meter</Button>
            </form>
          </section>
          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Account balance</p>
              <p className="text-2xl font-bold">
                ₦{c.account?.balance?.toLocaleString() ?? "0.00"}
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Latest bill</p>
              <p>
                {c.bills?.[0]
                  ? `${c.bills[0].billNumber} · ₦${c.bills[0].amount.toLocaleString()} · ${c.bills[0].status}`
                  : "No bill generated yet"}
              </p>
            </div>
          </section>
        </>
      )}
    </>
  );
}
function Status({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={good ? "text-green-700" : "text-amber-700"}>{value}</p>
    </div>
  );
}
