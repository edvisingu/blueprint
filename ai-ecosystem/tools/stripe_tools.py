# Tool 6 — Stripe Revenue, hermes-finance (Masterbuild §23.6)
import os
from datetime import datetime, timedelta


def _stripe():
    import stripe

    stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
    return stripe


def get_mrr() -> dict:
    stripe = _stripe()
    subs = stripe.Subscription.list(status="active", limit=100)
    mrr = (
        sum(
            s["items"]["data"][0]["price"]["unit_amount"] * s["items"]["data"][0]["quantity"]
            for s in subs["data"]
        )
        / 100
    )
    return {"mrr": mrr, "active_subscriptions": len(subs["data"])}


def get_recent_revenue(days: int = 30) -> dict:
    stripe = _stripe()
    since = int((datetime.now() - timedelta(days=days)).timestamp())
    charges = stripe.Charge.list(created={"gte": since}, limit=100)
    total = sum(c["amount"] for c in charges["data"] if c["paid"]) / 100
    return {"total_revenue": total, "transactions": len(charges["data"]), "days": days}
