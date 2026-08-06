import { useEffect, useState } from "react";
import { useAuth } from "@workos-inc/authkit-react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Id } from "../../convex/_generated/dataModel";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { signOut, user } = useAuth();
  const admins = useQuery(api.users.listAdmins);
  const invites = useQuery(api.users.listInvites);
  const billingRules = useQuery(api.billing.list);
  const cities = useQuery(api.cities.list, { includeInactive: true });
  const serviceRates = useQuery(api.expenses.getServiceRates);
  const inviteAdmin = useMutation(api.users.inviteAdmin);
  const revokeInvite = useMutation(api.users.revokeInvite);
  const setServiceRates = useMutation(api.expenses.setServiceRates);
  const createBillingVersion = useMutation(api.billing.createVersion);
  const seedBilling = useMutation(api.billing.seedIfEmpty);
  const createCity = useMutation(api.cities.create);
  const addCityRates = useMutation(api.cities.addRateVersion);
  const setCityActive = useMutation(api.cities.setActive);

  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [carRate, setCarRate] = useState("");
  const [parkingRate, setParkingRate] = useState("");
  const [ratesMsg, setRatesMsg] = useState<string | null>(null);

  const [ruleFrom, setRuleFrom] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [minHours, setMinHours] = useState("8");
  const [band8, setBand8] = useState("100");
  const [band10, setBand10] = useState("125");
  const [band11, setBand11] = useState("150");
  const [satMult, setSatMult] = useState("200");
  const [billingMsg, setBillingMsg] = useState<string | null>(null);

  const [cityName, setCityName] = useState("");
  const [cityFrom, setCityFrom] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [cityCar, setCityCar] = useState("0");
  const [cityCommute, setCityCommute] = useState("0");
  const [cityMsg, setCityMsg] = useState<string | null>(null);
  const [rateCityId, setRateCityId] = useState("");

  useEffect(() => {
    if (!serviceRates) return;
    setCarRate(String(serviceRates.carHourlyRate ?? 0));
    setParkingRate(String(serviceRates.parkingRate ?? 0));
  }, [serviceRates]);

  useEffect(() => {
    void seedBilling({});
  }, [seedBilling]);

  useEffect(() => {
    const current = billingRules?.[0];
    if (!current) return;
    setMinHours(String(current.minBillableHours));
    setSatMult(String(current.saturdayMultiplier * 100));
    const b8 = current.bands.find((b) => b.upToHours === 8);
    const b10 = current.bands.find((b) => b.upToHours === 10);
    const bRest = current.bands.find((b) => b.upToHours == null);
    if (b8) setBand8(String(b8.multiplier * 100));
    if (b10) setBand10(String(b10.multiplier * 100));
    if (bRest) setBand11(String(bRest.multiplier * 100));
  }, [billingRules]);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await inviteAdmin({ email: email.trim() });
      setEmail("");
      setMsg("ok");
    } catch {
      setMsg("error");
    }
  }

  async function onSaveRates(e: React.FormEvent) {
    e.preventDefault();
    setRatesMsg(null);
    try {
      await setServiceRates({
        carHourlyRate: Number(carRate) || 0,
        parkingRate: Number(parkingRate) || 0,
      });
      setRatesMsg("ok");
    } catch {
      setRatesMsg("error");
    }
  }

  async function onSaveBilling(e: React.FormEvent) {
    e.preventDefault();
    setBillingMsg(null);
    try {
      await createBillingVersion({
        effectiveFrom: ruleFrom,
        minBillableHours: Number(minHours) || 8,
        saturdayMultiplier: (Number(satMult) || 200) / 100,
        bands: [
          { upToHours: 8, multiplier: (Number(band8) || 100) / 100 },
          { upToHours: 10, multiplier: (Number(band10) || 125) / 100 },
          { upToHours: null, multiplier: (Number(band11) || 150) / 100 },
        ],
      });
      setBillingMsg("ok");
    } catch {
      setBillingMsg("error");
    }
  }

  async function onCreateCity(e: React.FormEvent) {
    e.preventDefault();
    setCityMsg(null);
    try {
      await createCity({
        name: cityName.trim(),
        effectiveFrom: cityFrom,
        carRate: Number(cityCar) || 0,
        commuteRate: Number(cityCommute) || 0,
      });
      setCityName("");
      setCityMsg("ok");
    } catch {
      setCityMsg("error");
    }
  }

  async function onAddCityRates(e: React.FormEvent) {
    e.preventDefault();
    if (!rateCityId) return;
    setCityMsg(null);
    try {
      await addCityRates({
        cityId: rateCityId as Id<"cities">,
        effectiveFrom: cityFrom,
        carRate: Number(cityCar) || 0,
        commuteRate: Number(cityCommute) || 0,
      });
      setCityMsg("ok");
    } catch {
      setCityMsg("error");
    }
  }

  return (
    <div className="w-full max-w-3xl space-y-4">
      <h2 className="text-xl font-bold md:text-2xl">{t("settings.title")}</h2>

      <Card className="space-y-3">
        <Label>{t("settings.language")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={i18n.language === "he" ? "default" : "secondary"}
            onClick={() => void i18n.changeLanguage("he")}
          >
            {t("settings.hebrew")}
          </Button>
          <Button
            type="button"
            variant={i18n.language === "en" ? "default" : "secondary"}
            onClick={() => void i18n.changeLanguage("en")}
          >
            {t("settings.english")}
          </Button>
        </div>
        <p className="text-xs text-muted">{user?.email}</p>
        <Button variant="secondary" onClick={() => void signOut()}>
          {t("auth.signOut")}
        </Button>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">{t("settings.billingRules")}</h3>
        <p className="text-sm text-muted">{t("settings.billingRulesHint")}</p>
        <form onSubmit={onSaveBilling} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("settings.effectiveFrom")}</Label>
            <Input
              type="date"
              required
              value={ruleFrom}
              onChange={(e) => setRuleFrom(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("settings.minHours")}</Label>
            <Input
              type="number"
              min="1"
              step="0.5"
              value={minHours}
              onChange={(e) => setMinHours(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("settings.band8")}</Label>
            <Input
              type="number"
              min="0"
              value={band8}
              onChange={(e) => setBand8(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("settings.band10")}</Label>
            <Input
              type="number"
              min="0"
              value={band10}
              onChange={(e) => setBand10(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("settings.band11")}</Label>
            <Input
              type="number"
              min="0"
              value={band11}
              onChange={(e) => setBand11(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("settings.saturdayPct")}</Label>
            <Input
              type="number"
              min="0"
              value={satMult}
              onChange={(e) => setSatMult(e.target.value)}
            />
          </div>
          <Button type="submit" className="sm:col-span-2">
            {t("settings.saveBillingVersion")}
          </Button>
        </form>
        {billingMsg === "ok" && (
          <p className="text-xs text-brand">{t("entries.saved")}</p>
        )}
        {billingMsg === "error" && (
          <p className="text-xs text-red-700">{t("common.error")}</p>
        )}
        <ul className="space-y-1 text-sm text-zinc-700">
          {(billingRules ?? []).map((r) => (
            <li key={r._id}>
              {r.effectiveFrom}: min {r.minBillableHours}h · Sat ×
              {r.saturdayMultiplier} ·{" "}
              {r.bands
                .map(
                  (b) =>
                    `${b.upToHours ?? "∞"}@${Math.round(b.multiplier * 100)}%`,
                )
                .join(", ")}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">{t("settings.cities")}</h3>
        <p className="text-sm text-muted">{t("settings.citiesHint")}</p>
        <form onSubmit={onCreateCity} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>{t("settings.cityName")}</Label>
            <Input
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>{t("settings.effectiveFrom")}</Label>
            <Input
              type="date"
              required
              value={cityFrom}
              onChange={(e) => setCityFrom(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("settings.cityCarRate")}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={cityCar}
              onChange={(e) => setCityCar(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("settings.cityCommuteRate")}</Label>
            <Input
              type="number"
              min="0"
              step="0.25"
              value={cityCommute}
              onChange={(e) => setCityCommute(e.target.value)}
            />
          </div>
          <Button type="submit" className="sm:col-span-2">
            {t("settings.addCity")}
          </Button>
        </form>

        <form onSubmit={onAddCityRates} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>{t("settings.updateCityRates")}</Label>
            <select
              className="flex h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
              value={rateCityId}
              onChange={(e) => setRateCityId(e.target.value)}
            >
              <option value="">—</option>
              {(cities ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary" className="sm:col-span-2">
            {t("settings.saveCityVersion")}
          </Button>
        </form>
        {cityMsg === "ok" && (
          <p className="text-xs text-brand">{t("entries.saved")}</p>
        )}
        {cityMsg === "error" && (
          <p className="text-xs text-red-700">{t("common.error")}</p>
        )}
        <ul className="space-y-2 text-sm">
          {(cities ?? []).map((c) => (
            <li
              key={c._id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted">
                  {t("settings.cityCarRate")}: {c.currentRates?.carRate ?? "—"}{" "}
                  · {t("settings.cityCommuteRate")}:{" "}
                  {c.currentRates?.commuteRate ?? "—"}h
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void setCityActive({
                    id: c._id as Id<"cities">,
                    active: !c.active,
                  })
                }
              >
                {c.active ? "Off" : "On"}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">{t("settings.serviceRates")}</h3>
        <p className="text-xs text-muted">{t("settings.serviceRatesHint")}</p>
        <form onSubmit={onSaveRates} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("settings.carHourlyRate")}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={carRate}
              onChange={(e) => setCarRate(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("settings.parkingRate")}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={parkingRate}
              onChange={(e) => setParkingRate(e.target.value)}
            />
          </div>
          <Button type="submit" className="sm:col-span-2">
            {t("settings.saveRates")}
          </Button>
        </form>
        {ratesMsg === "ok" && (
          <p className="text-xs text-brand">{t("entries.saved")}</p>
        )}
        {ratesMsg === "error" && (
          <p className="text-xs text-red-700">{t("common.error")}</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">{t("settings.invite")}</h3>
        <form onSubmit={onInvite} className="flex gap-2">
          <Input
            type="email"
            required
            placeholder={t("settings.inviteEmail")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit">{t("settings.sendInvite")}</Button>
        </form>
        {msg === "ok" && (
          <p className="text-xs text-brand">{t("entries.saved")}</p>
        )}
        {msg === "error" && (
          <p className="text-xs text-red-700">{t("common.error")}</p>
        )}
        <div>
          <p className="mb-1 text-sm font-medium">
            {t("settings.pendingInvites")}
          </p>
          <ul className="space-y-1 text-sm">
            {(invites ?? [])
              .filter((i) => i.status === "pending")
              .map((i) => (
                <li
                  key={i._id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{i.email}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void revokeInvite({ inviteId: i._id as Id<"invites"> })
                    }
                  >
                    ×
                  </Button>
                </li>
              ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">{t("settings.admins")}</p>
          <ul className="space-y-1 text-sm text-zinc-700">
            {(admins ?? []).map((a) => (
              <li key={a._id}>
                {a.email}
                {a.name ? ` (${a.name})` : ""}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
