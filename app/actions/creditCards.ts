"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CreditCardActionResult {
  error?: string;
}

/**
 * Marks a card's bill as paid for the given period ("just UI" per the
 * product ask, but real/persisted like every other feature here - a demo
 * that resets on refresh would be worse, and the public-demo account is
 * meant to be shared/consistent across visitors). Deliberately writes only
 * to credit_card_payments, never to `transactions` - paying a bill isn't a
 * new expense, so it must never affect Total Spend/savings elsewhere.
 */
export async function payCreditCardBill(
  cardName: string,
  periodMonth: string,
  amountPaise: number
): Promise<CreditCardActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please log in again." };

    if (amountPaise <= 0) return { error: "Nothing due for this card." };

    const { error } = await supabase.from("credit_card_payments").upsert(
      {
        user_id: user.id,
        card_name: cardName,
        period_month: periodMonth,
        amount_paid: amountPaise,
        paid_at: new Date().toISOString(),
      },
      { onConflict: "user_id,card_name,period_month" }
    );
    if (error) {
      console.error("[payCreditCardBill] supabase error:", error.message);
      return { error: "Could not record this payment. Please try again." };
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error("[payCreditCardBill] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/cards");
  return {};
}

/** Undoes a "paid" marker - e.g. to correct a mis-tap, not a real refund flow. */
export async function undoCreditCardPayment(
  cardName: string,
  periodMonth: string
): Promise<CreditCardActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please log in again." };

    const { error } = await supabase
      .from("credit_card_payments")
      .delete()
      .eq("user_id", user.id)
      .eq("card_name", cardName)
      .eq("period_month", periodMonth);
    if (error) {
      console.error("[undoCreditCardPayment] supabase error:", error.message);
      return { error: "Could not undo this payment. Please try again." };
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error("[undoCreditCardPayment] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/cards");
  return {};
}
